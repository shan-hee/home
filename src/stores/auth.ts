import { defineStore } from "pinia";
import { requestJson } from "@/services/apiClient";
import { STORAGE_KEYS } from "@/utils/storageKeys";

interface AuthDevice {
  id: string;
  name: string;
}

interface SessionResponse {
  authenticated: boolean;
  device?: AuthDevice;
  expiresAt?: string;
}

type AuthStatus = "checking" | "anonymous" | "authenticated";

const createDeviceId = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.ownerDeviceId);
    if (stored) return stored;
    const id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEYS.ownerDeviceId, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
};

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

const defaultDeviceName = () => `${browserName()} · ${platformName()}`;

export const useAuthStore = defineStore("owner-auth", {
  state: () => ({
    status: "checking" as AuthStatus,
    device: null as AuthDevice | null,
    expiresAt: null as string | null,
    deviceId: createDeviceId(),
    checkPromise: null as Promise<boolean> | null,
  }),
  getters: {
    authenticated: (state) => state.status === "authenticated",
  },
  actions: {
    applySession(response: SessionResponse) {
      this.status = response.authenticated ? "authenticated" : "anonymous";
      this.device = response.authenticated && response.device ? response.device : null;
      this.expiresAt = response.authenticated ? response.expiresAt || null : null;
    },
    async checkSession() {
      if (this.checkPromise) return this.checkPromise;
      this.status = "checking";
      this.checkPromise = requestJson<SessionResponse>("/api/auth/session")
        .then((response) => {
          this.applySession(response);
          return response.authenticated;
        })
        .catch(() => {
          this.applySession({ authenticated: false });
          return false;
        })
        .finally(() => {
          this.checkPromise = null;
        });
      return this.checkPromise;
    },
    async login(password: string) {
      const response = await requestJson<SessionResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          password,
          deviceId: this.deviceId,
          deviceName: defaultDeviceName(),
        }),
      });
      this.applySession(response);
      return response.authenticated;
    },
    async logout() {
      const response = await requestJson<SessionResponse>("/api/auth/logout", {
        method: "POST",
        body: "{}",
      });
      this.applySession(response);
    },
    async logoutAll() {
      const response = await requestJson<SessionResponse>("/api/auth/logout-all", {
        method: "POST",
        body: "{}",
      });
      this.applySession(response);
    },
    expireSession() {
      this.applySession({ authenticated: false });
    },
  },
});
