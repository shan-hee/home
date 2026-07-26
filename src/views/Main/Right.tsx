import { useEffect, useMemo } from "react";
import Func from "@/views/Func";
import Links from "@/components/Links";
import OwnerPanel from "@/components/OwnerPanel";
import { useAuthStore } from "@/stores/auth";
import { useMainStore } from "@/store";
import { useSiteContentStore } from "@/stores/siteContent";
import "@/views/Main/Right.scss";

interface Props { ownerPanelOpen: boolean; onCloseOwnerPanel: () => void }

export default function MainRight({ ownerPanelOpen, onCloseOwnerPanel }: Props) {
  const mobileOpen = useMainStore((state) => state.mobileOpenState);
  const mobileFunc = useMainStore((state) => state.mobileFuncState);
  const patch = useMainStore((state) => state.patch);
  const authStatus = useAuthStore((state) => state.status);
  const checkSession = useAuthStore((state) => state.checkSession);
  const siteUrl = useSiteContentStore((state) => state.snapshot.sections.profile.siteUrl);
  useEffect(() => { if (ownerPanelOpen && authStatus === "checking") void checkSession(); }, [authStatus, checkSession, ownerPanelOpen]);
  const domain = useMemo(() => {
    const raw = (siteUrl || "imsyy.top").replace(/^(https?:\/\/)/, "").split("/")[0]!.split(":")[0]!;
    const parts = raw.split(".");
    return [parts[0] || "imsyy", parts.slice(1).join(".") || "top"];
  }, [siteUrl]);
  return <div className={`right${mobileOpen ? "" : " is-hidden"}${ownerPanelOpen && authStatus === "authenticated" ? " has-owner-panel" : ""}`}>{!ownerPanelOpen ? <div className="right-home"><button type="button" className="logo text-truncate-ellipsis" onClick={() => patch({ mobileFuncState: !mobileFunc })}><span className="bg">{domain[0]}</span><span className="sm">.{domain[1]}</span></button><Func /><Links /></div> : <OwnerPanel onClose={onCloseOwnerPanel} />}</div>;
}
