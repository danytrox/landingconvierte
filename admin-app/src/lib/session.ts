// GitHub token kept in this browser only (storage can be unavailable: never throw).
const KEY = 'landingconvierte-admin-token';

export function readToken(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}
export function writeToken(token: string | null) {
  try {
    if (token) localStorage.setItem(KEY, token);
    else localStorage.removeItem(KEY);
  } catch { /* storage blocked: the session just won't survive a reload */ }
}
export function readFlag(key: string): boolean {
  try { return localStorage.getItem(key) === '1'; } catch { return false; }
}
export function writeFlag(key: string, value: boolean) {
  try { localStorage.setItem(key, value ? '1' : '0'); } catch { /* ignore */ }
}
