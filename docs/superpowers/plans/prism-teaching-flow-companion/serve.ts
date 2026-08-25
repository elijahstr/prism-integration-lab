import { renderContent, renderDigest } from "../../specs/prism-integration-lab-companion/render.ts";

import { PLAN_FIGURES } from "./figures.ts";

const planUrl = new URL("../2026-08-25-prism-teaching-flow.md", import.meta.url);
const styleUrl = new URL(
  "../../specs/prism-integration-lab-companion/style.css",
  import.meta.url,
);
const port = Number(process.env.PORT ?? 4412);
const chrome = {
  brand: "Prism",
  brandDetail: "teaching flow plan",
  eyebrow: "Approved presentation-only change",
  digestFigureKeys: ["teaching-flow-delivery"],
  digestSections: [
    { source: "Implementation Boundary" },
    { source: "Task Dependency and Verification Gate" },
  ],
  figures: PLAN_FIGURES,
};

function document(body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Prism Teaching Flow Implementation Plan</title><link rel="icon" href="data:,"><link rel="stylesheet" href="/style.css"></head><body>${body}</body></html>`;
}

Bun.serve({
  hostname: "127.0.0.1",
  port,
  async fetch(request) {
    const path = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
    const headers = { "cache-control": "no-store, no-cache, must-revalidate" };
    if (path === "/style.css") {
      return new Response(Bun.file(styleUrl), {
        headers: { ...headers, "content-type": "text/css; charset=utf-8" },
      });
    }
    if (!["/", "/full", "/raw"].includes(path)) {
      return new Response("Not found", { headers, status: 404 });
    }
    const markdown = await Bun.file(planUrl).text();
    if (path === "/raw") {
      return new Response(markdown, {
        headers: { ...headers, "content-type": "text/plain; charset=utf-8" },
      });
    }
    const content = path === "/full"
      ? renderContent(markdown, chrome)
      : renderDigest(markdown, chrome);
    return new Response(document(content), {
      headers: { ...headers, "content-type": "text/html; charset=utf-8" },
    });
  },
});

console.log(`Prism teaching flow plan → http://127.0.0.1:${port}`);
