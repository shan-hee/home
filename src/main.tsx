import { createRoot } from "react-dom/client";
import App from "@/App";
import Loading from "@/components/Loading";
import { useAdminOfflineStore } from "@/stores/adminOffline";
import { useAuthStore } from "@/stores/auth";
import { useSiteContentStore } from "@/stores/siteContent";
import ToastHost from "@/ui/ToastHost";
import { setupPwaUpdate } from "@/utils/pwaUpdate";
import "@/style/style.scss";
import "swiper/css";
import "uno.css";

const siteContent = useSiteContentStore.getState();
useAdminOfflineStore.getState().initialize();
void useAuthStore.getState().initialize();
const root = document.getElementById("app");
if (!root) throw new Error("缺少应用挂载节点 #app");
root.style.display = "block";

function BootstrapRoot() {
  const ready = useSiteContentStore((state) => state.ready);
  return <><Loading />{ready && <App />}<ToastHost /></>;
}

createRoot(root).render(<BootstrapRoot />);
void siteContent.initialize();

setupPwaUpdate();
