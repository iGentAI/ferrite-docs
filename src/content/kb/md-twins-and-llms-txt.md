---
title: Markdown twins and llms.txt on Ferrite
description: Serve Markdown page twins, llms.txt, sitemaps, and MCP discovery endpoints from a single Surface declaration using the agent-ready source package.
topics: ["agent-readiness", "source-packages"]
updated: 2026-11-16
---

A *Markdown twin* is a Markdown version of a web page returned from the same URL when a client requests Markdown. An `llms.txt` file is an emerging convention for a root-level index that points language models directly to your site's substantive content. Together they let a customer's assistant read your product without scraping HTML layout. Hand-written copies drift as pages change, so Ferrite's `agent-ready` source package generates both (along with the rest of your discovery surface) from a single declaration of your pages and operations.

## Install and wire the package

1. Add `agent-ready` to your app:

   ```bash
   ferrite add agent-ready
   ```

   This copies the package into `src/agent_ready/`, installs its package dependencies under their own `src/` directories, and prints the module declarations to add to your crate root.

2. Declare a `Surface` holding your app's identity (`name`, `owner`, `origin`, `description`, `version`), routes and operations, and pages (the package guide documents every field). Implement `PageSource` to return each page as Markdown or HTML; if you return HTML, the package converts it to Markdown automatically.

3. Dispatch incoming requests through `well_known::handle_h` ahead of your catch-all router, and return every response header it produces. The handler takes your `Surface`, the request method, path, headers, and body, your `PageSource`, and the function that executes MCP tool calls.

4. Forward every header the package inspects in each route's `forward_headers` list in `ferrite.json`, because the gateway strips unlisted request headers before they reach your app:

   ```json
   "forward_headers": ["accept", "origin", "mcp-protocol-version", "mcp-method", "mcp-name"]
   ```

   Each header controls a specific check:

   - Omit `origin` and the MCP server cannot reject cross-origin requests sent from another site's page.
   - Omit `accept` and a client requesting Markdown at a canonical page URL receives HTML.
   - Omit `mcp-method` or `mcp-name` and the MCP server skips verifying that those headers agree with the JSON-RPC request body.

   `forward_headers` is accepted on `api` and `grpc` routes and allows up to 16 header names.

## Generated endpoints

From one `Surface` declaration, `agent-ready` serves:

- `/robots.txt` and `/sitemap.xml`. The `robots.txt` allows crawling, lists the sitemap, and carries `Content-Signal: search=yes, ai-input=yes, ai-train=yes` inside its user-agent group. It is the same on your app's default `ferrite.run` host and on your own domain. To send a different policy, answer `/robots.txt` in your own router before requests reach `well_known::handle_h`.
- `/llms.txt` and `/llms-full.txt`.
- Markdown twins for every declared page at its `.md` path (`/docs/pricing.md`, `/index.md`) and at `?format=md`. The same Markdown is returned at the canonical URL for `Accept: text/markdown` with `Vary: Accept` when `accept` is listed in `forward_headers`; without that entry, the gateway drops the header and your app serves HTML.
- RFC 9457 error responses as `application/problem+json`.
- An OpenAPI 3.1 catalog at `/.well-known/api-catalog`, an agent card at `/.well-known/agent-card.json` that names an A2A JSON-RPC endpoint at `/a2a`, and a stateless MCP server at `/mcp` whose tools come from your declared operations.
- An MCP registry manifest at `/server.json` with its discovery copy at `/.well-known/mcp/server-card.json`, an Agent Skills index at `/.well-known/agent-skills/index.json`, and Markdown pricing at `/pricing.md`.
- A redirect at `/.well-known/change-password`, served only when your `PageSource` supplies your password-change page URL.
- A self-check report at `/.well-known/agent-readiness`, computed from your `Surface`, that marks each check `pass`, `warn`, or `fail` and names the change required to fix each gap. This endpoint audits your declaration against the package's built-in checklist; it is a local diagnostic, with no external scoring or certification.

Because every file comes from the same `Surface`, updating a page or operation updates the sitemap, `llms.txt`, and API catalog in the same build.

## Live example

The Ferrite documentation site publishes an `llms.txt` index and Markdown twins for its developer guides:

```bash
curl -s https://docs.ferrite.cloud/llms.txt
curl -s https://docs.ferrite.cloud/developers/quickstart.md
```

Both endpoints are public and need no cookie or account token.

The documentation site builds those files with its own static generator (separate from the `agent-ready` package), and its knowledge-base guides do not publish Markdown twins.

See [Agent-ready apps](/developers/agent-native-apps/) for the full `Surface` contract, authorization boundaries, and local verification steps.
