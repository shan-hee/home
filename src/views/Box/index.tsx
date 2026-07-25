import { useState } from "react";
import { CloseOne } from "@icon-park/react";
import { useMainStore } from "@/store";
import TimeCapsule from "@/components/TimeCapsule";
import MoreContent from "@/components/MoreContent";
import "@/views/Box/index.scss";

export default function Box() {
  const [showClose, setShowClose] = useState(false);
  const setSetting = useMainStore((state) => state.setSetting);
  return (
    <div className="box cards" onMouseEnter={() => setShowClose(true)} onMouseLeave={() => setShowClose(false)}>
      {showClose && <CloseOne className="close" theme="filled" size="28" fill="var(--close-icon-color)" onClick={() => setSetting("boxOpenState", false)} />}
      <div className="content"><TimeCapsule /><MoreContent /></div>
    </div>
  );
}
