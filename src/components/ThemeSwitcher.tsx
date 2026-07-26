import { useState, type ComponentType } from "react";
import { Bug, Effects, Lamp, Moon, Planet, Pushpin, Snowflake, Sun, System, Time } from "@icon-park/react";
import { useVisitorAppearanceStore } from "@/stores/visitorAppearance";
import type { BackgroundEffect, ThemePreference } from "@/typings/store";
import "@/components/ThemeSwitcher.scss";

interface ThemeOption { value: ThemePreference; label: string; icon: ComponentType<any> }
interface EffectOption { value: BackgroundEffect; label: string; icon: ComponentType<any> }

const themeOptions: ThemeOption[] = [
  { value: "system", label: "跟随系统", icon: System },
  { value: "time", label: "跟随时间", icon: Time },
  { value: "light", label: "浅色模式", icon: Sun },
  { value: "dark", label: "深色模式", icon: Moon },
];

const effectOptions: EffectOption[] = [
  { value: "snow", label: "雪花", icon: Snowflake },
  { value: "firefly", label: "萤火虫", icon: Bug },
  { value: "lantern", label: "灯笼", icon: Lamp },
  { value: "meteor", label: "流星", icon: Planet },
];

export default function ThemeSwitcher() {
  const theme = useVisitorAppearanceStore((state) => state.theme);
  const effectsMode = useVisitorAppearanceStore((state) => state.effectsMode);
  const selectedEffects = useVisitorAppearanceStore((state) => state.selectedEffects);
  const update = useVisitorAppearanceStore((state) => state.update);
  const [pinned, setPinned] = useState(false);
  const current = themeOptions.find((option) => option.value === theme) ?? themeOptions[0]!;
  const CurrentIcon = current.icon;
  const toggleEffect = (effect: BackgroundEffect) => {
    const currentEffects = effectsMode === "manual" ? selectedEffects : [];
    const nextEffects = currentEffects.includes(effect)
      ? currentEffects.filter((item) => item !== effect)
      : [...currentEffects, effect];
    update({ effectsMode: nextEffects.length ? "manual" : "off", selectedEffects: nextEffects });
  };

  return (
    <nav className={`theme-switcher${pinned ? " is-pinned" : ""}`} aria-label="主题与背景特效">
      <div className="theme-row">
        <button type="button" className="theme-trigger" aria-label={`展开主题与特效选项，当前主题为${current.label}`} title={`当前主题：${current.label}`}>
          <CurrentIcon theme="outline" size="22" fill="currentColor" />
        </button>
        <div className="theme-options">
          <button type="button" className={`switcher-option${pinned ? " is-active" : ""}`} aria-label={pinned ? "取消固定展开" : "固定展开"} title={pinned ? "取消固定展开" : "固定展开"} aria-pressed={pinned} onClick={(event) => { setPinned(!pinned); if (pinned) event.currentTarget.blur(); }}>
            <Pushpin theme={pinned ? "filled" : "outline"} size="19" fill="currentColor" />
          </button>
          {themeOptions.filter(({ value }) => value !== theme).map((option) => {
            const OptionIcon = option.icon;
            return <button key={option.value} type="button" className="switcher-option" aria-label={option.label} title={option.label}
              onClick={() => update({ theme: option.value })}><OptionIcon theme="outline" size="20" fill="currentColor" /></button>;
          })}
        </div>
      </div>
      <div className="effect-options" role="group" aria-label="背景特效">
        <button type="button" className={`switcher-option${effectsMode === "auto" ? " is-active" : ""}`} aria-label={effectsMode === "auto" ? "关闭自动特效" : "启用自动特效"} title="自动特效" aria-pressed={effectsMode === "auto"} onClick={() => update({ effectsMode: effectsMode === "auto" ? "off" : "auto", selectedEffects: [] })}>
          <Effects theme="outline" size="20" fill="currentColor" />
        </button>
        {effectOptions.map((option) => {
          const OptionIcon = option.icon;
          const active = effectsMode === "manual" && selectedEffects.includes(option.value);
          return <button key={option.value} type="button" className={`switcher-option${active ? " is-active" : ""}`} aria-label={`${active ? "关闭" : "开启"}${option.label}特效`} title={option.label} aria-pressed={active} onClick={() => toggleEffect(option.value)}>
            <OptionIcon theme={active ? "filled" : "outline"} size="20" fill="currentColor" />
          </button>;
        })}
      </div>
    </nav>
  );
}
