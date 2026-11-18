import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Login } from '@/components/Login';
import { Editor } from '@/components/Editor';
import { PAGES } from '@/lib/schema';
import { serializeContent } from '@/lib/json';
import { type Backend, type StoredFile, REPO, githubBackend, localBackend } from '@/lib/backend';
import { canPush } from '@/lib/github';
import { loginWithPopup } from '@/lib/oauth';
import { readToken, writeToken } from '@/lib/session';
import { validatePage } from '@/lib/validate';

interface Config { authBaseUrl: string | null; local?: boolean }
interface FileState { original: StoredFile; baseline: string; draft: unknown }
type Files = Record<string, FileState>;

const statusOf = (e: unknown) => (e && typeof e === 'object' && 'status' in e ? Number((e as { status: unknown }).status) : 0);
const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e));

// Local mode exists only in the Vite dev server; production builds never include it.
const LOCAL = import.meta.env.DEV;

async function loadAll(backend: Backend, previous: Files | null): Promise<Files> {
  const loaded = await Promise.all(PAGES.map(p => backend.load(p.path)));
  return Object.fromEntries(PAGES.map((page, i) => {
    const original = loaded[i];
    const baseline = serializeContent(JSON.parse(original.text));
    const prev = previous?.[page.id];
    // Keep unpublished edits across a re-login when the file did not change meanwhile.
    const draft = prev && prev.original.sha === original.sha ? prev.draft : JSON.parse(original.text);
    return [page.id, { original, baseline, draft }];
  }));
}

export default function App() {
  const [config, setConfig] = useState<Config | null>(null);
  const [backend, setBackend] = useState<Backend | null>(null);
  const [files, setFiles] = useState<Files | null>(null);
  const [busy, setBusy] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [conflict, setConflict] = useState(false);

  const logout = useCallback((message?: string) => {
    writeToken(null);
    setBackend(null);
    if (message) toast.error(message);
  }, []);

  const handleError = useCallback((e: unknown) => {
    const status = statusOf(e);
    if (status === 401) logout('Tu sesión expiró. Vuelve a entrar con GitHub; tus cambios sin publicar se mantienen.');
    else if (status === 409 || status === 422) setConflict(true);
    else toast.error('No se pudo completar la acción', { description: messageOf(e) });
  }, [logout]);

  const open = useCallback(async (next: Backend) => {
    setBusy(true);
    setLoginError(null);
    try {
      const loaded = await loadAll(next, files);
      setFiles(loaded);
      setBackend(next);
    } catch (e) {
      if (statusOf(e) === 401) { writeToken(null); setLoginError('Tu sesión expiró. Vuelve a entrar.'); }
      else setLoginError(`No se pudo cargar el contenido: ${messageOf(e)}`);
    } finally {
      setBusy(false);
    }
  }, [files]);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}config.json`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : { authBaseUrl: null }))
      .catch(() => ({ authBaseUrl: null }))
      .then((c: Config) => {
        setConfig(c);
        const token = readToken();
        if (!LOCAL && token) void open(githubBackend(token));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on load
  }, []);

  const login = async () => {
    if (LOCAL && config?.local) { await open(localBackend()); return; }
    if (!config?.authBaseUrl) return;
    setBusy(true);
    setLoginError(null);
    try {
      const token = await loginWithPopup(config.authBaseUrl);
      if (!(await canPush({ token, repo: REPO }))) {
        setLoginError('Tu cuenta de GitHub no tiene permiso para editar este sitio. Pide acceso al repositorio.');
        setBusy(false);
        return;
      }
      writeToken(token);
      await open(githubBackend(token));
    } catch (e) {
      setLoginError(messageOf(e));
      setBusy(false);
    }
  };

  const dirtyPages = useMemo(() => new Set(
    files ? PAGES.filter(p => serializeContent(files[p.id].draft) !== files[p.id].baseline).map(p => p.id) : []
  ), [files]);

  useEffect(() => {
    if (dirtyPages.size === 0) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirtyPages]);

  const siteUrl = useMemo(() => {
    const domain = files ? (JSON.parse(files.site.original.text) as { domain?: string }).domain : undefined;
    return domain || 'https://landingconvierte.cl';
  }, [files]);

  const publish = async () => {
    if (!backend || !files) return;
    const problems = PAGES.filter(p => dirtyPages.has(p.id)).flatMap(p => validatePage(p, files[p.id].draft));
    if (problems.length) {
      toast.error('Revisa estos campos antes de publicar', {
        description: problems.slice(0, 4).map(p => `${p.section}: ${p.message}`).join(' · ')
      });
      return;
    }
    setPublishing(true);
    try {
      for (const page of PAGES) {
        const file = files[page.id];
        const text = serializeContent(file.draft);
        if (text === file.baseline) continue;
        const sha = await backend.save(page.path, text, file.original.sha);
        setFiles(prev => prev && ({ ...prev, [page.id]: { ...prev[page.id], original: { text, sha }, baseline: text } }));
      }
      toast.success('Publicado. Tu página se actualiza en ~1 minuto.', {
        duration: 10000,
        action: { label: 'Ver página', onClick: () => window.open(siteUrl, '_blank', 'noopener') }
      });
    } catch (e) {
      handleError(e);
    } finally {
      setPublishing(false);
    }
  };

  const discard = () => {
    setFiles(prev => prev && Object.fromEntries(Object.entries(prev).map(([id, f]) => [id, { ...f, draft: JSON.parse(f.original.text) }])));
    toast('Cambios descartados');
  };

  const reload = async () => {
    if (!backend) return;
    setConflict(false);
    try {
      setFiles(await loadAll(backend, null));
      toast('Contenido actualizado con la última versión publicada.');
    } catch (e) {
      handleError(e);
    }
  };

  if (!config) {
    return <div className="blueprint grid min-h-dvh place-items-center"><Loader2 className="size-6 animate-spin text-primary" /></div>;
  }

  if (!backend || !files) {
    const mode = LOCAL && config.local ? 'local' : config.authBaseUrl ? 'github' : 'unconfigured';
    return <Login mode={mode} busy={busy} error={loginError} onLogin={login} />;
  }

  return (
    <>
      <Editor
        drafts={Object.fromEntries(Object.entries(files).map(([id, f]) => [id, f.draft]))}
        dirtyPages={dirtyPages}
        onDraft={(id, draft) => setFiles(prev => prev && ({ ...prev, [id]: { ...prev[id], draft } }))}
        onPublish={publish}
        onDiscard={discard}
        onLogout={() => {
          if (dirtyPages.size && !window.confirm('Tienes cambios sin publicar. ¿Salir igual? Se perderán.')) return;
          setFiles(null);
          logout();
        }}
        publishing={publishing}
        siteUrl={siteUrl}
        local={backend.kind === 'local'}
      />
      <AlertDialog open={conflict} onOpenChange={setConflict}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>El contenido cambió mientras editabas</AlertDialogTitle>
            <AlertDialogDescription>
              Alguien publicó otra versión desde otro lugar. Recarga para traer la última versión publicada.
              Tus cambios sin publicar se perderán; si los necesitas, cópialos antes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Ahora no</AlertDialogCancel>
            <AlertDialogAction onClick={reload}>Recargar contenido</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
