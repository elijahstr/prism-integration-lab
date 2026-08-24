import { buildServer } from "./server";

const server = buildServer();
const port = Number(process.env.PORT ?? 3001);

await server.listen({ host: "0.0.0.0", port });
