import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Loader2, LogOut, Menu, RotateCcw, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { PAGES, type Page, type Section } from '@/lib/schema';
import { readFlag, writeFlag } from '@/lib/session';
import { BrandMark } from './BrandMark';
import { FieldList } from './FieldEditor';

const ADVANCED_KEY = 'landingconvierte-admin-advanced';

interface Props {
  drafts: Record<string, unknown>;
  dirtyPages: Set<string>;
  onDraft: (pageId: string, draft: unknown) => void;
  onPublish: () => void;
  onDiscard: () => void;
  onLogout: () => void;
  publishing: boolean;
  siteUrl: string;
  local: boolean;
}

const visibleSections = (page: Page, advanced: boolean) => page.sections.filter(s => advanced || !s.advanced);

function Sidebar({ current, onSelect, dirtyPages, advanced, onAdvanced }: {
  current: { page: string; section: string };
  onSelect: (page: string, section: string) => void;
  dirtyPages: Set<string>;
  advanced: boolean;
  onAdvanced: (v: boolean) => void;
}) {
  return (
    <nav aria-label="Secciones" className="flex h-full flex-col gap-6">
      {PAGES.map(page => (
        <div key={page.id} className="grid gap-1">
          <p className="flex items-center gap-2 px-3 pb-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            {page.label}
            {dirtyPages.has(page.id) && <span className="size-2 rounded-full bg-primary shadow-[0_0_8px_var(--neon)]" aria-label="con cambios" />}
          </p>
          {visibleSections(page, advanced).map(section => {
            const active = current.page === page.id && current.section === section.id;
            return (
              <button
                key={section.id}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => onSelect(page.id, section.id)}
                className={cn(
                  'relative rounded-md px-3 py-2 text-left text-[0.95rem] transition-colors',
                  active ? 'bg-accent font-semibold text-foreground' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                )}
              >
                {active && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded bg-primary shadow-[0_0_10px_var(--neon)]" />}
                {section.label}
                {section.advanced && <span className="ml-2 text-xs text-muted-foreground">(avanzado)</span>}
              </button>
            );
          })}
        </div>
      ))}
      <div className="mt-auto grid gap-2 rounded-lg border border-border p-3">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="advanced" className="text-sm">Opciones avanzadas</Label>
          <Switch id="advanced" checked={advanced} onCheckedChange={onAdvanced} />
        </div>
        <p className="text-xs leading-snug text-muted-foreground">Muestra datos técnicos (SEO avanzado, claves). Normalmente no necesitas tocarlos.</p>
      </div>
    </nav>
  );
}

export function Editor({ drafts, dirtyPages, onDraft, onPublish, onDiscard, onLogout, publishing, siteUrl, local }: Props) {
  const [advanced, setAdvanced] = useState(() => readFlag(ADVANCED_KEY));
  const [current, setCurrent] = useState({ page: 'index', section: 'hero' });
  const [menuOpen, setMenuOpen] = useState(false);

  const page = PAGES.find(p => p.id === current.page)!;
  const sections = visibleSections(page, advanced);
  const section: Section = sections.find(s => s.id === current.section) ?? sections[0];
  const dirtyCount = dirtyPages.size;

  useEffect(() => { writeFlag(ADVANCED_KEY, advanced); }, [advanced]);

  const select = (pageId: string, sectionId: string) => {
    setCurrent({ page: pageId, section: sectionId });
    setMenuOpen(false);
    window.scrollTo({ top: 0 });
  };

  const draft = drafts[page.id] as Record<string, unknown>;
  const value = section.key ? draft[section.key] : draft;
  const change = (v: unknown) => onDraft(page.id, section.key ? { ...draft, [section.key]: v } : v);

  const liveUrl = useMemo(() => {
    const base = siteUrl.replace(/\/$/, '');
    return `${base}${page.livePath}${section.anchor ? `#${section.anchor}` : ''}`;
  }, [siteUrl, page, section]);

  const sidebar = (
    <Sidebar current={{ page: page.id, section: section.id }} onSelect={select} dirtyPages={dirtyPages} advanced={advanced} onAdvanced={setAdvanced} />
  );

  return (
    <div className="min-h-dvh bg-background">
      <header className="neon-rule sticky top-0 z-40 bg-[rgba(7,12,31,.82)] backdrop-blur-md">
        <div className="mx-auto flex min-h-16 max-w-[1400px] items-center gap-2 px-4 sm:gap-3 sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir secciones" onClick={() => setMenuOpen(true)}>
            <Menu />
          </Button>
          <div className="mr-auto flex min-w-0 items-center gap-2.5 font-bold tracking-tight">
            <BrandMark className="size-7" />
            <span className="hidden sm:inline">LandingConvierte</span>
            <span className="hidden text-muted-foreground md:inline">· Editor</span>
            {local && <Badge variant="outline" className="border-violeta/60 text-violeta">Modo local</Badge>}
          </div>
          {dirtyCount > 0 && (
            <Badge className="hidden border-primary/50 bg-primary/10 text-primary sm:inline-flex" variant="outline">
              Cambios sin publicar
            </Badge>
          )}
          <Button variant="ghost" size="sm" asChild className="hidden md:inline-flex">
            <a href={siteUrl} target="_blank" rel="noopener noreferrer"><ExternalLink /> Ver página</a>
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={dirtyCount === 0 || publishing} aria-label="Descartar cambios">
                <RotateCcw /> <span className="hidden sm:inline">Descartar cambios</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Descartar los cambios sin publicar?</AlertDialogTitle>
                <AlertDialogDescription>Todo vuelve a como está publicado ahora. Esto no se puede deshacer.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Seguir editando</AlertDialogCancel>
                <AlertDialogAction onClick={onDiscard}>Descartar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button size="sm" className="glow-signal font-bold" disabled={dirtyCount === 0 || publishing} onClick={onPublish}>
            {publishing ? <Loader2 className="animate-spin" /> : <Send />}
            {publishing ? 'Publicando…' : 'Publicar cambios'}
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Salir" onClick={onLogout}><LogOut /></Button>
            </TooltipTrigger>
            <TooltipContent>Salir</TooltipContent>
          </Tooltip>
        </div>
      </header>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-80 overflow-y-auto bg-background p-4">
          <SheetHeader className="p-0 pb-2">
            <SheetTitle>Secciones</SheetTitle>
            <SheetDescription>Elige qué parte de tu página quieres editar.</SheetDescription>
          </SheetHeader>
          {sidebar}
        </SheetContent>
      </Sheet>

      <div className="mx-auto grid max-w-[1400px] lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] overflow-y-auto border-r border-border px-4 py-6 lg:block">
          {sidebar}
        </aside>

        <main className="blueprint min-h-[calc(100dvh-4rem)] px-4 py-6 sm:px-8 sm:py-10">
          <div className="mx-auto grid max-w-3xl gap-6">
            {dirtyCount > 0 && (
              <p className="flex items-center gap-2 text-sm text-primary sm:hidden">
                <span className="size-2 rounded-full bg-primary" /> Cambios sin publicar
              </p>
            )}
            <div className="grid gap-2">
              <p className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">{page.label}</p>
              <Separator className="max-w-24 bg-primary/60" />
            </div>
            <Card className="gap-6 border-[var(--regla-fuerte)] bg-card/95 shadow-[0_20px_60px_rgba(0,0,0,.35)]">
              <CardHeader className="gap-3 px-5 sm:px-8">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <CardTitle className="font-display text-4xl sm:text-5xl">{section.label}</CardTitle>
                  <Button variant="link" size="sm" asChild className="px-0 text-primary">
                    <a href={liveUrl} target="_blank" rel="noopener noreferrer"><ExternalLink /> Ver en la página</a>
                  </Button>
                </div>
                {section.description && <CardDescription className="text-base">{section.description}</CardDescription>}
              </CardHeader>
              <CardContent className="px-5 sm:px-8">
                <fieldset disabled={publishing} className="min-w-0">
                  <FieldList
                    key={`${page.id}.${section.id}`}
                    fields={section.fields}
                    value={value}
                    onChange={change}
                    id={`${page.id}.${section.id}`}
                    showAdvanced={advanced}
                  />
                </fieldset>
              </CardContent>
            </Card>
            <p className="text-center text-sm text-muted-foreground">
              Tus cambios quedan guardados aquí hasta que presiones <strong className="text-foreground">Publicar cambios</strong>.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
