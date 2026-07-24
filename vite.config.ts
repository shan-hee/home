import { defineConfig, loadEnv } from "vite";
import { ElementPlusResolver } from "unplugin-vue-components/resolvers";
import { resolve } from "path";
import { VitePWA } from "vite-plugin-pwa";
import vue from "@vitejs/plugin-vue";
import AutoImport from "unplugin-auto-import/vite";
import Components from "unplugin-vue-components/vite";
import UnoCSS from 'unocss/vite';
import type { UserConfig } from "vite";

// https://vitejs.dev/config/
export default ({ mode }: { mode: string }): UserConfig => {
    const env = loadEnv(mode, process.cwd());
    return defineConfig({
        plugins: [
            vue(),
            UnoCSS(),
            AutoImport({
                imports: ["vue", { "@/utils/config_check.ts": ["envConfig"] }],
                resolvers: [ElementPlusResolver()],
                dts: "src/auto-imports.d.ts",
            }),
            Components({
                resolvers: [ElementPlusResolver()],
                dts: "src/components.d.ts",
            }),
            VitePWA({
                registerType: "prompt",
                // 酪灰的小批注：如果遇到了子页面自动跳转主页等问题，或不需要客户端浏览器缓存，可尝试取消注释这两行代码，而不需要完全移除 PWA ~
                // selfDestroying: true,
                // injectRegister: false,
                workbox: {
                    globIgnores: [
                        "**/images/background*.jpg",
                        "**/images/phone/backgroundphone*.jpg",
                    ],
                    runtimeCaching: [
                        {
                            urlPattern: ({ url }) => url.origin === self.location.origin && url.pathname === "/images/config.json",
                            handler: "NetworkFirst",
                            options: {
                                cacheName: "wallpaper-config-v1",
                                networkTimeoutSeconds: 3,
                                expiration: {
                                    maxEntries: 1,
                                    maxAgeSeconds: 86400,
                                },
                            },
                        },
                        {
                            urlPattern: ({ url }) => url.origin === self.location.origin && url.pathname === "/api/image",
                            handler: "CacheFirst",
                            options: {
                                cacheName: "online-wallpaper-v1",
                                expiration: {
                                    maxEntries: 12,
                                    maxAgeSeconds: 30 * 24 * 60 * 60,
                                    purgeOnQuotaError: true,
                                },
                                cacheableResponse: { statuses: [200] },
                            },
                        },
                        {
                            urlPattern: ({ url }) => url.origin === self.location.origin && /\.(?:png|jpe?g|svg|webp|gif|ico)$/i.test(url.pathname),
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
                    name: loadEnv(mode, process.cwd()).VITE_SITE_NAME,
                    short_name: loadEnv(mode, process.cwd()).VITE_SITE_NAME,
                    description: loadEnv(mode, process.cwd()).VITE_SITE_DES,
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
        },
        resolve: {
            alias: [
                {
                    find: "@",
                    replacement: resolve(__dirname, "src")
                }
            ],
            extensions: [".ts", ".js", ".vue", ".json"],
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
