import {
  LabSessionDtoSchema,
  ScenarioRunDtoSchema,
  type LabSessionDto,
  type ScenarioRunDto,
  type ScenarioId,
} from "@prism/contracts";

import { LabSessionExpiredError } from "./session";

export type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

type ResponseSchema<T> = { parse(value: unknown): T };

const untypedResponseSchema: ResponseSchema<unknown> = {
  parse: (value) => value,
};

export async function createLabSession(
  organizationSlug: string,
  fetcher: Fetcher = fetch,
): Promise<LabSessionDto> {
  const response = await fetcher("/api/lab/sessions", {
    body: JSON.stringify({ organizationSlug }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("The demo session could not start.");
  }

  return LabSessionDtoSchema.parse(await response.json());
}

export async function dashboardRequest<T>(
  token: string,
  path: string,
  schema: ResponseSchema<T>,
  init: RequestInit = {},
  fetcher: Fetcher = fetch,
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("authorization", `Lab ${token}`);
  const response = await fetcher(path, {
    ...init,
    headers,
  });

  if (response.status === 401) {
    throw new LabSessionExpiredError();
  }

  if (!response.ok) {
    throw new Error("The dashboard data could not load.");
  }

  return schema.parse(await response.json());
}

async function postAction(
  token: string,
  path: string,
  fetcher: Fetcher = fetch,
): Promise<void> {
  await dashboardRequest(
    token,
    path,
    untypedResponseSchema,
    { method: "POST" },
    fetcher,
  );
}

export function approveReview(
  token: string,
  reviewId: string,
  fetcher?: Fetcher,
): Promise<void> {
  return postAction(token, `/api/reviews/${reviewId}/approve`, fetcher);
}

export function rejectReview(
  token: string,
  reviewId: string,
  fetcher?: Fetcher,
): Promise<void> {
  return postAction(token, `/api/reviews/${reviewId}/reject`, fetcher);
}

export function replayMessage(
  token: string,
  messageId: string,
  fetcher?: Fetcher,
): Promise<void> {
  return postAction(token, `/api/messages/${messageId}/replay`, fetcher);
}

export function getScenarioRun(
  token: string,
  runId: string,
  fetcher?: Fetcher,
): Promise<ScenarioRunDto> {
  return dashboardRequest(
    token,
    `/api/lab/runs/${runId}`,
    ScenarioRunDtoSchema,
    {},
    fetcher,
  );
}

export function runScenario(
  token: string,
  scenario: ScenarioId,
  fetcher?: Fetcher,
): Promise<void> {
  return postAction(token, `/api/lab/scenarios/${scenario}/run`, fetcher);
}

export function resetScenarioRun(
  token: string,
  runId: string,
  fetcher?: Fetcher,
): Promise<void> {
  return postAction(token, `/api/lab/runs/${runId}/reset`, fetcher);
}
