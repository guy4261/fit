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
        canvas.getContext('2d').fillRect(0, 0, 640, 480);
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
                  ++reads === 1
                    ? 'A EMOM 1:30\nBench Press 12\nSquat 20'
                    : 'Squat 20\nDeadlift 8',
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
    for (let i = 0; i < 2; i++) {
      await page.locator('[data-read]').click();
      await page.waitForFunction(() => !document.querySelector('[data-read]').disabled);
    }
    assert.equal(await page.locator('[data-review]').textContent(), 'Review (3)');
    await page.locator('[data-review]').click();
    assert.equal(await page.locator('.live-scan-dialog video').isVisible(), false);
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
    assert.equal(await page.locator('[data-read]').isDisabled(), true);
    await page.locator('[data-cancel]').click();
    console.log(
      'PASS: repeated live scans, deduplication, heading filtering, editable review, import, camera cleanup and permission denial',
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
