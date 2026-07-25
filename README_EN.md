English | [简体中文](./README.md)

> [!IMPORTANT]
> ## To everyone
> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;·&nbsp;Hey! Congratulations on reading this~ This is a modified version of NanoRocky based on the original author imsyy's homepage! The modified version adds more features, but also brings higher performance usage! (mainly from seasonal effect rendering), and also adds security updates to enhance security.<p>
> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;·&nbsp;NanoRocky is a Vue beginner. Because of his passion, he worked with his classmate Pizero to perfect this project. Therefore, the code may be very bad and may be full of bugs. You are welcome to give feedback when you encounter bugs, and you are also welcome to help!<p>
>#### About feedback and help
> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;·&nbsp;If you encounter any problems, please raise an issue on Github. If you need help, please post a discussion on Github. We will reply to you when we see it. Except for special circumstances, <b>please do not contact NanoRocky directly through other social contact! </b>NanoRocky is not a customer service, does not provide after-sales service, and does not have that much time to reply to private chats. Please understand!<p>
>### Finally, if you like this project, please give a STAR! Thank you very much~

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

# Frontend-only development
pnpm dev:web

# Start the Vite frontend and Cloudflare Pages Functions in parallel
pnpm dev:cf
```

`dev:web` does not execute `/api/*`. Use `dev:cf` when validating Pages Functions, then open the Vite URL at `http://localhost:3000`; the development server proxies `/api/*` to the local Wrangler process. Verify that `http://localhost:3000/api/health` returns JSON first.

### ⚙️ Cloudflare Pages deployment

Cloudflare Pages is the only deployment target maintained for the first release:

1. Connect this repository in Cloudflare Pages.
2. Set the install command to `pnpm install --frozen-lockfile`.
3. Set the build command to `pnpm build`.
4. Set the output directory to `dist`; the root `functions/` directory is deployed as Pages Functions.
5. Use Pages environment variables for non-secret configuration and Cloudflare Secrets for credentials. Do not expose secrets through `VITE_*`. Optional values such as `WALLHAVEN_API_KEY`, `GITHUB_REPOSITORY`, and `GITHUB_TOKEN` are documented in `.dev.vars.example`.

The repository's `wrangler.jsonc` supports local preview and Wrangler deployment. Docker, Vercel, Netlify, and GitHub Pages are outside the first-release support scope.

### Site Links

In `src/assets/siteLinks.json` you can customize the website links (to point to your own website):

```json
{
  "icon": "Blog",
  "name": "Blog",
  "link": "https://blog.your.domain/"
},
```

The icon of the `icon` website link can be added in `src/components/Links/index.vue`:

```js
// You can go to https://www.xicons.org to select and import it here
// The fa type is imported here
import {
  Link,
  Blog,
  CompactDisc,
  Cloud,
  Compass,
  Book,
  Fire,
  LaptopCode,
} from "@vicons/fa";

...

// Website link icon
const siteIcon = {
  Blog,
  Cloud,
  CompactDisc,
  Compass,
  Book,
  Fire,
  LaptopCode,
};
```

### Social Links

Social links can be customized in `src/assets/socialLinks.json`. Built-in `icon` values are `github`, `bilibili`, `qq`, `mail`, `twitter-x`, and `telegram`; UnoCSS and Remix Icon generate them on demand at build time. When adding another icon, also add its static mapping to `socialIconClasses` in `src/components/SocialLinks.vue`.

### Weather

Weather is provided by the same-origin Cloudflare Pages Function `/api/weather`:

- Cloudflare supplies an approximate location from the visitor IP through `request.cf`; the app no longer requests browser geolocation permission. Users can still save a searched city or restore IP location from the weather dialog.
- Open-Meteo is tried first, with MET Norway as a fallback; both are normalized before the UI receives the response.
- If both providers fail, the latest successful response for that location is shown and marked as stale.
- `/api/alerts` is independent and optional. Without `QWEATHER_API_KEY`, it returns an empty list and does not affect regular weather.
- When Wrangler has no visitor geolocation, set `DEFAULT_LATITUDE`, `DEFAULT_LONGITUDE`, and `DEFAULT_CITY` in `.dev.vars`.

Online wallpaper metadata is provided by `/api/wallpaper`, remote images use the allowlisted same-origin `/api/image` proxy, and update checks use `/api/version`. These endpoints and the weather endpoints use short-lived Workers Cache entries.

### Music

>This project uses the `Aplayer` music player based on `MetingJS` for quick song list customization
>\*Only supported in **Mainland China**

Please change the song related parameters in the `.env` file to customize the song list

```bash
# Songs API address (It is strongly recommended to build Meting-Api by yourself)
VITE_SONG_API = "https://metingapi.nanorocky.top/"
# Song server ( netease-netease, tencent-qq music )
VITE_SONG_SERVER = "netease"
# Playback type ( song-song, playlist-playlist, album-album, search-search, artist-artist )
VITE_SONG_TYPE = "playlist"
# Playback ID
VITE_SONG_ID = "3035221869"
```

The first release maintains a single playback queue.

### Fonts

Now using` MiSans` and `HarmonyOS Sans` font, using font splitting to improve loading speed.

> `https://cdn-font.hyperos.mi.com/font/css?family=MiSans_VF:VF:Chinese_Simplify,Latin&display=swap` <p>
> `https://s1.hdslb.com/bfs/static/jinkela/long/font/regular.css`

### Website icon and website background

#### Website Background

You can modify the website background in `public/images`.<p>

Desktop and mobile use separate image collections. To add or remove local wallpapers, update the image files and `public/images/config.json`:<p>

```json
{
  "version": 1,
  "desktop": {
    "count": 10,
    "pattern": "/images/background{id}.jpg",
    "fallback": "/images/background1.jpg"
  },
  "mobile": {
    "count": 2,
    "pattern": "/images/phone/backgroundphone{id}.jpg",
    "fallback": "/images/phone/backgroundphone1.jpg"
  }
}
```

`count` must match the continuously numbered files in each collection, and `pattern` must keep `{id}`. The configuration is loaded at runtime, so changing the JSON and images does not require rebuilding the JavaScript. The default local wallpaper ID, rotation interval, and source are available in site settings.

#### Website Icon

The website icon can be modified in `public/images/icon`.

#### More default settings

> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;·&nbsp;For defaults such as autoplay and background effects, edit `src/store/index.ts`. These settings only apply to first-time visitors; clear the site's stored data to replace existing preferences.

### Technology Stack

- [Vue](https://cn.vuejs.org/)
- [Vite](https://vitejs.cn/vite3-cn/)
- [Pinia](https://pinia.vuejs.org/zh/)
- [IconPark](https://iconpark.oceanengine.com/official)
- [xicons](https://xicons.org/)
- [TypeScript](https://www.typescriptlang.org/zh/)
- [Aplayer](https://aplayer.js.org/)

### API

- [搏天 API](https://api.btstu.cn/doc/sjbz.php)
- [教书先生 API](https://api.oioweb.cn/doc/weather/GetWeather)
- [高德开放平台](https://lbs.amap.com/)
- [腾讯位置服务](https://lbs.qq.com/)
- [Hitokoto 一言](https://hitokoto.cn/)
- [Meting API](https://github.com/injahow/meting-api)
- [Meting API 酪灰修改版](https://github.com/NanoRocky/meting-api)

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=imsyy/home&type=Date)](https://star-history.com/#imsyy/home&Date)

## Special thanks
- [Meting API](https://github.com/injahow/meting-api)

### Thanks to the original author imsyy and the friends who helped with this project!
- [imsyy](https://github.com/imsyy/)
- [这个哔养得](https://github.com/pizeroLOL/)

<a title="SSL" target="_blank" href="https://myssl.com/seal/detail?domain=nanorocky.top"><img src="https://img.shields.io/badge/MySSL-Security Certification-brightgreen"></a>&nbsp;<a title="CDN" target="_blank" href="https://cdnjs.com/"><img src="https://img.shields.io/badge/CDN-Cloudflare-blue"></a>&nbsp;<a title="CDN2" target="_blank" href="https://cdnjs.com/"><img src="https://img.shields.io/badge/CDN-Tencent EdgeOne-blue"></a>&nbsp;<a title="Copyright" target="_blank" href="https://nanorocky.top/"><img src="https://img.shields.io/badge/Copyright%20%C2%A9%202023--2025-NanoRocky-red"></a>

