# Publicar LandingConvierte

## Opción recomendada: Cloudflare Pages + GitHub

1. Crear un repositorio público o privado en GitHub, por ejemplo `nexo-web`.
2. Desde esta carpeta ejecutar:

```bash
git init
git add index.html README_DEPLOY.md
git commit -m "Crear landing LandingConvierte"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/landingconvierte.git
git push -u origin main
```

3. En Cloudflare abrir **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**.
4. Elegir GitHub y el repositorio `nexo-web`.
5. Para esta landing usar:
   - Framework preset: `None`
   - Build command: vacío
   - Build output directory: `/`
6. Publicar.
7. En **Custom domains**, agregar el dominio comprado en NIC Chile.
8. En NIC Chile configurar los nameservers que entregue Cloudflare.

## Antes de publicar

Reemplazar en `index.html`:

- `56900000000` por el WhatsApp real.
- `$___` por el precio o texto comercial definitivo.
- `LandingConvierte` por el nombre final de la marca.
El dominio ya está configurado en la landing como `https://landingconvierte.cl/`. Si cambia en el futuro, actualizar también `index.html`, `robots.txt` y `sitemap.xml`.

Los archivos `robots.txt` y `sitemap.xml` ya están creados con la URL `https://landingconvierte.cl/`.

## Formulario de contacto sin backend

La landing usa Web3Forms, compatible con GitHub Pages y Cloudflare Pages:

1. Crear una cuenta gratuita en https://web3forms.com/.
2. Generar un Access Key para el correo que recibirá las consultas.
3. Reemplazar `YOUR_ACCESS_KEY_HERE` en `index.html` por esa clave.
4. Publicar nuevamente.

El plan gratuito publicado por Web3Forms indica 250 envíos mensuales. No pongas una contraseña ni una API privada en el HTML; el Access Key de Web3Forms está diseñado para usarse en formularios frontend.

Alternativa totalmente Cloudflare: un Worker puede recibir el formulario, pero el envío saliente de correo de Cloudflare Email Service requiere Workers Paid. Por eso Web3Forms es la opción gratuita más simple para esta landing.
## GitHub Pages como alternativa

En el repositorio: **Settings** → **Pages** → publicar desde `main` y `/root`. Luego agregar el dominio personalizado y configurar DNS según GitHub. Cloudflare Pages sigue siendo la opción recomendada porque conecta el repositorio y el dominio desde el mismo servicio.
