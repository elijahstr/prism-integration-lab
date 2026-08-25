import { describe, expect, test } from "bun:test";

import { validatePublicEnvironment } from "./public-environment";

describe("public process environment", () => {
  test("names every missing required variable without exposing values", () => {
    const suppliedSecret = "secret-database-value";

    expect(() =>
      validatePublicEnvironment({ DATABASE_URL: suppliedSecret }),
    ).toThrow(
      "Missing required environment variables: LAB_TOKEN_PEPPER, PROVIDER_KEY_MASTER_SECRET, REDIS_URL",
    );

    try {
      validatePublicEnvironment({ DATABASE_URL: suppliedSecret });
    } catch (error) {
      expect(String(error)).not.toContain(suppliedSecret);
    }
  });

  test("rejects empty and whitespace-only required values", () => {
    expect(() =>
      validatePublicEnvironment({
        DATABASE_URL: "",
        LAB_TOKEN_PEPPER: " ",
        PROVIDER_KEY_MASTER_SECRET: "\t",
        REDIS_URL: "\n",
      }),
    ).toThrow(
      "Missing required environment variables: DATABASE_URL, LAB_TOKEN_PEPPER, PROVIDER_KEY_MASTER_SECRET, REDIS_URL",
    );
  });

  test("accepts all required nonempty values", () => {
    expect(() =>
      validatePublicEnvironment({
        DATABASE_URL: "postgres://configured",
        LAB_TOKEN_PEPPER: "configured",
        PROVIDER_KEY_MASTER_SECRET: "configured",
        REDIS_URL: "redis://configured",
      }),
    ).not.toThrow();
  });
});
