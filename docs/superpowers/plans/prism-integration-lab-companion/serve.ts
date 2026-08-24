import { renderContent, renderDigest } from "../../specs/prism-integration-lab-companion/render.ts";
import { PLAN_FIGURES } from "./figures.ts";

const planUrl = new URL("../2026-08-24-prism-integration-lab.md", import.meta.url);
const styleUrl = new URL("../../specs/prism-integration-lab-companion/style.css", import.meta.url);
const port = Number(process.env.PORT ?? 4411);

const chrome = {
  brand: "Prism",
  brandDetail: "integration lab plan",
  eyebrow: "Unofficial portfolio prototype",
  figures: PLAN_FIGURES,
  digestFigureKeys: ["free-public-topology"],
  digestSections: [
    { source: "Package Approval Gate", tone: "approval" as const },
    { source: "Risks Accepted for the Free Demo", tone: "risk" as const },
    { source: "PR Packaging" },
  ],
};

function document(body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Prism Integration Lab Implementation Plan</title><link rel="icon" href="data:,"><link rel="stylesheet" href="/style.css"></head><body>${body}</body></html>`;
}

Bun.serve({
  hostname: "127.0.0.1",
  port,
  async fetch(request) {
    const path = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
    const headers = { "cache-control": "no-store, no-cache, must-revalidate" };
    if (path === "/style.css") return new Response(Bun.file(styleUrl), { headers: { ...headers, "content-type": "text/css; charset=utf-8" } });
    if (!["/", "/full", "/raw"].includes(path)) return new Response("Not found", { status: 404, headers });
    const markdown = await Bun.file(planUrl).text();
    if (path === "/raw") return new Response(markdown, { headers: { ...headers, "content-type": "text/plain; charset=utf-8" } });
    const content = path === "/full" ? renderContent(markdown, chrome) : renderDigest(markdown, chrome);
    return new Response(document(content), { headers: { ...headers, "content-type": "text/html; charset=utf-8" } });
  },
});

console.log(`Prism Integration Lab plan → http://127.0.0.1:${port}`);
