import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  // Keep local .env.local out of the default test process. Integration tests
  // only run when DATABASE_URL is deliberately supplied by Docker/CI.
  envDir: "./.vitest-env",
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
