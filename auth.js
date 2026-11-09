(() => {
  const button = document.querySelector('#account-button');
  const status = document.querySelector('#account-status');
  const backupActions = document.querySelector('#backup-actions');
  const saveButton = document.querySelector('#cloud-save');
  const restoreButton = document.querySelector('#cloud-restore');
  const tooltip = document.querySelector('#backup-tooltip');
  const cloudMessage = document.querySelector('#cloud-message');
  const supabaseUrl = document.querySelector('meta[name="supabase-url"]').content;
  const publishableKey = document.querySelector('meta[name="supabase-publishable-key"]').content;
  const appUrl = 'https://guy4261.github.io/fit/';
  const sdkUrl = 'https://cdn.auth0.com/js/auth0-spa-js/2.30/auth0-spa-js.production.js';
  let client;
  let user;
  let tooltipTimer;
  let autosaveTimer;
  let signingOut = false;
  const mobile = navigator.userAgentData?.mobile ||
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const revisionKey = 'fit24-training-revision';
  const currentRevision = () => localStorage.getItem(revisionKey);
  const savedRevisionKey = (account) => 'fit24-cloud-revision:' + account.sub;

  function updateSaveStatus() {
    const revision = currentRevision();
    const dirty = Boolean(user && revision && revision !== localStorage.getItem(savedRevisionKey(user)));
    saveButton.classList.toggle('has-unsaved-changes', dirty);
    saveButton.title = dirty
      ? mobile ? 'Changes are waiting to be saved to your account.' : 'Save changes to your account.'
      : 'Save training data to your account.';
    return dirty;
  }

  function scheduleAutosave(delay = 750) {
    clearTimeout(autosaveTimer);
    const dirty = updateSaveStatus();
    if (mobile && dirty && navigator.onLine && !signingOut && !saveButton.disabled) {
      autosaveTimer = setTimeout(() => runBackup(true, true), delay);
    }
  }

  window.addEventListener('fit24-training-change', () => {
    localStorage.setItem(revisionKey, crypto.randomUUID?.() || String(Date.now()) + Math.random());
    scheduleAutosave();
  });
  window.addEventListener('online', () => scheduleAutosave());

  function hideBackupResult() {
    clearTimeout(tooltipTimer);
    tooltip.hidden = true;
  }

  function showBackupResult(message) {
    hideBackupResult();
    tooltip.hidden = false;
    tooltip.querySelector('[role="status"]').textContent = message;
    tooltipTimer = setTimeout(hideBackupResult, 4000);
  }

  tooltip.querySelector('button').addEventListener('click', hideBackupResult);

  async function runBackup(save, automatic = false) {
    if (!user || signingOut || saveButton.disabled) return;
    if (automatic && (!navigator.onLine || !updateSaveStatus())) return;
    if (!automatic && !window.confirm(save
      ? 'Save this device’s training data to your account? This replaces your previous cloud backup.'
      : 'Restore your cloud backup? This replaces the training sessions on this device.')) return;

    const account = user;
    const revision = currentRevision();
    const snapshot = save ? window.fit24Backup.exportJson() : null;
    let retry = false;
    clearTimeout(autosaveTimer);
    if (!automatic) hideBackupResult();
    button.disabled = saveButton.disabled = restoreButton.disabled = true;
    try {
      const claims = await client.getIdTokenClaims();
      if (!claims?.__raw || claims.sub !== account.sub) throw new Error('Missing account token');

      const url = new URL('/rest/v1/fit24_backups', supabaseUrl);
      const headers = {
        apikey: publishableKey,
        Authorization: 'Bearer ' + claims.__raw,
      };
      const options = { headers, cache: 'no-store' };
      if (save) {
        headers['Content-Type'] = 'application/json';
        headers.Prefer = 'resolution=merge-duplicates,return=minimal';
        options.method = 'POST';
        options.body = JSON.stringify({
          owner_sub: claims.sub,
          backup: JSON.parse(snapshot),
        });
      } else {
        url.searchParams.set('select', 'backup');
        url.searchParams.set('owner_sub', 'eq.' + claims.sub);
      }
      const response = await fetch(url, options);
      if (!response.ok) throw new Error('Cloud backup request failed');
      if (!save) {
        const [row] = await response.json();
        if (!row) {
          showBackupResult('No cloud backup found for this account.');
          return;
        }
        if (revision !== currentRevision()) {
          showBackupResult('Training data changed during restore. Try restoring again.');
          return;
        }
        window.fit24Backup.restoreJson(JSON.stringify(row.backup));
      }
      const backedUpRevision = save ? revision : currentRevision();
      if (backedUpRevision) localStorage.setItem(savedRevisionKey(account), backedUpRevision);
      if (!automatic) showBackupResult(save ? 'Cloud backup saved.' : 'Cloud backup restored.');
    } catch {
      retry = automatic;
      if (!automatic) {
        showBackupResult(save ? 'Could not save the cloud backup.' : 'Could not restore the cloud backup.');
      }
    } finally {
      button.disabled = saveButton.disabled = restoreButton.disabled = false;
      scheduleAutosave(retry ? 30000 : undefined);
    }
  }

  saveButton.addEventListener('click', () => runBackup(true));
  restoreButton.addEventListener('click', () => runBackup(false));

  function showStatus(message) {
    status.textContent = message;
    status.title = message;
  }

  function loadSdk() {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = sdkUrl;
      script.onload = resolve;
      script.onerror = reject;
      document.head.append(script);
    });
  }

  async function loadCloudMessage() {
    if (!supabaseUrl || !publishableKey) return;

    cloudMessage.hidden = false;
    cloudMessage.textContent = 'Loading cloud message…';
    try {
      const claims = await client.getIdTokenClaims();
      if (!claims?.__raw) throw new Error('Missing ID token');

      const url = new URL('/rest/v1/fit24_footer', supabaseUrl);
      url.searchParams.set('select', 'message');
      url.searchParams.set('id', 'eq.1');
      const response = await fetch(url, {
        cache: 'no-store',
        headers: {
          apikey: publishableKey,
          Authorization: 'Bearer ' + claims.__raw,
        },
      });
      if (!response.ok) throw new Error('Cloud request failed');

      const [row] = await response.json();
      if (user) cloudMessage.textContent = row?.message ?? 'Cloud message unavailable.';
    } catch {
      if (user) cloudMessage.textContent = 'Could not load the cloud message.';
    }
  }

  async function initialize() {
    const url = new URL(location.href);
    const isCallback =
      url.searchParams.has('state') &&
      (url.searchParams.has('code') || url.searchParams.has('error'));

    await loadSdk();
    client = new window.auth0.Auth0Client({
      domain: 'dev-jx7ti74pu5j5dw4u.us.auth0.com',
      clientId: 'nI0M7eCyPn4kAxNfGicSRQUY2RnLDp0h',
      authorizationParams: { redirect_uri: appUrl },
      authorizeTimeoutInSeconds: 10,
    });

    if (isCallback) {
      try {
        await client.handleRedirectCallback();
      } finally {
        for (const key of ['code', 'state', 'error', 'error_description']) {
          url.searchParams.delete(key);
        }
        history.replaceState(history.state, '', url);
      }
    } else {
      await client.checkSession();
    }

    const profile = await client.getUser();
    if (profile && !profile.sub?.startsWith('google-oauth2|')) {
      await client.logout({ openUrl: false });
      throw new Error('A Google account is required.');
    }
    user = profile;
    backupActions.hidden = !user;
    button.textContent = user ? 'Sign out' : 'Sign in with Google';
    showStatus(user ? 'Signed in as ' + (user.email || user.name || 'Google user') : 'Signed out');
    scheduleAutosave();
    if (user) void loadCloudMessage();
  }

  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      if (!client) await initialize();
      if (user) {
        signingOut = true;
        clearTimeout(autosaveTimer);
        backupActions.hidden = true;
        hideBackupResult();
        cloudMessage.hidden = true;
        cloudMessage.textContent = '';
        await client.logout({ logoutParams: { returnTo: appUrl } });
      } else {
        await client.loginWithRedirect({
          authorizationParams: { connection: 'google-oauth2' },
        });
      }
    } catch {
      signingOut = false;
      scheduleAutosave();
      backupActions.hidden = !user;
      showStatus(user ? 'Could not sign out. Try again.' : 'Could not sign in. Try again.');
      button.disabled = false;
    }
  });

  initialize()
    .catch(() => showStatus('Could not verify sign-in.'))
    .finally(() => {
      button.disabled = false;
    });
})();
