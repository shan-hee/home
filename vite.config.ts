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
                            handler: "NetworkFirst",
                            options: {
                                cacheName: "site-config-v2",
                                networkTimeoutSeconds: 3,
                                expiration: {
                                    maxEntries: 1,
                                },
                                cacheableResponse: { statuses: [200] },
                            },
                        },
                        {
                            urlPattern: ({ url }) => url.origin === self.location.origin && url.pathname.startsWith("/api/assets/"),
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
                    changeOrigin: true,
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
