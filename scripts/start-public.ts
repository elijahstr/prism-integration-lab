import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildServer, registerPublicStatic } from "../apps/api/src/server";
import {
  createPublicLifecycle,
  installPublicSignalHandlers,
} from "../apps/api/src/public-lifecycle";
import { sql } from "@prism/database";
import { migrate } from "@prism/database/migrate";
import { seed } from "@prism/database/seed";
import { getBullMqConnection } from "../apps/worker/src/queue";
import { startWorker, stopWorker } from "../apps/worker/src/runtime";
import { validatePublicEnvironment } from "./public-environment";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const webRoot = join(scriptDirectory, "../apps/web/out");
const port = Number(process.env.PORT ?? 3000);

function timeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(
        () => reject(new Error("Readiness check timed out")),
        milliseconds,
      );
    }),
  ]);
}

validatePublicEnvironment(process.env);
await migrate();
await seed();

const server = buildServer();
registerPublicStatic(server, webRoot);
server.get("/ready", async (_request, reply) => {
  try {
    await Promise.all([
      timeout(sql`SELECT 1`, 1_000),
      timeout(getBullMqConnection().ping(), 1_000),
    ]);
    return { status: "ready" };
  } catch {
    return reply.code(503).send({ status: "not_ready" });
  }
});

startWorker();
await server.listen({ host: "0.0.0.0", port });

installPublicSignalHandlers(
  createPublicLifecycle({ closeHttp: () => server.close(), stopWorker }),
);
