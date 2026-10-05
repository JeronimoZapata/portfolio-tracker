# Portfolio Tracker

Aplicación web personal para registrar y seguir inversiones. El proyecto usa
Next.js, TypeScript, Tailwind CSS y pnpm.

## Requisitos

- Node.js 24
- pnpm 11.19.0

## Desarrollo local

```bash
pnpm install --frozen-lockfile
pnpm dev
```

### Desarrollo y pruebas con Docker

La imagen local `portfolio-tracker-app:local` ejecuta el runtime monolítico de
Next.js (frontend y backend) con el código montado desde el host, volúmenes
Linux separados para dependencias y `.next`, y polling habilitado para
conservar Fast Refresh:

```bash
pnpm docker:dev
```

Las pruebas reutilizan la misma imagen `portfolio-tracker-app:local` en un
contenedor runner efímero y un PostgreSQL efímero sin puerto publicado. No se
construye una imagen específica para tests. El runner aplica las migraciones y
ejecuta formato, lint, tipos, tests y build:

```bash
pnpm docker:test
```

Para dejar Vitest observando cambios en caliente usando la misma imagen:

```bash
pnpm docker:test:watch
```

Los contenedores no copian archivos `.env.local` ni secretos; sus conexiones
usan nombres de servicio internos de Compose. Los cambios de código se
reflejan sin reconstruir la imagen. Solo los cambios de dependencias requieren
volver a construirla.

### PostgreSQL local

Copiá `.env.example` como `.env.local`, iniciá la base local y aplicá las
migraciones versionadas:

```bash
docker compose up -d postgres
pnpm db:migrate
```

Para generar y revisar cambios de esquema:

```bash
pnpm db:generate
pnpm db:check
```

El volumen conserva los datos entre reinicios. Para reiniciar la base de datos
local de forma explícita, ejecutá `docker compose down -v`.

Los mismos controles que ejecuta GitHub Actions están disponibles localmente:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:ci
pnpm build
```

`test:ci` ejecuta la suite de pruebas de lógica de negocio con Vitest.

### Búsqueda de activos

La pantalla `/assets` obtiene la identidad del activo desde los proveedores y
no permite escribir manualmente el identificador. Para habilitar las búsquedas
locales, completá en `.env.local` las variables server-only de `.env.example`:

- `ALPACA_API_KEY` y `ALPACA_API_SECRET`: credenciales de una cuenta Paper;
  la aplicación sólo consulta `GET /v2/assets/{symbol_or_asset_id}`.
- `COINGECKO_API_KEY`: clave del plan Demo para buscar y resolver monedas.

Si las credenciales no están configuradas, `/assets` seguirá cargando los
activos existentes, pero las búsquedas nuevas mostrarán un error del proveedor.

## Flujo de trabajo

Cada cambio se desarrolla en un task branch y se integra a `main` mediante un
pull request. El check requerido se llama `CI / quality`.

La protección de `main` se configura en GitHub con estos valores:

- exigir pull request y el status check `CI / quality`;
- exigir que la rama esté actualizada antes del merge;
- no exigir aprobaciones mientras haya un único desarrollador;
- impedir force pushes y la eliminación de `main`;
- no permitir bypass, incluso para administradores;
- permitir únicamente merge commits, sin exigir historial lineal.
