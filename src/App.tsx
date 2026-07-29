import { CloseSmall, HamburgerButton } from "@icon-park/react";
import { useCallback, useEffect, useState } from "react";
import Background from "@/components/Background";
import Footer from "@/components/Footer";
import OwnerPanel from "@/components/OwnerPanel";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import { useTheme } from "@/composables/useTheme";
import { useMainStore } from "@/store";
import { useAuthStore } from "@/stores/auth";
import cursorInit from "@/utils/cursor";
import { checkDays, helloInit } from "@/utils/getTime";
import Box from "@/views/Box";
import MainLeft from "@/views/Main/Left";
import MainRight from "@/views/Main/Right";
import "@/App.scss";

export default function App() {
  const loaded = useMainStore((state) => state.imgLoadStatus);
  const boxOpen = useMainStore((state) => state.boxOpenState);
  const mobileOpen = useMainStore((state) => state.mobileOpenState);
  const innerWidth = useMainStore((state) => state.innerWidth);
  const authStatus = useAuthStore((state) => state.status);
  const patch = useMainStore((state) => state.patch);
  const setInnerWidth = useMainStore((state) => state.setInnerWidth);
  const [ownerPanel, setOwnerPanel] = useState(false);
  const settingsExpanded = ownerPanel && (authStatus === "authenticated" || authStatus === "offline-owner");
  useTheme();
  const openOwner = () => { patch({ boxOpenState: false }); setOwnerPanel(true); if ((innerWidth ?? window.innerWidth) < 721) patch({ mobileOpenState: true }); };
  const closeOwner = () => { setOwnerPanel(false); if ((innerWidth ?? window.innerWidth) < 721) patch({ mobileOpenState: false }); };
  const loadComplete = useCallback(() => { queueMicrotask(() => { helloInit(); checkDays(); }); }, []);
  useEffect(() => {
    const disposeCursor = cursorInit();
    const resize = () => setInnerWidth(window.innerWidth);
    resize(); window.addEventListener("resize", resize);
    return () => { disposeCursor?.(); window.removeEventListener("resize", resize); };
  }, [setInnerWidth]);
  useEffect(() => { if (innerWidth !== null && innerWidth < 721) patch({ boxOpenState: false }); }, [innerWidth, patch]);
  return <>
    <Background onLoadComplete={loadComplete} />
    {loaded && <main id="main" className={settingsExpanded ? "settings-open" : undefined}>
      <div className="page-container">
        <section className={`all${settingsExpanded ? " is-settings-hidden" : ""}`} aria-hidden={settingsExpanded || undefined}>
          <MainLeft onOpenOwnerPanel={openOwner} />
          <MainRight boxOpen={boxOpen} ownerPanelOpen={ownerPanel && !settingsExpanded} onCloseOwnerPanel={closeOwner} />
          {boxOpen && <Box />}
        </section>
        {settingsExpanded && <section className="owner-settings-view"><OwnerPanel onClose={closeOwner} /></section>}
      </div>
      <div className="page-chrome" aria-hidden={settingsExpanded || undefined}>
        <ThemeSwitcher />
        <button type="button" className="menu" aria-label={mobileOpen ? "关闭移动菜单" : "打开移动菜单"} onClick={() => patch({ mobileOpenState: !mobileOpen })}>{mobileOpen ? <CloseSmall theme="outline" size="24" /> : <HamburgerButton theme="outline" size="24" />}</button>
        <Footer className="f-ter" />
      </div>
    </main>}
  </>;
}
