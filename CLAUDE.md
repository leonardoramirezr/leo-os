# CLAUDE.md

Guía para Claude Code al trabajar en este repositorio. El `README.md` explica el proyecto para
quien lo usa; este archivo explica cómo moverse dentro de él y qué esperar de cada cambio.

## Regla número uno: devolver el enlace a la vista previa

**En cada respuesta donde haya cambios en el contenido de las apps (todo lo que cuelga de
`apps/`) o del inicio (`home/`), hay que terminar el mensaje con el enlace a la vista previa de
esos cambios.** Vale también para cualquier otro cambio que altere lo que se ve publicado, por
ejemplo `scripts/build.mjs`.

Para que el enlace exista, el cambio tiene que estar **commiteado y empujado** a la rama: la vista
previa la publica `deploy.yml` en cada push. El orden es siempre: commit → push → enlace.

La URL sale del nombre de la rama:

```sh
slug=$(scripts/preview-slug.sh "$(git rev-parse --abbrev-ref HEAD)")
echo "https://leonardoramirezr.github.io/leo-os/previews/$slug/"
```

`preview-slug.sh` baja a minúsculas y cambia por guiones todo lo que no sea letra o dígito, así que
la rama `claude/add-claude-md-file-rxd793` se sirve en
`https://leonardoramirezr.github.io/leo-os/previews/claude-add-claude-md-file-rxd793/`.

Formato del enlace al final del mensaje: el inicio, y además la ruta directa de cada app que se
tocó (la app vive en `<vista previa>/<carpeta de la app>/`). Por ejemplo:

> **Vista previa de esta rama**
>
> - Inicio: https://leonardoramirezr.github.io/leo-os/previews/claude-add-claude-md-file-rxd793/
> - Me deben: https://leonardoramirezr.github.io/leo-os/previews/claude-add-claude-md-file-rxd793/me-deben/
>
> GitHub Pages tarda alrededor de un minuto en servir el cambio.

Detalles que importan:

- En `main` no hay vista previa: el enlace es el sitio publicado,
  `https://leonardoramirezr.github.io/leo-os/` (y `…/leo-os/<app>/` para una app).
- Si el push todavía no se hizo, o el workflow falló, hay que decirlo en vez de dar un enlace que
  va a dar 404.
- Si el cambio no toca lo publicado (solo documentación, comentarios o el propio `CLAUDE.md`), no
  hace falta el enlace.
- La lista de todas las vistas previas vivas está en
  `https://leonardoramirezr.github.io/leo-os/previews/`.

## Qué es esto

Colección de web apps estáticas (SvelteKit + Svelte 5, en modo runes) que se publican juntas en
GitHub Pages bajo `https://leonardoramirezr.github.io/leo-os/`. El inicio imita la pantalla de
inicio de un iPhone: cada app es un ícono. Todo se renderiza en el cliente; **no hay backend**, y
los datos viven en `localStorage` o IndexedDB del navegador.

```
home/                      Pantalla de inicio (SvelteKit)
apps/<slug>/               Una carpeta por app; el slug es parte de la URL
scripts/build.mjs          Compila el inicio y cada app en dist/
scripts/icons.mjs          icon.svg → static/apple-touch-icon.png (generado, no versionado)
scripts/preview.mjs        Sirve dist/ como lo hace GitHub Pages
scripts/preview-slug.sh    Rama → carpeta dentro de previews/
scripts/previews-index.mjs Arma previews/index.html
scripts/publish-pages.sh   Escribe el sitio o una vista previa en la rama gh-pages
.github/workflows/         deploy.yml (cada push) y preview-cleanup.yml (al borrar la rama)
```

## Comandos

Node 24+ y pnpm (`packageManager` fija la versión).

```sh
pnpm install
pnpm --filter me-deben dev     # una app en concreto
pnpm --filter home dev         # el inicio
pnpm check                     # svelte-check en todos los proyectos
pnpm icons                     # regenera los apple-touch-icon.png tras editar un icon.svg

BASE_PATH=/leo-os pnpm build   # el sitio completo, como queda publicado
BASE_PATH=/leo-os pnpm preview # http://localhost:4173/leo-os/
```

**Antes de empujar hay que pasar `pnpm check`**: `deploy.yml` lo corre antes de compilar y un fallo
deja la rama sin vista previa.

## Contrato de una app

Cada carpeta de `apps/` se publica en `<BASE_PATH>/<carpeta>/` y el inicio la descubre al compilar
(`home/src/lib/apps.ts` lee los `app.json` e `icon.svg` con `import.meta.glob`): no hay que
registrarla en ningún otro lado.

| Archivo        | Qué debe contener                                                                          |
| -------------- | ------------------------------------------------------------------------------------------ |
| `app.json`     | `{ "name": "Nombre visible" }`                                                              |
| `icon.svg`     | Cuadrado, a sangre completa, opaco y sin esquinas redondeadas: el inicio e iOS enmascaran    |
| `package.json` | Un script `build` que genere `build/index.html` usando `BASE_PATH` como ruta base            |

- El nombre de la carpeta es parte de la URL: solo minúsculas, dígitos y guiones.
- En `vite.config.ts`: `paths: { base: process.env.BASE_PATH ?? '' }`.
- En `src/routes/+layout.ts`: `ssr = false` y `prerender = true`.
- App nueva: `pnpm dlx sv create apps/<carpeta> --template minimal --types ts --add sveltekit-adapter="adapter:static"`
  y copiar esos dos detalles de `apps/willchat`.

## Deploy y vistas previas

Todo se publica en la rama `gh-pages`, que es lo único que sirve GitHub Pages:

| Lo que se empuja    | Dónde queda           | URL                                        |
| ------------------- | --------------------- | ------------------------------------------ |
| `main`              | la raíz de `gh-pages` | `…github.io/leo-os/`                       |
| cualquier otra rama | `previews/<slug>/`    | `…github.io/leo-os/previews/<slug>/`       |

`publish-pages.sh` reescribe el sitio entero pero nunca toca `previews/`, y cada rama solo escribe
su carpeta; si dos publican a la vez, relee la rama y reintenta. Al borrar la rama,
`preview-cleanup.yml` quita su carpeta. Si la rama tiene un PR abierto, el workflow deja ahí un
comentario con el enlace y lo actualiza en cada push.

Una vista previa comparte origen con el sitio publicado, así que **comparte `localStorage` e
IndexedDB con las apps de verdad**: probar «Me deben» en una vista previa mueve los datos reales.

## Convenciones de código

- **Formato**: tabuladores, comillas simples, punto y coma, líneas de hasta ~110 columnas. No hay
  Prettier configurado: hay que imitar los archivos de alrededor.
- **Svelte 5 en modo runes** (`$state`, `$derived`, `$props`), forzado desde `vite.config.ts`.
  TypeScript en `strict`.
- **Idioma**: la interfaz y la documentación van en español. WillChat es bilingüe: sus textos
  viven en `src/lib/i18n.ts` (inglés y español, elegidos con `navigator.language`), así que todo
  texto nuevo se agrega en los dos. Los comentarios siguen el idioma del archivo: la
  infraestructura y `home/` están en inglés, el dominio de «Me deben» en español.
- **Comentarios**: explican el porqué, no el qué; en particular las rarezas de iOS/Safari, que aquí
  son la razón de varias decisiones. Vale la pena leerlos antes de «simplificar» algo.
- **Persistencia**: todas las apps comparten el origen, así que cada clave de `localStorage` o
  IndexedDB lleva prefijo propio (`home:wallpaper`, `me-deben:*`, `willchat:*`). Toda lectura y
  escritura va envuelta en `try`/`catch`: el navegador puede tener los datos del sitio bloqueados.
- **Dependencias**: las mínimas. Nada de frameworks de UI ni de estilos; el CSS se escribe a mano
  dentro de cada componente.
- **Sin backend y sin telemetría**: lo único que sale a la red es lo que el usuario pide (WillChat
  habla directo con `api.openai.com` con la key del propio usuario).
- Los `apple-touch-icon.png` se generan; no se versionan. El `icon.svg` es la única fuente.

## Las apps

- **home** — Pantalla de inicio: rejilla paginada de íconos, barra de estado propia y dos íconos
  integrados que no son apps publicadas (**Recargar** y **Ajustes**, que cambia el fondo de
  pantalla y lo guarda reencodeado en `localStorage`).
- **willchat** — Chat para crear y editar imágenes con la API de OpenAI y la API key del usuario.
  Las respuestas usan `background: true` y se consultan cada 2 s porque Safari en iOS corta las
  solicitudes que pasan 60 s. La conversación vive en IndexedDB. El markdown del modelo se
  sanitiza siempre (`src/lib/markdown.ts`): la API key vive en este mismo origen.
- **me-deben** — Libreta de quién te debe dinero: préstamos, pagos, fechas de devolución,
  acuerdos de pago por semana o por mes, y montos vencidos. Los montos se guardan en **centavos
  enteros** para que los saldos no acumulen errores de redondeo. Los pagos no se capturan contra un
  préstamo concreto: se reparten sobre los que vencen primero.

El comportamiento de cada una está descrito con detalle en el `README.md`; conviene actualizarlo
cuando un cambio lo contradiga.

## Commits

Mensajes en español, en presente y con el área adelante, como los que ya hay:

```
Me deben: editar movimientos y borrar personas con confirmación
Inicio: nuevo ícono del sitio
README: el orden de la primera vez, y de dónde sale la limpieza
```

Trabajar en la rama que indique la tarea, nunca directo en `main`, y no abrir un PR salvo que se
pida.
