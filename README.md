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
