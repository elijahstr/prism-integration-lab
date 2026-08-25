import { describe, expect, test } from "bun:test";

import { buildServer } from "./server";

describe("API server boundaries", () => {
  test("uses the immediate proxy address despite spoofed forwarded prefixes", async () => {
    const server = buildServer();

    for (let count = 0; count < 20; count += 1) {
      const response = await server.inject({
        headers: {
          authorization: "Lab rate-limit-test-token",
          "x-forwarded-for": `198.51.100.${count + 1}, 10.0.0.1`,
        },
        method: "POST",
        url: "/api/lab/scenarios/not-a-scenario/run",
      });

      expect(response.statusCode).toBe(404);
    }

    const limited = await server.inject({
      headers: {
        authorization: "Lab rate-limit-test-token",
        "x-forwarded-for": "203.0.113.200, 10.0.0.1",
      },
      method: "POST",
      url: "/api/lab/scenarios/not-a-scenario/run",
    });
    const otherProxy = await server.inject({
      headers: {
        authorization: "Lab rate-limit-test-token",
        "x-forwarded-for": "203.0.113.200, 10.0.0.2",
      },
      method: "POST",
      url: "/api/lab/scenarios/not-a-scenario/run",
    });

    expect(limited.statusCode).toBe(429);
    expect(limited.headers["retry-after"]).toBeDefined();
    expect(otherProxy.statusCode).toBe(404);
    await server.close();
  });

  test("does not share rate counters between server instances", async () => {
    const firstServer = buildServer();
    const secondServer = buildServer();
    const headers = {
      authorization: "Lab isolated-rate-limit-token",
      "x-forwarded-for": "198.51.100.50, 10.0.0.5",
    };

    for (let count = 0; count < 20; count += 1) {
      const response = await firstServer.inject({
        headers,
        method: "POST",
        url: "/api/lab/scenarios/not-a-scenario/run",
      });
      expect(response.statusCode).toBe(404);
    }

    const independent = await secondServer.inject({
      headers,
      method: "POST",
      url: "/api/lab/scenarios/not-a-scenario/run",
    });

    expect(independent.statusCode).toBe(404);
    await Promise.all([firstServer.close(), secondServer.close()]);
  });

  test("evicts the counter with the earliest full expiry", async () => {
    let now = 0;
    const server = buildServer({
      rateLimit: {
        maxKeys: 2,
        now: () => now,
        scenarioLimit: 2,
      },
    });
    const request = (address: string) =>
      server.inject({
        headers: {
          authorization: "Lab eviction-test-token",
          "x-forwarded-for": `198.51.100.1, ${address}`,
        },
        method: "POST",
        url: "/api/lab/scenarios/not-a-scenario/run",
      });

    expect((await request("10.0.0.1")).statusCode).toBe(404);
    now = 1_000;
    expect((await request("10.0.0.2")).statusCode).toBe(404);
    now = 2_000;
    expect((await request("10.0.0.1")).statusCode).toBe(404);
    now = 3_000;
    expect((await request("10.0.0.3")).statusCode).toBe(404);

    expect((await request("10.0.0.1")).statusCode).toBe(429);
    expect((await request("10.0.0.2")).statusCode).toBe(404);
    await server.close();
  });

  test("returns a generic 500 response and redacts authorization logs", async () => {
    const previousEnvironment = process.env.NODE_ENV;
    const logLines: string[] = [];
    process.env.NODE_ENV = "production";
    const server = buildServer({
      logStream: { write: (line) => logLines.push(line) },
    });
    server.get("/unexpected-test-error", async () => {
      throw new Error("database connection failed");
    });
    let response: Awaited<ReturnType<typeof server.inject>>;

    try {
      response = await server.inject({
        headers: { authorization: "Lab secret-log-token" },
        method: "GET",
        url: "/unexpected-test-error",
      });
    } finally {
      await server.close();
      if (previousEnvironment === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = previousEnvironment;
      }
    }

    expect(response.statusCode).toBe(500);
    expect(response.json() as { error: string }).toEqual({
      error: "Internal server error",
    });
    expect(logLines.join("\n")).toContain("Unexpected request error");
    expect(logLines.join("\n")).not.toContain("secret-log-token");
  });
});
