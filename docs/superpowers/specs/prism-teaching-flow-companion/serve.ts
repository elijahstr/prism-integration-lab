import { renderContent, renderDigest, type SpecChrome } from "../prism-integration-lab-companion/render.ts";
import { FIGURES } from "./figures.ts";

const specUrl = new URL("../2026-08-25-prism-teaching-flow-design.md", import.meta.url);
const styleUrl = new URL("../prism-integration-lab-companion/style.css", import.meta.url);
const port = Number(process.env.PORT ?? 4411);
const chrome: SpecChrome = {
  brand: "Prism",
  brandDetail: "teaching flow",
  eyebrow: "Approved presentation rework",
  figures: FIGURES,
  digestFigureKeys: ["teaching-journey", "lesson-anatomy"],
};

Bun.serve({
  hostname: "127.0.0.1",
  port,
  async fetch(request) {
    const path = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
    const headers = { "cache-control": "no-store, no-cache, must-revalidate" };
    if (path === "/style.css") return new Response(Bun.file(styleUrl), { headers: { ...headers, "content-type": "text/css; charset=utf-8" } });
    const markdown = await Bun.file(specUrl).text();
    if (path === "/raw") return new Response(markdown, { headers: { ...headers, "content-type": "text/plain; charset=utf-8" } });
    const content = path === "/full" ? renderContent(markdown, chrome) : renderDigest(markdown, chrome);
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Prism Integration Lab Teaching Flow Rework</title><link rel="stylesheet" href="/style.css"></head><body>${content}</body></html>`;
    return new Response(html, { headers: { ...headers, "content-type": "text/html; charset=utf-8" } });
  },
});

console.log(`Prism teaching flow design → http://127.0.0.1:${port}`);
