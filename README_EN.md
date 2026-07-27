English | [简体中文](./README.md)


<p>
<strong><h2>Homepage</h2></strong>
</p>

![Homepage](/screenshots/main.png)<p>
![Homepage](/screenshots/main1.png)<p>
![Homepage](/screenshots/main2.png)<p>

### 👀Demo

> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;·&nbsp;Due to workbox caching, you may need to press `Ctrl` + `F5` to force refresh the browser cache to view the latest effects!

- [NanoRocky's Homepage](https://nanorocky.top/)

> If your project does not require Workbox local caching, such as when using a CDN or encountering an issue where subpath visits automatically redirect to the homepage, you can uncomment the following two lines in `vite.config.ts`:

```bash
selfDestroying: true,
injectRegister: false,
```

### 🎉 Functions

- [x] Loading animation
- [x] Site description
- [x] Hitokoto
- [x] Date and time
- [x] Live weather
- [x] Time progress bar
- [x] Music player
- [x] Mobile adaptation
- [x] Line-by-line lyrics

### ⚙️ Local development

* **Installation** [node.js](https://nodejs.org/en-us/) **Environment**

  > node > 24.13.0 <p>
  > npm > 10.15.0

* Then run the `PowerShell` terminal with **administrator privileges** and `cd` to the project root directory
* In the `terminal` type:

```bash
# Install pnpm
npm install -g pnpm

# Install the dependencies
pnpm install --frozen-lockfile

# Initialize the local D1 database once
cp .dev.vars.example .dev.vars
cp scripts/site-content.seed.example.json .site-content.seed.json
pnpm db:migrate:local
pnpm db:seed:generate
pnpm db:seed:local

# Frontend-only development
pnpm dev:web

# Start the Vite frontend and Cloudflare Pages Functions in parallel
pnpm dev:cf
```

`dev:web` does not execute `/api/*` and does not open a browser automatically. Use `dev:cf` when validating Pages Functions, then open `http://localhost:3000`; the development server proxies `/api/*` to the local Wrangler process.

### ⚙️ Cloudflare Pages deployment

Cloudflare Pages is the only deployment target maintained for the first release:

1. Connect this repository in Cloudflare Pages.
2. Set the install command to `pnpm install --frozen-lockfile`.
3. Set the build command to `pnpm build`.
4. Set the output directory to `dist`; the root `functions/` directory is deployed as Pages Functions.
5. Use Pages environment variables for non-secret configuration and Cloudflare Secrets for credentials. Do not expose secrets through `VITE_*`. Optional values such as `WALLHAVEN_API_KEY`, `GITHUB_REPOSITORY`, and `GITHUB_TOKEN` are documented in `.dev.vars.example`.
6. Create the R2 bucket configured by `wrangler.jsonc` and bind it as `WALLPAPER_BUCKET`.

The repository's `wrangler.jsonc` supports local preview and Wrangler deployment. Docker, Vercel, Netlify, and GitHub Pages are outside the first-release support scope.

### Site content

Profile, global behavior, site links, social links, music, wallpaper references, and Hitokoto configuration use D1 as their authoritative source; wallpaper binaries live in R2. Offline owner drafts and confirmed pending saves are stored in IndexedDB, then submitted with an idempotent mutation ID after connectivity returns. Section revisions still prevent silent overwrites, and conflicts retain the local draft for an explicit decision.

```json
{
  "name": "Blog",
  "link": "https://blog.your.domain/",
  "iconMode": "icon",
  "iconValue": "ri:blogger-fill",
  "iconColor": "#FF4757"
}
```

`iconMode` accepts `icon`, `text`, or `image`. Icon mode uses an Iconify code such as `ri:github-fill`; text mode accepts one to four characters in `iconValue`, and image mode uses an HTTPS icon URL. `iconColor` is a six-digit hexadecimal color.

### Social Links

After signing in, social links are managed directly in their home-page row. The form provides common Iconify choices and also accepts a valid Iconify code directly.

### Weather

Weather is provided by the same-origin Cloudflare Pages Function `/api/weather`:

- Cloudflare supplies an approximate location from the visitor IP through `request.cf`; the app no longer requests browser geolocation permission. The owner can configure a fixed city and coordinates in **Site settings → Global behavior**.
- Open-Meteo is tried first, with MET Norway as a fallback; both are normalized before the UI receives the response.
- If both providers fail, the page shows a clear offline/unavailable state and does not maintain a weather localStorage cache.
- `/api/alerts` is independent and optional. Without `QWEATHER_API_KEY`, it returns an empty list and does not affect regular weather.
- When Wrangler has no visitor geolocation, set `DEFAULT_LATITUDE`, `DEFAULT_LONGITUDE`, and `DEFAULT_CITY` in `.dev.vars`.

**Wallpaper management** supports Bing, Wallhaven, and custom sources. Bing desktop and mobile images come from the [Nuoxian Bing API](https://docs.nxvav.cn/doc/bing.html). Wallhaven uses its official public API for random SFW images; an optional `WALLHAVEN_API_KEY` remains server-side. Global behavior settings can disable rotation or select a preset or custom interval in minutes. Bing itself changes daily, so shorter intervals still resolve to that day's image.

Custom wallpaper files live in Cloudflare R2 and support upload, preview, download, selection, and deletion. Each file may be up to 50MB. The server detects JPEG, PNG, WebP, or AVIF from the file header and normalizes the object extension and MIME type. The selected asset is used first; when rotation is enabled, the other R2 wallpapers for the same viewport variant are cycled in order. Public pages read immutable objects through `/api/assets/:id`. The PWA caches custom wallpapers and a small set of the latest successful Bing or Wallhaven images. Offline startup reuses a cached image when available and falls back to a solid background only when none is usable. Update checks continue to use `/api/version`.

### Music

>This project uses a native HTML Audio engine with a custom React interface for playlists, lyrics, fullscreen playback, footer progress, and media shortcuts.
>\*Only supported in **Mainland China**

Configure the provider, query type, and resource ID (or keyword for search) under **Music settings**. The backend uses the fixed [Nuoxian Music API](https://docs.nxvav.cn/doc/music.html), validates its response, and converts it into the application's stable playlist format. The upstream service generates media signatures, so no `auth` value or additional Worker Secret is required.

The first release maintains a single playback queue. Its response is cached briefly, while audio, artwork, and lyrics are still requested directly from the upstream service. The PWA can reopen the page and previously loaded site configuration offline, but it does not guarantee offline playback of uncached music.

### Fonts

Now using` MiSans` and `HarmonyOS Sans` font, using font splitting to improve loading speed.

> `https://cdn-font.hyperos.mi.com/font/css?family=MiSans_VF:VF:Chinese_Simplify,Latin&display=swap` <p>
> `https://s1.hdslb.com/bfs/static/jinkela/long/font/regular.css`

### Website icon and website background

#### Website Background

Wallpapers are no longer stored under `public/images`, continuously numbered, path-templated, or selected by visitors. The owner can choose Bing or Wallhaven as an online source, or upload separate desktop and mobile custom wallpapers to R2. The custom source uses the solid-color fallback when no asset is selected.

#### Website Icon

The website icon can be modified in `public/images/icon`.

#### More default settings

> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;·&nbsp;Global defaults are managed in the owner panel. Anonymous visitors persist only theme and background effects; player controls remain session-only.

### Technology Stack

- [React](https://react.dev/)
- [Vite](https://vitejs.cn/vite3-cn/)
- [Zustand](https://zustand.docs.pmnd.rs/)
- [idb](https://github.com/jakearchibald/idb)
- [Valibot](https://valibot.dev/)
- Cloudflare D1 / R2 / Pages Functions
- [IconPark](https://iconpark.oceanengine.com/official)
- [TypeScript](https://www.typescriptlang.org/zh/)

### API

- [搏天 API](https://api.btstu.cn/doc/sjbz.php)
- [教书先生 API](https://api.oioweb.cn/doc/weather/GetWeather)
- [高德开放平台](https://lbs.amap.com/)
- [腾讯位置服务](https://lbs.qq.com/)
- [Hitokoto 一言](https://hitokoto.cn/)
- [Nuoxian Music API](https://docs.nxvav.cn/doc/music.html)

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=imsyy/home&type=Date)](https://star-history.com/#imsyy/home&Date)

### Thanks to the original author imsyy and the friends who helped with this project!
- [imsyy](https://github.com/imsyy/)
- [这个哔养得](https://github.com/pizeroLOL/)

<a title="SSL" target="_blank" href="https://myssl.com/seal/detail?domain=nanorocky.top"><img src="https://img.shields.io/badge/MySSL-Security Certification-brightgreen"></a>&nbsp;<a title="CDN" target="_blank" href="https://cdnjs.com/"><img src="https://img.shields.io/badge/CDN-Cloudflare-blue"></a>&nbsp;<a title="CDN2" target="_blank" href="https://cdnjs.com/"><img src="https://img.shields.io/badge/CDN-Tencent EdgeOne-blue"></a>&nbsp;<a title="Copyright" target="_blank" href="https://nanorocky.top/"><img src="https://img.shields.io/badge/Copyright%20%C2%A9%202023--2025-NanoRocky-red"></a>

