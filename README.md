# Ferrite documentation

This repository holds the source text of the documentation published at <https://docs.ferrite.cloud>, so that a reader who finds a mistake can point at the exact line.

| Path | Contents |
| --- | --- |
| `src/content/docs/` | The developer documentation: guides and reference for building, deploying and running applications on Ferrite |
| `src/content/academy/` | The Academy courses, one directory per course |
| `src/content/kb/` | The knowledge base: short answers to specific problems |
| `src/content/blog/`, `src/content/changelog/` | Blog posts and the change log |
| `public/agent-setup/` | The setup skills a coding agent reads to connect itself to Ferrite |

Every file here is a page the site serves, though some published pages are not in this snapshot yet. A file at `src/content/docs/developers/quickstart.mdx` is the page at `https://docs.ferrite.cloud/developers/quickstart/`, and each page is also served as Markdown at the same address with `.md` in place of the trailing slash.

The program that turns these files into the site, its page templates and its images are not part of this repository, so the site is not built from it.

## Correcting the documentation

Open an issue that names the file and the line, says what is wrong, and says what it should say if you know. A command that fails or an example that does not compile is the most useful kind of report: include the command and its output. Corrections are made in Ferrite's own source tree, and this repository is replaced by the next snapshot.

## Licence and contributions

The documentation text is copyright iGent AI and is not offered under an open source licence; see `LICENSE`. This repository accepts issues and does not accept outside pull requests; see `CONTRIBUTING.md`. Report a security problem to security@ferrite.cloud, as `SECURITY.md` describes. The hosted Ferrite platform is proprietary and not open source.

This repository is a scrubbed public snapshot prepared by the Ferrite team and carries no private development history.
