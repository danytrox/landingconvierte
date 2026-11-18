import { Loader2, LogIn, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BrandMark } from './BrandMark';

interface Props {
  mode: 'github' | 'local' | 'unconfigured';
  busy: boolean;
  error?: string | null;
  onLogin: () => void;
}

export function Login({ mode, busy, error, onLogin }: Props) {
  return (
    <main className="blueprint grid min-h-dvh place-items-center px-4 py-10">
      <Card className="w-full max-w-md gap-8 border-[var(--regla-fuerte)] bg-card/90 py-8 shadow-[0_0_60px_rgba(155,107,255,.18)] backdrop-blur">
        <CardHeader className="gap-5 px-6 sm:px-8">
          <div className="flex items-center gap-3 text-lg font-bold tracking-tight">
            <BrandMark />
            LandingConvierte
          </div>
          <div className="grid gap-3">
            <CardTitle className="font-display text-5xl">Editor de contenido</CardTitle>
            <CardDescription className="text-base leading-relaxed">
              Cambia los textos de tu página y publícalos con un clic. No necesitas saber programar.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 px-6 sm:px-8">
          <Button
            size="lg"
            className="glow-signal h-12 text-base font-bold"
            disabled={busy || mode === 'unconfigured'}
            onClick={onLogin}
          >
            {busy ? <Loader2 className="animate-spin" /> : <LogIn />}
            {mode === 'local' ? 'Entrar (modo local)' : 'Entrar con GitHub'}
          </Button>
          {mode === 'local' && (
            <p className="text-sm text-muted-foreground">Modo local: lee y guarda los archivos de content/ de este equipo, sin GitHub.</p>
          )}
          {mode === 'github' && (
            <p className="text-sm text-muted-foreground">Se abrirá una ventana de GitHub para confirmar que eres tú.</p>
          )}
          {mode === 'unconfigured' && (
            <p className="flex gap-2 text-sm text-destructive">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              El inicio de sesión todavía no está configurado (falta CMS_AUTH_BASE_URL en Cloudflare Pages).
            </p>
          )}
          {error && (
            <p role="alert" className="flex gap-2 text-sm text-destructive">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />{error}
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
