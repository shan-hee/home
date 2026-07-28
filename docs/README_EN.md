English | [简体中文](../README.md)

# Homepage

A personal navigation homepage built with React and Cloudflare, including links, weather, Hitokoto, music, wallpapers, and an owner dashboard.

![Homepage](../screenshots/main.png)

[Live demo](https://ajjj.de/)

## Features

- Responsive homepage with site and social-link management
- Time, weather, Hitokoto, and time-progress views
- Music search, playlist playback, lyrics, and media shortcuts
- Bing, Wallhaven, and custom R2 wallpapers with scheduled rotation
- Owner dashboard, device management, and audit history
- PWA offline startup and offline owner-draft synchronization

## Stack

- React, TypeScript, Vite, Zustand
- Cloudflare Pages Functions, D1, R2
- IndexedDB, Workbox PWA
- IconPark, Iconify

## Deploy to Cloudflare

You need a GitHub account and a Cloudflare account with Pages, D1, and R2 enabled. Cloudflare Pages is the only supported deployment target.

### 1. Prepare the repository and Cloudflare resources

1. Fork this repository to your GitHub account.
2. Create a D1 database named `home` in the Cloudflare dashboard.
3. Create an R2 bucket named `home-assets`.

### 2. Create the Pages project

Open Workers & Pages in the Cloudflare dashboard, create an application, and connect the forked GitHub repository:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Build command | `pnpm build` |
| Build output directory | `dist` |
| Root directory | Leave empty |

### 3. Add bindings and secrets

Add the following bindings in the Pages project settings:

| Type | Variable name | Value |
| --- | --- | --- |
| D1 database | `DB` | Select the D1 database |
| R2 bucket | `WALLPAPER_BUCKET` | Select the R2 bucket |
| Secret | `OWNER_PASSWORD` | Owner password with at least 8 characters |
| Secret | `IP_HASH_SECRET` | Random string with at least 32 characters |

Use the Secret type for `OWNER_PASSWORD` and `IP_HASH_SECRET`, and never add a `VITE_` prefix. Add `QWEATHER_API_KEY` and `WALLHAVEN_API_KEY` only when needed.

### 4. Initialize the site once

Install Node.js 24+ and pnpm 11+, open the repository directory, and run:

```bash
pnpm install --frozen-lockfile
pnpm exec wrangler login
pnpm db:migrate:remote
pnpm db:seed:generate
pnpm db:seed:remote
```

Run these initialization commands only once on a brand-new database. Refresh the site afterward, sign in with `OWNER_PASSWORD`, and customize the site from the owner dashboard.

Never commit real passwords, tokens, `.dev.vars`, or `.site-content.seed.json`.

## Local maintenance

```bash
pnpm install --frozen-lockfile
cp .dev.vars.example .dev.vars
pnpm db:migrate:local
pnpm db:seed:generate
pnpm db:seed:local
pnpm dev:cf
```

Set the local `OWNER_PASSWORD` and `IP_HASH_SECRET` in `.dev.vars`, then open `http://localhost:3000`. Use `pnpm dev:web` when only working on frontend pages.

`wrangler.local.jsonc` is used only for local D1 and R2 resources. It is not used by the production Cloudflare Pages deployment.

Initial content comes from `scripts/site-content.seed.example.json`. After deployment, profile data, default behavior, music, wallpapers, and Hitokoto can be managed from the owner dashboard. The repository address is used by the About page to check for updates.

## Data and offline behavior

- D1 stores site configuration, devices, sessions, and audit records.
- R2 stores server-validated and normalized custom wallpapers up to 50MB each.
- IndexedDB stores owner drafts and queued mutations, which are submitted after connectivity returns.
- The PWA caches the application shell, recent configuration, and a limited wallpaper set. Uncached music is not guaranteed to play offline.

## External services

- [nuoxian's Music API](https://docs.nxvav.cn/doc/music.html)
- [ChKSz NetEase Music API](https://api.chksz.top/docs/163_music.html)
- [nuoxian's Bing Wallpaper API](https://docs.nxvav.cn/doc/bing.html)
- [Wallhaven API](https://wallhaven.cc/help/api)
- [Open-Meteo](https://open-meteo.com/) and [MET Norway](https://api.met.no/)
- [Hitokoto](https://hitokoto.cn/)

## Credits

Thanks to the original author imsyy and everyone who has contributed maintenance, feedback, or testing.

- [imsyy](https://github.com/imsyy/)
- [NanoRocky](https://github.com/NanoRocky/home)
