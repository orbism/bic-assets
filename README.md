# BIC Asset Tracker

Records of provenance for onchain artefacts. Next.js + Prisma Postgres, deployable to Vercel.

## Running locally

```bash
npx prisma dev -n asset-tracker -d   # local Postgres, named so it cannot collide
npm run db:migrate
npm run seed                         # users from .env + all CSVs in /data
npm run dev
```

`prisma dev` prints a connection string; `DATABASE_URL` in `.env` should be its
**TCP** form (`postgres://…`), not the `prisma+postgres://` one. If requests start
failing with `ECONNREFUSED`, the local Postgres has stopped — restart it with
`npx prisma dev start asset-tracker`.

## Checks

```bash
npm run verify          # eslint + tsc + next build
npm run check:console   # real browser, fails on any console error or warning
```

`verify` catches nothing that happens at runtime in the browser, which is the
point of `check:console`: it drives Chromium over every page in both themes,
does a full pass of **client-side** navigation, and opens the media modal. The
client-side pass matters — several React warnings only fire when the browser
processes the RSC payload, so a suite of plain page loads will never see them.
Start the app first, then point it at the right port with
`npm run check:console -- http://localhost:3000`.

## Theme

Light and dark are declared once per token with CSS `light-dark()`. The choice
lives in a `theme` cookie that the root layout reads during SSR and stamps onto
`<html>` as `.light` or `.dark`; with no cookie there is no class and
`prefers-color-scheme` decides. There is no inline theme script, so no flash and
no hydration mismatch.

## Data model

All rows from all sheets live in one `Artefact` table with the fields they share
(name, creator, chains, contracts, links, tags, provenance answers). Sheet-specific
columns hang off it as 1:1 detail records: `MemecoinDetail`, `NftDetail`,
`CollectionDetail`, `ProvfiDetail`. That is what lets the master tool sort and filter
across everything in one query while each sheet page still shows its own columns.

Provenance questions are free text in the source sheets. Each is parsed into a
`YES` / `NO` / `UNKNOWN` / `NA` enum in `flags` for filtering, and the original
string is kept verbatim in `flagsRaw`. Every record also keeps its untouched
source row in `sourceRow` with the sheet name and line number.

## Import

`npm run seed` (or **Re-run import** in the admin page) reads the CSVs in `/data`
and upserts on `(sheet, slug)`.

- Nothing is ever deleted. A row removed from a CSV stays in the database.
- Re-running overwrites fields with the CSV values, so in-app edits to imported
  fields are lost on re-import. The previous state is in the audit log.
- Record ids are stable across re-imports.

Three source quirks are handled explicitly in `src/lib/import.ts`:

1. The Collections sheet contains three different row shapes. Rows tagged
   `celebrity` become Collections rows of type "Celebrity NFT project"; ten
   memecoin-shaped rows with inconsistent column offsets are hand-mapped into the
   Memecoins sheet from a literal table in the importer; the rest use the sheet's
   stated header.
2. Six Celebrity rows have no Name but do have a ticker and creator. They are kept,
   named from the ticker, and flagged `needsReview`.
3. Dates are parsed best-effort (`M/D/YYYY` is read as US order, matching the Google
   Sheets export). The original string is always kept in `launchRaw`.

## Media

`npm run scan` (or **Re-scan media** in the admin page) walks `/public/assets`,
collapses size variants into one asset per artwork, and attaches each to every
record whose name, slug or ticker matches. A thumbnail appears in the first
column of every table and in a gallery on the record page; clicking opens a modal
with the full image or video and a download button.

Because one meme is often present on several sheets, a single file attaches to
all of its records — Keyboard Cat shows on the NFT and Prov.fi pages alike.

Files whose names match nothing are listed on `/media` under **Unattached**,
where they can be attached to a record by hand. Nineteen files whose names differ
from the record they belong to are mapped explicitly in `MANUAL_MATCHES` in
`src/lib/assets.ts`.

The scan is re-runnable and non-destructive: detaching a file marks the link
dismissed rather than deleting it, so a later scan will not resurrect it, and
files that disappear from disk are flagged `missing` rather than removed.

Uploads go straight from the browser to Vercel Blob, which is what makes video
possible — a server route on Vercel caps request bodies at 4.5MB. Set
`BLOB_READ_WRITE_TOKEN` to enable it; without it the rest of the media layer
works and only the upload button errors.

## Access

**Reading is public.** Anyone can browse every sheet, the master tool, records,
media and the CSV export without an account. Signing in only ever adds the
ability to change things.

| | read + export | edit records & media | users, import, scan |
|---|---|---|---|
| public | yes | no | no |
| Viewer | yes | no | no |
| Editor | yes | yes | no |
| Admin | yes | yes | yes |

Every write endpoint enforces its own role, so an anonymous or under-privileged
request is refused at the route with 401/403 rather than being redirected. The
per-record change history is the one read that stays behind sign-in, since it
names the people who made each edit.

Accounts are admin-created only; there is no self-signup. The bootstrap admin comes from
`ADMIN_EMAIL` / `ADMIN_PASSWORD` and/or `ADMIN_WALLET`. That account is created
either by `npm run seed` or on its first sign-in, so setting the variables is
enough — no seed run required on a fresh deploy. Only an exact match to those
variables is ever auto-created. Everyone else is added in the admin page.

- **Viewer** — read and export.
- **Editor** — plus create, edit and delete records.
- **Admin** — plus user management and re-running the import.

Sign in with an EVM wallet (SIWE, EOA signatures) or email and password. Both can be
linked to one account, so the same person shows up as one actor in the audit log.

## Deleting

Deletes are real, but the complete prior state of the record is written to the audit
log first, so it can always be reconstructed.

## Deploying to Vercel

Set `DATABASE_URL` to the Prisma Postgres connection string, and set `AUTH_SECRET`
to a long random value. Then:

```bash
npx prisma migrate deploy
npm run seed   # creates the bootstrap admin
```

The Prisma client is generated into `src/generated/prisma` on `postinstall`.
