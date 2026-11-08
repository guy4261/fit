(() => {
  const button = document.querySelector('#account-button');
  const status = document.querySelector('#account-status');
  const cloudMessage = document.querySelector('#cloud-message');
  const supabaseUrl = document.querySelector('meta[name="supabase-url"]').content;
  const publishableKey = document.querySelector('meta[name="supabase-publishable-key"]').content;
  const appUrl = 'https://guy4261.github.io/fit/';
  const sdkUrl = 'https://cdn.auth0.com/js/auth0-spa-js/2.30/auth0-spa-js.production.js';
  let client;
  let user;

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
    button.textContent = user ? 'Sign out' : 'Sign in with Google';
    showStatus(user ? 'Signed in as ' + (user.email || user.name || 'Google user') : 'Signed out');
    if (user) void loadCloudMessage();
  }

  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      if (!client) await initialize();
      if (user) {
        cloudMessage.hidden = true;
        cloudMessage.textContent = '';
        await client.logout({ logoutParams: { returnTo: appUrl } });
      } else {
        await client.loginWithRedirect({
          authorizationParams: { connection: 'google-oauth2' },
        });
      }
    } catch {
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
