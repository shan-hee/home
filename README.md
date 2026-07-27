简体中文 | [English](./README_EN.md)

# 無名の主页

一个基于 React 和 Cloudflare 构建的个人导航主页，包含站点导航、天气、一言、音乐播放器、壁纸和管理员后台。

![無名の主页](/screenshots/main.png)

[在线预览](https://ajjj.de/)

## 主要功能

- 响应式主页、站点与社交链接管理
- 时间、天气、一言和时光进度展示
- 音乐搜索、歌单播放、歌词和媒体快捷键
- Bing、Wallhaven 与 R2 自定义壁纸，支持定时切换
- 管理员后台、设备管理和操作审计
- PWA 离线启动与管理员离线草稿同步

## 技术栈

- React、TypeScript、Vite、Zustand
- Cloudflare Pages Functions、D1、R2
- IndexedDB、Workbox PWA
- IconPark、Iconify

## 本地开发

需要 Node.js 24+ 和 pnpm 11+。

```bash
pnpm install --frozen-lockfile

cp .dev.vars.example .dev.vars
cp scripts/site-content.seed.example.json .site-content.seed.json
```

编辑 `.dev.vars`，至少设置：

```ini
OWNER_PASSWORD = "至少 8 个字符"
IP_HASH_SECRET = "使用 openssl rand -base64 48 生成"
```

首次启动前初始化本地 D1：

```bash
pnpm db:migrate:local
pnpm db:seed:generate
pnpm db:seed:local
```

启动完整开发环境：

```bash
pnpm dev:cf
```

浏览器访问 `http://localhost:3000`。Vite 会将 `/api/*` 转发到本地 Wrangler。

只开发前端页面时可以运行 `pnpm dev:web`，但此模式不会启动 API。

## 常用配置

非敏感配置位于 `wrangler.jsonc`，本地 Secret 参考 `.dev.vars.example`：

- `OWNER_PASSWORD`：管理员密码，必填
- `IP_HASH_SECRET`：登录限流摘要密钥，必填
- `WALLHAVEN_API_KEY`：Wallhaven 可选身份配置
- `QWEATHER_API_KEY`：可选的中国天气预警
- `DEFAULT_LATITUDE`、`DEFAULT_LONGITUDE`、`DEFAULT_CITY`：本地天气默认位置
- `GITHUB_REPOSITORY`、`GITHUB_TOKEN`：可选的版本检查配置

站点初始内容来自 `.site-content.seed.json`。完成初始化后，公开资料、常规行为、音乐、壁纸和一言均在管理员后台维护。

## Cloudflare 部署

当前只维护 Cloudflare Pages 部署：

1. 创建 D1 数据库和 R2 Bucket，并更新 `wrangler.jsonc` 中的真实绑定信息。
2. 将 R2 绑定命名为 `WALLPAPER_BUCKET`，D1 绑定命名为 `DB`。
3. 在 Pages 中配置 `APP_ORIGIN`、`APP_ENV`、`SESSION_TTL_DAYS`，并以 Secret 形式配置 `OWNER_PASSWORD` 和 `IP_HASH_SECRET`。
4. 准备 `.site-content.seed.json`，然后执行远端迁移和初始化。

```bash
pnpm db:migrate:remote
pnpm db:seed:generate
pnpm db:seed:remote
```

5. Pages 构建命令使用 `pnpm build`，输出目录为 `dist`。

不要将真实密码、密钥、`.dev.vars` 或 `.site-content.seed.json` 提交到仓库。

## 数据与离线行为

- D1 保存站点配置、设备、会话和审计记录。
- R2 保存经过服务端格式检测和规范化的自定义壁纸，单文件最大 50MB。
- IndexedDB 保存管理员草稿和待同步操作，恢复网络后自动提交。
- PWA 缓存应用外壳、最近配置和有限数量的壁纸；未缓存的音乐资源不保证离线播放。

## 外部服务

- [诺西 API 音乐解析](https://docs.nxvav.cn/doc/music.html)
- [ChKSz API 网易云音乐解析](https://api.chksz.top/docs/163_music.html)
- [诺西 API 必应每日美图](https://docs.nxvav.cn/doc/bing.html)
- [Wallhaven API](https://wallhaven.cc/help/api)
- [Open-Meteo](https://open-meteo.com/) 与 [MET Norway](https://api.met.no/)
- [Hitokoto 一言](https://hitokoto.cn/)

## 致谢

感谢原作者 imsyy 和所有参与维护、反馈与测试的贡献者。

- [imsyy](https://github.com/imsyy/)
- [NanoRocky](https://github.com/NanoRocky/home)
