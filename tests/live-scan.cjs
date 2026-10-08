const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({
      serviceWorkers: 'block',
      viewport: { width: 390, height: 844 },
    });
    await page.route('http://localhost:8080/**', (route) => {
      const pathname = new URL(route.request().url()).pathname;
      const file = path.join(__dirname, '..', pathname === '/' ? 'index.html' : pathname);
      route.fulfill({
        body: fs.readFileSync(file),
        contentType: file.endsWith('.js')
          ? 'text/javascript'
          : file.endsWith('.css')
            ? 'text/css'
            : file.endsWith('.html')
              ? 'text/html'
              : 'application/octet-stream',
      });
    });
    await page.addInitScript(() => {
      window.cameraStopped = false;
      navigator.mediaDevices.getUserMedia = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#123b73';
        ctx.fillRect(0, 0, 640, 480);
        ctx.fillStyle = 'white';
        ctx.font = '32px Arial';
        ctx.fillText('BENCH PRESS 12', 80, 140);
        ctx.fillText('SQUAT 20', 80, 210);
        const stream = canvas.captureStream(5);
        window.testStream = stream;
        const track = stream.getVideoTracks()[0];
        const stop = track.stop.bind(track);
        track.stop = () => {
          window.cameraStopped = true;
          stop();
        };
        return stream;
      };
      let reads = 0;
      window.Tesseract = {
        createWorker: async () => ({
          recognize: async (canvas) => {
            if (!(canvas instanceof HTMLCanvasElement)) throw Error('Expected canvas');
            return {
              data: {
                text:
                  window.testOcrText ??
                  (++reads === 1
                    ? 'A EMOM 1:30\nBench Press 12\nSquat 20'
                    : 'Squat 20\nDeadlift 8'),
              },
            };
          },
          terminate: async () => {
            window.workerStopped = true;
          },
        }),
      };
    });
    await page.goto('http://localhost:8080/');
    await page.locator('#start').click();
    await page.locator('#scan-workout-screen').click();
    await page.waitForFunction(() => !document.querySelector('[data-read]').disabled);
    for (const viewport of [
      { width: 844, height: 390 },
      { width: 667, height: 280 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await page.waitForFunction(() => {
        const dialog = document.querySelector('.live-scan-dialog');
        return Math.abs(dialog.getBoundingClientRect().height - innerHeight) < 2;
      });
      const visibleButtons = await page
        .locator('.live-scan-dialog button:visible')
        .allTextContents();
      assert.deepEqual(visibleButtons, ['Take a scan', 'Done']);
      for (const selector of ['[data-read]', '[data-review]']) {
        const box = await page.locator(selector).boundingBox();
        assert.ok(
          box.y >= 0 && box.y + box.height <= viewport.height,
          'Scanner buttons must stay inside the viewport',
        );
        assert.ok(box.height >= 48, 'Scanner buttons should be easy to tap');
      }
      assert.equal(
        await page
          .locator('.live-scan-dialog')
          .evaluate((el) => el.scrollHeight <= el.clientHeight),
        true,
      );
      if (process.env.SCANNER_SCREENSHOT && viewport.width === 844)
        await page.screenshot({ path: process.env.SCANNER_SCREENSHOT });
    }
    const scan = async () => {
      await page.locator('[data-read]').click();
      await page.waitForFunction(() =>
        document.querySelector('[data-read]').textContent.startsWith('Add results'),
      );
    };
    await scan();
    assert.equal(
      await page.locator('[data-live-names] input').count(),
      0,
      'Scans are staged until accepted',
    );
    assert.deepEqual(await page.locator('[data-detected-names] li').allTextContents(), [
      'Bench Press',
      'Squat',
    ]);
    await page.setViewportSize({ width: 667, height: 280 });
    await page.locator('[data-review]').click();
    await page.waitForFunction(() =>
      document.querySelector('[data-detected-names]').textContent.includes('Deadlift'),
    );
    assert.equal(
      await page.locator('[data-live-names] input').count(),
      0,
      'Retry must discard previous candidates',
    );
    await page.locator('[data-read]').click();
    assert.equal(await page.locator('[data-live-names] input').count(), 2);
    await page.locator('[data-live-results] [data-clear-all]').click();
    assert.equal(await page.locator('[data-live-names] input').count(), 0);
    assert.equal(await page.locator('[data-live-results]').isVisible(), false);
    await page.evaluate(() => {
      window.testOcrText = 'A EMOM 1:30\nBench Press 12\nSquat 20';
    });
    await scan();
    await page.locator('[data-read]').click();
    await page.evaluate(() => {
      window.testOcrText = undefined;
    });
    await scan();
    assert.ok(
      (await page.locator('[data-detected-names]').textContent()).includes(
        'Already added',
      ),
    );
    for (const selector of ['[data-read]', '[data-review]']) {
      const box = await page.locator(selector).boundingBox();
      assert.ok(
        box.y >= 0 && box.y + box.height <= 280,
        'Pending scan controls stay visible in short landscape',
      );
    }
    if (process.env.SCANNER_SCREENSHOT)
      await page.screenshot({ path: process.env.SCANNER_SCREENSHOT });
    await page.locator('[data-read]').click();
    assert.equal(await page.locator('[data-review]').textContent(), 'Done');
    assert.equal(await page.locator('[data-live-names] input').count(), 3);
    await page.locator('[data-review]').click();
    assert.equal(await page.locator('.live-scan-dialog video').isVisible(), false);
    await page.locator('[data-live-review] [data-clear-all]').click();
    assert.equal(await page.locator('[data-live-names] input').count(), 0);
    assert.equal(await page.locator('[data-import]').isDisabled(), true);
    await page.locator('[data-resume]').click();
    await page.evaluate(() => {
      window.testOcrText = '';
    });
    await scan();
    assert.equal(
      await page.locator('[data-read]').isDisabled(),
      true,
      'Empty scans cannot be added',
    );
    assert.equal(await page.locator('[data-detected-empty]').isVisible(), true);
    await page.evaluate(() => {
      window.testOcrText = Array.from(
        { length: 60 },
        (_, i) =>
          `Exercise ${String.fromCharCode(65 + Math.floor(i / 26))}${String.fromCharCode(65 + (i % 26))}`,
      ).join('\n');
    });
    await page.locator('[data-review]').click();
    await page.waitForFunction(
      () => document.querySelector('[data-detected-names]').children.length === 60,
    );
    assert.equal(
      await page
        .locator('[data-live-results]')
        .evaluate((el) => el.scrollHeight > el.clientHeight),
      true,
      'Long detections scroll within the panel',
    );
    for (const selector of ['[data-read]', '[data-review]']) {
      const box = await page.locator(selector).boundingBox();
      assert.ok(
        box.y + box.height <= 280,
        'Long detections must not hide action buttons',
      );
    }
    await page.locator('[data-live-results] [data-clear-all]').click();
    assert.equal(
      await page.locator('[data-live-results]').isVisible(),
      false,
      'Clear All also removes pending candidates',
    );
    await page.evaluate(() => {
      window.testOcrText = 'Bench Press 12\nSquat 20\nDeadlift 8';
    });
    await scan();
    await page.locator('[data-read]').click();
    await page.locator('[data-review]').click();
    await page.locator('[data-live-names] input').first().fill('Hip Thrust');
    await page.locator('[data-import]').click();
    assert.deepEqual(await page.locator('.exercise-card h3').allTextContents(), [
      'Hip Thrust',
      'Squat',
      'Deadlift',
    ]);
    await page.waitForFunction(() => window.cameraStopped && window.workerStopped);
    await page.locator('[data-edit="0"]').click();
    assert.equal(await page.locator('#recorded-sets .recorded-set').count(), 0);
    await page.goto('http://localhost:8080/');
    await page.locator('#start').click();
    await page.evaluate(() => {
      navigator.mediaDevices.getUserMedia = async () => {
        throw new DOMException('Denied', 'NotAllowedError');
      };
    });
    await page.locator('#scan-workout-screen').click();
    await page.waitForFunction(() =>
      document.querySelector('[data-live-status]').textContent.includes('denied'),
    );
    assert.equal(await page.locator('[data-read]').textContent(), 'Retry camera');
    await page.locator('[data-review]').click();
    await page.waitForFunction(() => !document.querySelector('.live-scan-dialog'));
    console.log(
      'PASS: inline acceptance/retry, Clear All, empty/long detections, landscape controls, deduplication, no-set import, camera cleanup and permission denial',
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
