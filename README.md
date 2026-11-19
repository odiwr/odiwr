# odiwr.com

I hate boring design. Ironic right? But why bother creating a product just for
the end result to be a vibe coded mediocre mess of ideas? That has been my
mindset ever since I began freelance web developing in 2021. Creators (and
honestly, clients) overlook the small details that make a product worth buying,
even if it's boring.

This is the code for my website, plus the dashboard I use to edit it. Anyways,
welcome to my website.

## What lives where

| Address | What it is |
| --- | --- |
| [odiwr.com](https://odiwr.com) | the home page, the blog, and write-ups at `/<slug>` |
| [projects.odiwr.com](https://projects.odiwr.com) | my projects |
| [creative.odiwr.com](https://creative.odiwr.com) | film and photography, as a mosaic |
| [cinema.odiwr.com](https://cinema.odiwr.com) | favourite moments from films and shows |
| [portfolio.odiwr.com](https://portfolio.odiwr.com) | photos and video, no words. Any shape fits, and it shuffles on every visit |

It's all one app. `src/proxy.ts` points each subdomain at its own page, so
until DNS catches up they also work as paths: `/projects`, `/cinema`,
`/portfolio` and so on.

## Stack

Next.js 16, React 19 and Tailwind 4. Everything I edit lives in one JSON
document in Cloudflare R2 (no database), along with every upload. The dashboard
at `/dashboard` is behind Google sign-in.

## Run it

```
npm install
npm run dev
```

Then open [localhost:3000](http://localhost:3000). Without R2 keys the dashboard
still works: it saves to `.local/` and `public/_local/` (both gitignored) instead
of the bucket. Without a Google client, set `ADMIN_EMAILS` and it signs you
straight in as the first address on that list.

## Environment

Put these in `.env.local`. It's gitignored, and none of it belongs in the repo.

```
NEXT_PUBLIC_SITE_URL           # optional; defaults to https://odiwr.com
SESSION_SECRET                 # signs the dashboard cookie
ADMIN_EMAILS                   # comma separated, who can sign in
GOOGLE_CLIENT_ID               # dashboard sign-in
GOOGLE_CLIENT_SECRET
GOOGLE_SITE_VERIFICATION       # optional; Search Console
NEXT_PUBLIC_GA_MEASUREMENT_ID  # GA4 "G-…" id
GA_PROPERTY_ID                 # GA4 numeric property id, for the dashboard
GOOGLE_SERVICE_ACCOUNT_EMAIL   # read-only access to that property
GOOGLE_SERVICE_ACCOUNT_KEY
R2_ENDPOINT                    # the content document and all uploads
R2_BUCKET
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_PUBLIC_URL                  # e.g. https://media.odiwr.com
```

The Google OAuth client needs `<origin>/dashboard/auth/callback` as a redirect
URI, for production and for localhost.

## Generated files

Committed, so only re-run these after changing what they read.

| Command | Makes |
| --- | --- |
| `npm run icons` | every favicon size, from `public/brand/catguy.svg` |
| `npm run icons:data` | the inline SVG for icons used in `src/` |
| `npm run stacks` | the searchable tech-stack index |
| `npm run fonts:subset` | the small CJK and `@` font files |
| `npm run ffmpeg:worker` | `public/ffmpeg/`, for the clip cutter |

## Talk to me

Anywhere online [@odiwr](https://github.com/odiwr) or
[o@odiwr.com](mailto:o@odiwr.com).

因为热爱
