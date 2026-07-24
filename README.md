简体中文 | [English](./README_EN.md)

> [!IMPORTANT]
> ## 致大家
> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;·&nbsp;嘿！恭喜你看到这里~ 这是酪灰基于原作者 imsyy 主页的修改版本！修改版本添加了更多的功能，但是也会带来更高的性能占用！（主要来自逐字歌词以及季节效果渲染），也添加了安全更新，增强安全性。<p>
> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;·&nbsp;酪灰作为 Vue 初学者，因为热爱，拉着同学 Pizero 完善了这个项目，因此这些代码可能会很 shi，并可能充斥着不少 BUG。欢迎在遇到 BUG 时进行反馈，也欢迎各位大佬帮助！<p>
>#### 关于问题反馈以及求助
> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;·&nbsp;遇到问题请在 Github 上提 issue ，需要帮助请在 Github 上发 discussion ，看到了会回复。除特殊情况外，<b>请不要直接通过其它社交方式联系酪灰！</b>酪灰不是客服，不提供售后服务，并没有那么多的时间来回复私聊。还请谅解！<p>
>### 最后，喜欢本项目的话麻烦给个 STAR ！阿里嘎多~

<p>&nbsp;<p>

> [!WARNING]
> ## hmm...
> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;下一个版本原计划是添加 i18n ，由于工作量巨大且...某个笨蛋最近迷上了 洛克王国 ，故这个更新可能会遥遥无期(x)... 等腾点时间出来叭（<p>

<p>&nbsp;<p>
<strong><h2>無名の主页</h2></strong>
</p>

![無名の主页](/screenshots/main.png)<p>
![無名の主页](/screenshots/main1.png)<p>
![無名の主页](/screenshots/main2.png)<p>

### 👀 Demo

> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;·&nbsp;由于 workbox 缓存原因，查看最新效果可能需要 `Ctrl` + `F5` 强制刷新浏览器缓存噢！

- [酪灰の主页](https://nanorocky.top/)

> 【小贴士】如果您的项目不需要 workbox 的本地缓存，比如有 CDN 的情况下，或者是遇到访问子路径自动跳转主页的情况，可以取消注释 `vite.config.ts` 内的两行代码：

```bash
selfDestroying: true,
injectRegister: false,
```

### 🎉 功能

- [x] 载入动画
- [x] 站点简介
- [x] Hitokoto 一言
- [x] 日期及时间
- [x] 实时天气
- [x] 时光进度条
- [x] 音乐播放器
- [x] 移动端适配
- [x] 逐字歌词兼容

### ⚙️ 本地开发

- **安装** [node.js](https://nodejs.org/zh-cn/) **环境**

  > node > 24.13.0 <p>
  > npm > 10.15.0

- 然后以 **管理员权限** 运行 `PowerShell` 终端，并 `cd` 到 项目根目录
- 在 `终端` 中输入：

```bash
# 安装 pnpm
npm install -g pnpm

# 安装依赖
pnpm install --frozen-lockfile
# 只启动前端，适合页面与样式开发
pnpm dev:web

# 启动 Cloudflare Pages 与 Functions 完整环境
pnpm dev:cf
```

`dev:web` 不会运行 `/api/*`。需要验证 Pages Functions 时使用 `dev:cf`，并先访问 `/api/health`，确认返回 JSON。

### ⚙️ Cloudflare Pages 部署

首版只维护 Cloudflare Pages：

1. 在 Cloudflare Pages 连接本仓库。
2. 安装命令填写 `pnpm install --frozen-lockfile`。
3. 构建命令填写 `pnpm build`。
4. 输出目录填写 `dist`；根目录下的 `functions/` 会作为 Pages Functions 发布。
5. 非敏感配置使用 Pages 环境变量，Secret 通过 Cloudflare 控制台配置，不要写入 `VITE_*`。可选变量见 `.dev.vars.example`，包括 `WALLHAVEN_API_KEY`、`GITHUB_REPOSITORY` 和 `GITHUB_TOKEN`。

仓库中的 `wrangler.jsonc` 可用于本地预览和 Wrangler 部署。Docker、Vercel、Netlify 与 GitHub Pages 不属于首版支持范围。

### 网站链接

在 `src/assets/siteLinks.json` 中可以自定义网站链接（以指向自己的网站）:

```json
{
  "icon": "Blog",
  "name": "博客",
  "link": "https://blog.your.domain/"
},
```

其中 `icon` 网站链接的图标可以在 `src/components/Links/index.vue` 中添加:

```js
// 可前往 https://www.xicons.org 自行挑选并在此处引入
// 此处引入的是 fa 类型
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

// 网站链接图标
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

### 社交链接

在 `src/assets/socialLinks.json` 中可以自定义社交链接。内置 `icon` 值包括 `github`、`bilibili`、`qq`、`mail`、`twitter-x` 和 `telegram`，由 UnoCSS 和 Remix Icon 在构建时按需生成；增加其他图标时，需要同时在 `src/components/SocialLinks.vue` 的 `socialIconClasses` 中添加静态映射。

### 天气

天气由同源 Cloudflare Pages Function `/api/weather` 提供：

- 首次访问由 Cloudflare 根据访问 IP 的 `request.cf` 提供近似位置，不请求浏览器定位权限；用户仍可搜索并保存城市，或在天气面板恢复 IP 定位。
- 首选 Open-Meteo，失败时自动回退到 MET Norway；两者返回统一格式后再交给页面展示。
- 两个天气源都失败时，页面会显示该地点最近一次成功数据并标记为“旧数据”。
- `/api/alerts` 是独立可选能力。未配置 `QWEATHER_API_KEY` 时返回空数组，不影响普通天气。
- Wrangler 本地开发没有访客地理信息时，可在 `.dev.vars` 中填写 `DEFAULT_LATITUDE`、`DEFAULT_LONGITUDE` 和 `DEFAULT_CITY`。

在线壁纸元数据由 `/api/wallpaper` 获取，远程图片经带域名白名单的 `/api/image` 同源代理；版本检查统一请求 `/api/version`。这些接口和天气、城市、预警接口都使用 Workers Cache 做短期边缘缓存。

### 音乐

> 本项目采用了 `Aplayer` 音乐播放器，可实现快速自定义歌单
> \*仅支持 **中国大陆地区**

请在 `.env` 文件中更改歌曲相关参数即可实现自定义歌单列表

```bash
# 歌曲 API 地址 （强烈建议自行搭建 Meting-Api）
VITE_SONG_API = "https://metingapi.nanorocky.top/"
# 歌曲服务器 ( netease-网易云, tencent-qq音乐 )
VITE_SONG_SERVER = "netease"
# 播放类型 ( song-歌曲, playlist-播放列表, album-专辑, search-搜索, artist-艺术家 )
VITE_SONG_TYPE = "playlist"
# 播放 ID
VITE_SONG_ID = "3035221869"
```
>首版只维护一个播放队列。<p>
>如果需要使用网易云音乐逐字歌词，请使用 [修改版 Meting-Api](https://github.com/NanoRocky/meting-api/) ！<p>

>[!WARNING]
>这里提供的 api 有较高的速率限制，且不太稳定，强烈建议自行搭建 Meting-API！你也可以赞助酪灰帮助他承担服务费用！阿里嘎多！<p>
>注意：提供的 api 可能出现Q音接口抛 401 的情况，并非服务异常，Q音接口需要将项目编译后挂到正常域名并使用 https only，使用正常 443 端口，才能正常工作。<p>

### 字体

现采用 `MiSans` and `HarmonyOS Sans` 字体，采用字体拆分，提升加载速度。

> `https://cdn-font.hyperos.mi.com/font/css?family=MiSans_VF:VF:Chinese_Simplify,Latin&display=swap` <p>
> `https://s1.hdslb.com/bfs/static/jinkela/long/font/regular.css`


### 网站图标及网站背景

#### 网站背景

可以在 `public/images` 中修改网站背景。<p>

桌面与移动端使用独立图片集合。添加或减少本地壁纸时，只需调整图片文件并编辑 `public/images/config.json`：<p>

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

`count` 必须与对应集合中的连续编号图片一致，`pattern` 中必须保留 `{id}`。该配置在运行时读取，修改 JSON 和图片后不需要重新编译 JavaScript。默认本地壁纸 ID、自动切换间隔和壁纸来源可在站点设置中调整。

#### 网站图标

可以在 `public/images/icon` 中修改网站图标。

#### 更多默认设置

> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;·&nbsp;自动播放、逐字歌词等默认设置请编辑 `src/store/index.ts`，但这些设置仅对首次打开网页的用户生效，覆盖用户设置需要清除网页数据。

### 技术栈

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

## 特别鸣谢
- [Meting API](https://github.com/injahow/meting-api)

### 感谢原作者 imsyy 和帮助本项目的小伙伴们！
- [imsyy](https://github.com/imsyy/)
- [这个哔养得](https://github.com/pizeroLOL/)

<a title="SSL" target="_blank" href="https://myssl.com/seal/detail?domain=nanorocky.top"><img src="https://img.shields.io/badge/MySSL-安全认证-brightgreen"></a>&nbsp;<a title="CDN" target="_blank" href="https://cdnjs.com/"><img src="https://img.shields.io/badge/CDN-Cloudflare-blue"></a>&nbsp;<a title="CDN2" target="_blank" href="https://cdnjs.com/"><img src="https://img.shields.io/badge/CDN-Tencent EdgeOne-blue"></a>&nbsp;<a title="Copyright" target="_blank" href="https://nanorocky.top/"><img src="https://img.shields.io/badge/Copyright%20%C2%A9%202023--2025-酪灰-red"></a>
