(() => {
  document.querySelector('#refresh-app').onclick = async () => {
    if (document.querySelector('#refresh-app').disabled) return;
    const status = document.querySelector('#update-status');
    const button = document.querySelector('#refresh-app');
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    status.hidden = false;
    status.textContent = 'Checking for updates…';
    try {
      if (!('serviceWorker' in navigator)) {
        location.reload();
        return;
      }
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        location.reload();
        return;
      }
      await registration.update();
      if (registration.waiting) {
        await new Promise((resolve) => {
          navigator.serviceWorker.addEventListener('controllerchange', resolve, {
            once: true,
          });
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        });
        location.reload();
        return;
      }
      if (registration.installing) {
        await new Promise((resolve) => {
          const worker = registration.installing;
          if (worker.state === 'activated') return resolve();
          worker.addEventListener('statechange', () => {
            if (worker.state === 'activated' || worker.state === 'redundant') resolve();
          });
        });
        if (navigator.serviceWorker.controller) {
          location.reload();
          return;
        }
      }
      location.reload();
    } catch (error) {
      status.textContent =
        error.message || 'Could not check for updates. Try again online.';
      button.disabled = false;
      button.removeAttribute('aria-busy');
    }
  };
  const app = document.querySelector('#app');
  if (!app) return;
  const indicator = document.createElement('p');
  indicator.className = 'pull-refresh-status';
  indicator.setAttribute('role', 'status');
  indicator.hidden = true;
  app.before(indicator);
  let start = null;
  let distance = 0;
  const isHome = () => ['#home', '#history', ''].includes(location.hash);
  const reset = () => {
    start = null;
    distance = 0;
    indicator.hidden = true;
  };
  document.addEventListener(
    'touchstart',
    (event) => {
      reset();
      if (
        !isHome() ||
        window.scrollY > 0 ||
        document.querySelector('#refresh-app').disabled ||
        document.querySelector('dialog[open]') ||
        event.touches.length !== 1 ||
        event.target.closest('button, a, input, textarea, select')
      )
        return;
      start = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    },
    { passive: true },
  );
  document.addEventListener(
    'touchmove',
    (event) => {
      if (!start) return;
      if (
        !isHome() ||
        event.touches.length !== 1 ||
        window.scrollY > 0 ||
        document.querySelector('dialog[open]')
      )
        return reset();
      const dx = event.touches[0].clientX - start.x;
      const dy = event.touches[0].clientY - start.y;
      if (dy < 0 || Math.abs(dx) > Math.abs(dy)) return reset();
      distance = dy;
      if (dy > 12) {
        if (event.cancelable) event.preventDefault();
        indicator.hidden = false;
        indicator.textContent =
          dy >= 120 ? 'Release to check for updates' : 'Pull down to check for updates';
      }
    },
    { passive: false },
  );
  document.addEventListener('touchend', () => {
    const ready = start && distance >= 120 && isHome();
    reset();
    if (ready) document.querySelector('#refresh-app').click();
  });
  document.addEventListener('touchcancel', reset);
  window.addEventListener('hashchange', reset);
})();
