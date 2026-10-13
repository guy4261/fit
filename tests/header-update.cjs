const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({
      serviceWorkers: 'block',
      viewport: { width: 320, height: 800 },
    });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('http://fit.test/**', (route) => {
      const pathname = new URL(route.request().url()).pathname;
      const file = path.join(__dirname, '..', pathname === '/' ? 'index.html' : pathname);
      const extension = path.extname(file);
      route.fulfill({
        body: fs.readFileSync(file),
        contentType:
          { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[
            extension
          ] || 'application/octet-stream',
      });
    });
    await page.addInitScript(() => {
      const serviceWorker = new EventTarget();
      serviceWorker.register = async () => ({});
      serviceWorker.getRegistration = async () => ({
        update: async () => {
          if (sessionStorage.getItem('update-test') !== 'success')
            throw Error('Offline test: try again online.');
        },
        waiting: {
          postMessage: (message) => {
            sessionStorage.setItem('update-message', message.type);
            serviceWorker.dispatchEvent(new Event('controllerchange'));
          },
        },
      });
      Object.defineProperty(navigator, 'serviceWorker', { value: serviceWorker });
    });
    for (const url of ['/', '/#achievements', '/about.html']) {
      await page.goto('http://fit.test' + url);
      await page.evaluate(() => sessionStorage.removeItem('update-test'));
      const button = page.locator('header #refresh-app');
      assert.equal(await button.count(), 1);
      assert.equal(await page.locator('#data-dialog #refresh-app').count(), 0);
      assert.equal(await button.getAttribute('aria-label'), 'Check for updates');
      const style = await button.evaluate((el) => ({
        color: getComputedStyle(el).color,
        background: getComputedStyle(el).backgroundColor,
      }));
      assert.equal(style.color, 'rgb(0, 0, 0)');
      assert.equal(style.background, 'rgb(255, 255, 255)');
      assert.ok(
        await page.locator('header').evaluate((el) => el.scrollWidth <= el.clientWidth),
        'Header must fit a 320px phone',
      );
      await page.locator('#menu-button').click();
      assert.equal(await page.locator('#data-dialog').isVisible(), true);
      assert.equal(await page.locator('#data-dialog .menu-action').count(), 4);
      assert.equal(await page.locator('#share-app').count(), 0);
      if (url === '/about.html') {
        await page.locator('#import-file').setInputFiles({
          name: 'backup.json',
          mimeType: 'application/json',
          buffer: Buffer.from(JSON.stringify({ sessions: [], names: ['Test Exercise'] })),
        });
        await page.waitForFunction(
          () =>
            document.querySelector('#dialog-status').textContent ===
            'Imported 0 sessions.',
        );
        assert.equal(await page.locator('.about-content h1').textContent(), 'About');
        await page.evaluate(() =>
          Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: {
              writeText: async (text) => {
                window.copiedBackup = text;
              },
            },
          }),
        );
        await page.locator('#copy-json').click();
        await page.waitForFunction(() => Boolean(window.copiedBackup));
        assert.equal(
          await page.evaluate(() => JSON.parse(window.copiedBackup).format),
          'form-training-log',
        );
      }
      await page.locator('#close-dialog').click();
      assert.equal(await page.locator('dialog[open]').count(), 0);
      await button.click();
      await page.waitForFunction(() =>
        document.querySelector('#update-status').textContent.includes('Offline test'),
      );
      assert.equal(await page.locator('#update-status').isVisible(), true);
      assert.equal(await button.isEnabled(), true);
      assert.equal(await page.locator('dialog[open]').count(), 0);
      await page.evaluate(() => sessionStorage.setItem('update-test', 'success'));
      await Promise.all([page.waitForEvent('framenavigated'), button.click()]);
      assert.equal(
        await page.evaluate(() => sessionStorage.getItem('update-message')),
        'SKIP_WAITING',
      );
      await page.goto('http://fit.test' + url);
      const newSession = page.locator('header #new-session');
      assert.equal(await newSession.getAttribute('aria-label'), 'Start new session');
      await newSession.click();
      await page.locator('#add').waitFor();
      assert.equal(await page.locator('#exercise-list .exercise-card').count(), 0);
      await page.locator('#add').click();
      await page.locator('header #new-session').click();
      assert.equal(await page.locator('#add').isVisible(), true);
      assert.ok(
        await page.locator('header').evaluate((el) => el.scrollWidth <= el.clientWidth),
        'Header with new-session action must fit a 320px phone',
      );
      console.log(
        `PASS: ${url} header placement, phone layout, update reload and new session from page and exercise form`,
      );
    }
    assert.deepEqual(errors, [], 'Screens should initialize without script errors');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
