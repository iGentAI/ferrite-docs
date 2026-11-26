---
title: Serve static assets from Blob
description: Declare a content route bound to Blob storage, load built files at startup, and let the gateway serve static assets directly without invoking your app.
topics: ["blob", "deploys"]
updated: 2026-11-16
---

Bind a `content` route to Blob storage to serve a website's static files directly from the gateway. Your app writes the built files into Blob storage at startup, and the gateway answers requests for them without calling your handlers, so slow dynamic code never stalls a stylesheet or script.

## Declare the route

Map a `content` route to a blob service in `ferrite.json`:

```json
{
  "services": [{ "name": "site-assets", "primitive": "blob" }],
  "applications": [{
    "name": "my-site",
    "artifact_key": "apps/my-site@v1",
    "artifact_sha256": "0000000000000000000000000000000000000000000000000000000000000000",
    "bindings": [
      { "handle": "assets", "kind": "blob", "service": "site-assets" }
    ],
    "routes": [{ "prefix": "/", "binding": "assets", "kind": "content", "public": true }]
  }]
}
```

The `public` field defaults to `false`. Because application code cannot mint presigned `?token=` tokens, set `"public": true` for public site assets and serve private files through an authenticated `api` route instead. A `content` route accepts no request body. Serve dynamic endpoints from a separate `api` route bound to a queue, and note that an `api` route at `/` takes precedence over `content` routes.

## Load the files

Write each asset to the blob binding during startup and skip objects whose bytes already match:

```rust
let mut assets = ctx.blob("assets")?;
for asset in embedded_assets() {
    match assets.get(asset.path.as_bytes()).await? {
        Some(current) if current == asset.bytes => {}
        _ => {
            assets.put(asset.path.as_bytes(), &asset.bytes).await?;
        }
    }
}
```

Here `embedded_assets()` returns built files compiled into the app's source. The `webapp` template generates `src/__ferrite_site.rs` from `site/index.html` with one constant, `INDEX_HTML`, and does not embed other files under `site/`. Pull in text assets such as CSS, JavaScript, or SVG with `include_str!` (for example, `include_str!("../site/app.css")` from inside `src/`). For binary assets such as PNG images, generate a Rust source file under `src/` that defines the bytes as a constant.

Two gates validate build-time file reads: the local gate (`ferrite check`) and the platform gate. Both admit `include_str!` on any UTF-8 file inside the app directory, because the CLI uploads every file an `include_str!` names. Both admit `include_bytes!` on a UTF-8 file under `src/` or `tests/`. The platform gate rejects `include_bytes!` on a binary file or on a file outside `src/` and `tests/`, because the CLI does not upload that file, even though the local gate allows it. See [Why ferrite check rejects your spec](/kb/guide/why-ferrite-check-rejects-your-spec/) for the full gate rules.

Name object keys to match URL paths, such as `index.html` and `docs/intro/index.html`. The gateway strips the route `prefix`, appends the remainder to the route's `key_prefix` (empty by default), and resolves both the route root and any path ending in `/` to `index.html`, so `/docs/intro/` fetches `docs/intro/index.html`. Keep metadata about files, such as ownership and deletion rules, in Store, and keep only the raw bytes in Blob storage.

## What the route provides

- The gateway serves every static file directly; your app only packages and loads the bytes at startup.
- Blob storage verifies each stored record on read using a CRC32C checksum, plus the encryption tag on an encrypted store, and refuses corrupted objects instead of serving them. The SHA-256 digest computed on write becomes the HTTP `ETag`.
- Static files ship in the same build and deployment as your code, so a separate asset upload cannot drift out of sync with a release.

## Limits

This layout fits files built alongside the app that change only on deploy:

- A single object holds at most 16 MiB, the default object service limit.
- Embedded files travel inside the app's source and compile into the binary, so they count toward the source upload cap (32 MiB on a trial account).
- Assets update only when you deploy. For user uploads or files that change between deployments, write to a blob binding from a handler instead.
- Because the files live in source, deploying the app to a fresh account repopulates Blob storage automatically. See [Prepare for a platform release](/kb/guide/prepare-for-a-platform-release/).

See [Object Storage](/developers/object-storage/) for the full Blob API and configuration reference.
