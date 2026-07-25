import { useEffect, useState } from "react";
import { Quote } from "@icon-park/react";
import { getHitokoto } from "@/api";
import { toast } from "@/ui/toast";
import "@/components/Hitokoto.scss";

export default function Hitokoto() {
  const [data, setData] = useState({ text: "这里应该显示一句话", from: "無名" });
  useEffect(() => {
    let active = true;
    void getHitokoto()
      .then((result) => active && setData({ text: result.hitokoto, from: result.from }))
      .catch(() => {
        toast.error("一言获取失败");
        if (active) setData({ text: "这里应该显示一句话", from: "無名" });
      });
    return () => { active = false; };
  }, []);
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
