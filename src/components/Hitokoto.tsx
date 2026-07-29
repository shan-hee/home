import { useEffect, useState } from "react";
import { Quote } from "@icon-park/react";
import { getHitokoto } from "@/api";
import { useSiteContentStore } from "@/stores/siteContent";
import { toast } from "@/ui/toast";
import "@/components/Hitokoto.scss";

export default function Hitokoto() {
  const config = useSiteContentStore((state) => state.snapshot.sections.hitokoto);
  const revision = useSiteContentStore((state) => state.snapshot.sectionRevisions.hitokoto);
  const fallbackText = config.mode === "fixed" ? config.fixedText || config.fallbackText : config.fallbackText;
  const fallbackFrom = config.mode === "fixed" ? config.fixedFrom || config.fallbackFrom : config.fallbackFrom;
  const [data, setData] = useState({ text: fallbackText, from: fallbackFrom });
  useEffect(() => {
    setData({ text: fallbackText, from: fallbackFrom });
    if (config.mode === "fixed") return;
    let active = true;
    void getHitokoto(revision)
      .then((result) => active && setData({ text: result.hitokoto, from: result.from }))
      .catch(() => {
        toast.error("一言获取失败");
        if (active) setData({ text: fallbackText, from: fallbackFrom });
      });
    return () => { active = false; };
  }, [config.mode, fallbackFrom, fallbackText, revision]);
  return (
    <div className="hitokoto cards">
      <Quote className="quote-icon quote-start" size={18} aria-hidden="true" />
      <div className="content">
        <span className="text">{data.text}</span>
        <span className="from">-「&nbsp;{data.from}&nbsp;」</span>
      </div>
      <Quote className="quote-icon quote-end" size={18} aria-hidden="true" />
    </div>
  );
}
