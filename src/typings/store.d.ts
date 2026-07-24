export type PlayerStatus = "idle" | "loading" | "ready" | "playing" | "paused" | "error";
export type BackgroundEffect = "snow" | "firefly" | "lantern" | "meteor";
export type BackgroundEffectMode = "auto" | "off" | "manual";
export type WordLyricToken = [[start: number, duration: number], text: string, line: number, row: number];
export type WordLyricLine = [start: number, duration: number, words: WordLyricToken[]];
export type PlayerLyricItem = [
    active: boolean,
    played: boolean | number,
    lineIndex: number,
    wordIndex: number,
    text: string,
    duration?: number,
    remaining?: number,
];

export interface MainState {
    imgLoadStatus: boolean;
    innerWidth: number | null;
    coverType: number;
    sBGCount: string | null;
    autoBGSwitchInterval : number;
    wallpaperLocalId: number | null;
    wallpaperMaxId: number;
    effectsMode: BackgroundEffectMode;
    selectedEffects: BackgroundEffect[];
    msgNameShow: boolean;
    siteStartShow: boolean;
    musicBoxOpenState: boolean;
    musicIsOk: boolean;
    musicVolume: number;
    backgroundShow: boolean;
    boxOpenState: boolean;
    mobileOpenState: boolean;
    mobileFuncState: boolean;
    setOpenState: boolean;
    setV: boolean;
    playerStatus: PlayerStatus;
    playerHasStarted: boolean;
    playerError: string | null;
    playerCanplay: boolean;
    playerTitle: string | null;
    playerArtist: string | null;
    playerAlbum: string | null;
    playerLrc: PlayerLyricItem[];
    playerLrcShow: boolean;
    footerBlur: boolean;
    footerProgressBar: boolean;
    playerAutoplay: boolean;
    playerOrder: "list" | "single" | "shuffle";
    playerKeyboardShortcuts: boolean;
    playerTrLrc: boolean;
    playerDWRCShow: boolean;
    playerDWRCShowPro: boolean;
    playerRMMetadata: boolean;
    playerCurrentTime: number;
    playerDuration: number;
    dwrcIndex: number | null;
    dwrcTemp: WordLyricLine[];
    dwrcEnable: boolean;
    dwrcLoading: boolean;
    lyricSeekVersion: number;
    showFirefly: boolean;
    showSnowfall: boolean;
    showLantern: boolean;
    showMeteor: boolean;
    theme: "system" | "time" | "bg" | "light" | "dark";
};
