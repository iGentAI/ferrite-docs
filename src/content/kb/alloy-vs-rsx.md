---
title: "Alloy versus Rsx: choose a web framework"
description: "Choose Alloy when you want Rust routing and loaders or a typed React front end, and Rsx when you want server-rendered .rsx templates with minimal client JavaScript."
topics: ["comparisons", "alloy", "rsx"]
updated: 2026-11-16
---

Choose Alloy when you want to write routing, cached loaders, and mutations directly in Rust, optionally under a React front end with a generated TypeScript contract. Choose Rsx when your pages are mostly server-rendered data authored as `.rsx` templates with small JavaScript islands. Both ship inside the `ferrite` CLI, compile into a single-dependency Ferrite app (`ferrite-app`), and deploy identically, so you can pick per app.

## Decide between them

Match your UI and authoring style to the framework:

- Pick Alloy when you want routing, loaders, and actions written in Rust, or when the interface relies on client-side React state such as a drag-and-drop board, optimistic editing, or offline support.
- Pick Rsx when pages are mostly rendered data with a few interactive controls (documentation, dashboards, or feeds), when you prefer template files over building HTML in Rust, or when compact server-rendered HTML matters for assistants and crawlers.

Skip both frameworks for small surfaces. For a single page with a form (a poll, sign-up sheet, or guestbook), the Ferrite plugin starts from a one-file page app without a framework. For an API with no HTML pages, `ferrite new hello` scaffolds a plain request/reply app. When you have no strong preference on a multi-page web app, start with Alloy: `ferrite new` recommends it for HTML apps and the plugin defaults to it for multi-page projects.

Scaffold either framework with one command:

```bash
ferrite new alloy my-app --with-tests
ferrite rsx new my-app --with-tests
```

Both commands accept `--dir <path>` to create the app inside a specific parent directory.

## How Alloy works

`ferrite new alloy` scaffolds a server-rendered Rust application with no JavaScript build. Your Rust code owns URL routing, tag-invalidated cached loaders, replay-safe actions, and HTML document assembly.

You can attach a React front end to the same app. When the project declares its routes and actions under `app/` alongside a Vite project in `web/` (with `web/package.json` and `src/alloy/mod.rs` present), `ferrite dev` generates a typed contract between both halves, runs the Vite build, and packs the compiled assets into the Rust crate. Changing a Rust loader signature breaks TypeScript compilation on the next build. No starter template scaffolds this React layout, and the `@alloy/next` adapter is outside the CLI distribution, so you wire your Vite front end against the generated TypeScript types, fetch client, and TanStack Query hooks directly.

## How Rsx works

Rsx compiles file-convention routes under `app/` and `.rsx` templates ahead of time into plain Rust, with no proc-macros, no build scripts, and no React or TypeScript compiler. Interactive fragments live in plain JavaScript islands (`components/<name>.island.js`) that hydrate independently, and live regions push server-driven updates. The browser downloads server-rendered HTML plus the JavaScript for its islands.

Plan around two runtime behaviors: the server buffers the entire first page load into one HTTP reply before sending it (no HTTP chunked streaming), and live regions poll their backing log on an interval rather than waking on append, so an update can wait up to one interval.

## Compare the details

| Concern | Alloy | Rsx |
| --- | --- | --- |
| Routing, loaders, and mutations | Hand-written Rust | Rust generated from `app/` |
| Page markup | Assembled in Rust, or an optional Vite + React front end | `.rsx` templates compiled to Rust |
| Cross-boundary type safety | Generated TypeScript contract when `web/` is present | Single language on the server; plain JS islands |
| JavaScript sent to the browser | None, or your React bundle | Islands only |
| Live updates | Implemented in your client front end | Live regions streamed from the server |

For full setup instructions and API details, read [Alloy](/developers/alloy/) and [Rsx](/developers/rsx/).
