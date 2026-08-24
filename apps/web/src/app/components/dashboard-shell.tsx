"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import {
  dashboardHref,
  dashboardLocation,
  type DashboardRouteState,
} from "../lib/navigation";

export type DashboardPageName =
  "events" | "ingestion" | "lab" | "overview" | "providers" | "reviews";

const navigation: Array<{
  href: string;
  id: DashboardPageName;
  label: string;
}> = [
  { href: "/", id: "overview", label: "Overview" },
  { href: "/providers", id: "providers", label: "Providers" },
  { href: "/events", id: "events", label: "Events" },
  { href: "/needs-review", id: "reviews", label: "Needs Review" },
  { href: "/integration-lab", id: "lab", label: "Integration Lab" },
  { href: "/how-ingestion-works", id: "ingestion", label: "How it works" },
];

const defaultRouteState: DashboardRouteState = {
  organizationSlug: "northstar-presents",
  runId: null,
};
const organizationSlugs = ["northstar-presents", "harborlight-live"];

export function DashboardShell({
  children,
  organization,
  page,
  routeState,
  sessionNote = "Each browser session uses its own temporary copy of seeded data.",
  topbarControl,
}: {
  children: ReactNode;
  organization: string;
  page: DashboardPageName;
  routeState?: DashboardRouteState;
  sessionNote?: string;
  topbarControl: ReactNode;
}) {
  const [navigationState, setNavigationState] = useState(
    routeState ?? defaultRouteState,
  );
  const pageTitle =
    navigation.find((item) => item.id === page)?.label ?? "Overview";

  useEffect(() => {
    if (routeState) {
      setNavigationState(routeState);
      return;
    }

    setNavigationState(
      dashboardLocation(
        window.location.search,
        organizationSlugs,
        defaultRouteState.organizationSlug,
      ),
    );
  }, [routeState]);

  return (
    <div className="app-shell">
      <aside className="rail">
        <a
          className="brand"
          href={dashboardHref("/", navigationState)}
          aria-label="Prism Integration Lab home"
        >
          <span>PRISM</span>
          <small>INTEGRATION LAB</small>
        </a>
        <nav aria-label="Dashboard navigation">
          {navigation.map((item) => (
            <a
              key={item.id}
              className={page === item.id ? "active" : ""}
              href={dashboardHref(item.href, navigationState)}
              aria-current={page === item.id ? "page" : undefined}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <p className="rail-note">
          Fictional provider data
          <br />
          UTC system time
        </p>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div>
            <p className="prototype-label">Unofficial portfolio prototype</p>
            <p className="crumb">Workspace / Ticket integrations</p>
          </div>
          {topbarControl}
        </header>
        <main id="main-content" tabIndex={-1}>
          <div className="page-heading">
            <div>
              <p className="eyebrow">{organization}</p>
              <h1>{pageTitle}</h1>
            </div>
            <p className="session-note">{sessionNote}</p>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
