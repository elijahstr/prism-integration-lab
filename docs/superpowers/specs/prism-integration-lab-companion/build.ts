import { renderContent, renderDigest } from "./render.ts";

const specUrl = new URL("../2026-08-24-prism-integration-lab-design.md", import.meta.url);
const styleUrl = new URL("./style.css", import.meta.url);
const markdown = await Bun.file(specUrl).text();
const style = await Bun.file(styleUrl).text();

function document(body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Prism Integration Lab Design</title><style>${style}</style></head><body>${body}</body></html>`;
}

await Bun.write(new URL("./out-digest.html", import.meta.url), document(renderDigest(markdown).replaceAll('href="/full"', 'href="out-full.html"').replaceAll('href="/raw"', 'href="../2026-08-24-prism-integration-lab-design.md"').replaceAll('href="/"', 'href="out-digest.html"')));
await Bun.write(new URL("./out-full.html", import.meta.url), document(renderContent(markdown).replaceAll('href="/full"', 'href="out-full.html"').replaceAll('href="/raw"', 'href="../2026-08-24-prism-integration-lab-design.md"').replaceAll('href="/"', 'href="out-digest.html"')));

console.log("Built out-digest.html and out-full.html");
