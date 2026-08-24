import { FIGURES } from "./figures.ts";

export type FigureMap = Record<string, string>;

type DigestSection = {
  source: string;
  tone?: "approval" | "risk";
};

export type SpecChrome = {
  brand?: string;
  brandDetail?: string;
  eyebrow?: string;
  figures?: FigureMap;
  digestFigureKeys?: string[];
  digestSections?: DigestSection[];
};

const DEFAULT_CHROME: Required<Pick<SpecChrome, "brand" | "brandDetail" | "eyebrow">> & {
  figures: FigureMap;
} = {
  brand: "Prism",
  brandDetail: "integration lab design",
  eyebrow: "Unofficial portfolio prototype",
  figures: FIGURES,
};

export const esc = (value: string) => value
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

function inline(value: string): string {
  const code: string[] = [];
  const start = String.fromCharCode(0xe000);
  const end = String.fromCharCode(0xe001);
  let text = value.replace(/`([^`]+)`/g, (_match, body) => {
    code.push(`<code>${esc(body)}</code>`);
    return `${start}${code.length - 1}${end}`;
  });
  text = esc(text)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
  return text.replace(new RegExp(`${start}(\\d+)${end}`, "g"), (_match, index) => code[Number(index)]);
}

type Section = { title: string; body: string };

export function splitSections(markdown: string): Section[] {
  const sections: Section[] = [];
  let title = "";
  let body: string[] = [];
  const flush = () => {
    if (title || body.join("").trim()) sections.push({ title, body: body.join("\n").trim() });
    body = [];
  };
  for (const line of markdown.split("\n")) {
    const heading = line.match(/^##\s+(.+)$/);
    if (heading) {
      flush();
      title = heading[1].trim();
    } else {
      body.push(line);
    }
  }
  flush();
  return sections;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function renderBlocks(markdown: string, figures: FigureMap): string {
  const lines = markdown.split("\n");
  const output: string[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    const figure = line.match(/^<!--\s*fig:([a-z-]+)\s*-->$/);
    if (figure) {
      output.push(figures[figure[1]] ?? `<!-- unknown figure: ${esc(figure[1])} -->`);
      index += 1;
      continue;
    }
    if (/^```/.test(line)) {
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !/^```/.test(lines[index])) code.push(lines[index++]);
      index += 1;
      output.push(`<pre>${esc(code.join("\n"))}</pre>`);
      continue;
    }
    if (/^\|.*\|\s*$/.test(line) && index + 1 < lines.length && /^\|[\s:|-]+\|\s*$/.test(lines[index + 1])) {
      const cells = (row: string) => row.replace(/^\||\|\s*$/g, "").split("|").map((cell) => cell.trim());
      const head = cells(line);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && /^\|.*\|\s*$/.test(lines[index])) rows.push(cells(lines[index++]));
      output.push(`<div class="table-wrap"><table><thead><tr>${head.map((cell) => `<th>${inline(cell)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      continue;
    }
    const heading = line.match(/^(#{3,6})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      output.push(`<h${level} class="md-h">${inline(heading[2])}</h${level}>`);
      index += 1;
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) items.push(lines[index++].replace(/^\s*[-*]\s+/, ""));
      output.push(`<ul>${items.map((item) => `<li>${inline(item)}</li>`).join("")}</ul>`);
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) items.push(lines[index++].replace(/^\s*\d+\.\s+/, ""));
      output.push(`<ol>${items.map((item) => `<li>${inline(item)}</li>`).join("")}</ol>`);
      continue;
    }
    if (!line.trim()) {
      index += 1;
      continue;
    }
    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim() && !/^(#{3,6})\s|^```|^\|.*\|\s*$|^\s*[-*]\s+|^\s*\d+\.\s+|^<!--\s*fig:/.test(lines[index])) paragraph.push(lines[index++]);
    output.push(`<p>${inline(paragraph.join(" "))}</p>`);
  }
  return output.join("\n");
}

function titleFrom(markdown: string): string {
  return markdown.match(/^#\s+(.+)$/m)?.[1] ?? "Design specification";
}

function leadFrom(section?: Section): string {
  if (!section) return "";
  return section.body.split(/\n\s*\n/).find((block) => !block.trim().startsWith("<!--"))?.replace(/\n/g, " ") ?? "";
}

function topBullets(section?: Section): string[] {
  if (!section) return [];
  return section.body.split("\n").filter((line) => /^[-*]\s+/.test(line)).map((line) => line.replace(/^[-*]\s+/, ""));
}

function shell(title: string, body: string, mode: "digest" | "full", chrome: SpecChrome): string {
  const { brand, brandDetail, eyebrow } = { ...DEFAULT_CHROME, ...chrome };
  return `<div class="wrap" id="top">
  <nav class="topnav"><div class="brand">${esc(brand)} <span>${esc(brandDetail)}</span></div><a class="navlink" href="/">Digest</a><a class="navlink" href="/full">Full spec</a><a class="navlink" href="/raw">Markdown</a></nav>
  <header class="hero"><div class="kick">${esc(eyebrow)} · ${mode}</div><h1 class="title">${esc(title)}</h1></header>
  ${body}
</div>`;
}

export function renderDigest(markdown: string, chrome: SpecChrome = {}): string {
  const sections = splitSections(markdown);
  const goal = sections.find((section) => /^goal$/i.test(section.title));
  const scope = sections.find((section) => /^scope$/i.test(section.title));
  const decisions = sections.find((section) => /^locked decisions$/i.test(section.title));
  const open = sections.find((section) => /^open questions$/i.test(section.title));
  const figuresByKey = chrome.figures ?? DEFAULT_CHROME.figures;
  const figureKeys = chrome.digestFigureKeys ?? [...markdown.matchAll(/^<!--\s*fig:([a-z-]+)\s*-->$/gm)].map((match) => match[1]);
  const figures = figureKeys.map((key) => figuresByKey[key]).filter(Boolean).join("\n");
  const openItems = topBullets(open);
  const projected = (chrome.digestSections ?? []).map(({ source, tone }) => {
    const section = sections.find((candidate) => candidate.title === source);
    return section ? `<section class="projected-section${tone ? ` ${tone}` : ""}"><h2 class="section-title">${inline(section.title)}</h2>${renderBlocks(section.body, chrome.figures ?? DEFAULT_CHROME.figures)}</section>` : "";
  }).join("\n");
  const body = `
    <p class="digest-lead">${inline(leadFrom(goal))}</p>
    ${openItems.length ? `<div class="open"><h2>Open questions</h2><ul>${openItems.map((item) => `<li>${inline(item)}</li>`).join("")}</ul></div>` : ""}
    <section><h2 class="section-title">Architecture</h2>${figures}</section>
    ${scope ? `<section><h2 class="section-title">Scope</h2>${renderBlocks(scope.body, chrome.figures ?? DEFAULT_CHROME.figures)}</section>` : ""}
    ${decisions ? `<section><h2 class="section-title">Locked decisions</h2><ul class="decisions">${topBullets(decisions).map((item) => `<li>${inline(item)}</li>`).join("")}</ul></section>` : ""}
    ${projected}
    <section><div class="digest-more">This page is a digest of the Markdown specification. <a href="/full">Read the full specification.</a></div></section>`;
  return shell(titleFrom(markdown), body, "digest", chrome);
}

export function renderContent(markdown: string, chrome: SpecChrome = {}): string {
  const figures = chrome.figures ?? DEFAULT_CHROME.figures;
  const sections = splitSections(markdown);
  const body = sections.map((section) => section.title
    ? `<section id="${slug(section.title)}"><h2 class="section-title">${inline(section.title)}</h2>${renderBlocks(section.body, figures)}</section>`
    : renderBlocks(section.body.replace(/^#\s+.+$/m, ""), figures)).join("\n");
  return shell(titleFrom(markdown), body, "full", chrome);
}
