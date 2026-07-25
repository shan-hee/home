import { createRoot } from "react-dom/client";
import App from "@/App";
import { useMainStore } from "@/store";
import { useAuthStore } from "@/stores/auth";
import { useSettingsSyncStore } from "@/stores/settingsSync";
import { useSiteContentStore } from "@/stores/siteContent";
import ToastHost from "@/ui/ToastHost";
import { toast } from "@/ui/toast";
import { setupPwaUpdate } from "@/utils/pwaUpdate";
import "@/style/style.scss";
import "swiper/css";
import "uno.css";

const siteContent = useSiteContentStore.getState();
siteContent.initialize();
useSettingsSyncStore.getState().initialize();
const root = document.getElementById("app");
if (!root) throw new Error("缺少应用挂载节点 #app");
root.style.display = "block";
createRoot(root).render(<><App /><ToastHost /></>);
void useAuthStore.getState().checkSession();
void useSiteContentStore.getState().refresh();

const params = new URLSearchParams(window.location.search);
const store = useMainStore.getState();
const parseBoolean = (value: string | null) => value === "true" || value === "1" ? true : value === "false" || value === "0" ? false : null;
const applyUrlSettings = () => {
  const backgroundType = params.get("bg");
  if (backgroundType !== null) store.setSetting("coverType", Number(backgroundType));
  const backgroundId = params.get("bgc");
  if (backgroundId && (useMainStore.getState().coverType === 0 || backgroundType === "0")) store.setSetting("sBGCount", backgroundId);
  const developer = parseBoolean(params.get("devs")); if (developer !== null) store.setSetting("setV", developer);
  const autoplay = parseBoolean(params.get("pap")); if (autoplay !== null) store.setSetting("playerAutoplay", autoplay);
};
if (params.get("set") === "reset") {
  toast.info("正在恢复默认配置，请稍后…");
  void store.resetStore().then(() => window.history.replaceState({}, "", window.location.pathname));
} else if (useMainStore.getState().imgLoadStatus) applyUrlSettings();
else {
  const stop = useMainStore.subscribe((state) => state.imgLoadStatus, (ready) => { if (!ready) return; stop(); applyUrlSettings(); });
}
setupPwaUpdate();
