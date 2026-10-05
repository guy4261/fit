(() => {
  document.querySelector('#refresh-app').onclick = async () => {
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
})();
