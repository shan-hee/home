简体中文 | [English](./README_EN.md)

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

`.dev.vars` 至少需要填写长度足够的 `OWNER_PASSWORD` 和 `IP_HASH_SECRET`；音乐功能还需要 `MUSIC_API_URL`。这些文件均已忽略提交。`.site-content.seed.json` 只用于初始化空 D1，初始化后全局行为、站点资料和壁纸在主页铅笔入口的“站点设置”面板修改；网站和社交方式则直接在主页原位置管理。

### ⚙️ Cloudflare Pages 部署

首版只维护 Cloudflare Pages：

1. 创建 D1 数据库并将真实 `database_id` 写入 `wrangler.jsonc`，再按顺序应用 `migrations/` 下的全部迁移。
2. 创建 R2 Bucket，并按 `wrangler.jsonc` 将其绑定为 `WALLPAPER_BUCKET`。
3. 按 `scripts/site-content.seed.example.json` 的结构准备初始化内容，并写入远端 `content_sections`；不要把访问密钥放进 Seed。
4. 在 Cloudflare Pages 连接本仓库，安装命令填写 `pnpm install --frozen-lockfile`，构建命令填写 `pnpm build`，输出目录填写 `dist`。
5. 将 `DB` 和 `WALLPAPER_BUCKET` 绑定到对应的 D1/R2；设置 `APP_ORIGIN`、`APP_ENV` 和 `SESSION_TTL_DAYS`。
6. 通过 Cloudflare Secret 配置 `OWNER_PASSWORD`、`IP_HASH_SECRET` 和 `MUSIC_API_URL`。其它可选变量见 `.dev.vars.example`。
7. 部署后先确认公开主页正常，再用铅笔入口登录；站点设置、R2 壁纸、设备和审计均在原位管理面板操作。

仓库中的 `wrangler.jsonc` 可用于本地预览和 Wrangler 部署。Docker、Vercel、Netlify 与 GitHub Pages 不属于首版支持范围。

### 站点内容

Profile、全局行为、网站列表、社交链接、音乐、壁纸引用和一言以 D1 为权威来源，壁纸二进制存放在 R2。管理员离线时，草稿和已确认保存的待提交操作写入 IndexedDB；恢复网络后通过幂等 `mutationId` 提交。保存仍校验 section revision，冲突时保留本机草稿，不会静默覆盖服务器内容。

```json
{
  "name": "博客",
  "link": "https://blog.your.domain/",
  "iconMode": "icon",
  "iconValue": "ri:blogger-fill",
  "iconColor": "#FF4757"
}
```

`iconMode` 可取 `icon`、`text` 或 `image`。图标库模式使用 Iconify 代码（例如 `ri:github-fill`），文字模式的 `iconValue` 为 1 至 4 个字符，图片模式使用 HTTPS 图标地址；`iconColor` 使用六位十六进制颜色。

### 社交链接

管理员登录后可在主页社交图标区域直接新增、编辑、删除和拖动排序。`icon` 使用 Iconify 图标代码，表单提供常用图标选择，也可以直接填写其它有效代码。

### 天气

天气由同源 Cloudflare Pages Function `/api/weather` 提供：

- 默认由 Cloudflare 根据访问 IP 的 `request.cf` 提供近似位置，不请求浏览器定位权限；管理员也可以在“站点设置 → 全局行为”配置固定城市和坐标。
- 首选 Open-Meteo，失败时自动回退到 MET Norway；两者返回统一格式后再交给页面展示。
- 两个天气源都失败时，页面显示明确的离线/不可用状态，不在浏览器中维护天气 localStorage 缓存。
- `/api/alerts` 是独立可选能力。未配置 `QWEATHER_API_KEY` 时返回空数组，不影响普通天气。
- Wrangler 本地开发没有访客地理信息时，可在 `.dev.vars` 中填写 `DEFAULT_LATITUDE`、`DEFAULT_LONGITUDE` 和 `DEFAULT_CITY`。

壁纸文件存放在 Cloudflare R2，管理员通过“站点设置 → 壁纸资源”上传、选择和删除。公开页面通过 `/api/assets/:id` 读取不可变对象，并由 Cloudflare 与 PWA 运行时缓存；版本检查统一请求 `/api/version`。

### 音乐

> 本项目采用原生 HTML Audio 播放引擎与 React 自定义界面，可实现歌单、歌词、全屏、底栏进度和媒体快捷键
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

桌面与移动端壁纸都由管理员上传到 Cloudflare R2，不再放入 `public/images`，也不使用连续编号、路径模板、在线随机源或访客壁纸 ID。未配置壁纸时页面使用纯色背景。

#### 网站图标

可以在 `public/images/icon` 中修改网站图标。

#### 更多默认设置

> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;·&nbsp;全站默认行为由管理员后台管理。未登录访客只持久化主题与背景特效；播放器操作仅保留在当前页面会话。

### 技术栈

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
