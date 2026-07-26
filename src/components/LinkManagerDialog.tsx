import { CheckSmall, CloseSmall, Delete, Download, Plus } from "@icon-park/react";
import { FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import DynamicIcon, { ICON_CODE_PATTERN } from "@/components/DynamicIcon";
import SiteLinkIcon from "@/components/SiteLinkIcon";
import type { SiteLinkConfig, SocialLinkConfig } from "@/typings/siteContent";
import { toast } from "@/ui/toast";
import "@/components/LinkManagerDialog.scss";

const SITE_ICON_PRESETS = [
  "ri:blogger-fill",
  "ri:cloud-fill",
  "ri:compass-fill",
  "ri:book-fill",
  "ri:fire-fill",
  "ri:code-box-fill",
  "ri:home-5-fill",
  "ri:links-fill",
];

const SOCIAL_ICON_PRESETS = [
  "ri:github-fill",
  "ri:bilibili-fill",
  "ri:qq-fill",
  "ri:mail-fill",
  "ri:twitter-x-fill",
  "ri:telegram-fill",
  "ri:wechat-fill",
  "ri:weibo-fill",
];

const COLOR_PRESETS = ["#FF4757", "#F09A37", "#2ED573", "#25A7F0", "#5352ED", "#A55EEA", "#525866"];

interface FaviconCandidate {
  id: string;
  label: string;
  url: string;
}

const safeUrl = (value: string, protocols: string[]) => {
  try {
    return protocols.includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

const faviconCandidates = (value: string): FaviconCandidate[] | null => {
  try {
    const target = new URL(value.trim());
    if (target.protocol !== "http:" && target.protocol !== "https:") return null;
    const candidates: FaviconCandidate[] = [];
    if (target.protocol === "https:") {
      candidates.push(
        { id: "favicon", label: "站点图标", url: new URL("/favicon.ico", target.origin).toString() },
        { id: "apple", label: "Touch Icon", url: new URL("/apple-touch-icon.png", target.origin).toString() },
      );
    }
    candidates.push(
      { id: "google", label: "Google", url: `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(target.origin)}&sz=128` },
      { id: "duckduckgo", label: "DuckDuckGo", url: `https://icons.duckduckgo.com/ip3/${encodeURIComponent(target.hostname)}.ico` },
    );
    return candidates.filter((candidate, index) => candidates.findIndex((item) => item.url === candidate.url) === index);
  } catch {
    return null;
  }
};

interface BaseProps {
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onDelete?: () => void;
}

interface SiteProps extends BaseProps {
  kind: "site";
  initial: SiteLinkConfig | null;
  onSave: (value: SiteLinkConfig) => void;
}

interface SocialProps extends BaseProps {
  kind: "social";
  initial: SocialLinkConfig | null;
  onSave: (value: SocialLinkConfig) => void;
}

type Props = SiteProps | SocialProps;

const defaultSite: SiteLinkConfig = {
  name: "",
  link: "https://",
  iconMode: "icon",
  iconValue: "ri:links-fill",
  iconColor: "#25A7F0",
};

const defaultSocial: SocialLinkConfig = {
  name: "",
  icon: "ri:links-fill",
  url: "https://",
};

export default function LinkManagerDialog(props: Props) {
  const { open, saving, onClose, onDelete } = props;
  const [siteDraft, setSiteDraft] = useState<SiteLinkConfig>(defaultSite);
  const [socialDraft, setSocialDraft] = useState<SocialLinkConfig>(defaultSocial);
  const [faviconOptions, setFaviconOptions] = useState<FaviconCandidate[]>([]);
  const [loadedFavicons, setLoadedFavicons] = useState<string[]>([]);
  const [failedFavicons, setFailedFavicons] = useState<string[]>([]);
  const [faviconRequest, setFaviconRequest] = useState(0);
  useEffect(() => {
    if (!open) return;
    if (props.kind === "site") {
      setSiteDraft(structuredClone(props.initial || defaultSite));
      setFaviconOptions([]);
      setLoadedFavicons([]);
      setFailedFavicons([]);
      setFaviconRequest(0);
    }
    else setSocialDraft(structuredClone(props.initial || defaultSocial));
  }, [open, props.kind, props.initial]);
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open, saving, onClose]);

  if (!open) return null;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (props.kind === "site") {
      const draft = {
        ...siteDraft,
        name: siteDraft.name.trim(),
        link: siteDraft.link.trim(),
        iconValue: siteDraft.iconValue.trim(),
      };
      if (!draft.name) return toast.error("请填写网站名称");
      if (!safeUrl(draft.link, ["http:", "https:"])) return toast.error("请填写有效的网站地址");
      if (draft.iconMode === "text") {
        draft.iconValue = siteDraft.iconValue.trim();
        if (!draft.iconValue || [...draft.iconValue].length > 4) return toast.error("图标文字需要填写 1 至 4 个字符");
      } else if (draft.iconMode === "icon") {
        draft.iconValue = draft.iconValue.toLowerCase();
        if (!ICON_CODE_PATTERN.test(draft.iconValue)) return toast.error("图标代码格式应类似 ri:blogger-fill");
      } else if (!safeUrl(draft.iconValue, ["https:"])) {
        return toast.error("请选择有效的网站图标");
      }
      props.onSave(draft);
      return;
    }
    const draft = {
      ...socialDraft,
      name: socialDraft.name.trim(),
      icon: socialDraft.icon.trim().toLowerCase(),
      url: socialDraft.url.trim(),
    };
    if (!draft.name) return toast.error("请填写社交方式名称");
    if (!safeUrl(draft.url, ["https:", "mailto:"])) return toast.error("请填写 HTTPS 或 mailto 地址");
    if (!ICON_CODE_PATTERN.test(draft.icon)) return toast.error("图标代码格式应类似 ri:github-fill");
    props.onSave(draft);
  };

  const loadFavicons = () => {
    const candidates = faviconCandidates(siteDraft.link);
    if (!candidates) return toast.error("请先填写有效的网站地址");
    setFaviconOptions(candidates);
    setLoadedFavicons([]);
    setFailedFavicons([]);
    setFaviconRequest((current) => current + 1);
  };

  const settleFavicon = (url: string, loaded: boolean) => {
    if (loaded) setLoadedFavicons((current) => current.includes(url) ? current : [...current, url]);
    else setFailedFavicons((current) => current.includes(url) ? current : [...current, url]);
  };

  const selectImageMode = () => {
    const imageUrl = siteDraft.iconMode === "image"
      ? siteDraft.iconValue
      : faviconOptions.find((candidate) => loadedFavicons.includes(candidate.url))?.url;
    if (imageUrl) setSiteDraft({ ...siteDraft, iconMode: "image", iconValue: imageUrl });
  };

  const visibleFavicons = faviconOptions.filter((candidate) => !failedFavicons.includes(candidate.url));
  const faviconsSettled = faviconOptions.length > 0
    && faviconOptions.every((candidate) => loadedFavicons.includes(candidate.url) || failedFavicons.includes(candidate.url));

  return createPortal(
    <div className="link-manager-layer" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !saving) onClose();
    }}>
      <section className="link-manager cards" role="dialog" aria-modal="true" aria-labelledby="link-manager-title">
        <header>
          <div><span className="manager-mark"><Plus theme="outline" size={18} /></span><h2 id="link-manager-title">{props.initial ? "编辑" : "添加"}{props.kind === "site" ? "网站" : "社交方式"}</h2></div>
          <button type="button" aria-label="关闭" disabled={saving} onClick={onClose}><CloseSmall theme="outline" size={24} /></button>
        </header>
        <form onSubmit={submit}>
          {props.kind === "site" ? <>
            <div className="manager-preview">
              <span className="preview-icon cards" style={{ color: siteDraft.iconColor }}>
                <SiteLinkIcon link={siteDraft} />
              </span>
              <span>{siteDraft.name || "网站名称"}</span>
            </div>
            <label>网址<div className="url-fetch-control"><input type="url" value={siteDraft.link} placeholder="https://example.com" autoFocus onChange={(event) => { const link = event.target.value; setSiteDraft((current) => current.iconMode === "image" ? { ...current, link, iconMode: "icon", iconValue: "ri:links-fill" } : { ...current, link }); setFaviconOptions([]); setLoadedFavicons([]); setFailedFavicons([]); }} /><button type="button" onClick={loadFavicons}><Download theme="outline" size={17} />获取图标</button></div></label>
            {faviconOptions.length > 0 && <fieldset className="favicon-results"><legend>获取结果</legend>
              <div className="favicon-candidates" aria-live="polite">
                {visibleFavicons.map((candidate) => {
                  const loaded = loadedFavicons.includes(candidate.url);
                  const selected = siteDraft.iconMode === "image" && siteDraft.iconValue === candidate.url;
                  return <button key={`${faviconRequest}-${candidate.id}`} type="button" className={selected ? "active" : ""} disabled={!loaded} aria-label={`使用${candidate.label}`} aria-pressed={selected} onClick={() => setSiteDraft({ ...siteDraft, iconMode: "image", iconValue: candidate.url })}>
                    <img src={candidate.url} alt="" width="34" height="34" referrerPolicy="no-referrer" onLoad={() => settleFavicon(candidate.url, true)} onError={() => settleFavicon(candidate.url, false)} />
                    <span>{candidate.label}</span>
                    {selected && <CheckSmall className="candidate-check" theme="filled" size={16} />}
                  </button>;
                })}
              </div>
              {faviconsSettled && visibleFavicons.length === 0 && <p className="favicon-empty" role="status">未获取到可用图标</p>}
            </fieldset>}
            <label>名称<input value={siteDraft.name} maxLength={80} placeholder="网站名称" onChange={(event) => setSiteDraft({ ...siteDraft, name: event.target.value })} /></label>
            <fieldset><legend>图标类型</legend><div className="segmented">
              <button type="button" className={siteDraft.iconMode === "icon" ? "active" : ""} onClick={() => setSiteDraft({ ...siteDraft, iconMode: "icon", iconValue: "ri:links-fill" })}>图标库</button>
              <button type="button" className={siteDraft.iconMode === "text" ? "active" : ""} onClick={() => setSiteDraft({ ...siteDraft, iconMode: "text", iconValue: "站" })}>文字图标</button>
              <button type="button" className={siteDraft.iconMode === "image" ? "active" : ""} disabled={siteDraft.iconMode !== "image" && loadedFavicons.length === 0} onClick={selectImageMode}>网站图标</button>
            </div></fieldset>
            {siteDraft.iconMode !== "image" && <fieldset><legend>图标颜色</legend><div className="color-picker">
              {COLOR_PRESETS.map((color) => <button key={color} type="button" className={siteDraft.iconColor === color ? "active" : ""} aria-label={`使用颜色 ${color}`} style={{ backgroundColor: color }} onClick={() => setSiteDraft({ ...siteDraft, iconColor: color })} />)}
              <input type="color" value={siteDraft.iconColor} aria-label="自定义图标颜色" onChange={(event) => setSiteDraft({ ...siteDraft, iconColor: event.target.value.toUpperCase() })} />
            </div></fieldset>}
            {siteDraft.iconMode === "icon" ? <><label>图标库代码<input value={siteDraft.iconValue} maxLength={80} placeholder="ri:blogger-fill" onChange={(event) => setSiteDraft({ ...siteDraft, iconValue: event.target.value })} /><small>支持 Iconify 代码，例如 ri:github-fill</small></label><div className="icon-presets" aria-label="常用网站图标">{SITE_ICON_PRESETS.map((icon) => <button key={icon} type="button" className={siteDraft.iconValue === icon ? "active" : ""} title={icon} onClick={() => setSiteDraft({ ...siteDraft, iconValue: icon })}><DynamicIcon code={icon} size={21} /></button>)}</div></> : siteDraft.iconMode === "text" ? <label>图标文字<input value={siteDraft.iconValue} maxLength={8} placeholder="1 至 4 个字符" onChange={(event) => setSiteDraft({ ...siteDraft, iconValue: event.target.value })} /></label> : null}
          </> : <>
            <div className="manager-preview social-preview"><DynamicIcon code={socialDraft.icon} size={30} /><span>{socialDraft.name || "社交方式"}</span></div>
            <label>名称<input value={socialDraft.name} maxLength={80} placeholder="例如 Github" autoFocus onChange={(event) => setSocialDraft({ ...socialDraft, name: event.target.value })} /></label>
            <label>地址<input value={socialDraft.url} maxLength={500} placeholder="https://… 或 mailto:…" onChange={(event) => setSocialDraft({ ...socialDraft, url: event.target.value })} /></label>
            <label>图标库代码<input value={socialDraft.icon} maxLength={80} placeholder="ri:github-fill" onChange={(event) => setSocialDraft({ ...socialDraft, icon: event.target.value })} /><small>可以直接填写 Iconify 图标代码</small></label>
            <div className="icon-presets" aria-label="常用社交图标">{SOCIAL_ICON_PRESETS.map((icon) => <button key={icon} type="button" className={socialDraft.icon === icon ? "active" : ""} title={icon} onClick={() => setSocialDraft({ ...socialDraft, icon })}><DynamicIcon code={icon} size={21} /></button>)}</div>
          </>}
          <footer>
            {onDelete ? <button type="button" className="delete-button" disabled={saving} onClick={onDelete}><Delete theme="outline" size={17} />删除</button> : <span />}
            <div><button type="button" className="cancel-button" disabled={saving} onClick={onClose}>取消</button><button type="submit" className="primary-button" disabled={saving}>{saving ? "保存中…" : "保存"}</button></div>
          </footer>
        </form>
      </section>
    </div>,
    document.body,
  );
}
