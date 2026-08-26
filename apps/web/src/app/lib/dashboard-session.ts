import {
  readLabToken,
  readWithLabSession,
  type SessionStorageLike,
} from "./session";

export async function loadDashboardSession<TDashboard, TRun>({
  createToken,
  loadDashboard,
  loadRun,
  organizationSlug,
  runId,
  storage,
}: {
  createToken: () => Promise<string>;
  loadDashboard: (token: string) => Promise<TDashboard>;
  loadRun: (token: string, runId: string) => Promise<TRun>;
  organizationSlug: string;
  runId: string | null;
  storage: SessionStorageLike;
}): Promise<{ dashboard: TDashboard; run: TRun | null }> {
  const dashboard = await readWithLabSession(
    storage,
    organizationSlug,
    createToken,
    loadDashboard,
  );
  const token = readLabToken(storage, organizationSlug);

  if (!token) {
    throw new Error("The lab session is unavailable.");
  }

  const run = runId ? await loadRun(token, runId) : null;

  return { dashboard, run };
}
