import { createApp } from "vue";
import "@/style/style.scss";
import App from "@/App.vue";
import { mainStore } from "@/store";
import { validationPlugin } from "@/store/plugins/validation";
// 引入 pinia
import { createPinia } from 'pinia';
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate';
// Element Plus
import { ElMessage, ElMessageBox } from "element-plus";
import "element-plus/dist/index.css";
// swiper
import "swiper/css";
import "uno.css";
import { watch } from "vue";
import { setupPwaUpdate } from "@/utils/pwaUpdate";

const app = createApp(App);
const pinia = createPinia();

export default pinia;
pinia.use(piniaPluginPersistedstate);
pinia.use(validationPlugin);
app.use(pinia);

const mountApp = () => {
  const appEl = document.getElementById("app");
  if (appEl) {
    appEl.style.display = "block";
  };
  app.mount("#app");
  const store = mainStore();

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("set") === "reset") {
    ElMessage({
      dangerouslyUseHTMLString: true,
      message: `正在恢复默认配置，请稍后...`,
    });
    void store.resetStore().then(() => {
      window.history.replaceState({}, "", window.location.pathname);
    });
  };

  setupPwaUpdate(store);

  const parseBooleanParam = (value: string | null) => {
    if (value === "true" || value === "1") return true;
    if (value === "false" || value === "0") return false;
    return null;
  };

  const applyUrlSettings = () => {
    const backgroundType = urlParams.get("bg");
    if (backgroundType !== null) store.coverType = Number(backgroundType);
    const backgroundId = urlParams.get("bgc");
    if (backgroundId && (store.coverType === 0 || backgroundType === "0")) store.sBGCount = backgroundId;
    const developerMode = parseBooleanParam(urlParams.get("devs"));
    if (developerMode !== null) store.setV = developerMode;
    const autoplay = parseBooleanParam(urlParams.get("pap"));
    if (autoplay !== null) store.playerAutoplay = autoplay;
  };

  if (urlParams.get("set") !== "reset") {
    if (store.imgLoadStatus) applyUrlSettings();
    else {
      const stop = watch(() => store.imgLoadStatus, (ready) => {
        if (!ready) return;
        stop();
        applyUrlSettings();
      });
    }
  }
};

if (!import.meta.env.VITE_CONFIG_TURN || import.meta.env.VITE_CONFIG_TURN != "true") {
  const appEl = document.getElementById("app");
  if (appEl) {
    appEl.style.display = "none";
  };
  console.error(`警告：您似乎没有启用配置文件，项目可能出现异常！请配置 .env 文件后再运行项目！`);
  ElMessageBox.confirm(
    '检测到您似乎没有创建配置文件，项目可能出现异常！',
    '警告',
    {
      confirmButtonText: '继续',
      cancelButtonText: '取消',
      type: 'warning',
    }
  )
    .then(() => {
      mountApp();
    })
    .catch(() => {
      ElMessage({
        type: 'info',
        message: '已取消',
      })
    });
} else {
  mountApp();
};
