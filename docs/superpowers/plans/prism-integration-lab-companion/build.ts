import { renderContent, renderDigest } from "../../specs/prism-integration-lab-companion/render.ts";
import { PLAN_FIGURES } from "./figures.ts";

const planUrl = new URL("../2026-08-24-prism-integration-lab.md", import.meta.url);
const styleUrl = new URL("../../specs/prism-integration-lab-companion/style.css", import.meta.url);
const markdown = await Bun.file(planUrl).text();
const style = await Bun.file(styleUrl).text();

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
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Prism Integration Lab Implementation Plan</title><style>${style}</style></head><body>${body}</body></html>`;
}

function localLinks(body: string): string {
  return body
    .replaceAll('href="/full"', 'href="out-full.html"')
    .replaceAll('href="/raw"', 'href="out-raw.md"')
    .replaceAll('href="/"', 'href="out-digest.html"');
}

await Bun.write(new URL("./out-digest.html", import.meta.url), document(localLinks(renderDigest(markdown, chrome))));
await Bun.write(new URL("./out-full.html", import.meta.url), document(localLinks(renderContent(markdown, chrome))));
await Bun.write(new URL("./out-raw.md", import.meta.url), markdown);

console.log("Built out-digest.html, out-full.html, and out-raw.md");
