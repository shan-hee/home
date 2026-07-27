English | [简体中文](./README.md)

# Homepage

A personal navigation homepage built with React and Cloudflare, including links, weather, Hitokoto, music, wallpapers, and an owner dashboard.

![Homepage](/screenshots/main.png)

[Live demo](https://nanorocky.top/)

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

## Local development

Node.js 24+ and pnpm 11+ are required.

```bash
pnpm install --frozen-lockfile

cp .dev.vars.example .dev.vars
cp scripts/site-content.seed.example.json .site-content.seed.json
```

Edit `.dev.vars` and provide at least:

```ini
OWNER_PASSWORD = "at least 8 characters"
IP_HASH_SECRET = "generate with openssl rand -base64 48"
```

Initialize the local D1 database before the first run:

```bash
pnpm db:migrate:local
pnpm db:seed:generate
pnpm db:seed:local
```

Start the complete development environment:

```bash
pnpm dev:cf
```

Open `http://localhost:3000`. Vite proxies `/api/*` to the local Wrangler process.

Use `pnpm dev:web` for frontend-only work. API routes are unavailable in that mode.

## Configuration

Non-secret values live in `wrangler.jsonc`. Local secrets are documented in `.dev.vars.example`:

- `OWNER_PASSWORD`: required owner password
- `IP_HASH_SECRET`: required login rate-limit hashing secret
- `WALLHAVEN_API_KEY`: optional Wallhaven identity
- `QWEATHER_API_KEY`: optional weather alerts for China
- `DEFAULT_LATITUDE`, `DEFAULT_LONGITUDE`, `DEFAULT_CITY`: local weather fallback
- `GITHUB_REPOSITORY`, `GITHUB_TOKEN`: optional update-check configuration

Initial site content comes from `.site-content.seed.json`. After initialization, public profile, global behavior, music, wallpapers, and Hitokoto are managed in the owner dashboard.

## Cloudflare deployment

Cloudflare Pages is the only maintained deployment target:

1. Create a D1 database and an R2 bucket, then update the real bindings in `wrangler.jsonc`.
2. Bind D1 as `DB` and R2 as `WALLPAPER_BUCKET`.
3. Configure `APP_ORIGIN`, `APP_ENV`, and `SESSION_TTL_DAYS` in Pages, and add `OWNER_PASSWORD` and `IP_HASH_SECRET` as Secrets.
4. Prepare `.site-content.seed.json`, then initialize the remote database.

```bash
pnpm db:migrate:remote
pnpm db:seed:generate
pnpm db:seed:remote
```

5. Use `pnpm build` as the Pages build command and `dist` as the output directory.

Never commit real passwords, tokens, `.dev.vars`, or `.site-content.seed.json`.

## Data and offline behavior

- D1 stores site configuration, devices, sessions, and audit records.
- R2 stores server-validated and normalized custom wallpapers up to 50MB each.
- IndexedDB stores owner drafts and queued mutations, which are submitted after connectivity returns.
- The PWA caches the application shell, recent configuration, and a limited wallpaper set. Uncached music is not guaranteed to play offline.

## External services

- [Nuoxian Music API](https://docs.nxvav.cn/doc/music.html)
- [Nuoxian Bing Wallpaper API](https://docs.nxvav.cn/doc/bing.html)
- [Wallhaven API](https://wallhaven.cc/help/api)
- [Open-Meteo](https://open-meteo.com/) and [MET Norway](https://api.met.no/)
- [Hitokoto](https://hitokoto.cn/)

## Credits

Thanks to the original author [imsyy](https://github.com/imsyy/) and everyone who has contributed maintenance, feedback, or testing.
