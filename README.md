简体中文 | [English](./README_EN.md)

> [!IMPORTANT]
> ## 致大家
> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;·&nbsp;嘿！恭喜你看到这里~ 这是酪灰基于原作者 imsyy 主页的修改版本！修改版本添加了更多的功能，但是也会带来更高的性能占用！（主要来自季节效果渲染），也添加了安全更新，增强安全性。<p>
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
- [x] 逐行歌词显示

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

# 首次初始化本地 D1
cp .dev.vars.example .dev.vars
cp scripts/site-content.seed.example.json .site-content.seed.json
# 编辑上述两个本地文件后执行
pnpm db:migrate:local
pnpm db:seed:generate
pnpm db:seed:local

# 只启动前端，适合页面与样式开发
pnpm dev:web

# 并行启动 Vite 前端与 Cloudflare Pages Functions
pnpm dev:cf
```

`dev:web` 不会运行 `/api/*`。需要验证 Pages Functions 时使用 `dev:cf`，浏览器访问 Vite 输出的 `http://localhost:3000`；开发服务器会将 `/api/*` 转发到本地 Wrangler。`pnpm dev:web` 不会自动打开浏览器。

`.dev.vars` 至少需要填写长度足够的 `OWNER_ACCESS_KEY` 和 `IP_HASH_SECRET`；音乐功能还需要 `MUSIC_API_URL`。这些文件均已忽略提交。`.site-content.seed.json` 只用于初始化空 D1，初始化后站点资料直接在主页铅笔入口的“内容”面板修改，无需重新构建或重启服务。

### ⚙️ Cloudflare Pages 部署

首版只维护 Cloudflare Pages：

1. 创建 D1 数据库并将真实 `database_id` 写入 `wrangler.jsonc`，再应用 `migrations/0001_initial.sql`。
2. 按 `scripts/site-content.seed.example.json` 的结构准备初始化内容，并写入远端 `content_sections`；不要把访问密钥放进 Seed。
3. 在 Cloudflare Pages 连接本仓库，安装命令填写 `pnpm install --frozen-lockfile`，构建命令填写 `pnpm build`，输出目录填写 `dist`。
4. 将 `DB` 绑定到刚创建的 D1；设置 `APP_ORIGIN`、`APP_ENV` 和 `SESSION_TTL_DAYS`。
5. 通过 Cloudflare Secret 配置 `OWNER_ACCESS_KEY`、`IP_HASH_SECRET` 和 `MUSIC_API_URL`。其它可选变量见 `.dev.vars.example`。
6. 部署后先确认公开主页正常，再用铅笔入口登录；站点内容、设备和审计均在原位设置面板管理。

仓库中的 `wrangler.jsonc` 可用于本地预览和 Wrangler 部署。Docker、Vercel、Netlify 与 GitHub Pages 不属于首版支持范围。

### 站点内容

Profile、网站列表、社交链接、音乐、壁纸和一言以 D1 为权威来源。所有者登录后，在原位设置面板的“内容”标签修改；保存会校验 section revision，避免多个标签页静默覆盖。

```json
{
  "icon": "Blog",
  "name": "博客",
  "link": "https://blog.your.domain/"
},
```

网站图标目前支持 `Blog`、`Cloud`、`Compass`、`Book`、`Fire`、`LaptopCode`。扩展图标需要同时修改前端静态图标映射和服务端白名单。以下代码仅说明现有图标映射：

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

社交链接同样在“内容”面板维护。内置 `icon` 值包括 `github`、`bilibili`、`qq`、`mail`、`twitter-x` 和 `telegram`，由 UnoCSS 和 Remix Icon 在构建时按需生成；增加其它图标时，需要同时修改前端映射和服务端白名单。

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

音乐平台、类型和 ID 在原位设置面板的“内容 → 音乐来源”中修改；Meting API 上游地址只通过 Worker Secret `MUSIC_API_URL` 配置，不会下发到浏览器。
>首版只维护一个播放队列。<p>

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

桌面与移动端使用独立图片集合。添加或减少本地壁纸后，在原位设置面板的“内容 → 壁纸资源”修改数量、路径模板和回退图片；`count` 必须与连续编号图片一致，`pattern` 中必须保留 `{id}`。默认本地壁纸 ID、自动切换间隔和壁纸来源在“偏好”标签调整，并可跨设备同步。

#### 网站图标

可以在 `public/images/icon` 中修改网站图标。

#### 更多默认设置

> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;·&nbsp;自动播放、背景特效等默认设置请编辑 `src/store/index.ts`，但这些设置仅对首次打开网页的用户生效，覆盖用户设置需要清除网页数据。

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
