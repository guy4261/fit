(() => {
  const dialog = document.querySelector('#install-dialog');
  const button = document.querySelector('#install-app');
  const confirm = document.querySelector('#confirm-install');
  const instructions = document.querySelector('#install-instructions');
  const status = document.querySelector('#install-status');
  const key = 'fit24-install-suggestion-seen';
  let deferredPrompt = null;
  let installed = false;
  let suggested = false;
  const standalone = () =>
    installed ||
    navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches;
  function update() {
    const added = standalone();
    button.disabled = added;
    button.querySelector('b').textContent = added
      ? 'Added to home screen'
      : 'Add to home screen';
    confirm.hidden = added || !deferredPrompt;
    const ios =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    instructions.textContent = added
      ? 'fit24 is already installed.'
      : deferredPrompt
        ? 'Keep your training log one tap away. Add fit24 to your home screen.'
        : ios
          ? 'Open fit24 in Safari, tap Share, then choose Add to Home Screen.'
          : 'Open your browser menu and choose Install app or Add to home screen. If neither option appears, open fit24 in a browser that supports installation, such as Chrome or Edge.';
  }
  function show() {
    update();
    status.textContent = '';
    if (!dialog.open) dialog.showModal();
  }
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    update();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferredPrompt = null;
    update();
    dialog.close();
  });
  window.matchMedia('(display-mode: standalone)').addEventListener('change', update);
  button.onclick = show;
  document.querySelector('#close-install').onclick = () => dialog.close();
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  confirm.onclick = async () => {
    const prompt = deferredPrompt;
    if (!prompt) return;
    confirm.disabled = true;
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === 'accepted') dialog.close();
    } catch {
      status.textContent =
        'Could not open installation. Use your browser menu to add fit24 to your home screen.';
    } finally {
      deferredPrompt = null;
      confirm.disabled = false;
      update();
    }
  };
  window.fit24Install = {
    suggestAfterSession() {
      if (suggested) return;
      suggested = true;
      try {
        if (localStorage.getItem(key)) return;
        localStorage.setItem(key, '1');
      } catch {
        /* Keep the one-time guard in memory when storage is unavailable. */
      }
      if (!standalone()) show();
    },
  };
  update();
})();
