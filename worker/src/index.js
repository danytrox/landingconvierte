// GitHub OAuth proxy for Decap CMS (Cloudflare Worker).
// Routes: /auth starts the OAuth flow, /callback exchanges the code for a token
// and hands it to the Decap window through postMessage (only to ALLOWED_ORIGIN).
const STATE_COOKIE = 'decap_oauth_state';
const SCOPE = 'public_repo,user';

const randomHex = bytes => {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return [...buf].map(b => b.toString(16).padStart(2, '0')).join('');
};

const readCookie = (request, name) => {
  const header = request.headers.get('Cookie') || '';
  const match = header.split(/;\s*/).find(c => c.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : null;
};

const clearStateCookie = `${STATE_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;

const callbackPage = (origin, status, payload) => {
  const message = `authorization:github:${status}:${JSON.stringify(payload)}`;
  const js = s => JSON.stringify(s).replaceAll('<', '\\u003c');
  return new Response(`<!doctype html>
<html><body><p>Autorizando…</p>
<script>
  const origin = ${js(origin)};
  const message = ${js(message)};
  window.addEventListener('message', function onMessage(e) {
    if (e.origin !== origin) return;
    window.removeEventListener('message', onMessage);
    window.opener.postMessage(message, origin);
  });
  window.opener.postMessage('authorizing:github', origin);
</script></body></html>`, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Set-Cookie': clearStateCookie
    }
  });
};

const handleAuth = (url, env) => {
  if (url.searchParams.get('provider') !== 'github') {
    return new Response('Invalid provider', { status: 400 });
  }
  const state = randomHex(16);
  const authorize = new URL('https://github.com/login/oauth/authorize');
  authorize.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  authorize.searchParams.set('redirect_uri', `${url.origin}/callback`);
  authorize.searchParams.set('scope', SCOPE);
  authorize.searchParams.set('state', state);
  return new Response(null, {
    status: 302,
    headers: {
      Location: authorize.toString(),
      'Set-Cookie': `${STATE_COOKIE}=${state}; Path=/; Max-Age=600; HttpOnly; Secure; SameSite=Lax`
    }
  });
};

const handleCallback = async (request, url, env) => {
  const origin = env.ALLOWED_ORIGIN;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const expected = readCookie(request, STATE_COOKIE);
  if (!code || !state || !expected || state !== expected) {
    return callbackPage(origin, 'error', { message: 'Invalid OAuth state' });
  }
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'decap-oauth-worker'
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${url.origin}/callback`
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    return callbackPage(origin, 'error', { message: data.error_description || 'Token exchange failed' });
  }
  return callbackPage(origin, 'success', { token: data.access_token, provider: 'github' });
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/auth') return handleAuth(url, env);
    if (url.pathname === '/callback') return handleCallback(request, url, env);
    return new Response('Not found', { status: 404 });
  }
};
