export type PlayerStatus = "idle" | "loading" | "ready" | "playing" | "paused" | "error";
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
    seasonalEffects: boolean;
    msgNameShow: boolean;
    siteStartShow: boolean;
    musicClick: boolean;
    musicBoxOpenState: boolean;
    musicIsOk: boolean;
    musicVolume: number;
    musicOpenState: boolean;
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
    playerDWRCATDB: boolean;
    playerDWRCATDBF: boolean;
    playerDWRCPilfer: boolean;
    playerRMMetadata: boolean;
    playerCurrentTime: number;
    playerDuration: number;
    dwrcIndex: number | null;
    dwrcTemp: any[];
    dwrcEnable: boolean;
    dwrcLoading: boolean;
    lyricSeekVersion: number;
    showFirefly: boolean;
    showSnowfall: boolean;
    showLantern: boolean;
    theme: "system" | "time" | "bg" | "light" | "dark";
};
