import { CloseSmall, HamburgerButton } from "@icon-park/react";
import { useCallback, useEffect, useState } from "react";
import Background from "@/components/Background";
import Footer from "@/components/Footer";
import Loading from "@/components/Loading";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import { useTheme } from "@/composables/useTheme";
import { useMainStore } from "@/store";
import { toast } from "@/ui/toast";
import cursorInit from "@/utils/cursor";
import { checkDays, helloInit } from "@/utils/getTime";
import Box from "@/views/Box";
import MainLeft from "@/views/Main/Left";
import MainRight from "@/views/Main/Right";
import "@/App.scss";

export default function App() {
  const loaded = useMainStore((state) => state.imgLoadStatus);
  const backgroundShow = useMainStore((state) => state.backgroundShow);
  const boxOpen = useMainStore((state) => state.boxOpenState);
  const mobileOpen = useMainStore((state) => state.mobileOpenState);
  const innerWidth = useMainStore((state) => state.innerWidth);
  const patch = useMainStore((state) => state.patch);
  const setInnerWidth = useMainStore((state) => state.setInnerWidth);
  const [ownerPanel, setOwnerPanel] = useState(false);
  const { applyBackgroundTheme } = useTheme();
  const openOwner = () => { patch({ boxOpenState: false }); setOwnerPanel(true); if ((innerWidth ?? window.innerWidth) < 721) patch({ mobileOpenState: true }); };
  const closeOwner = () => { setOwnerPanel(false); if ((innerWidth ?? window.innerWidth) < 721) patch({ mobileOpenState: false }); };
  const loadComplete = useCallback(() => { queueMicrotask(() => { helloInit(); checkDays(); }); }, []);
  useEffect(() => {
    const disposeCursor = cursorInit();
    const resize = () => setInnerWidth(window.innerWidth);
    const middle = (event: MouseEvent) => { if (event.button !== 1) return; const next = !useMainStore.getState().backgroundShow; patch({ backgroundShow: next }); toast.info(`已${next ? "开启" : "退出"}壁纸展示状态`); };
    resize(); window.addEventListener("resize", resize); window.addEventListener("mousedown", middle);
    return () => { disposeCursor?.(); window.removeEventListener("resize", resize); window.removeEventListener("mousedown", middle); };
  }, [patch, setInnerWidth]);
  useEffect(() => { if (innerWidth !== null && innerWidth < 721) patch({ boxOpenState: false }); }, [innerWidth, patch]);
  return <><Loading /><Background onLoadComplete={loadComplete} onImageLoaded={(image) => void applyBackgroundTheme(image)} />{loaded && <main id="main">{!backgroundShow && <div className="page-container"><section className="all"><MainLeft onOpenOwnerPanel={openOwner} />{!boxOpen && <MainRight ownerPanelOpen={ownerPanel} onCloseOwnerPanel={closeOwner} />}{boxOpen && <Box />}</section></div>}{!backgroundShow && <ThemeSwitcher />}{!backgroundShow && <button type="button" className="menu" aria-label={mobileOpen ? "关闭移动菜单" : "打开移动菜单"} onClick={() => patch({ mobileOpenState: !mobileOpen })}>{mobileOpen ? <CloseSmall theme="outline" size="24" /> : <HamburgerButton theme="outline" size="24" />}</button>}{!backgroundShow && <Footer className="f-ter" />}</main>}</>;
}
