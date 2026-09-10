FROM node:24-alpine AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

FROM base AS dependencies

RUN pnpm install --frozen-lockfile

FROM dependencies AS development

ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
CMD ["pnpm", "dev"]

FROM dependencies AS test

ENV NODE_ENV=test
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
CMD ["sh", "-c", "pnpm db:migrate && pnpm format:check && pnpm lint && pnpm typecheck && pnpm test:ci && pnpm build"]
