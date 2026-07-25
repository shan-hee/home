import { FormEvent, useMemo, useState } from "react";
import config from "@/../package.json";
import { useMainStore } from "@/store";
import { confirmAction, toast } from "@/ui/toast";
import { checkForUpdate } from "@/utils/updatecheck";
import { parseVersion } from "@/utils/ver";
import "@/components/DevSet.scss";

export default function DevSet() {
  const store = useMainStore();
  const [wallpaperId, setWallpaperId] = useState("");
  const version = useMemo(() => parseVersion(config.version), []);
  const type = ({ preview: "预览版", development: "开发版", beta: "尝鲜版", release: "正式版" } as Record<string, string>)[version.type] || "未知版本";
  const setWallpaper = (event: FormEvent) => {
    event.preventDefault();
    if (store.coverType !== 0) return toast.error("当前使用非内置壁纸，不支持该功能");
    if (!/^\d+$/.test(wallpaperId)) return toast.error("壁纸号必须为纯数字");
    if (!store.setSBGCount(Number(wallpaperId))) return toast.error(`壁纸 ID 应在 1–${store.wallpaperMaxId || 1} 之间`);
    toast.success(`已设置壁纸 ID：${wallpaperId}`); setWallpaperId("");
  };
  const reset = async () => {
    if (!await confirmAction("将恢复所有默认设置，并清除本项目的天气缓存，是否继续？")) return;
    toast.info("正在恢复默认配置，请稍后…"); await store.resetStore(); toast.success("已恢复默认设置");
  };
  const update = async () => {
    const result = await checkForUpdate(version);
    if (result.status === "true") toast.success(`当前已是最新版本：v${version.version}`);
    else if (result.status === "false") toast.info(`发现新版本 v${result.latestVersion}`);
    else toast.error("版本检测异常，请稍后再试");
  };
  return <div className="devsettings"><section><strong>壁纸调整</strong><p>使用内置壁纸时临时指定壁纸</p><form className="dev-inline" onSubmit={setWallpaper}><input value={wallpaperId} onChange={(event) => setWallpaperId(event.target.value)} inputMode="numeric" aria-label="壁纸 ID" /><button type="submit" disabled={!wallpaperId}>确定</button></form></section><section><strong>个性化设置</strong><label className="dev-check"><input type="checkbox" checked={store.msgNameShow} onChange={(event) => store.patch({ msgNameShow: event.target.checked })} />信息区域显示自定义名</label></section><section><strong>维护</strong><div className="dev-actions"><button type="button" onClick={() => void reset()}>重置所有设置</button><button type="button" onClick={() => void update()}>检查更新</button></div><p>版本号 v{version.version}，{type}，{version.channel} 渠道，by {version.upa}。</p></section></div>;
}
