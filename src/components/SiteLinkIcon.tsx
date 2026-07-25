import { useState } from "react";
import DynamicIcon from "@/components/DynamicIcon";
import type { SiteLinkConfig } from "@/typings/siteContent";

interface Props {
  link: Pick<SiteLinkConfig, "iconMode" | "iconValue">;
  size?: number;
}

export default function SiteLinkIcon({ link, size = 31 }: Props) {
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);

  if (link.iconMode === "text") return <b>{link.iconValue}</b>;
  if (link.iconMode === "image" && failedImageUrl !== link.iconValue) {
    return <img className="site-icon-image" src={link.iconValue} alt="" width={size} height={size} referrerPolicy="no-referrer" draggable={false} onError={() => setFailedImageUrl(link.iconValue)} />;
  }
  return <DynamicIcon code={link.iconMode === "icon" ? link.iconValue : "ri:links-fill"} size={size} />;
}
