import { boolean, minValue, number, object, pipe, safeParse, string } from "valibot";

const STORAGE_KEY = "home:player-session:v1";
const playerSessionSchema = object({
  playlistKey: string(),
  trackId: string(),
  currentTime: pipe(number(), minValue(0)),
  wasPlaying: boolean(),
});

export interface PlayerSession {
  playlistKey: string;
  trackId: string;
  currentTime: number;
  wasPlaying: boolean;
}

export const loadPlayerSession = (): PlayerSession | null => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = safeParse(playerSessionSchema, JSON.parse(raw) as unknown);
    return parsed.success ? parsed.output : null;
  } catch {
    return null;
  }
};

export const savePlayerSession = (session: PlayerSession) => {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // 当前页面内的播放不受会话存储失败影响。
  }
};
