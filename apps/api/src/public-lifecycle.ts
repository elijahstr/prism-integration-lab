export type PublicLifecycleDependencies = {
  closeHttp(): Promise<void>;
  stopWorker(): Promise<void>;
};

export type PublicLifecycle = {
  shutdown(): Promise<void>;
};

type SignalProcess = {
  exitCode?: number | string | null;
  off(signal: "SIGINT" | "SIGTERM", listener: () => void): unknown;
  on(signal: "SIGINT" | "SIGTERM", listener: () => void): unknown;
};

const defaultSignalProcess: SignalProcess = {
  get exitCode() {
    return process.exitCode;
  },
  set exitCode(value) {
    process.exitCode = value;
  },
  off(signal, listener) {
    return (process as unknown as SignalProcess).off(signal, listener);
  },
  on(signal, listener) {
    return (process as unknown as SignalProcess).on(signal, listener);
  },
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
  processOwner: SignalProcess = defaultSignalProcess,
): void {
  const shutdown = () => {
    void lifecycle
      .shutdown()
      .catch(() => {
        processOwner.exitCode = 1;
      })
      .finally(() => {
        processOwner.off("SIGTERM", shutdown);
        processOwner.off("SIGINT", shutdown);
      });
  };

  processOwner.on("SIGTERM", shutdown);
  processOwner.on("SIGINT", shutdown);
}
