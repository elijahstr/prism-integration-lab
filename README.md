# Prism Integration Lab

An unofficial portfolio prototype that explains ticket-provider architecture for a venue and promoter workflow.

Live site: [prism-integration-lab.vercel.app](https://prism-integration-lab.vercel.app/)

The scenario uses Come and Take It Live in Austin and Come and Take It Productions. The provider and transport examples are hypothetical.

## What is included

- Five topic tabs on one page
- Architecture diagrams for each of the four challenge topics
- Clear approach comparisons with pros, cons, and technical debt
- Four preloaded worked scenarios
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

This command checks formatting, types, the production export, all tabs, keyboard navigation, the venue image, and every worked scenario.

## Deploy to Vercel

Import this GitHub repository as a Next.js project. Use the default build settings.

The deployment needs no environment variables or other Vercel services.

## Disclaimer

This project is not an official Prism, Come and Take It Live, or Come and Take It Productions product.
