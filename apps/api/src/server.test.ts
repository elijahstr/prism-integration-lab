import { expect, test } from "bun:test";

import { buildServer } from "./server";

test("stops a rate-limited scenario request before route handling", async () => {
  const server = buildServer();
  const clientAddress = `198.51.100.${Math.floor(Math.random() * 200) + 1}`;
  const headers = {
    authorization: "Lab rate-limit-test-token",
    "x-forwarded-for": `${clientAddress}, 10.0.0.1`,
  };

  for (let count = 0; count < 20; count += 1) {
    const response = await server.inject({
      headers,
      method: "POST",
      url: "/api/lab/scenarios/not-a-scenario/run",
    });

    expect(response.statusCode).toBe(404);
  }

  const limited = await server.inject({
    headers,
    method: "POST",
    url: "/api/lab/scenarios/not-a-scenario/run",
  });

  expect(limited.statusCode).toBe(429);
  expect(limited.headers["retry-after"]).toBeDefined();

  const otherClient = await server.inject({
    headers: { ...headers, "x-forwarded-for": "198.51.100.254, 10.0.0.1" },
    method: "POST",
    url: "/api/lab/scenarios/not-a-scenario/run",
  });

  expect(otherClient.statusCode).toBe(404);
  await server.close();
});
