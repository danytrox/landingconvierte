# Publicar LandingConvierte

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
   - Build command: vacío
   - Build output directory: `/`
6. Publicar.
7. En **Custom domains**, agregar el dominio comprado en NIC Chile.
8. En NIC Chile configurar los nameservers que entregue Cloudflare.

## Estructura del sitio

- `index.html` y `landing-page.html`: las dos páginas. Cloudflare Pages sirve `landing-page.html` como `/landing-page`.
- `styles.css` y `main.js`: estilos y comportamiento compartidos (menú móvil, demo del hero, envío del formulario).
- `fonts/archivo-latin.woff2`: tipografía Archivo (licencia OFL), servida desde el propio dominio.
- `404.html`: página de error. `_headers`: cabeceras de seguridad y caché para Cloudflare Pages.
- `robots.txt`, `sitemap.xml`, `site.webmanifest`, `favicon.svg`, `apple-touch-icon.png`, `logo.png`, `og-image.png`.

El dominio configurado es `https://landingconvierte.cl/`. Si cambia, actualizar `index.html`, `landing-page.html`, `robots.txt` y `sitemap.xml`.

Para probar en local hace falta un servidor (las rutas son absolutas): `python3 -m http.server` y abrir `http://localhost:8000/`.

## Formulario de contacto sin backend

La landing usa Web3Forms, compatible con GitHub Pages y Cloudflare Pages:

1. Crear una cuenta gratuita en https://web3forms.com/.
2. Generar un Access Key para el correo que recibirá las consultas.
3. Poner esa clave en el campo oculto `access_key` del formulario en `index.html`.
4. Publicar nuevamente.

El plan gratuito publicado por Web3Forms indica 250 envíos mensuales. No pongas una contraseña ni una API privada en el HTML; el Access Key de Web3Forms está diseñado para usarse en formularios frontend.

Alternativa totalmente Cloudflare: un Worker puede recibir el formulario, pero el envío saliente de correo de Cloudflare Email Service requiere Workers Paid. Por eso Web3Forms es la opción gratuita más simple para esta landing.
## GitHub Pages como alternativa

En el repositorio: **Settings** → **Pages** → publicar desde `main` y `/root`. Luego agregar el dominio personalizado y configurar DNS según GitHub. Cloudflare Pages sigue siendo la opción recomendada porque conecta el repositorio y el dominio desde el mismo servicio.
