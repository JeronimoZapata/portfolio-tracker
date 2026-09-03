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
