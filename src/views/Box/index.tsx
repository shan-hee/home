import { CloseOne } from "@icon-park/react";
import { useMainStore } from "@/store";
import TimeCapsule from "@/components/TimeCapsule";
import "@/views/Box/index.scss";

export default function Box() {
  const patch = useMainStore((state) => state.patch);
  return (
    <div className="box cards">
      <CloseOne className="close" theme="filled" size="28" fill="var(--close-icon-color)" onClick={() => patch({ boxOpenState: false })} />
      <div className="content"><TimeCapsule /></div>
    </div>
  );
}
