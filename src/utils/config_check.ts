import exampleConfig from '@/assets/example_config.json';
type Env = ImportMetaEnv;

export const envConfig: Env = {
    ...import.meta.env,
    BASE_URL: import.meta.env.BASE_URL,
    MODE: import.meta.env.MODE,
    DEV: import.meta.env.DEV,
    PROD: import.meta.env.PROD,
    SSR: import.meta.env.SSR,
    VITE_SITE_NAME: import.meta.env.VITE_CONFIG_TURN == 'true'
        ? import.meta.env.VITE_SITE_NAME || exampleConfig.VITE_SITE_NAME : exampleConfig.VITE_SITE_NAME,
    VITE_SITE_AUTHOR: import.meta.env.VITE_CONFIG_TURN == 'true'
        ? import.meta.env.VITE_SITE_AUTHOR || exampleConfig.VITE_SITE_AUTHOR : exampleConfig.VITE_SITE_AUTHOR,
    VITE_SITE_KEYWORDS: import.meta.env.VITE_CONFIG_TURN == 'true'
        ? import.meta.env.VITE_SITE_KEYWORDS || exampleConfig.VITE_SITE_KEYWORDS : exampleConfig.VITE_SITE_KEYWORDS,
    VITE_SITE_DES: import.meta.env.VITE_CONFIG_TURN == 'true'
        ? import.meta.env.VITE_SITE_DES || exampleConfig.VITE_SITE_DES : exampleConfig.VITE_SITE_DES,
    VITE_SITE_URL: import.meta.env.VITE_CONFIG_TURN == 'true'
        ? import.meta.env.VITE_SITE_URL || exampleConfig.VITE_SITE_URL : exampleConfig.VITE_SITE_URL,
    VITE_SITE_MAIN_NAME: import.meta.env.VITE_CONFIG_TURN == 'true'
        ? import.meta.env.VITE_SITE_MAIN_NAME || exampleConfig.VITE_SITE_MAIN_NAME : exampleConfig.VITE_SITE_MAIN_NAME,
    VITE_SITE_LOGO: import.meta.env.VITE_CONFIG_TURN == 'true'
        ? import.meta.env.VITE_SITE_LOGO || exampleConfig.VITE_SITE_LOGO : exampleConfig.VITE_SITE_LOGO,
    VITE_SITE_MAIN_LOGO: import.meta.env.VITE_CONFIG_TURN == 'true'
        ? import.meta.env.VITE_SITE_MAIN_LOGO || exampleConfig.VITE_SITE_MAIN_LOGO : exampleConfig.VITE_SITE_MAIN_LOGO,
    VITE_SITE_APPLE_LOGO: import.meta.env.VITE_CONFIG_TURN == 'true'
        ? import.meta.env.VITE_SITE_APPLE_LOGO || exampleConfig.VITE_SITE_APPLE_LOGO : exampleConfig.VITE_SITE_APPLE_LOGO,
    VITE_DESC_HELLO: import.meta.env.VITE_CONFIG_TURN == 'true'
        ? import.meta.env.VITE_DESC_HELLO || exampleConfig.VITE_DESC_HELLO : exampleConfig.VITE_DESC_HELLO,
    VITE_DESC_TEXT: import.meta.env.VITE_CONFIG_TURN == 'true'
        ? import.meta.env.VITE_DESC_TEXT || exampleConfig.VITE_DESC_TEXT : exampleConfig.VITE_DESC_TEXT,
    VITE_DESC_HELLO_OTHER: import.meta.env.VITE_CONFIG_TURN == 'true'
        ? import.meta.env.VITE_DESC_HELLO_OTHER || exampleConfig.VITE_DESC_HELLO_OTHER : exampleConfig.VITE_DESC_HELLO_OTHER,
    VITE_DESC_TEXT_OTHER: import.meta.env.VITE_CONFIG_TURN == 'true'
        ? import.meta.env.VITE_DESC_TEXT_OTHER || exampleConfig.VITE_DESC_TEXT_OTHER : exampleConfig.VITE_DESC_TEXT_OTHER,
    VITE_SITE_START: import.meta.env.VITE_CONFIG_TURN == 'true'
        ? import.meta.env.VITE_SITE_START || exampleConfig.VITE_SITE_START : exampleConfig.VITE_SITE_START,
    VITE_SITE_ICP: import.meta.env.VITE_CONFIG_TURN == 'true'
        ? import.meta.env.VITE_SITE_ICP || exampleConfig.VITE_SITE_ICP : exampleConfig.VITE_SITE_ICP,
    VITE_SITE_MPS: import.meta.env.VITE_CONFIG_TURN == 'true'
        ? import.meta.env.VITE_SITE_MPS || exampleConfig.VITE_SITE_MPS : exampleConfig.VITE_SITE_MPS,
    VITE_SITE_MICP: import.meta.env.VITE_CONFIG_TURN == 'true'
        ? import.meta.env.VITE_SITE_MICP || exampleConfig.VITE_SITE_MICP : exampleConfig.VITE_SITE_MICP,
    VITE_SONG_API: import.meta.env.VITE_CONFIG_TURN == 'true'
        ? import.meta.env.VITE_SONG_API || exampleConfig.VITE_SONG_API : exampleConfig.VITE_SONG_API,
    VITE_SONG_SERVER: (import.meta.env.VITE_CONFIG_TURN == 'true'
        ? (import.meta.env.VITE_SONG_SERVER || exampleConfig.VITE_SONG_SERVER) : exampleConfig.VITE_SONG_SERVER) as "netease" | "tencent",
    VITE_SONG_TYPE: (import.meta.env.VITE_CONFIG_TURN == 'true'
        ? (import.meta.env.VITE_SONG_TYPE || exampleConfig.VITE_SONG_TYPE) : exampleConfig.VITE_SONG_TYPE) as "playlist" | "song",
    VITE_SONG_ID: import.meta.env.VITE_CONFIG_TURN == 'true'
        ? import.meta.env.VITE_SONG_ID || exampleConfig.VITE_SONG_ID : exampleConfig.VITE_SONG_ID,
}
