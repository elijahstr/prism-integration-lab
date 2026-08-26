# Prism Integration Lab

An unofficial portfolio prototype that explains ticket-provider architecture for a venue and promoter workflow.

The scenario uses Come and Take It Live in Austin and Come and Take It Productions. The provider and transport examples are hypothetical.

## What is included

- Seven topic tabs on one page
- Architecture diagrams for each topic
- Clear approach comparisons with pros, cons, and technical debt
- Six deterministic browser-only examples
- A responsive Poppins and Prism-purple interface

## Architecture

This repository contains one static Next.js application. It has no API, database, worker, queue, secrets, or runtime service.

Next.js exports the site to `out/`. Vercel serves those files from its CDN.

## Local use

```bash
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Checks

```bash
bun run verify
```

This command checks formatting, types, the production export, all tabs, keyboard navigation, the venue image, and every example.

## Deploy to Vercel

Import this GitHub repository as a Next.js project. Use the default build settings.

The deployment needs no environment variables or other Vercel services.

## Disclaimer

This project is not an official Prism, Come and Take It Live, or Come and Take It Productions product.
