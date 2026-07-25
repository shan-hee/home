import Message from "@/components/Message";
import SocialLinks from "@/components/SocialLinks";
import { useMainStore } from "@/store";
import "@/views/Main/Left.scss";

export default function MainLeft({ onOpenOwnerPanel }: { onOpenOwnerPanel: () => void }) {
  const mobileOpen = useMainStore((state) => state.mobileOpenState);
  return <div className={`left${mobileOpen ? " hidden" : ""}`}><Message onOpenOwnerPanel={onOpenOwnerPanel} /><SocialLinks /></div>;
}
