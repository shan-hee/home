import type { ComponentType } from "react";
import { Moon, Pic, Sun, System, Time } from "@icon-park/react";
import { useMainStore } from "@/store";
import type { MainState } from "@/typings/store";
import "@/components/ThemeSwitcher.scss";

interface ThemeOption { value: MainState["theme"]; label: string; icon: ComponentType<any> }
const options: ThemeOption[] = [
  { value: "system", label: "跟随系统", icon: System },
  { value: "time", label: "跟随时间", icon: Time },
  { value: "bg", label: "跟随背景", icon: Pic },
  { value: "light", label: "浅色模式", icon: Sun },
  { value: "dark", label: "深色模式", icon: Moon },
];

export default function ThemeSwitcher() {
  const theme = useMainStore((state) => state.theme);
  const setSetting = useMainStore((state) => state.setSetting);
  const current = options.find((option) => option.value === theme) ?? options[0]!;
  const CurrentIcon = current.icon;
  return (
    <nav className="theme-switcher" aria-label="主题切换">
      <button type="button" className="theme-trigger" aria-label={`展开主题选项，当前为${current.label}`} title={`当前主题：${current.label}`}>
        <CurrentIcon theme="outline" size="22" fill="currentColor" />
      </button>
      <div className="theme-options">
        {options.filter(({ value }) => value !== theme).map((option) => {
          const OptionIcon = option.icon;
          return <button key={option.value} type="button" className="theme-option" aria-label={option.label} title={option.label}
            onClick={() => setSetting("theme", option.value)}><OptionIcon theme="outline" size="20" fill="currentColor" /></button>;
        })}
      </div>
    </nav>
  );
}
