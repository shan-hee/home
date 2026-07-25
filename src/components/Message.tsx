import type { KeyboardEvent } from "react";
import Hitokoto from "@/components/Hitokoto";
import { useMainStore } from "@/store";
import { useSiteContentStore } from "@/stores/siteContent";
import { toast } from "@/ui/toast";
import "@/components/Message.scss";

const displayUrl = (value: string) => {
  const hostname = value.replace(/^(https?:\/\/)/, "").split("/")[0]?.split(":")[0] || "imsyy.top";
  return hostname.split(".");
};

interface Props { onOpenOwnerPanel: () => void }

export default function Message({ onOpenOwnerPanel }: Props) {
  const msgNameShow = useMainStore((state) => state.msgNameShow);
  const innerWidth = useMainStore((state) => state.innerWidth);
  const boxOpenState = useMainStore((state) => state.boxOpenState);
  const setSetting = useMainStore((state) => state.setSetting);
  const profile = useSiteContentStore((state) => state.snapshot.sections.profile);
  const siteUrl = displayUrl(msgNameShow ? profile.mainName || profile.siteUrl : profile.siteUrl);
  const changeBox = () => {
    if ((innerWidth ?? 0) >= 721) setSetting("boxOpenState", !boxOpenState);
    else toast.info("当前显示分辨率不足以打开拓展盒子啦qwq");
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      changeBox();
    }
  };
  return (
    <div className="message">
      <div className="logo">
        <img className="logo-img" src={profile.mainLogo} alt="logo" />
        <div className={`name${siteUrl[0]!.length >= 6 ? " long" : ""}`}>
          <span className="site-address text-truncate-ellipsis">
            <span className="bg">{siteUrl[0]}</span>
            <span className="sm">.{siteUrl[1]}</span>
          </span>
          <button type="button" className="owner-entry" aria-label="打开所有者设置" title="编辑站点" onClick={onOpenOwnerPanel}>
            <svg className="owner-entry-icon" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="currentColor" fillRule="evenodd" clipRule="evenodd" d="M38.9 6.4c-7.7.8-14.4 3.7-19.2 8.5-5.1 5.1-7.7 11.8-8.1 20.5l-3.4 3.4a1.7 1.7 0 0 0 2.4 2.4l3.4-3.4c8.7-.4 15.4-3 20.5-8.1 4.8-4.8 7.7-11.5 8.5-19.2.3-2.6-1.5-4.4-4.1-4.1ZM17.1 33.2c.7-6.6 2.8-11.5 6.5-15.2 3.6-3.6 8.4-5.9 14.2-7-1.1 5.9-3.4 10.6-7 14.2-3.7 3.7-8.6 5.8-15.2 6.5l8.8-8.8a1.7 1.7 0 1 0-2.4-2.4l-4.9 4.9v7.8Z" />
              <path fill="currentColor" d="m11.1 8.2.8 2.3 2.3.8-2.3.8-.8 2.3-.8-2.3-2.3-.8 2.3-.8.8-2.3Zm7.2-4.1.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5.5-1.5Z" />
            </svg>
          </button>
        </div>
      </div>
      <div className="description" role="button" tabIndex={0} title="切换拓展盒子" onClick={changeBox} onKeyDown={onKeyDown}>
        <Hitokoto />
      </div>
    </div>
  );
}
