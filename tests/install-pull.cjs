const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ serviceWorkers: 'block', viewport: { width: 900, height: 844 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('http://fit.test/**', route => {
      const file = path.join(__dirname, '..', new URL(route.request().url()).pathname.replace(/^\/$/, '/index.html'));
      route.fulfill({ body: fs.readFileSync(file), contentType: { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(file)] || 'application/octet-stream' });
    });
    page.on('dialog', dialog => dialog.accept());
    await page.goto('http://fit.test/#new');
    await page.locator('#finish').click();
    await page.locator('#install-dialog[open]').waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem('fit24-install-suggestion-seen')), '1');
    await page.locator('#close-install').click();
    await page.reload();
    await page.locator('#start').click();
    await page.locator('#finish').click();
    assert.equal(await page.locator('#install-dialog').isVisible(), false);
    await page.locator('#menu-button').click();
    await page.locator('#install-app').click();
    await page.locator('#install-dialog[open]').waitFor();
    await page.evaluate(() => {
      const event = new Event('beforeinstallprompt', { cancelable: true });
      event.prompt = async () => { window.installCalled = true; };
      event.userChoice = Promise.resolve({ outcome: 'accepted' });
      window.dispatchEvent(event);
    });
    await page.locator('#confirm-install').click();
    assert.equal(await page.evaluate(() => window.installCalled), true);
    await page.locator('#close-dialog').click();
    const pull = async (distance, cancel = false) => page.evaluate(({ distance, cancel }) => {
      const target = document.querySelector('#app');
      const send = (type, y) => {
        const event = new Event(type, { bubbles: true, cancelable: true });
        Object.defineProperty(event, 'touches', { value: [{ clientX: 150, clientY: y }] });
        target.dispatchEvent(event);
      };
      send('touchstart', 100);
      send('touchmove', 100 + distance);
      send(cancel ? 'touchcancel' : 'touchend', 100 + distance);
    }, { distance, cancel });
    await page.evaluate(() => {
      window.updates = 0;
      document.querySelector('#refresh-app').onclick = () => window.updates++;
    });
    await pull(60);
    await pull(150, true);
    assert.equal(await page.evaluate(() => window.updates), 0);
    await pull(150);
    assert.equal(await page.evaluate(() => window.updates), 1);
    await page.goto('http://fit.test/#achievements');
    await page.evaluate(() => {
      window.updates = 0;
      document.querySelector('#refresh-app').onclick = () => window.updates++;
    });
    await pull(150);
    assert.equal(await page.evaluate(() => window.updates), 0);
    await page.goto('http://fit.test/#home');
    await page.evaluate(() => {
      localStorage.removeItem('fit24-install-suggestion-seen');
      Object.defineProperty(navigator, 'standalone', { value: true });
      window.fit24Install.suggestAfterSession();
    });
    assert.equal(await page.locator('#install-dialog').isVisible(), false);
    await page.goto('http://fit.test/about.html');
    assert.equal(await page.getByRole('link', { name: 'Tip Jar' }).getAttribute('href'), 'https://links.payboxapp.com/9vqzsSsvk7b');
    await page.locator('#menu-button').click();
    await page.locator('#install-app').click();
    await page.locator('#install-dialog[open]').waitFor();
    assert.deepEqual(errors, []);
    console.log('PASS: one-time session suggestion, manual install, native prompt, installed mode, pull threshold/cancel/route guards, Tip Jar');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
