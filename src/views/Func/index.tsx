import { useEffect, useMemo, useState } from "react";
import Music from "@/components/Music";
import Weather from "@/components/Weather";
import { useMainStore } from "@/store";
import { useSiteContentStore } from "@/stores/siteContent";
import { getCurrentTime } from "@/utils/getTime";
import "@/views/Func/index.scss";

type CurrentTime = ReturnType<typeof getCurrentTime>;

const lunarFormatter = new Intl.DateTimeFormat("zh-CN-u-ca-chinese", { month: "long", day: "numeric" });
const weekdayFormatter = new Intl.DateTimeFormat("zh-CN", { weekday: "short" });
const lunarDayNames = ["", "初一", "初二", "初三", "初四", "初五", "初六", "初七", "初八", "初九", "初十", "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十", "廿一", "廿二", "廿三", "廿四", "廿五", "廿六", "廿七", "廿八", "廿九", "三十"];

const getCalendarText = (date: Date) => {
  const parts = lunarFormatter.formatToParts(date);
  const month = parts.find((part) => part.type === "month")?.value || "";
  const day = Number(parts.find((part) => part.type === "day")?.value || 0);
  return { lunar: `${month}${lunarDayNames[day] || ""}`, weekday: weekdayFormatter.format(date) };
};

export default function Func() {
  const mobile = useMainStore((state) => state.mobileFuncState);
  const musicRevision = useSiteContentStore((state) => state.snapshot.sectionRevisions.music);
  const preferencesRevision = useSiteContentStore((state) => state.snapshot.sectionRevisions.preferences);
  const [time, setTime] = useState<CurrentTime>(() => getCurrentTime());
  const [calendar, setCalendar] = useState(() => getCalendarText(new Date()));

  useEffect(() => {
    let dateKey = "";
    const update = () => {
      const now = new Date();
      setTime(getCurrentTime());
      const nextKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
      if (nextKey !== dateKey) {
        dateKey = nextKey;
        setCalendar(getCalendarText(now));
      }
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const dateText = useMemo(() => `${time.year} 年 ${time.month} 月 ${time.day} 日`, [time.day, time.month, time.year]);

  return (
    <div className={`function${mobile ? " mobile" : ""}`}>
      <div className="function-row">
        <div className="function-column function-music"><div className="function-card"><Music key={`${musicRevision}:${preferencesRevision}`} /></div></div>
        <div className="function-column function-info">
          <div className="function-card function-summary cards">
            <div className="time">
              <div className="date">{dateText}</div>
              <div className="lunar-date"><span>{calendar.lunar}</span><span aria-hidden="true">&nbsp;·&nbsp;</span><span>{calendar.weekday}</span></div>
              <div className="text"><span>{time.hour}:{time.minute}:{time.second}</span></div>
            </div>
            <Weather />
          </div>
        </div>
      </div>
    </div>
  );
}
