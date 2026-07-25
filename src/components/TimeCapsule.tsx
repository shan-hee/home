import { useEffect, useState } from "react";
import { HourglassFull } from "@icon-park/react";
import { getTimeCapsule, siteDateStatistics } from "@/utils/getTime";
import { useMainStore } from "@/store";
import { useSiteContentStore } from "@/stores/siteContent";
import "@/components/TimeCapsule.scss";

export default function TimeCapsule() {
  const showStart = useMainStore((state) => state.siteStartShow);
  const startDate = useSiteContentStore((state) => state.snapshot.sections.profile.startDate);
  const [timeData, setTimeData] = useState(getTimeCapsule());
  const [startText, setStartText] = useState(() => startDate ? siteDateStatistics(new Date(startDate)) : "");
  useEffect(() => {
    const update = () => {
      setTimeData(getTimeCapsule());
      setStartText(startDate ? siteDateStatistics(new Date(startDate)) : "");
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [startDate]);
  return (
    <div className="time-capsule">
      <div className="title"><HourglassFull theme="two-tone" size="24" fill={["var(--time-icon-one-color)", "var(--time-icon-two-color)"]} /><span>时光胶囊</span></div>
      <div className="all-capsule">
        {Object.entries(timeData).map(([tag, item]) => (
          <div key={tag} className="capsule-item">
            <div className="item-title">
              <span className="percentage">{item.name}已度过 <strong>{item.passed}</strong> {tag === "day" ? "小时" : "天"}</span>
              <span className="remaining">剩余&nbsp;{item.remaining}&nbsp;{tag === "day" ? "小时" : "天"}</span>
            </div>
            <div className="time-progress"><span style={{ width: `${item.percentage}%` }}>{item.percentage}%</span></div>
          </div>
        ))}
        {showStart && startText && <div className="capsule-item start"><div className="item-title">{startText}</div></div>}
      </div>
    </div>
  );
}
