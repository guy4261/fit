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
    await page.setContent(
      '<div style="background:white;color:black;padding:20px;font:24px Arial;line-height:2">1. Bench Press 12<br>2. Squat 20</div>',
    );
    const photo = await page.locator('div').screenshot();
    await page.route('http://fit.test/**', (route) => {
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
              : file.endsWith('.jpg')
                ? 'image/jpeg'
                : 'application/octet-stream',
      });
    });
    await page.goto('http://fit.test/');
    await page.locator('#start').click();
    const qrBox = await page.locator('#scan-exercises').boundingBox();
    const photoBox = await page.locator('#import-exercise-photo').boundingBox();
    assert.equal(qrBox.y, photoBox.y, 'QR and photo buttons should sit side by side');
    await page.locator('#import-exercise-photo').click();
    assert.equal(
      await page.locator('[data-camera-input]').getAttribute('capture'),
      'environment',
    );
    assert.equal(await page.locator('[data-photos-input]').getAttribute('capture'), null);
    await page
      .locator('[data-photos-input]')
      .setInputFiles({ name: 'real-list.png', mimeType: 'image/png', buffer: photo });
    await page.waitForFunction(() => !document.querySelector('[data-ocr]').disabled);
    assert.equal(await page.locator('#photo-exercise-names').inputValue(), '');
    assert.equal(await page.locator('[data-corner]').count(), 4);
    await page.locator('[data-ocr]').click();
    await page.waitForFunction(
      () =>
        document.querySelector('[data-add]').disabled === false ||
        document.querySelector('[data-status]').textContent.includes('Could not'),
      null,
      { timeout: 120000 },
    );
    assert.equal(
      await page.locator('textarea#photo-exercise-names').inputValue(),
      'Bench Press\nSquat',
      await page.locator('[data-status]').textContent(),
    );
    console.log('PASS: real Tesseract OCR of exercise image');
    await page.locator('#photo-exercise-names').fill('');
    await page.locator('[data-corner="br"]').focus();
    for (let step = 0; step < 10; step++) await page.keyboard.press('Shift+ArrowUp');
    await page.locator('[data-ocr]').click();
    await page.waitForFunction(
      () => !document.querySelector('[data-ocr]').disabled,
      null,
      { timeout: 120000 },
    );
    assert.equal(
      await page.locator('#photo-exercise-names').inputValue(),
      'Bench Press',
      'Real OCR should read only the upper crop',
    );
    await page.locator('[data-corner="br"]').focus();
    for (let step = 0; step < 10; step++) await page.keyboard.press('Shift+ArrowDown');
    await page.locator('[data-corner="tl"]').focus();
    for (let step = 0; step < 10; step++) await page.keyboard.press('Shift+ArrowDown');
    await page.locator('[data-ocr]').click();
    await page.waitForFunction(
      () => !document.querySelector('[data-ocr]').disabled,
      null,
      { timeout: 120000 },
    );
    assert.equal(
      await page.locator('#photo-exercise-names').inputValue(),
      'Bench Press\nSquat',
      'Second real crop should append only the lower line',
    );
    console.log('PASS: real OCR of two separate rectangular sections');
    for (let sample = 1; sample <= 6; sample++) {
      await page.locator('.photo-samples summary').click();
      assert.equal(await page.locator('[data-sample]').count(), 6);
      assert.ok(
        await page
          .locator('dialog[open]')
          .evaluate((el) => el.scrollWidth <= el.clientWidth),
        'Sample gallery must fit a phone viewport',
      );
      await page.locator(`[data-sample="${sample}"]`).click();
      await page.waitForFunction(() => !document.querySelector('[data-ocr]').disabled);
      const previousText = await page.locator('#photo-exercise-names').inputValue();
      await page.locator('[data-ocr]').click();
      await page.waitForFunction(
        () => document.querySelector('[data-camera]').disabled === false,
        null,
        { timeout: 120000 },
      );
      const status = await page.locator('[data-status]').textContent();
      assert.ok(status.startsWith('Appended '), `Photo ${sample}: ${status}`);
      const detected = await page.locator('#photo-exercise-names').inputValue();
      assert.ok(
        detected.startsWith(previousText + '\n'),
        'OCR should append and preserve previous scans',
      );
      assert.ok(!/\p{N}/u.test(detected));
      console.log(
        `PASS: sample photo ${sample}: ${detected.split('\n').length} detected lines`,
      );
    }
    await page.locator('[data-close]').click();
    await page.locator('#import-exercise-photo').click();
    await page.evaluate(() => {
      window.Tesseract = {
        createWorker: async () => ({
          recognize: async (canvas) => {
            window.testCrop = { width: canvas.width, height: canvas.height };
            return {
              data: { text: '1. BENCH PRESS 12\n2. sQUAT 20\n123\nBench Press 8' },
            };
          },
          terminate: async () => {},
        }),
      };
    });
    await page.locator('[data-photos-input]').setInputFiles({
      name: 'list.png',
      mimeType: 'image/png',
      buffer: photo,
    });
    await page.waitForFunction(() => !document.querySelector('[data-ocr]').disabled);
    const handle = page.locator('[data-corner="br"]');
    await handle.scrollIntoViewIfNeeded();
    const box = await page.locator('.photo-crop').boundingBox();
    const start = await handle.boundingBox();
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();
    await page.locator('#photo-exercise-names').fill('hIP THRUST 20');
    await page.locator('[data-ocr]').click();
    await page.waitForFunction(
      () => document.querySelector('[data-add]').disabled === false,
    );
    assert.equal(
      await page.locator('textarea#photo-exercise-names').inputValue(),
      'hIP THRUST 20\nBench Press\nSquat',
    );
    const sizes = await page.evaluate(() => ({
      crop: window.testCrop,
      width: document.querySelector('[data-image]').naturalWidth,
      height: document.querySelector('[data-image]').naturalHeight,
    }));
    assert.ok(Math.abs(sizes.crop.width - sizes.width / 2) < 3);
    assert.ok(Math.abs(sizes.crop.height - sizes.height / 2) < 3);
    assert.equal(
      await page.locator('.exercise-card').count(),
      0,
      'OCR must not create exercises',
    );
    await page.locator('[data-ocr]').click();
    await page.waitForFunction(() => !document.querySelector('[data-ocr]').disabled);
    assert.equal(
      await page.locator('#photo-exercise-names').inputValue(),
      'hIP THRUST 20\nBench Press\nSquat\nBench Press\nSquat',
    );
    await page.locator('[data-add]').click();
    assert.equal(await page.locator('.exercise-card').count(), 3);
    assert.deepEqual(await page.locator('.exercise-card h3').allTextContents(), [
      'Hip Thrust',
      'Bench Press',
      'Squat',
    ]);
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('form-training-log-v1')),
    );
    assert.ok(JSON.stringify(stored).includes('Bench Press'));
    await page.locator('#import-exercise-photo').click();
    await page.evaluate(() => {
      window.Tesseract.createWorker = async () => {
        throw Error('test failure');
      };
    });
    await page.locator('[data-camera-input]').setInputFiles({
      name: 'bad.png',
      mimeType: 'image/png',
      buffer: photo,
    });
    await page.waitForFunction(() => !document.querySelector('[data-ocr]').disabled);
    await page.locator('[data-ocr]').click();
    await page.waitForFunction(() =>
      document.querySelector('[data-status]').textContent.includes('test failure'),
    );
    assert.equal(await page.locator('[data-add]').isDisabled(), true);
    assert.equal(await page.locator('[data-camera]').isEnabled(), true);
    await page.locator('[data-close]').click();
    assert.equal(await page.locator('#import-exercise-photo').count(), 1);
    await page.locator('#add').click();
    assert.equal(await page.locator('#import-exercise-photo').count(), 0);
    console.log(
      'PASS: photo source controls, OCR cleanup, duplicate removal, import, persistence, failure recovery and cancellation',
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
