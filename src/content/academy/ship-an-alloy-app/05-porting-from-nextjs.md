---
# Held from publication until alloy-next is distributed publicly.
kind: lesson
course: held-ship-an-alloy-app
title: Porting patterns from Next.js
description: "Keep the upstream Next.js component tree byte-identical, resolve next/* imports through one adapter, and rewrite only server data modules as Rust loaders and actions."
order: 5
sources:
  - packages/alloy-next/README.md
---

Porting a Next.js App Router application to Alloy fails fastest when you
rewrite the React tree by hand. A manual rebuild from memory or screenshots
passes every server check because a mismatched UI still returns HTTP 200,
while layout chrome, state transitions, and interaction details diverge from
the original application without triggering an error.

## Keep upstream components verbatim

Pin one upstream commit and copy component files into `web/src/upstream/`
byte-for-byte without edits. Whenever a file must diverge, record the diff and the
reason in the port's evidence note. Comparing `web/src/upstream/` against the
pinned commit before accepting the port turns visual and behavioral parity
into a mechanical check.

## Resolve Next.js imports through one adapter

Aliasing `next/*` modules to the `alloy-next` adapter lets copied components
compile unchanged against Alloy's browser runtime:

- `next/link` maps onto Alloy's client router with prefetch-on-viewport.
- `next/navigation` exposes `useRouter`, `usePathname`, `useSearchParams`,
  `redirect`, and `notFound` over the same router.
- `next/cache` connects `updateTag` and `revalidateTag` to the tag epochs
  advanced by an action reply.
- `next/headers`, `next/offline`, `next/server`, and `server-only` each
  provide a minimal browser-safe shim while server behavior moves to Rust.

With those imports routed through the adapter, the copied components compile
and run without edits.

## Rewrite only server data modules

Limit code changes to `features/*-queries.ts` and `*-actions.ts` files marked
`server-only` or `'use server'`. Port each
Prisma query or mutation into a Rust loader or action that preserves the
function name, arguments, return shape, and cache tags. The rewritten
TypeScript file re-exports the generated typed client stub at the original
import path so upstream components keep compiling without edits.

## Verify parity and browser behavior

No standalone upstream-parity tool is distributed, and `alloy-check` does not
compare copied files against an upstream repository. Run `git diff --no-index`
between `web/src/upstream/` and the pinned upstream commit, and document every
difference with its reason in the port's evidence note.

Complete acceptance in a real browser. Exercise every capability the upstream
application provides: click every link, submit every form, capture
side-by-side screenshots at the same viewport width, and account for every
visible difference.
