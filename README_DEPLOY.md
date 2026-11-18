# Publicar LandingConvierte

## Antes de mergear

Este cambio reemplaza las páginas HTML de la raíz por `content/*.json` + un build (`npm run build`). **Cambiar la configuración de Cloudflare Pages ANTES de mergear a `main`**: si se mergea primero, el build de producción usa el comando viejo y el sitio queda en 404 o con el panel sin login.

- [ ] **Build de Cloudflare Pages** (Settings → Builds): build command `npm ci && npm run build`, build output directory `dist`, Node 22 (variable `NODE_VERSION=22`).
- [ ] **Variable `CMS_AUTH_BASE_URL`** en Cloudflare Pages (Settings → Variables and secrets) con la URL del Worker desplegado, por ejemplo `https://landingconvierte-cms-auth.TU-CUENTA.workers.dev`. El build la escribe en `dist/admin/config.json`. En el build de producción (rama `main`) es obligatoria: sin ella el build falla. En previews y en local solo muestra un aviso.
- [ ] **Worker y OAuth App**: desplegar `worker/` con wrangler y crear la OAuth App de GitHub (pasos 1 a 3 de [Editar el contenido](#editar-el-contenido)).
- [ ] **CI en verde**: el workflow `Build` (`.github/workflows/build.yml`) corre `npm ci`, `npm run build` y `npm test` en cada push y pull request.

Correr los tests en local (Node 22):

```bash
npm ci
npm run build       # panel (admin-app/ → admin-app/dist) + sitio (dist/)
npm test            # node --test "test/*.test.mjs"; necesita el panel ya compilado
```

Los tests generan el sitio en carpetas temporales y comprueban que `index.html` y `landing-page.html` sigan siendo equivalentes a las páginas originales (`test/fixtures/`), que se publique `/admin` con su `config.json` y sin scripts de terceros, y que `dist/` no incluya archivos internos (`build.mjs`, `content/`, `worker/`, `admin-app/`…). También prueban las piezas del panel: formato del JSON guardado, el commit a GitHub y el login. Si se cambia un texto a propósito, actualizar el fixture correspondiente.

## Opción recomendada: Cloudflare Pages + GitHub

1. Crear un repositorio público o privado en GitHub, por ejemplo `landingconvierte`.
2. Desde esta carpeta ejecutar:

```bash
git init
git add .
git commit -m "Crear landing LandingConvierte"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/landingconvierte.git
git push -u origin main
```

3. En Cloudflare abrir **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**.
4. Elegir GitHub y el repositorio `landingconvierte`.
5. Para esta landing usar:
   - Framework preset: `None`
   - Build command: `npm ci && npm run build`
   - Build output directory: `dist`
   - Variables: `NODE_VERSION=22` y `CMS_AUTH_BASE_URL` (ver [Editar el contenido](#editar-el-contenido))
6. Publicar.
7. En **Custom domains**, agregar el dominio comprado en NIC Chile.
8. En NIC Chile configurar los nameservers que entregue Cloudflare.

## Estructura del sitio

Las páginas se generan: el contenido vive en `content/*.json` y `build.mjs` arma `dist/`.

- `content/site.json`: marca, menú y pie de página. `content/index.json` y `content/landing-page.json`: textos de cada página (SEO, secciones, preguntas frecuentes, formulario).
- `build.mjs`: plantillas HTML. Genera `dist/index.html` y `dist/landing-page.html` y copia los archivos estáticos. Cloudflare Pages sirve `landing-page.html` como `/landing-page`.
- `admin-app/`: código del panel de edición `/admin` (React + Vite + Tailwind + shadcn/ui). `npm run build` lo compila en `admin-app/dist/` y `build.mjs` lo copia a `dist/admin/` junto con `config.json`. `worker/`: proxy OAuth de GitHub para el login del panel.
- `styles.css` y `main.js`: estilos y comportamiento compartidos (menú móvil, demo del hero, envío del formulario). La demo del hero lee sus rubros del bloque `demo-data` que genera el build.
- `fonts/archivo-latin.woff2`: tipografía Archivo (licencia OFL), servida desde el propio dominio.
- `404.html`: página de error. `_headers`: cabeceras de seguridad y caché para Cloudflare Pages.
- `robots.txt`, `sitemap.xml`, `site.webmanifest`, `favicon.svg`, `apple-touch-icon.png`, `logo.png`, `og-image.png`.

Si el dominio cambia, actualizar `content/` (o desde el panel), `robots.txt`, `sitemap.xml` y `ALLOWED_ORIGIN` en `worker/wrangler.toml`. Si cambia el repositorio, actualizar `REPO` en `admin-app/src/lib/backend.ts`.

Probar en local (Node 22):

```bash
npm ci
npm run build
python3 -m http.server --directory dist
```

y abrir `http://localhost:8000/`.

## Editar el contenido

El panel queda en `https://landingconvierte.cl/admin/`: se entra con GitHub, se eligen la página y la sección en el menú de la izquierda, se editan los textos y se presiona **Publicar cambios**. Cada archivo cambiado se guarda con un commit en `main` (`content: update content/<archivo>.json`) y Cloudflare Pages vuelve a publicar solo (alrededor de 1 minuto). **Descartar cambios** vuelve a lo publicado. Los datos técnicos (SEO avanzado, clave de Web3Forms) quedan bajo el interruptor **Opciones avanzadas**.

Configuración única (todo gratis):

1. **Desplegar el Worker OAuth** (desde `worker/`):

   ```bash
   cd worker
   npx wrangler@3 login
   npx wrangler@3 deploy
   ```

   Anotar la URL que entrega, por ejemplo `https://landingconvierte-cms-auth.TU-CUENTA.workers.dev`.

2. **Crear una OAuth App en GitHub**: Settings → Developer settings → OAuth Apps → New OAuth App.
   - Homepage URL: `https://landingconvierte.cl`
   - Authorization callback URL: `<URL del Worker>/callback`

   Copiar el Client ID y generar un Client Secret.

3. **Guardar las credenciales en el Worker**:

   ```bash
   npx wrangler@3 secret put GITHUB_CLIENT_ID
   npx wrangler@3 secret put GITHUB_CLIENT_SECRET
   ```

4. **Apuntar el panel al Worker**: en Cloudflare Pages (Settings → Variables and secrets) crear `CMS_AUTH_BASE_URL` con la URL del Worker (https). No va en ningún archivo del repositorio: el build la escribe en `dist/admin/config.json`.

5. **Cambiar el build de Cloudflare Pages** (Settings → Builds): build command `npm ci && npm run build`, output directory `dist`. Hacerlo antes del merge de este cambio a `main`, porque las páginas HTML ya no están en la raíz del repositorio.

Solo pueden publicar las cuentas de GitHub con permiso de escritura en el repositorio (el panel lo comprueba al entrar). El Worker solo entrega el token al origen definido en `ALLOWED_ORIGIN` y valida el parámetro `state` del flujo OAuth. El panel guarda el token solo en ese navegador; si expira, pide entrar de nuevo sin perder los cambios sin publicar. Si alguien publicó otra versión mientras editabas, ofrece recargar la última.

Probar el panel sin GitHub (modo local, solo servidor de desarrollo):

```bash
npm run dev:admin   # http://localhost:5173/admin/ — lee y guarda content/*.json de esta carpeta
```

El modo local existe solo en `npm run dev:admin` (Vite en desarrollo); el build de producción no lo incluye. Con `CONTENT_DIR=/otra/carpeta` edita esa copia en vez de `content/`.

## Formulario de contacto sin backend

La landing usa Web3Forms, compatible con GitHub Pages y Cloudflare Pages:

1. Crear una cuenta gratuita en https://web3forms.com/.
2. Generar un Access Key para el correo que recibirá las consultas.
3. Poner esa clave en `contact.web3formsAccessKey` de `content/index.json` (o en el panel: Página de inicio → Formulario de contacto, con **Opciones avanzadas** activado).
4. Publicar nuevamente.

El plan gratuito publicado por Web3Forms indica 250 envíos mensuales. No pongas una contraseña ni una API privada en el HTML; el Access Key de Web3Forms está diseñado para usarse en formularios frontend.

Alternativa totalmente Cloudflare: un Worker puede recibir el formulario, pero el envío saliente de correo de Cloudflare Email Service requiere Workers Paid. Por eso Web3Forms es la opción gratuita más simple para esta landing.
## GitHub Pages como alternativa

En el repositorio: **Settings** → **Pages** → publicar con GitHub Actions ejecutando `npm ci && npm run build` y subiendo `dist/`. Luego agregar el dominio personalizado y configurar DNS según GitHub. Cloudflare Pages sigue siendo la opción recomendada porque conecta el repositorio y el dominio desde el mismo servicio.
