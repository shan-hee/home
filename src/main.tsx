import { createRoot } from "react-dom/client";
import App from "@/App";
import { useAuthStore } from "@/stores/auth";
import { useAdminOfflineStore } from "@/stores/adminOffline";
import { useSiteContentStore } from "@/stores/siteContent";
import ToastHost from "@/ui/ToastHost";
import { setupPwaUpdate } from "@/utils/pwaUpdate";
import "@/style/style.scss";
import "swiper/css";
import "uno.css";

const siteContent = useSiteContentStore.getState();
siteContent.initialize();
useAdminOfflineStore.getState().initialize();
const root = document.getElementById("app");
if (!root) throw new Error("缺少应用挂载节点 #app");
root.style.display = "block";
createRoot(root).render(<><App /><ToastHost /></>);
void useAuthStore.getState().checkSession();
void useSiteContentStore.getState().refresh();

setupPwaUpdate();
