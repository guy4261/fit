const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({
      serviceWorkers: 'block',
      viewport: { width: 320, height: 640 },
    });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('http://localhost/**', (route) => {
      const pathname = new URL(route.request().url()).pathname;
      const file = path.join(__dirname, '..', pathname === '/' ? 'index.html' : pathname);
      return route.fulfill({
        body: fs.readFileSync(file),
        contentType:
          { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[
            path.extname(file)
          ] || 'application/octet-stream',
      });
    });
    await page.addInitScript(() => {
      const session = (days, weight) => {
        const date = new Date();
        date.setDate(date.getDate() - days);
        return {
          id: String(days),
          title: 'Workout',
          date: date.toISOString(),
          exercises: [
            {
              name: 'Bench Press',
              reps: 6,
              weight: { type: 'dumbbell', count: 1, each: weight },
              setEntries: [
                { reps: 6, weight: { type: 'dumbbell', count: 1, each: weight } },
                { reps: 20, weight: { type: 'body' } },
              ],
            },
            { name: 'Push Up', reps: 10, weight: { type: 'body' } },
          ],
        };
      };
      localStorage.setItem(
        'form-training-log-v1',
        JSON.stringify({
          sessions: [
            session(10, 30),
            session(2, 20),
            {
              ...session(0, 0),
              exercises: [{ name: 'Bench Press', reps: 30, weight: { type: 'body' } }],
            },
          ],
          names: [],
        }),
      );
    });
    await page.goto('http://localhost/#achievements');
    const row = page.locator('tr[data-achievement="0"]');
    assert.equal(await page.locator('thead th').count(), 4);
    assert.equal(await page.locator('thead th').last().innerText(), '1RM');
    assert.match(await row.innerText(), /Top/i);
    assert.match(await row.innerText(), /10 days ago/);
    const topText = await row.innerText();
    assert.equal(await row.locator('td').last().innerText(), '36.0 kg');
    await row.locator('td').last().click();
    assert.equal(await row.getAttribute('data-view'), 'latest');
    assert.match(await row.innerText(), /2 days ago/);
    assert.equal(await row.locator('td').last().innerText(), '24.0 kg');
    await row.locator('button').focus();
    await page.keyboard.press('Enter');
    assert.equal(await row.getAttribute('data-view'), 'top');
    assert.equal(await row.innerText(), topText);
    assert.equal(await page.locator('[data-achievement]').count(), 1);
    assert.equal(await page.getByRole('rowheader', { name: 'Push Up' }).count(), 0);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    assert.equal(await page.locator('.achievements-legend').isVisible(), true);
    await page.evaluate(() => {
      const saved = JSON.parse(localStorage.getItem('form-training-log-v1'));
      saved.sessions[0].exercises[0].setEntries[0].weight.each = 40;
      localStorage.setItem('form-training-log-v1', JSON.stringify(saved));
    });
    await page.getByRole('button', { name: 'Recalculate achievements' }).click();
    assert.equal(await row.locator('td').last().innerText(), '48.0 kg');
    await page.locator('#splash-screen').waitFor({ state: 'detached' });
    await page.screenshot({
      path: 'C:/Users/guy42/AppData/Local/Temp/fit-achievements-preview.png',
    });
    await page.evaluate(() => {
      const saved = JSON.parse(localStorage.getItem('form-training-log-v1'));
      saved.sessions = saved.sessions.slice(-1);
      localStorage.setItem('form-training-log-v1', JSON.stringify(saved));
    });
    await page.getByRole('button', { name: 'Recalculate achievements' }).click();
    assert.equal(await page.locator('[data-achievement]').count(), 0);
    assert.equal(
      await page.getByText('No achievements yet', { exact: true }).isVisible(),
      true,
    );
    assert.deepEqual(errors, []);
    console.log(
      'PASS: compact achievements table, independent row toggle, dates, keyboard access and mobile layout',
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
