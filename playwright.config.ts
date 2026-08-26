import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:4173",
    browserName: "chromium",
  },
  webServer: {
    command: "bun run scripts/start-public.ts",
    env: {
      DATABASE_URL:
        "postgres://prism:prism@127.0.0.1:5432/prism_integration_lab",
      LAB_TOKEN_PEPPER: "playwright-lab-token-pepper",
      NODE_ENV: "production",
      PORT: "4173",
      PROVIDER_KEY_MASTER_SECRET: "playwright-provider-key-master-secret",
      REDIS_URL: "redis://127.0.0.1:6379",
    },
    reuseExistingServer: false,
    url: "http://127.0.0.1:4173/health",
  },
});
