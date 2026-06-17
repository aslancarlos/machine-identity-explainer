# machine-identity-explainer

[![build](https://github.com/aslancarlos/machine-identity-explainer/actions/workflows/build.yml/badge.svg)](https://github.com/aslancarlos/machine-identity-explainer/actions/workflows/build.yml) [![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

Interactive single-page application that walks through the core building blocks of **Machine Identity Security**: SPIFFE, SPIRE, X.509 SVIDs, JWT SVIDs, mTLS, and the zero-trust workload identity model that underpins modern cloud-native security. Companion to the [IDIRA Secrets Manager demos](https://demo.minha.cloud).

> **2026-05-27 — rebrand & theme** · Visual language now follows [paloaltonetworks.com/idira](https://www.paloaltonetworks.com/idira): Onest typography + IBM Plex Mono, IDIRA palette, **dark + light theme** with user toggle in the nav (persists to `localStorage`, falls back to `prefers-color-scheme`). Skip-to-content link, visible focus rings, and `prefers-reduced-motion` support (WCAG 2.4.1 / 2.3.3). See [`src/lib/useTheme.ts`](src/lib/useTheme.ts) and [`src/components/ThemeToggle.tsx`](src/components/ThemeToggle.tsx).

Live at: `https://machine.minha.cloud/`

---

## What this demonstrates

Machine identity is the next decade's identity problem. Every workload, service, CI runner, and AI agent needs to authenticate to other workloads — without long-lived API keys, shared secrets, or human intervention. This explainer covers the foundational patterns:

| Concept | What it shows |
|---|---|
| SPIFFE IDs | Universal naming scheme for workloads across clouds, K8s, and VMs |
| SPIRE Server / Agent | How identity is attested and issued at runtime |
| X.509 SVIDs | Short-lived certificates as workload credentials |
| JWT SVIDs | JWT-based alternative for HTTP and message-bus workloads |
| mTLS | Mutual authentication based on workload identity, not network location |
| Trust Domains | Federation between organizations and clouds |

Each section is interactive — you can step through attestation flows, inspect certificate contents, and see how a workload moves from "no identity" to "fully attested and authorized" without ever touching a static secret.

## Why this matters

The industry has spent two decades hardening human identity (SSO, MFA, conditional access). Machine identity is roughly where human identity was in 2010: long-lived credentials, broad scope, weak rotation, and very little observability. SPIFFE/SPIRE is one of the open foundations for closing that gap, alongside cloud-native primitives like IRSA, Workload Identity Federation, and Conjur `authn-jwt`.

## Live SCEP enrollment

The `/scep` tool requests a real certificate from any SCEP server (RFC 8894) —
Venafi, Microsoft NDES, EJBCA, etc. Supply the SCEP URL and challenge password,
then enrol as a **machine** (CN = FQDN, DNS SANs) or a **user** (CN = name, email
/ UPN SANs). The full exchange — `GetCACaps`, `GetCACert`, RSA keygen, PKCS#10
CSR, the signed/enveloped `PKCSReq` pkiMessage, `PKIOperation`, and decrypt of the
issued cert — runs server-side in `api/scep.cjs` (pure Node.js + `node-forge`).

Keys, CSR, and the challenge are never persisted or logged server-side. The
public-facing proxy resolves the target host and refuses private/internal
addresses (SSRF guard), and verifies the endpoint's TLS by default (an explicit
per-request opt-in is required to skip it for private/self-signed CAs).

> The API server (`api/server.cjs`) now depends on `node-forge`; run `npm install`
> wherever it is deployed and restart the `mi-scan-api` service.

## Running locally

```bash
npm install
npm run dev
```

Then open `http://localhost:5173`.

## Building / Docker

```bash
npm run build
docker build -t machine-identity-explainer .
docker run -p 8080:8080 machine-identity-explainer
```

## Tech stack

- **Vite + React + TypeScript** for the SPA
- **Tailwind CSS** for styling
- **Nginx** as the production server (in the Docker image)

## Related projects

- [conjur-explainer](https://github.com/aslancarlos/conjur-explainer) — Same explainer pattern, focused on IDIRA Secrets Manager
- [k8s-eso-shop](https://github.com/aslancarlos/k8s-eso-shop) — End-to-end demo of External Secrets Operator on K8s

## License

Apache License 2.0 — see [LICENSE](LICENSE).
