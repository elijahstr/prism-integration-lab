import { describe, expect, test } from "bun:test";

import {
  approveReview,
  createLabSession,
  dashboardRequest,
  getScenarioRun,
  rejectReview,
  replayMessage,
  resetScenarioRun,
  runScenario,
} from "./api";

type RecordedCall = { init: RequestInit | undefined; path: string };

function response(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status: 200,
  });
}

function recordingFetch(calls: RecordedCall[]) {
  return async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ init, path: input.toString() });
    return response({
      expiresAt: "2026-08-24T12:00:00.000Z",
      token: "token-123",
    });
  };
}

describe("dashboard API actions", () => {
  test("loads a scoped scenario trace for URL restoration", async () => {
    const calls: RecordedCall[] = [];

    await getScenarioRun("token-123", "run-123", async (input, init) => {
      calls.push({ init, path: input.toString() });
      return response({
        id: "run-123",
        scenario: "provider_change",
        state: "applied",
        trace: [],
      });
    });

    expect(calls[0]?.path).toBe("/api/lab/runs/run-123");
    expect(calls[0]?.init?.method).toBeUndefined();
    expect(new Headers(calls[0]?.init?.headers).get("authorization")).toBe(
      "Lab token-123",
    );
  });

  test("keeps RequestInit headers while it adds the lab authorization", async () => {
    const calls: RecordedCall[] = [];

    await dashboardRequest(
      "token-123",
      "/api/example",
      { parse: (value) => value },
      { headers: new Headers({ "x-request-id": "request-1" }), method: "POST" },
      recordingFetch(calls),
    );

    expect(calls[0]?.init?.method).toBe("POST");
    expect(new Headers(calls[0]?.init?.headers).get("authorization")).toBe(
      "Lab token-123",
    );
    expect(new Headers(calls[0]?.init?.headers).get("x-request-id")).toBe(
      "request-1",
    );
  });

  test("creates a session with a POST body and validates its DTO", async () => {
    const calls: RecordedCall[] = [];

    await expect(
      createLabSession("northstar-presents", recordingFetch(calls)),
    ).resolves.toEqual({
      expiresAt: "2026-08-24T12:00:00.000Z",
      token: "token-123",
    });

    expect(calls).toEqual([
      {
        init: {
          body: '{"organizationSlug":"northstar-presents"}',
          headers: { "content-type": "application/json" },
          method: "POST",
        },
        path: "/api/lab/sessions",
      },
    ]);
  });

  test("sends every authenticated dashboard action as POST", async () => {
    const calls: RecordedCall[] = [];
    const fetcher = recordingFetch(calls);

    await approveReview("token-123", "review-1", fetcher);
    await rejectReview("token-123", "review-1", fetcher);
    await replayMessage("token-123", "message-1", fetcher);
    await runScenario("token-123", "provider_change", fetcher);
    await resetScenarioRun("token-123", "run-1", fetcher);

    expect(
      calls.map((call) => ({
        authorization: new Headers(call.init?.headers).get("authorization"),
        method: call.init?.method,
        path: call.path,
      })),
    ).toEqual([
      {
        authorization: "Lab token-123",
        method: "POST",
        path: "/api/reviews/review-1/approve",
      },
      {
        authorization: "Lab token-123",
        method: "POST",
        path: "/api/reviews/review-1/reject",
      },
      {
        authorization: "Lab token-123",
        method: "POST",
        path: "/api/messages/message-1/replay",
      },
      {
        authorization: "Lab token-123",
        method: "POST",
        path: "/api/lab/scenarios/provider_change/run",
      },
      {
        authorization: "Lab token-123",
        method: "POST",
        path: "/api/lab/runs/run-1/reset",
      },
    ]);
  });
});
