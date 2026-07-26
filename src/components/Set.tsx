import { useState } from "react";
import DevSet from "@/components/DevSet";
import { useMainStore } from "@/store";
import type { MainState } from "@/typings/store";
import { toast } from "@/ui/toast";
import "@/components/Set.scss";

const RadioSet = <Value extends string | number>({ value, values, onChange, name }: { value: Value; values: Array<[Value, string]>; onChange: (value: Value) => void; name: string }) => <div className="choice-group">{values.map(([item, label]) => <label key={String(item)} className={value === item ? "is-selected" : ""}><input type="radio" name={name} checked={value === item} onChange={() => onChange(item)} />{label}</label>)}</div>;
const Toggle = ({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) => <button type="button" className={`native-switch${checked ? " is-on" : ""}`} role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}><span /></button>;

export default function Set() {
  const state = useMainStore();
  const [wallpaperId, setWallpaperId] = useState(state.wallpaperLocalId?.toString() || "");
  const set = <Key extends keyof MainState>(key: Key, value: MainState[Key]) => state.setSetting(key, value);
  const applyWallpaper = () => {
    if (!wallpaperId.trim()) return clearWallpaper();
    if (!state.setWallpaperLocalId(wallpaperId)) return toast.error(`壁纸 ID 应在 1–${state.wallpaperMaxId || 1} 之间`);
    toast.success(`默认壁纸已设置为 ${state.wallpaperLocalId}`);
  };
  const clearWallpaper = () => { state.setWallpaperLocalId(null); setWallpaperId(""); toast.success("默认壁纸已改为随机"); };
  return <div className="setting"><div className="native-collapse"><details open><summary>个性壁纸</summary><div className="collapse-content"><RadioSet name="wallpaper" value={state.coverType} values={[[0, "默认壁纸"], [1, "每日一图"], [2, "随机风景"], [3, "随机动漫"]]} onChange={(value) => { set("coverType", value); toast.success("壁纸更换成功"); }} /><div className="item"><span className="text">自动切换</span><RadioSet name="auto-wallpaper" value={state.autoBGSwitchInterval} values={[[0, "关闭"], [1, "15 秒"], [2, "30 秒"], [3, "45 秒"]]} onChange={(value) => set("autoBGSwitchInterval", value)} /></div>{state.coverType === 0 && <div className="item"><span className="text">默认壁纸 ID</span><div className="inline-control"><input value={wallpaperId} onChange={(event) => setWallpaperId(event.target.value)} type="number" min="1" max={state.wallpaperMaxId || undefined} placeholder="随机" /><button type="button" onClick={applyWallpaper}>应用</button><button type="button" onClick={clearWallpaper}>随机</button></div></div>}</div></details><details><summary>个性化调整</summary><div className="collapse-content"><div className="item"><span className="text">建站日期显示</span><Toggle label="建站日期显示" checked={state.siteStartShow} onChange={(value) => set("siteStartShow", value)} /></div><div className="item"><span className="text">底栏背景模糊</span><Toggle label="底栏背景模糊" checked={state.footerBlur} onChange={(value) => set("footerBlur", value)} /></div></div></details>{state.setV && <details><summary>开发设置</summary><div className="collapse-content"><DevSet /></div></details>}</div></div>;
}
