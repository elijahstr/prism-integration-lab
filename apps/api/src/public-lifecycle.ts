export type PublicLifecycleDependencies = {
  closeHttp(): Promise<void>;
  stopWorker(): Promise<void>;
};

export type PublicLifecycle = {
  shutdown(): Promise<void>;
};

type SignalProcess = {
  exitCode?: number | string | null;
  once(signal: "SIGINT" | "SIGTERM", listener: () => void): unknown;
};

export function createPublicLifecycle(
  dependencies: PublicLifecycleDependencies,
): PublicLifecycle {
  let stopping: Promise<void> | undefined;

  return {
    shutdown() {
      stopping ??= dependencies
        .closeHttp()
        .then(() => dependencies.stopWorker());
      return stopping;
    },
  };
}

export function installPublicSignalHandlers(
  lifecycle: PublicLifecycle,
  processOwner: SignalProcess = process,
): void {
  const shutdown = () => {
    void lifecycle.shutdown().catch(() => {
      processOwner.exitCode = 1;
    });
  };

  processOwner.once("SIGTERM", shutdown);
  processOwner.once("SIGINT", shutdown);
}
