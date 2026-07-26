import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { requestJson } from "@/services/apiClient";
import { forgetOwner, readRememberedOwner, rememberOwner } from "@/services/offlineDatabase";

export interface AuthDevice {
  id: string;
  name: string;
}

interface SessionResponse {
  authenticated: boolean;
  device?: AuthDevice;
  expiresAt?: string;
}

export type AuthStatus = "checking" | "anonymous" | "authenticated" | "offline-owner";

const browserName = () => {
  const agent = navigator.userAgent;
  if (/Edg\//.test(agent)) return "Edge";
  if (/Firefox\//.test(agent)) return "Firefox";
  if (/Chrome\//.test(agent)) return "Chrome";
  if (/Safari\//.test(agent)) return "Safari";
  return "浏览器";
};

const platformName = () => {
  const agent = navigator.userAgent;
  if (/Windows/i.test(agent)) return "Windows";
  if (/Android/i.test(agent)) return "Android";
  if (/iPhone|iPad|iPod/i.test(agent)) return "iOS";
  if (/Macintosh|Mac OS X/i.test(agent)) return "macOS";
  if (/Linux/i.test(agent)) return "Linux";
  return "当前设备";
};

interface AuthStore {
  status: AuthStatus;
  device: AuthDevice | null;
  expiresAt: string | null;
  checkPromise: Promise<boolean> | null;
  applySession: (response: SessionResponse) => void;
  checkSession: () => Promise<boolean>;
  login: (password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  expireSession: () => void;
}

export const useAuthStore = create<AuthStore>()(subscribeWithSelector((set, get) => ({
  status: "checking",
  device: null,
  expiresAt: null,
  checkPromise: null,
  applySession: (response) => set({
    status: response.authenticated ? "authenticated" : "anonymous",
    device: response.authenticated && response.device ? response.device : null,
    expiresAt: response.authenticated ? response.expiresAt || null : null,
  }),
  checkSession: async () => {
    if (get().checkPromise) return get().checkPromise!;
    set({ status: "checking" });
    const promise = requestJson<SessionResponse>("/api/auth/session")
      .then((response) => {
        get().applySession(response);
        if (response.authenticated && response.device && response.expiresAt) {
          void rememberOwner({ deviceId: response.device.id, deviceName: response.device.name, expiresAt: response.expiresAt });
        } else {
          void forgetOwner();
        }
        return response.authenticated;
      })
      .catch(async () => {
        const remembered = await readRememberedOwner();
        if (remembered) {
          set({ status: "offline-owner", device: { id: remembered.deviceId, name: remembered.deviceName }, expiresAt: remembered.expiresAt });
          return true;
        }
        get().applySession({ authenticated: false });
        return false;
      })
      .finally(() => set({ checkPromise: null }));
    set({ checkPromise: promise });
    return promise;
  },
  login: async (password) => {
    const response = await requestJson<SessionResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        password,
        deviceName: `${browserName()} · ${platformName()}`,
      }),
    });
    get().applySession(response);
    if (response.authenticated && response.device && response.expiresAt) {
      await rememberOwner({ deviceId: response.device.id, deviceName: response.device.name, expiresAt: response.expiresAt });
    }
    return response.authenticated;
  },
  logout: async () => {
    const response = await requestJson<SessionResponse>("/api/auth/logout", { method: "POST", body: "{}" });
    get().applySession(response);
    await forgetOwner();
  },
  logoutAll: async () => {
    const response = await requestJson<SessionResponse>("/api/auth/logout-all", { method: "POST", body: "{}" });
    get().applySession(response);
    await forgetOwner();
  },
  expireSession: () => { get().applySession({ authenticated: false }); void forgetOwner(); },
})));
