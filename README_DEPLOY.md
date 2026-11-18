# Publicar LandingConvierte

## Antes de mergear

Este cambio reemplaza las páginas HTML de la raíz por `content/*.json` + `node build.mjs`. Si se mergea a `main` sin estos pasos, Cloudflare Pages deja el sitio sin páginas o el CMS sin login:

- [ ] **Build de Cloudflare Pages** (Settings → Builds): build command `node build.mjs`, build output directory `dist`.
- [ ] **Variable `CMS_AUTH_BASE_URL`** en Cloudflare Pages (Settings → Variables and secrets) con la URL del Worker desplegado, por ejemplo `https://landingconvierte-cms-auth.TU-CUENTA.workers.dev`. El build la escribe en `dist/admin/config.yml`; sin ella el login del CMS no funciona y el build muestra un aviso.
- [ ] **Worker y OAuth App**: desplegar `worker/` con wrangler y crear la OAuth App de GitHub (pasos 1 a 3 de [Editar el contenido con Decap CMS](#editar-el-contenido-con-decap-cms)).
- [ ] **CI en verde**: el workflow `Build` (`.github/workflows/build.yml`) genera el sitio y corre los tests en cada push y pull request.

Correr los tests en local (Node 22, sin dependencias):

```bash
npm test            # equivale a: node --test "test/*.test.mjs"
```

Los tests generan el sitio en una carpeta temporal y comprueban que `index.html` y `landing-page.html` sigan siendo equivalentes a las páginas originales (`test/fixtures/`), que se publique `/admin` y que `dist/` no incluya archivos internos (`build.mjs`, `content/`, `worker/`…). Si se cambia un texto a propósito, actualizar el fixture correspondiente.

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
   - Build command: `node build.mjs`
   - Build output directory: `dist`
6. Publicar.
7. En **Custom domains**, agregar el dominio comprado en NIC Chile.
8. En NIC Chile configurar los nameservers que entregue Cloudflare.

## Estructura del sitio

Las páginas se generan: el contenido vive en `content/*.json` y `build.mjs` arma `dist/`.

- `content/site.json`: marca, menú y pie de página. `content/index.json` y `content/landing-page.json`: textos de cada página (SEO, secciones, preguntas frecuentes, formulario).
- `build.mjs`: plantillas HTML. Genera `dist/index.html` y `dist/landing-page.html` y copia los archivos estáticos. Cloudflare Pages sirve `landing-page.html` como `/landing-page`.
- `admin/`: Decap CMS (`index.html` + `config.yml`). `worker/`: proxy OAuth de GitHub para Decap.
- `styles.css` y `main.js`: estilos y comportamiento compartidos (menú móvil, demo del hero, envío del formulario). La demo del hero lee sus rubros del bloque `demo-data` que genera el build.
- `fonts/archivo-latin.woff2`: tipografía Archivo (licencia OFL), servida desde el propio dominio.
- `404.html`: página de error. `_headers`: cabeceras de seguridad y caché para Cloudflare Pages.
- `robots.txt`, `sitemap.xml`, `site.webmanifest`, `favicon.svg`, `apple-touch-icon.png`, `logo.png`, `og-image.png`.

Si el dominio cambia, actualizar `content/` (o desde el CMS), `robots.txt`, `sitemap.xml`, `admin/config.yml` y `ALLOWED_ORIGIN` en `worker/wrangler.toml`.

Probar en local (requiere Node 18+):

```bash
node build.mjs
python3 -m http.server --directory dist
```

y abrir `http://localhost:8000/`.

## Editar el contenido con Decap CMS

El panel queda en `https://landingconvierte.cl/admin/`. Al guardar, Decap hace un commit en `main` y Cloudflare Pages vuelve a publicar solo (1-2 minutos).

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

4. **Apuntar Decap al Worker**: en `admin/config.yml`, reemplazar `base_url` por la URL del Worker y hacer commit.

5. **Cambiar el build de Cloudflare Pages** (Settings → Builds): build command `node build.mjs`, output directory `dist`. Hacerlo antes o junto con el merge de este cambio a `main`, porque las páginas HTML ya no están en la raíz del repositorio.

Solo pueden editar las cuentas de GitHub con permiso de escritura en el repositorio. El Worker solo entrega el token al origen definido en `ALLOWED_ORIGIN` y valida el parámetro `state` del flujo OAuth.

## Formulario de contacto sin backend

La landing usa Web3Forms, compatible con GitHub Pages y Cloudflare Pages:

1. Crear una cuenta gratuita en https://web3forms.com/.
2. Generar un Access Key para el correo que recibirá las consultas.
3. Poner esa clave en `contact.web3formsAccessKey` de `content/index.json` (o en el CMS: Página de inicio → Formulario de contacto).
4. Publicar nuevamente.

El plan gratuito publicado por Web3Forms indica 250 envíos mensuales. No pongas una contraseña ni una API privada en el HTML; el Access Key de Web3Forms está diseñado para usarse en formularios frontend.

Alternativa totalmente Cloudflare: un Worker puede recibir el formulario, pero el envío saliente de correo de Cloudflare Email Service requiere Workers Paid. Por eso Web3Forms es la opción gratuita más simple para esta landing.
## GitHub Pages como alternativa

En el repositorio: **Settings** → **Pages** → publicar con GitHub Actions ejecutando `node build.mjs` y subiendo `dist/`. Luego agregar el dominio personalizado y configurar DNS según GitHub. Cloudflare Pages sigue siendo la opción recomendada porque conecta el repositorio y el dominio desde el mismo servicio.
