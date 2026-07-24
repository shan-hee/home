import { watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { registerSW } from "virtual:pwa-register";
import type { mainStore } from "@/store";

type MainStore = ReturnType<typeof mainStore>;

export const setupPwaUpdate = (store: MainStore) => {
  let refreshWhenPaused = false;

  if ("caches" in window) {
    void Promise.all(["js-css-cache", "image-cache"].map((name) => window.caches.delete(name))).catch(() => undefined);
  }

  const updateSW = registerSW({
    onNeedRefresh: async () => {
      try {
        await ElMessageBox.confirm(
          store.playerStatus === "playing"
            ? "新版本已准备好。确认后将在音乐暂停时刷新。"
            : "新版本已准备好，是否立即刷新？",
          "发现新版本",
          {
            confirmButtonText: store.playerStatus === "playing" ? "暂停后刷新" : "立即刷新",
            cancelButtonText: "稍后",
            type: "info",
          },
        );
        if (store.playerStatus === "playing") {
          refreshWhenPaused = true;
          ElMessage.info("新版本将在音乐暂停后应用");
          return;
        }
        await updateSW(true);
      } catch {
        // 用户选择稍后更新，等待中的 Service Worker 保持不接管页面。
      }
    },
    onOfflineReady: () => {
      ElMessage.success("离线资源已准备完成");
    },
    onRegisterError: (error) => {
      console.error("Service Worker 注册失败：", error);
    },
  });

  const stop = watch(
    () => store.playerStatus,
    (status) => {
      if (!refreshWhenPaused || status === "playing") return;
      refreshWhenPaused = false;
      void updateSW(true);
    },
  );

  return stop;
};
