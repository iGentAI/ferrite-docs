---
title: "Custom domains and TLS"
description: "Bind your app to a free name under ferrite.run or to a domain you own with CNAME and TXT records. Ferrite obtains and renews the TLS certificate."
topics: ["domains", "deploys"]
updated: 2026-11-23
---

Run `ferrite domains add <hostname>` from your project directory to put an app on a free `*.ferrite.run` name or a domain you own. Every deployed app already receives a generated HTTPS host such as `2z6xa6mewg3itc9j.ferrite.run`. Adding a custom hostname gives you two options: a free single-label name such as `shop.ferrite.run` with no DNS setup, or a domain you own such as `shop.example.com` using two CNAME records and an ownership TXT record. In both cases, Ferrite obtains and renews the TLS certificate automatically, and the generated platform host keeps answering too.

## Put the app on a name

From your project directory:

```bash
ferrite domains add shop.example.com
```

`ferrite domains add` claims the name for your account, verifies the claim, binds it to the app in `./ferrite.json` (pass `--app` to target another app), and prints the DNS records to publish. Re-running the command skips any step already completed.

You can run the same sequence from the Dashboard or over MCP:

- In the Dashboard, open **Domains**, enter the hostname, click **Claim domain**, copy the printed records, then verify and bind the name on its page.
- Over MCP, call `claim_domain`, `verify_domain`, and `bind_domain` in order. Save the `verify_token` returned by `claim_domain`, because it is issued once.

For a free name one label under `ferrite.run` (such as `shop.ferrite.run`), no DNS records are required. It serves under Ferrite's wildcard certificate as soon as it is bound. Multi-label names such as `a.b.ferrite.run` are refused, and names under `ferrite.cloud` are reserved for the platform's own services.

## Add the DNS records

For `shop.example.com`, publish these records where your domain's DNS is hosted (your registrar such as Namecheap, GoDaddy, or Squarespace, or a DNS host such as Cloudflare or DNSimple):

| Name | Type | Value | Purpose |
| --- | --- | --- | --- |
| `shop` | CNAME | `ferrite.cloud` | Routes visitors to Ferrite |
| `_acme-challenge.shop` | CNAME | `_acme-challenge.shop.example.com.acme.ferrite.cloud` | Delegates DNS-01 certificate validation without exposing your zone |
| `_ferrite-challenge.shop` | TXT | Token printed by `ferrite domains add` | Proves domain ownership |

Most DNS providers ask only for the subdomain prefix shown above; some require the full hostname. Use a TTL of 300 seconds or less while setting up so corrections propagate fast.

If your provider proxies HTTP traffic (such as Cloudflare's orange cloud), turn proxying off on the traffic record so it resolves as DNS-only. Proxying blocks TLS certificate issuance.

### Using the bare domain

Standard DNS forbids a CNAME at the zone apex (`example.com`). Point an `ALIAS`, `ANAME`, or flattened CNAME record at `ferrite.cloud` instead (Cloudflare, DNSimple, and most modern DNS providers support one). If your provider does not, bind `www.example.com` with a CNAME and configure a redirect from the bare domain to `www.example.com` at your provider. The `_acme-challenge` record is always a normal CNAME because it sits beneath the apex.

## Check that it works

```bash
ferrite domains check shop.example.com
```

`ferrite domains check` queries each record through public DNS, points out anything missing or misconfigured, and requests `https://shop.example.com/`. Within about ten minutes of both CNAME records resolving, Ferrite obtains the certificate and starts serving your app on the custom name. If a record was missing when Ferrite first checked, it retries an hour later, so give a fixed record up to an hour to issue.

## Good to know

- Names are claimed first come, first served across the installation. If a domain you own is already claimed by another account, [contact the Ferrite team](/kb/guide/get-help-from-the-ferrite-team/).
- There is no command or button to release a claim or remove a binding yet. Binding the name to another app in your account moves it there.
- Pick one canonical address for sign-in, links, `sitemap.xml`, and `llms.txt`. Sign-in cookies belong to a single host, so a user signed in on one name is not signed in on the other.
- `ferrite deploy` re-binds the app's domains automatically after each deploy. If you deploy through MCP alone, verify each domain after deploying and call `bind_domain` again if needed.

For the full reference, read [Domains](/developers/domains/).
