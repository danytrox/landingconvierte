// GitHub login through the OAuth worker (worker/src/index.js), same handshake Decap CMS used:
// popup -> 'authorizing:github' -> we echo it back -> 'authorization:github:<status>:<json>'.
export type AuthMessage =
  | { type: 'authorizing' }
  | { type: 'success'; token: string }
  | { type: 'error'; message: string };

const PREFIX = 'authorization:github:';

export function parseAuthMessage(data: unknown): AuthMessage | null {
  if (typeof data !== 'string') return null;
  if (data === 'authorizing:github') return { type: 'authorizing' };
  if (!data.startsWith(PREFIX)) return null;
  const rest = data.slice(PREFIX.length);
  const sep = rest.indexOf(':');
  if (sep < 0) return null;
  const status = rest.slice(0, sep);
  let payload: unknown;
  try { payload = JSON.parse(rest.slice(sep + 1)); } catch { return null; }
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as { token?: unknown; message?: unknown };
  if (status === 'success') return typeof p.token === 'string' && p.token ? { type: 'success', token: p.token } : null;
  if (status === 'error') return { type: 'error', message: typeof p.message === 'string' ? p.message : 'Error de autorización' };
  return null;
}

export function buildAuthUrl(authBaseUrl: string, siteId: string): string {
  const url = new URL('auth', authBaseUrl.endsWith('/') ? authBaseUrl : authBaseUrl + '/');
  url.searchParams.set('provider', 'github');
  url.searchParams.set('site_id', siteId);
  return url.toString();
}

// Opens the worker popup and resolves with the GitHub token.
export function loginWithPopup(authBaseUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const authOrigin = new URL(authBaseUrl).origin;
    const w = 600, h = 720;
    const left = window.screenX + (window.outerWidth - w) / 2;
    const top = window.screenY + (window.outerHeight - h) / 2;
    const popup = window.open(buildAuthUrl(authBaseUrl, window.location.host), 'github-login',
      `width=${w},height=${h},left=${left},top=${top}`);
    if (!popup) {
      reject(new Error('Tu navegador bloqueó la ventana de GitHub. Permite ventanas emergentes e inténtalo de nuevo.'));
      return;
    }
    const cleanup = () => { window.removeEventListener('message', onMessage); clearInterval(timer); };
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== authOrigin) return;
      const msg = parseAuthMessage(e.data);
      if (!msg) return;
      if (msg.type === 'authorizing') { popup.postMessage('authorizing:github', e.origin); return; }
      cleanup();
      popup.close();
      if (msg.type === 'success') resolve(msg.token);
      else reject(new Error(`GitHub no autorizó el acceso: ${msg.message}`));
    };
    const timer = setInterval(() => {
      if (popup.closed) { cleanup(); reject(new Error('Se cerró la ventana de GitHub antes de terminar.')); }
    }, 500);
    window.addEventListener('message', onMessage);
  });
}
