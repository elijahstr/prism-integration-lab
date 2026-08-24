export type DashboardRouteState = {
  organizationSlug: string;
  runId: string | null;
};

export function dashboardLocation(
  search: string,
  organizations: readonly string[],
  defaultOrganizationSlug: string,
): DashboardRouteState {
  const parameters = new URLSearchParams(search);
  const requestedOrganization = parameters.get("organization");
  const organizationSlug = organizations.includes(requestedOrganization ?? "")
    ? requestedOrganization!
    : defaultOrganizationSlug;
  const runId = parameters.get("run")?.trim() || null;

  return { organizationSlug, runId };
}

export function dashboardHref(
  path: string,
  state: DashboardRouteState,
): string {
  const parameters = new URLSearchParams({
    organization: state.organizationSlug,
  });

  if (state.runId) {
    parameters.set("run", state.runId);
  }

  return `${path}?${parameters.toString()}`;
}

export function dashboardNavigation(
  paths: readonly string[],
  state: DashboardRouteState,
): string[] {
  return paths.map((path) => dashboardHref(path, state));
}

export function switchOrganization(
  state: DashboardRouteState,
  organizationSlug: string,
): DashboardRouteState {
  if (state.organizationSlug === organizationSlug) {
    return state;
  }

  return { organizationSlug, runId: null };
}

export function withScenarioRun(
  state: DashboardRouteState,
  runId: string,
): DashboardRouteState {
  return { ...state, runId };
}
