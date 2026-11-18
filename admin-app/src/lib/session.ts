// GitHub token kept only for this browser tab (sessionStorage): it disappears when the tab
// closes, so a stolen or forgotten browser profile does not keep a write token around.
// Storage can be unavailable: never throw.
const KEY = 'landingconvierte-admin-token';

// Earlier versions stored the token in localStorage; remove it so it does not linger.
function wipeLegacyToken() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

export function readToken(): string | null {
  wipeLegacyToken();
  try { return sessionStorage.getItem(KEY); } catch { return null; }
}
export function writeToken(token: string | null) {
  wipeLegacyToken();
  try {
    if (token) sessionStorage.setItem(KEY, token);
    else sessionStorage.removeItem(KEY);
  } catch { /* storage blocked: the session just won't survive a reload */ }
}
export function readFlag(key: string): boolean {
  try { return localStorage.getItem(key) === '1'; } catch { return false; }
}
export function writeFlag(key: string, value: boolean) {
  try { localStorage.setItem(key, value ? '1' : '0'); } catch { /* ignore */ }
}
