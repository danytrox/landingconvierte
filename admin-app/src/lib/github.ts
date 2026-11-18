// Minimal GitHub contents API client (read a file, commit a new version of it).
const API = 'https://api.github.com';

type FetchFn = typeof fetch;

export class GitHubError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'GitHubError';
    this.status = status;
  }
}

export function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export function base64ToUtf8(b64: string): string {
  const binary = atob(b64.replace(/\s/g, ''));
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function buildPutBody({ path, text, sha, branch }: { path: string; text: string; sha: string; branch: string }) {
  return { message: `content: update ${path}`, content: utf8ToBase64(text), sha, branch };
}

const headers = (token: string) => ({
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${token}`,
  'X-GitHub-Api-Version': '2022-11-28'
});

const encodePath = (path: string) => path.split('/').map(encodeURIComponent).join('/');

async function request(fetchFn: FetchFn, url: string, init: RequestInit) {
  let res: Response;
  try {
    res = await fetchFn(url, init);
  } catch {
    throw new GitHubError(0, 'No se pudo conectar con GitHub. Revisa tu conexión a internet.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new GitHubError(res.status, (data as { message?: string }).message || `GitHub respondió ${res.status}`);
  return data as Record<string, unknown>;
}

interface Common { token: string; repo: string; branch: string; path: string; fetch?: FetchFn }

export async function loadFile({ token, repo, branch, path, fetch: fetchFn = fetch }: Common) {
  const url = `${API}/repos/${repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(branch)}`;
  const data = await request(fetchFn, url, { headers: headers(token), cache: 'no-store' });
  return { sha: String(data.sha), text: base64ToUtf8(String(data.content ?? '')) };
}

export async function saveFile({ token, repo, branch, path, text, sha, fetch: fetchFn = fetch }: Common & { text: string; sha: string }) {
  const url = `${API}/repos/${repo}/contents/${encodePath(path)}`;
  const data = await request(fetchFn, url, {
    method: 'PUT',
    headers: { ...headers(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(buildPutBody({ path, text, sha, branch }))
  });
  return String((data.content as { sha?: string } | undefined)?.sha ?? '');
}

export async function canPush({ token, repo, fetch: fetchFn = fetch }: { token: string; repo: string; fetch?: FetchFn }) {
  const data = await request(fetchFn, `${API}/repos/${repo}`, { headers: headers(token) });
  return Boolean((data.permissions as { push?: boolean } | undefined)?.push);
}
