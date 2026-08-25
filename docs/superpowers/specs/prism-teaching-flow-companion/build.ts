import { renderContent, renderDigest, type SpecChrome } from "../prism-integration-lab-companion/render.ts";
import { FIGURES } from "./figures.ts";

const specUrl = new URL("../2026-08-25-prism-teaching-flow-design.md", import.meta.url);
const styleUrl = new URL("../prism-integration-lab-companion/style.css", import.meta.url);
const markdown = await Bun.file(specUrl).text();
const style = await Bun.file(styleUrl).text();
const chrome: SpecChrome = {
  brand: "Prism",
  brandDetail: "teaching flow",
  eyebrow: "Approved presentation rework",
  figures: FIGURES,
  digestFigureKeys: ["teaching-journey", "lesson-anatomy"],
};

function document(body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Prism Integration Lab Teaching Flow Rework</title><style>${style}</style></head><body>${body}</body></html>`;
}

function localLinks(body: string): string {
  return body
    .replaceAll('href="/full"', 'href="out-full.html"')
    .replaceAll('href="/raw"', 'href="../2026-08-25-prism-teaching-flow-design.md"')
    .replaceAll('href="/"', 'href="out-digest.html"');
}

await Bun.write(new URL("./out-digest.html", import.meta.url), document(localLinks(renderDigest(markdown, chrome))));
await Bun.write(new URL("./out-full.html", import.meta.url), document(localLinks(renderContent(markdown, chrome))));

console.log("Built out-digest.html and out-full.html");
