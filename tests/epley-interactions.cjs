const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({
      serviceWorkers: 'block',
      viewport: { width: 390, height: 844 },
    });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('http://fit.test/**', (route) => {
      const file = path.join(__dirname, '..', new URL(route.request().url()).pathname);
      return route.fulfill({
        body: fs.readFileSync(file),
        contentType:
          {
            '.html': 'text/html; charset=utf-8',
            '.js': 'text/javascript; charset=utf-8',
            '.css': 'text/css',
          }[path.extname(file)] || 'application/octet-stream',
      });
    });
    await page.goto('http://fit.test/how-it-works.html');
    assert.equal(await page.locator('#epley-reps').inputValue(), '10');
    assert.equal(await page.locator('#epley-weight').inputValue(), '60');
    assert.equal(await page.locator('#epley-result').isVisible(), true);
    assert.equal(
      await page.locator('#epley-summary').textContent(),
      'Estimated 1RM: 80 kg \u00b7 Your set: 10 reps \u00d7 60 kg',
    );
    assert.equal(await page.locator('.epley-target').count(), 25);
    await page.locator('.epley-target[data-reps="5"]').click();
    const tip = page.locator('#epley-tooltip');
    assert.match(await tip.textContent(), /5 reps × 68.57 kg/);
    assert.equal(await tip.isVisible(), true);
    assert.match(
      await page.locator('.epley-target[data-reps="5"] > title').textContent(),
      /5 reps: 68.57 kg/,
    );
    await page.locator('.epley-target[data-reps="15"]').click();
    assert.equal(await tip.isVisible(), true);
    assert.match(await tip.textContent(), /15 reps/);
    await page.locator('.epley-target[data-reps="15"]').click();
    assert.equal(await tip.isVisible(), false);
    await page.locator('.epley-target.is-entered').click();
    assert.equal(await tip.isVisible(), true);
    assert.match(await tip.textContent(), /10 reps/);
    await page.locator('.epley-target.is-entered').click();
    assert.equal(await tip.isVisible(), false);
    await page.locator('.epley-target[data-reps="5"]').click();
    await tip.click();
    assert.equal(await tip.isVisible(), false);
    await page.locator('.epley-target[data-reps="5"]').click();
    await page.locator('h1').click();
    assert.equal(await tip.isVisible(), false);
    const point = await page.locator('.is-entered .epley-point').boundingBox();
    await page.mouse.move(point.x + point.width / 2, point.y + point.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      point.x + point.width / 2 + 35,
      point.y + point.height / 2 - 20,
      { steps: 8 },
    );
    await page.waitForTimeout(50);
    assert.notEqual(await page.locator('#epley-reps').inputValue(), '10');
    assert.notEqual(await page.locator('#epley-weight').inputValue(), '60');
    await page.mouse.up();
    assert.equal(await page.locator('.epley-target').count(), 25);
    assert.equal(await tip.isVisible(), false);
    await page.locator('.epley-target.is-entered').click();
    assert.equal(await tip.isVisible(), true);
    await page.keyboard.press('Escape');
    assert.equal(await tip.isVisible(), false);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    await page.evaluate(() =>
      localStorage.setItem(
        'form-training-log-v1',
        JSON.stringify({
          sessions: [
            {
              date: '2026-10-18',
              title: 'New session',
              exercises: [
                {
                  name: 'Bench Press',
                  setEntries: [
                    { reps: 8, weight: { type: 'barbell', bar: 20, plates: { 10: 2 } } },
                    { reps: 12, weight: { type: 'dumbbell', count: 2, each: 15 } },
                    { reps: 15, weight: { type: 'body' } },
                  ],
                },
                {
                  name: 'Plank',
                  setEntries: [
                    { reps: 20, reps_type: 'Seconds', weight: { type: 'body' } },
                  ],
                },
              ],
            },
            {
              date: '2026-10-10',
              title: 'Old session',
              exercises: [
                {
                  name: 'bench press',
                  sets: 2,
                  reps: 10,
                  weight: { type: 'plates', integer: 50, fraction: 0.5 },
                },
              ],
            },
          ],
        }),
      ),
    );
    await page.reload();
    const exercise = page.locator('#epley-exercise');
    const set = page.locator('#epley-set');
    assert.equal(await set.isDisabled(), true);
    assert.equal(await exercise.locator('option').count(), 2);
    assert.equal(await exercise.locator('option[value="plank"]').count(), 0);
    await exercise.selectOption('bench press');
    assert.equal(await set.isDisabled(), false);
    assert.equal(await set.locator('option').count(), 5);
    const labels = await set.locator('option').allTextContents();
    assert.match(labels[1], /New session.*Set 2/);
    assert.match(labels[2], /New session.*Set 1/);
    assert.match(labels[3], /Old session.*Set 2/);
    assert.match(labels[4], /Old session.*Set 1/);
    await set.selectOption('1');
    assert.equal(await page.locator('#epley-reps').inputValue(), '8');
    assert.equal(await page.locator('#epley-weight').inputValue(), '60');
    assert.equal(await page.locator('#epley-result').isVisible(), true);
    await set.selectOption('0');
    assert.equal(await page.locator('#epley-weight').inputValue(), '30');
    await set.selectOption('2');
    assert.equal(await page.locator('#epley-weight').inputValue(), '50.5');
    await page.locator('#epley-weight').fill('55');
    assert.equal(await set.inputValue(), '');
    assert.equal(
      labels.some((label) => label.includes('Body weight')),
      false,
    );
    await exercise.selectOption('');
    assert.equal(await set.isDisabled(), true);
    assert.deepEqual(errors, []);
    console.log(
      'PASS: initial plot, 25 points, point tooltip, tooltip/outside/Escape dismissal, live drag, click after drag, mobile width',
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
