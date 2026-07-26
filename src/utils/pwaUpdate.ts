import { registerSW } from "virtual:pwa-register";
import { useMainStore } from "@/store";
import { confirmAction, toast } from "@/ui/toast";

export const setupPwaUpdate = () => {
  let refreshWhenPaused = false;

  if ("storage" in navigator && "persist" in navigator.storage) {
    void navigator.storage.persist().catch(() => false);
  }

  if ("caches" in window) {
    void Promise.all(["js-css-cache", "image-cache", "site-config-v1", "online-wallpaper-v1"].map((name) => window.caches.delete(name))).catch(() => undefined);
  }

  const updateSW = registerSW({
    onNeedRefresh: async () => {
      const playing = useMainStore.getState().playerStatus === "playing";
      const accepted = await confirmAction(
        playing ? "新版本已准备好。确认后将在音乐暂停时刷新。" : "新版本已准备好，是否立即刷新？",
      );
      if (!accepted) return;
      if (playing) {
        refreshWhenPaused = true;
        toast.info("新版本将在音乐暂停后应用");
        return;
      }
      await updateSW(true);
    },
    onOfflineReady: () => toast.success("离线资源已准备完成"),
    onRegisterError: (error) => console.error("Service Worker 注册失败：", error),
  });

  return useMainStore.subscribe(
    (state) => state.playerStatus,
    (status) => {
      if (!refreshWhenPaused || status === "playing") return;
      refreshWhenPaused = false;
      void updateSW(true);
    },
  );
};
