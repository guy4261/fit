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
    await page.locator('[data-corner="bl"]').focus();
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
    await page.locator('[data-corner="bl"]').focus();
    for (let step = 0; step < 10; step++) await page.keyboard.press('Shift+ArrowDown');
    await page.locator('[data-corner="tl"]').focus();
    for (let step = 0; step < 10; step++) await page.keyboard.press('Shift+ArrowDown');
    await page.locator('[data-corner="tr"]').focus();
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
    const straightened = await page.evaluate(async () => {
      const source = document.createElement('canvas');
      source.width = 500;
      source.height = 240;
      const ctx = source.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, 500, 240);
      ctx.setTransform(1, 0.15, 0.2, 1, 30, 20);
      ctx.fillStyle = 'black';
      ctx.font = '24px Arial';
      ctx.fillText('1. BENCH PRESS 12', 20, 40);
      ctx.fillText('2. SQUAT 20', 20, 90);
      const image = new Image();
      image.src = source.toDataURL();
      await image.decode();
      const corners = [
        [30, 20],
        [430, 80],
        [454, 200],
        [54, 140],
      ].map(([x, y]) => ({ x: x / 500, y: y / 240 }));
      const corrected = ExercisePhoto.perspectiveCrop(image, corners);
      const worker = await Tesseract.createWorker('eng');
      try {
        return ExercisePhoto.namesFromText((await worker.recognize(corrected)).data.text);
      } finally {
        await worker.terminate();
      }
    });
    assert.deepEqual(
      straightened,
      ['Bench Press', 'Squat'],
      'OCR must straighten a skewed quadrilateral',
    );
    const mappedCorners = await page.evaluate(async () => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 200;
      const ctx = canvas.getContext('2d');
      const pixels = ctx.createImageData(200, 200);
      for (let y = 0; y < 200; y++)
        for (let x = 0; x < 200; x++) {
          const i = (y * 200 + x) * 4;
          pixels.data[i] = x;
          pixels.data[i + 1] = y;
          pixels.data[i + 3] = 255;
        }
      ctx.putImageData(pixels, 0, 0);
      const image = new Image();
      image.src = canvas.toDataURL();
      await image.decode();
      const points = [
        { x: 0.1, y: 0.1 },
        { x: 0.9, y: 0.2 },
        { x: 0.7, y: 0.9 },
        { x: 0.2, y: 0.7 },
      ];
      const warped = ExercisePhoto.perspectiveCrop(image, points);
      const output = warped.getContext('2d');
      return [
        [0, 0],
        [warped.width - 1, 0],
        [warped.width - 1, warped.height - 1],
        [0, warped.height - 1],
      ].map(([x, y]) => [...output.getImageData(x, y, 1, 1).data].slice(0, 2));
    });
    [
      [20, 20],
      [180, 40],
      [140, 180],
      [40, 140],
    ].forEach((expected, index) =>
      expected.forEach((value, channel) =>
        assert.ok(
          Math.abs(mappedCorners[index][channel] - value) < 3,
          'Projective crop should map each selected corner, not a bounding box',
        ),
      ),
    );
    console.log('PASS: skewed text OCR and projective mapping of all four corners');
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
    const readPoints = () =>
      page
        .locator('[data-selection]')
        .getAttribute('points')
        .then((value) => value.split(' ').map((pair) => pair.split(',').map(Number)));
    const dragCorner = async (corner, x, y) => {
      const handle = page.locator(`[data-corner="${corner}"]`);
      await handle.scrollIntoViewIfNeeded();
      const box = await page.locator('.photo-crop').boundingBox();
      const start = await handle.boundingBox();
      await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * x, box.y + box.height * y, { steps: 5 });
      await page.mouse.up();
    };
    await dragCorner('tl', 0.1, 0.1);
    await dragCorner('tr', 0.75, 0.2);
    await dragCorner('br', 0.65, 0.8);
    await dragCorner('bl', 0.15, 0.7);
    const points = await readPoints();
    assert.ok(
      Math.abs(points[0][1] - points[1][1]) > 0.05,
      'Corners must adjust independently',
    );
    await page.locator('[data-zoom="in"]').click();
    assert.equal(await page.locator('[data-zoom-level]').textContent(), '125%');
    assert.deepEqual(await readPoints(), points, 'Zoom must preserve photo coordinates');
    await page.locator('[data-zoom="out"]').click();
    assert.equal(await page.locator('[data-zoom-level]').textContent(), '100%');
    await page.locator('[data-zoom="in"]').click();
    await page.locator('[data-zoom="reset"]').click();
    assert.equal(await page.locator('[data-zoom-level]').textContent(), '100%');
    assert.deepEqual(await readPoints(), points, 'Reset zoom must preserve crop');
    await page.locator('.photo-crop').scrollIntoViewIfNeeded();
    const view = await page.locator('.photo-crop').boundingBox();
    const center = points.reduce(
      (sum, p) => [sum[0] + p[0] / 4, sum[1] + p[1] / 4],
      [0, 0],
    );
    await page.mouse.move(
      view.x + center[0] * view.width,
      view.y + center[1] * view.height,
    );
    await page.mouse.down();
    await page.mouse.move(
      view.x + (center[0] + 0.1) * view.width,
      view.y + (center[1] + 0.1) * view.height,
      { steps: 5 },
    );
    await page.mouse.up();
    const moved = await readPoints();
    moved.forEach((p, i) => {
      assert.ok(Math.abs(p[0] - points[i][0] - 0.1) < 0.01);
      assert.ok(Math.abs(p[1] - points[i][1] - 0.1) < 0.01);
    });
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
    const distance = (a, b) =>
      Math.hypot((a[0] - b[0]) * sizes.width, (a[1] - b[1]) * sizes.height);
    assert.ok(
      Math.abs(
        sizes.crop.width -
          (distance(moved[0], moved[1]) + distance(moved[3], moved[2])) / 2,
      ) < 2,
    );
    assert.ok(
      Math.abs(
        sizes.crop.height -
          (distance(moved[0], moved[3]) + distance(moved[1], moved[2])) / 2,
      ) < 2,
    );
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
