# ct-apps-ca container handoff

## Image contract

- Multi-stage Node 22 Alpine image, Next.js standalone, non-root UID/GID 1001.
- Listen on `0.0.0.0:3000`; `GET /health` returns `200 {"status":"ok"}` without authentication or upstream requests.
- Docker healthcheck uses `wget -Y off` to bypass proxy environment variables.
- `SHADOW_NOINDEX=1` is the runtime default: middleware adds `X-Robots-Tag: noindex, nofollow, noarchive` to application responses (including redirects and health), and `/robots.txt` disallows every crawler. Static/image assets are excluded from middleware. Override to `0` only during the approved production cutover.
- This change prepares source and CI for ct-apps-ca. Release is owned by the devops promote/projects.yml entry point.

## Infisical variable names (no values in source)

Provide public configuration to both the image build and runtime:

| Name | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (required) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public anonymous key (required) |
| `NEXT_PUBLIC_SITE_URL` | Canonical origin and authentication callback origin |
| `NEXT_PUBLIC_SITE_NAME` | AI gateway application title (optional) |

`NEXT_PUBLIC_*` values are intentionally embedded in browser bundles. Inject the real public values from Infisical into Docker build arguments; changing them requires rebuilding the image. CI uses inert placeholders only.

Server-only variables must be supplied by Infisical at runtime, never as Docker build arguments:

- `OPENROUTER_API_KEY`
- `SILICONFLOW_API_KEY`

Runtime container controls: `SHADOW_NOINDEX=1`, `PORT=3000`, `HOSTNAME=0.0.0.0`. No credentials are needed for `/health` or shadow `/robots.txt`.

## CVE-2025-55182 verification

The original lockfile pinned Next.js `16.0.10`, already above the official `16.0.7` fix for CVE-2025-55182 (downstream CVE-2025-66478). During preparation, `npm audit` identified subsequent Next.js advisories, including image optimizer RCE GHSA-2464-fhr4-w9xw affecting versions through `16.4.0`. This change therefore pins Next.js and eslint-config-next `16.4.6`, with React and React DOM `19.3.1`, rather than shipping the older vulnerable line.

Evidence: https://nextjs.org/blog/CVE-2025-66478 and https://github.com/vercel/next.js/security/advisories/GHSA-9qr9-h5gf-34mp

## Validation

CI runs `npm ci`, `npm run lint`, `npm run build`, a Docker image build, and an ephemeral loopback-only container smoke test for health, crawler headers, robots, and the exact healthcheck command. No production credentials or deployment are used.
