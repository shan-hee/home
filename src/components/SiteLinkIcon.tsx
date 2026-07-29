import { useState } from "react";
import DynamicIcon from "@/components/DynamicIcon";
import type { SiteLinkConfig } from "@/typings/siteContent";

interface Props {
  link: Pick<SiteLinkConfig, "iconMode" | "iconValue">;
  size?: number;
}

export default function SiteLinkIcon({ link, size = 31 }: Props) {
  const [failedAssetId, setFailedAssetId] = useState<string | null>(null);

  if (link.iconMode === "text") return <b>{link.iconValue}</b>;
  if (link.iconMode === "asset" && failedAssetId !== link.iconValue) {
    return <img className="site-icon-image" src={`/api/assets/${encodeURIComponent(link.iconValue)}?kind=site-icon`} alt="" width={size} height={size} draggable={false} onError={() => setFailedAssetId(link.iconValue)} />;
  }
  return <DynamicIcon code={link.iconMode === "icon" ? link.iconValue : "ri:links-fill"} size={size} />;
}
