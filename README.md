# Ferrite documentation

Ferrite maintains its public developer guides, Academy courses, knowledge base, blog, changelog and agent setup instructions here. The production site selects a commit of this repository for each release. Read the [Ferrite documentation](https://docs.ferrite.cloud).

| Path | Contents |
| --- | --- |
| `src/content/docs/developers/` | Developer guides and reference |
| `src/content/academy/` | Courses and lessons |
| `src/content/kb/` | Answers to common questions |
| `src/content/blog/` and `src/content/changelog/` | Posts and release notes |
| `public/agent-setup/` | Downloadable instructions for coding agents |

## Check a change

With Node.js 24 and npm installed, run:

```sh
npm ci
npm run build
```

The build checks page titles and compiles the Markdown and MDX. It writes the content and its rights notices to `dist/ferrite-docs.tar.gz`. The site publisher combines the selected revision with the site theme and assets, then checks the rendered routes, links, search index and Ferrite application before deployment.

A guide such as `src/content/docs/developers/quickstart.mdx` appears at [Quickstart](https://docs.ferrite.cloud/developers/quickstart/) and is also available [as Markdown](https://docs.ferrite.cloud/developers/quickstart.md).

## Corrections and rights

Open an issue with the file and line, the correction, and a command or example that demonstrates it where applicable. See [Contributing](CONTRIBUTING.md). For support, contact info@igent.ai. Report security issues privately to security@ferrite.cloud as described in [Security](SECURITY.md).

Copyright 2026 iGent AI. All rights reserved. The [licence](LICENSE) covers this documentation. The hosted Ferrite platform is proprietary.
