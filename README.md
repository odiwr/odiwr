# odiwr.com

Personal site, plus a dashboard that edits it.

## Hosts

| Host | Serves |
| --- | --- |
| `odiwr.com` | the landing page, work write-ups at `/[slug]`, `/dashboard` |
| `projects.odiwr.com` | the projects listing |
| `creative.odiwr.com` | the creative mosaic |

Both subdomains are this same app: `src/proxy.ts` rewrites their root onto
`/projects` and `/creative`, and gives each host its own `robots.txt` and
`sitemap.xml`. DNS has to point them here.

## Content

Everything editable lives in **one JSON document in R2** (`site/content.json`),
read through `src/lib/content.ts`. There is no database. The dashboard writes it;
the site reads it through a short cache that a save clears.

Until a section has real entries it shows filler from `src/lib/filler.ts`, which
disappears on its own once the first entry is published.

## Dashboard

`/dashboard`, behind Google sign-in restricted to `ADMIN_EMAILS`. Analytics reads
GA4 through a service account; Work, Blog and Media edit the document and the
bucket.

## Environment

Copy into `.env.local` — it is gitignored, and none of it belongs in the repo.

```
NEXT_PUBLIC_SITE_URL           # optional; defaults to https://odiwr.com
SESSION_SECRET                 # signs the dashboard cookie (PAYLOAD_SECRET also accepted)
ADMIN_EMAILS                   # comma separated allow-list
GOOGLE_CLIENT_ID               # OAuth client for the dashboard sign-in
GOOGLE_CLIENT_SECRET
GOOGLE_SITE_VERIFICATION       # optional; Search Console meta tag
GA_PROPERTY_ID                 # GA4 numeric property id
GOOGLE_SERVICE_ACCOUNT_EMAIL   # read-only access to that property
GOOGLE_SERVICE_ACCOUNT_KEY
R2_ENDPOINT                    # the content document and all uploads
R2_BUCKET
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_PUBLIC_URL                  # public origin, e.g. https://media.odiwr.com
```

The OAuth client needs `<origin>/dashboard/auth/callback` registered as a
redirect URI, for production and for localhost.

## Generated files

Each writes a module that is committed; re-run after changing its inputs.

| Command | Writes |
| --- | --- |
| `npm run icons` | every favicon size from `public/brand/catguy.svg` |
| `npm run icons:data` | inline SVG for the icons found in `src/` |
| `npm run stacks` | the searchable tech-stack index |
| `npm run fonts:subset` | the CJK and `@` font subsets, and their unicode-ranges |

## Bucket layout

`npm run r2:plan` prints a reorganisation plan; `npm run r2:apply` performs it.
Moves are copy-then-delete and cannot be undone, and assets are shared with the
old site — read the header of `scripts/reorganize-r2.mjs` first.
