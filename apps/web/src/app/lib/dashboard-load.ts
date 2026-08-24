type LoadHandlers<TResult> = {
  error(error: Error): void;
  loading(organizationSlug: string): void;
  success(result: TResult): void;
};

declare const dashboardActionGeneration: unique symbol;

export type DashboardActionGeneration = {
  readonly [dashboardActionGeneration]: true;
};

type DashboardGeneration = DashboardActionGeneration & {
  organizationSlug: string;
};

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}

export class DashboardLoadCoordinator<TResult> {
  #currentGeneration: DashboardGeneration | null = null;

  invalidate(): void {
    this.#currentGeneration = null;
  }

  beginAction(organizationSlug: string): DashboardActionGeneration | null {
    return this.#currentGeneration?.organizationSlug === organizationSlug
      ? this.#currentGeneration
      : null;
  }

  commitAction(
    generation: DashboardActionGeneration,
    update: () => void,
  ): void {
    if (!this.#isCurrent(generation)) {
      return;
    }

    update();
  }

  start(
    organizationSlug: string,
    load: () => Promise<TResult>,
    handlers: LoadHandlers<TResult>,
  ): Promise<void> {
    const generation = { organizationSlug } as DashboardGeneration;
    this.#currentGeneration = generation;
    return this.#run(generation, load, handlers);
  }

  refresh<TRefreshResult>(
    generation: DashboardActionGeneration,
    load: () => Promise<TRefreshResult>,
    handlers: LoadHandlers<TRefreshResult>,
  ): Promise<void> {
    if (!this.#isCurrent(generation)) {
      return Promise.resolve();
    }

    return this.#run(generation as DashboardGeneration, load, handlers);
  }

  #run<TLoadResult>(
    generation: DashboardGeneration,
    load: () => Promise<TLoadResult>,
    handlers: LoadHandlers<TLoadResult>,
  ): Promise<void> {
    if (!this.#isCurrent(generation)) {
      return Promise.resolve();
    }

    handlers.loading(generation.organizationSlug);

    return load()
      .then((result) => {
        if (!this.#isCurrent(generation)) {
          return;
        }
        handlers.success(result);
      })
      .catch((error: unknown) => {
        if (!this.#isCurrent(generation) || isAbortError(error)) {
          return;
        }
        handlers.error(
          error instanceof Error
            ? error
            : new Error("The dashboard data could not load."),
        );
      });
  }

  #isCurrent(generation: DashboardActionGeneration): boolean {
    return this.#currentGeneration === generation;
  }
}
