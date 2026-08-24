type LoadHandlers<TResult> = {
  error(error: Error): void;
  loading(organizationSlug: string): void;
  success(result: TResult): void;
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
  #generation = 0;
  #organizationSlug: string | null = null;

  invalidate(): void {
    this.#generation += 1;
    this.#organizationSlug = null;
  }

  isCurrentOrganization(organizationSlug: string): boolean {
    return this.#organizationSlug === organizationSlug;
  }

  start(
    organizationSlug: string,
    load: () => Promise<TResult>,
    handlers: LoadHandlers<TResult>,
  ): Promise<void> {
    this.#organizationSlug = organizationSlug;
    return this.#run(organizationSlug, load, handlers);
  }

  refresh<TRefreshResult>(
    organizationSlug: string,
    load: () => Promise<TRefreshResult>,
    handlers: LoadHandlers<TRefreshResult>,
  ): Promise<void> {
    if (this.#organizationSlug !== organizationSlug) {
      return Promise.resolve();
    }

    return this.#run(organizationSlug, load, handlers);
  }

  #run<TLoadResult>(
    organizationSlug: string,
    load: () => Promise<TLoadResult>,
    handlers: LoadHandlers<TLoadResult>,
  ): Promise<void> {
    const generation = ++this.#generation;
    handlers.loading(organizationSlug);

    return load()
      .then((result) => {
        if (!this.#isCurrent(generation, organizationSlug)) {
          return;
        }
        handlers.success(result);
      })
      .catch((error: unknown) => {
        if (
          !this.#isCurrent(generation, organizationSlug) ||
          isAbortError(error)
        ) {
          return;
        }
        handlers.error(
          error instanceof Error
            ? error
            : new Error("The dashboard data could not load."),
        );
      });
  }

  #isCurrent(generation: number, organizationSlug: string): boolean {
    return (
      this.#generation === generation &&
      this.#organizationSlug === organizationSlug
    );
  }
}
