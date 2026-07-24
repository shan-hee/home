interface ImportMetaEnv {
    // 站点信息
    readonly VITE_SITE_NAME: string;
    readonly VITE_SITE_AUTHOR: string;
    readonly VITE_SITE_KEYWORDS: string;
    readonly VITE_SITE_DES: string;
    readonly VITE_SITE_URL: string;
    readonly VITE_SITE_MAIN_NAME: string;
    readonly VITE_SITE_LOGO: string;
    readonly VITE_SITE_MAIN_LOGO: string;
    readonly VITE_SITE_APPLE_LOGO: string;

    // 简介文本
    readonly VITE_DESC_HELLO: string;
    readonly VITE_DESC_TEXT: string;
    readonly VITE_DESC_HELLO_OTHER: string;
    readonly VITE_DESC_TEXT_OTHER: string;

    // 建站日期
    readonly VITE_SITE_START: string;

    // ICP 备案号
    readonly VITE_SITE_ICP: string;
    readonly VITE_SITE_MPS: string;
    readonly VITE_SITE_MICP: string;

    // 歌曲 API 设置
    readonly VITE_SONG_API: string;
    readonly VITE_SONG_SERVER: "netease" | "tencent";
    readonly VITE_SONG_TYPE: "playlist" | "song";
    readonly VITE_SONG_ID: string;

}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
