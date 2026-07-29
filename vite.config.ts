import { defineConfig } from "vite";
import { resolve } from "path";
import { VitePWA } from "vite-plugin-pwa";
import react from "@vitejs/plugin-react";
import UnoCSS from 'unocss/vite';
import type { UserConfig } from "vite";

// https://vitejs.dev/config/
export default (): UserConfig => {
    return defineConfig({
        plugins: [
            react(),
            UnoCSS(),
            VitePWA({
                registerType: "prompt",
                // 酪灰的小批注：如果遇到了子页面自动跳转主页等问题，或不需要客户端浏览器缓存，可尝试取消注释这两行代码，而不需要完全移除 PWA ~
                // selfDestroying: true,
                // injectRegister: false,
                workbox: {
                    cleanupOutdatedCaches: true,
                    runtimeCaching: [
                        {
                            urlPattern: ({ url }) => url.origin === self.location.origin && url.pathname === "/api/site-config",
                            handler: "CacheFirst",
                            options: {
                                cacheName: "site-config-v4",
                                expiration: {
                                    maxEntries: 1,
                                    maxAgeSeconds: 6 * 60 * 60,
                                },
                                cacheableResponse: { statuses: [200] },
                            },
                        },
                        {
                            urlPattern: ({ url }) => url.origin === self.location.origin && url.pathname === "/api/music",
                            handler: "CacheFirst",
                            options: {
                                cacheName: "music-playlist-v4",
                                expiration: {
                                    maxEntries: 1,
                                    maxAgeSeconds: 60 * 60,
                                },
                                cacheableResponse: { statuses: [200] },
                            },
                        },
                        {
                            urlPattern: ({ url }) => url.origin === self.location.origin && url.pathname === "/api/hitokoto",
                            handler: "CacheFirst",
                            options: {
                                cacheName: "hitokoto-v1",
                                expiration: {
                                    maxEntries: 1,
                                    maxAgeSeconds: 24 * 60 * 60,
                                },
                                cacheableResponse: { statuses: [200] },
                            },
                        },
                        {
                            urlPattern: ({ url }) => url.origin === self.location.origin && url.pathname === "/api/weather",
                            handler: "CacheFirst",
                            options: {
                                cacheName: "weather-v1",
                                expiration: {
                                    maxEntries: 12,
                                    maxAgeSeconds: 15 * 60,
                                },
                                cacheableResponse: { statuses: [200] },
                            },
                        },
                        {
                            urlPattern: ({ url }) => url.origin === self.location.origin && url.pathname === "/api/alerts",
                            handler: "CacheFirst",
                            options: {
                                cacheName: "weather-alerts-v1",
                                expiration: {
                                    maxEntries: 12,
                                    maxAgeSeconds: 5 * 60,
                                },
                                cacheableResponse: { statuses: [200] },
                            },
                        },
                        {
                            urlPattern: ({ url }) => url.origin === self.location.origin && url.pathname === "/api/music/lyric",
                            handler: "CacheFirst",
                            options: {
                                cacheName: "music-lyrics-v1",
                                expiration: {
                                    maxEntries: 50,
                                    maxAgeSeconds: 30 * 24 * 60 * 60,
                                },
                                cacheableResponse: { statuses: [200] },
                            },
                        },
                        {
                            urlPattern: ({ url }) => url.origin === self.location.origin && url.pathname === "/api/wallpaper" && url.searchParams.get("source") === "bing",
                            handler: "CacheFirst",
                            options: {
                                cacheName: "bing-wallpaper-metadata-v1",
                                expiration: {
                                    maxEntries: 2,
                                    maxAgeSeconds: 24 * 60 * 60,
                                },
                                cacheableResponse: { statuses: [200] },
                            },
                        },
                        {
                            urlPattern: ({ url }) => url.origin === self.location.origin && url.pathname === "/api/wallpaper" && url.searchParams.get("source") !== "bing",
                            handler: "NetworkFirst",
                            options: {
                                cacheName: "remote-wallpaper-metadata-v1",
                                networkTimeoutSeconds: 5,
                                expiration: {
                                    maxEntries: 8,
                                    maxAgeSeconds: 7 * 24 * 60 * 60,
                                },
                                cacheableResponse: { statuses: [200] },
                            },
                        },
                        {
                            urlPattern: ({ url }) => url.origin === self.location.origin && url.pathname.startsWith("/api/assets/") && url.searchParams.get("kind") === "site-icon" && url.searchParams.get("download") !== "1",
                            handler: "CacheFirst",
                            options: {
                                cacheName: "site-icon-assets-v1",
                                expiration: {
                                    maxEntries: 80,
                                    maxAgeSeconds: 365 * 24 * 60 * 60,
                                    purgeOnQuotaError: true,
                                },
                                cacheableResponse: { statuses: [200] },
                            },
                        },
                        {
                            urlPattern: ({ url }) => url.origin === self.location.origin && url.pathname.startsWith("/api/assets/") && url.searchParams.get("download") !== "1" && url.searchParams.get("kind") !== "site-icon",
                            handler: "CacheFirst",
                            options: {
                                cacheName: "wallpaper-assets-v1",
                                expiration: {
                                    maxEntries: 4,
                                    purgeOnQuotaError: true,
                                },
                                cacheableResponse: { statuses: [200] },
                            },
                        },
                        {
                            urlPattern: ({ url }) => ["bing.com", "www.bing.com", "w.wallhaven.cc"].includes(url.hostname),
                            handler: "CacheFirst",
                            options: {
                                cacheName: "remote-wallpaper-images-v1",
                                expiration: {
                                    maxEntries: 6,
                                    maxAgeSeconds: 7 * 24 * 60 * 60,
                                    purgeOnQuotaError: true,
                                },
                                cacheableResponse: { statuses: [0, 200] },
                            },
                        },
                        {
                            urlPattern: ({ url }) => url.origin === self.location.origin && /\.(?:png|svg|webp|gif|ico)$/i.test(url.pathname),
                            handler: "CacheFirst",
                            options: {
                                cacheName: "local-images-v1",
                                expiration: {
                                    maxEntries: 8,
                                    maxAgeSeconds: 30 * 24 * 60 * 60,
                                    purgeOnQuotaError: true,
                                },
                                cacheableResponse: { statuses: [200] },
                            },
                        },
                    ],
                },
                manifest: {
                    name: "Home",
                    short_name: "Home",
                    description: "个人主页",
                    display: "standalone",
                    start_url: "/",
                    theme_color: "#424242",
                    background_color: "#424242",
                    icons: [
                        {
                            src: "/images/icon/48.png",
                            sizes: "48x48",
                            type: "image/png",
                        },
                        {
                            src: "/images/icon/72.png",
                            sizes: "72x72",
                            type: "image/png",
                        },
                        {
                            src: "/images/icon/96.png",
                            sizes: "96x96",
                            type: "image/png",
                        },
                        {
                            src: "/images/icon/128.png",
                            sizes: "128x128",
                            type: "image/png",
                        },
                        {
                            src: "/images/icon/144.png",
                            sizes: "144x144",
                            type: "image/png",
                        },
                        {
                            src: "/images/icon/192.png",
                            sizes: "192x192",
                            type: "image/png",
                        },
                        {
                            src: "/images/icon/512.png",
                            sizes: "512x512",
                            type: "image/png",
                        },
                    ],
                },
            }),
        ],
        server: {
            port: 3000,
            open: false,
            proxy: {
                "/api": {
                    target: "http://127.0.0.1:8788",
                    changeOrigin: false,
                },
            },
        },
        resolve: {
            alias: [
                {
                    find: "@",
                    replacement: resolve(__dirname, "src")
                }
            ],
            extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
        },
        css: {
            preprocessorOptions: {
                scss: {
                    charset: false,
                    additionalData: `@use "@/style/global.scss" as global;`,
                },
            },
        },
        build: {
            minify: "terser",
            terserOptions: {
                compress: {
                    pure_funcs: ["console.debug"],
                },
            },
            chunkSizeWarningLimit: 1024,
        },
        publicDir: "public",
    });
};
