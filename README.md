# Leo OS

Colección de web apps estáticas que se publican juntas en GitHub Pages. La página de inicio imita la pantalla de inicio de un iPhone: cada app es un ícono.

- Inicio: https://leonardoramirezr.github.io/leo-os/
- WillChat: https://leonardoramirezr.github.io/leo-os/willchat/
- Me deben: https://leonardoramirezr.github.io/leo-os/me-deben/

## Estructura

```
.
├── home/                    # Pantalla de inicio (SvelteKit + Svelte 5)
├── apps/
│   └── willchat/            # Una carpeta por app
│       ├── app.json         # Manifiesto: { "name": "WillChat" }
│       ├── icon.svg         # Ícono de la app
│       └── …
├── scripts/
│   ├── build.mjs            # Construye el inicio y todas las apps en dist/
│   ├── icons.mjs            # Convierte cada icon.svg en el PNG que pide iOS
│   ├── preview.mjs          # Sirve dist/ igual que GitHub Pages
│   ├── preview-slug.sh      # El nombre que le toca a una rama dentro de previews/
│   ├── previews-index.mjs   # Arma la lista de vistas previas publicadas
│   └── publish-pages.sh     # Escribe el sitio (o una vista previa) en gh-pages
└── .github/workflows/
    ├── deploy.yml           # Publica en cada push
    └── preview-cleanup.yml  # Quita la vista previa al borrar la rama
```

## Contrato de una app

Cada carpeta dentro de `apps/` es una app y se publica en `<BASE_PATH>/<carpeta>/`. El inicio las descubre al compilar, así que no hay que registrarlas en otro lado.

| Archivo        | Qué debe contener                                                                                        |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| `app.json`     | `{ "name": "Nombre visible" }`                                                                           |
| `icon.svg`     | Ícono cuadrado, a sangre completa y sin esquinas redondeadas: el inicio e iOS aplican la máscara.        |
| `package.json` | Un script `build` que genere `build/index.html` usando la variable de entorno `BASE_PATH` como ruta base. |

Además:

- El nombre de la carpeta es parte de la URL: solo minúsculas, dígitos y guiones.
- El ícono de la pantalla de inicio del iPhone sale del mismo `icon.svg`: no hay que dibujarlo aparte.
- Todo se renderiza en el cliente; ninguna app necesita backend propio.
- Todas las apps comparten el origen `leonardoramirezr.github.io`, y por lo tanto `localStorage` e IndexedDB. Usa un prefijo propio en las claves (p. ej. `willchat:`).

Para una app nueva con SvelteKit, parte de `pnpm dlx sv create apps/<carpeta> --template minimal --types ts --add sveltekit-adapter="adapter:static"` y copia de `apps/willchat` dos detalles: `paths.base` leído de `BASE_PATH` en `vite.config.ts`, y `ssr = false` + `prerender = true` en `src/routes/+layout.ts`.

## Desarrollo

Requiere Node 24+ y pnpm.

```sh
pnpm install
pnpm --filter willchat dev     # una app
pnpm --filter home dev         # el inicio
pnpm check                     # svelte-check en todos los proyectos
pnpm icons                     # regenera los apple-touch-icon.png tras editar un icon.svg
```

Para probar el sitio completo como queda publicado:

```sh
BASE_PATH=/apps pnpm build
BASE_PATH=/apps pnpm preview   # http://localhost:4173/apps/
```

## Deploy

Todo se publica en la rama `gh-pages`, que es la única que GitHub Pages sirve:

| Lo que se empuja    | Dónde queda           | URL                                  |
| ------------------- | --------------------- | ------------------------------------ |
| `main`              | la raíz de `gh-pages` | `…github.io/leo-os/`                 |
| cualquier otra rama | `previews/<rama>/`    | `…github.io/leo-os/previews/<rama>/` | `…github.io/leo-os/previews/<rama>/`   |

`deploy.yml` corre en cada push: pasa `pnpm check`, compila con la ruta base que le toca y `scripts/publish-pages.sh` escribe el resultado en `gh-pages`. Publicar el sitio no borra las vistas previas, y cada rama solo toca su carpeta; si dos publican a la vez, el script vuelve a leer la rama y reintenta.

Solo la primera vez, y en este orden: primero un push a `main`, que es el que escribe el sitio en la raíz de `gh-pages`; después, en el repositorio, **Settings → Pages → Build and deployment → Source: Deploy from a branch**, y elegir la rama `gh-pages` con la carpeta `/ (root)`. Al revés, el sitio queda en 404 hasta el siguiente push a `main`. Mientras no se cambie el ajuste, Pages sigue sirviendo el último deploy hecho con la opción anterior («GitHub Actions») y nada de esto se ve publicado.

## Vistas previas

Cada rama que no es `main` se publica por su cuenta, para poder abrir un cambio y probarlo antes de mezclarlo.

- El nombre de la carpeta sale del de la rama con la misma regla que las apps —minúsculas, dígitos y guiones—, así que `claude/wizardly-euler` se sirve en `/leo-os/previews/claude-wizardly-euler/`.
- Si la rama tiene un PR abierto, el workflow deja ahí un comentario con el enlace y lo va actualizando. El enlace sale también en el resumen de cada ejecución, aunque todavía no haya PR.
- `…/leo-os/previews/` lista las que hay, de la más reciente a la más vieja.
- Al borrar la rama, `preview-cleanup.yml` quita su carpeta. Cuando no queda ninguna, `previews/` desaparece. GitHub corre ese workflow desde `main`, así que la limpieza empieza a funcionar cuando el archivo llega ahí.
- GitHub Pages tarda alrededor de un minuto en servir lo que se acaba de publicar.

Una vista previa vive en el mismo origen que el sitio publicado, así que comparte con él `localStorage` e IndexedDB: probar «Me deben» en una vista previa mueve los mismos datos que la app de verdad.

## Ícono en la pantalla de inicio

Safari no acepta un SVG para el ícono que se guarda con «Agregar a pantalla de inicio»: si no encuentra un PNG, guarda una captura de la página. Por eso `scripts/icons.mjs` convierte cada `icon.svg` en un `apple-touch-icon.png` de 180 × 180 dentro de `static/` del proyecto, y cada `app.html` lo enlaza con `<link rel="apple-touch-icon">`. El PNG se genera al compilar y al instalar; no se versiona, así que el SVG sigue siendo la única fuente.

El ícono debe ser opaco y llegar a los bordes: iOS le aplica su propia máscara redondeada y pinta de negro lo que esté transparente. Safari también cachea el ícono con ganas; si al probar sigue apareciendo el anterior, cierra la pestaña y vuelve a abrir la página.

## Inicio

Además de las apps publicadas, la pantalla de inicio trae dos íconos propios:

- **Recargar**: recarga el sitio, útil cuando corre a pantalla completa y sin controles del navegador.
- **Ajustes**: cambia el fondo de pantalla. La foto elegida se reduce a 1600 px, se reencoda como JPEG y se guarda en el `localStorage` del navegador con la clave `home:wallpaper`. Sin foto se usa el degradado por omisión, que vuelve al tocar «Quitar».

## WillChat

Chat al estilo ChatGPT para crear y editar imágenes con la API de OpenAI y tu propia API key.

- La API key se guarda en el `localStorage` del navegador y solo se envía a `api.openai.com`.
- Los modelos de texto y de imagen se eligen tocando el título. La lista sale de `/v1/models`, y también se puede escribir cualquier ID.
- Las fotos se reducen a 2048 px y se envían como `input_image`. En cada turno se manda la conversación completa, incluidas las imágenes generadas antes, para que el modelo pueda seguir editándolas.
- Las solicitudes usan `background: true` y se consultan cada 2 s. Generar una imagen puede tardar más de un minuto y Safari en iOS corta las solicitudes que pasan 60 s sin respuesta; así, además, la respuesta se recupera si recargas o cambias de app.
- La conversación actual se guarda en IndexedDB.

## Me deben

Libreta de quién te debe dinero: al abrir se ve cuánto te deben en total, cuánto de eso ya venció, la lista de personas que deben y, abajo, dos botones.

- **+** («Presté») registra un préstamo nuevo. Primero se elige a quién: aparecen las personas ya registradas y, al escribir un nombre que no está, la opción de agregarlo. Después se captura el monto, cuándo se prestó, cuándo se debe devolver, desde qué banco salió el dinero y a qué banco llegó. La fecha de devolución es opcional: sin ella el préstamo nunca se marca como vencido.
- El préstamo puede llevar un **acuerdo de pago**, también opcional y con solo dos formas: por semana o por mes. Se captura cuánto se cobra cada semana (o cada mes) y la primera fecha de cobro; de ahí en adelante los cobros caen el mismo día de la semana, o el mismo día del mes recortado al último si ese mes es más corto. El último cobro es lo que sobra del préstamo, así que puede ser menor. Con acuerdo no se pide fecha de devolución: el calendario de cobros la sustituye.
- **−** («Me pagaron») registra un pago. Solo lista a quienes deben algo y propone el adeudo completo como monto, que se puede editar para un abono parcial.
- Vencido es lo que pasó de su fecha de devolución y sigue sin pagarse; con acuerdo de pago, lo que suman los cobros que ya quedaron atrás y todavía no se cubren. El cobro del día no cuenta como vencido hasta el día siguiente. Cada fila de la lista muestra cuánto debe esa persona de vencido, o **Al corriente** si no le ha vencido nada; quien tiene vencido aparece primero.
- Los pagos no se capturan contra un préstamo en concreto, así que se reparten sobre los préstamos que vencen primero: quien abona salda antes lo más atrasado.
- Al tocar una persona se ve cuánto debe en total y cuánto ya venció, su historial de préstamos y pagos —cada préstamo con su fecha de devolución, o **Sin fecha de devolución** si no se pactó ninguna, o con su acuerdo y el próximo cobro, y lo que le falta por cubrir—, y ahí mismo se le puede prestar de nuevo, registrar un pago, cambiar su nombre o eliminarla.
- Al tocar un movimiento se abre para corregirlo: monto, fechas, acuerdo de pago, cuentas y nota. De quién es y si fue préstamo o pago no se cambian; para eso está «Editar», que saca el botón rojo de cada renglón para borrar lo capturado por error.
- Solo se puede eliminar a una persona que ya no debe nada, y antes hay que escribir su nombre para confirmar: se va con todo su historial y no se puede deshacer.
- La lista de bancos («Cuentas») trae las instituciones mexicanas agrupadas: bancos, fintech y no bancarias, banca de desarrollo, corporativos y extranjeros, y efectivo. Se guarda el nombre del banco, nunca un número de cuenta. El banco propio se recuerda para no elegirlo cada vez.
- Todo vive en el `localStorage` del navegador con las claves `me-deben:*`; no hay servidor ni cuenta. Los montos se guardan en centavos enteros para que los saldos no acumulen errores de redondeo.
