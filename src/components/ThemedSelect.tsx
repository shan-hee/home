import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { RefObject } from "react";
import { createPortal } from "react-dom";
import { Search } from "@icon-park/react";
import "@/components/ThemedSelect.scss";

export interface ThemedSelectOption {
  value: string;
  label: string;
  imageUrl?: string;
  description?: string;
  disabled?: boolean;
}

interface ThemedSelectPosition {
  left: number;
  width: number;
  maxHeight: number;
  top?: number;
  bottom?: number;
}

interface ThemedSelectProps {
  value: string;
  options: readonly ThemedSelectOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  menuAnchorRef?: RefObject<HTMLElement | null>;
}

export default function ThemedSelect({ value, options, onChange, ariaLabel, className = "", disabled = false, searchable = false, searchPlaceholder = "搜索选项", menuAnchorRef }: ThemedSelectProps) {
  const listboxId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const selectedOption = useRef<HTMLButtonElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<ThemedSelectPosition | null>(null);
  const [query, setQuery] = useState("");
  const current = options.find((option) => option.value === value) ?? options[0];
  const optionCount = options.length;
  const unavailable = disabled || optionCount === 0;
  const mediaOptions = options.some((option) => option.imageUrl || option.description);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleOptions = normalizedQuery
    ? options.filter((option) => `${option.label} ${option.description || ""} ${option.value}`.toLocaleLowerCase().includes(normalizedQuery))
    : options;

  const positionMenu = useCallback(() => {
    const element = menuAnchorRef?.current ?? trigger.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const viewportGap = 8;
    const menuGap = 5;
    const optionHeight = mediaOptions ? 58 : 36;
    const desiredHeight = Math.min(420, optionCount * optionHeight + (searchable ? 42 : 0) + 8);
    const roomBelow = window.innerHeight - rect.bottom - viewportGap - menuGap;
    const roomAbove = rect.top - viewportGap - menuGap;
    const openAbove = roomBelow < desiredHeight && roomAbove > roomBelow;
    const width = Math.min(rect.width, window.innerWidth - viewportGap * 2);
    const left = Math.min(Math.max(viewportGap, rect.left), window.innerWidth - viewportGap - width);
    const maxHeight = Math.min(desiredHeight, Math.max(80, openAbove ? roomAbove : roomBelow));
    setPosition(openAbove
      ? { left, width, maxHeight, bottom: window.innerHeight - rect.top + menuGap }
      : { left, width, maxHeight, top: rect.bottom + menuGap });
  }, [mediaOptions, menuAnchorRef, optionCount, searchable]);

  const close = useCallback((restoreFocus = false) => {
    setOpen(false);
    setPosition(null);
    setQuery("");
    if (restoreFocus) window.setTimeout(() => trigger.current?.focus());
  }, []);

  const show = () => {
    if (unavailable) return;
    positionMenu();
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    positionMenu();
    window.setTimeout(() => {
      selectedOption.current?.scrollIntoView({ block: "nearest" });
      if (searchable) searchInput.current?.focus();
      else selectedOption.current?.focus();
    });
    const closeOnPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!trigger.current?.contains(target) && !menu.current?.contains(target)) close();
    };
    const repositionOnScroll = (event: Event) => {
      if (!menu.current?.contains(event.target as Node)) positionMenu();
    };
    document.addEventListener("pointerdown", closeOnPointerDown);
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", repositionOnScroll, true);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", repositionOnScroll, true);
    };
  }, [close, open, positionMenu, searchable]);

  useEffect(() => {
    if (unavailable) close();
  }, [close, unavailable]);

  const moveFocus = (direction: 1 | -1) => {
    const items = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
    if (!items.length) return;
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const nextIndex = index < 0 ? direction === 1 ? 0 : items.length - 1 : (index + direction + items.length) % items.length;
    items[nextIndex]?.focus();
  };

  return <div className={`themed-select${className ? ` ${className}` : ""}`}>
    <button ref={trigger} type="button" className="themed-select-trigger" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listboxId : undefined} disabled={unavailable} onClick={() => open ? close() : show()} onKeyDown={(event) => {
      if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
        event.preventDefault();
        show();
      }
    }}>
      <span>{current?.label || "请选择"}</span><span className="themed-select-arrow" aria-hidden="true" />
    </button>
    {open && position && createPortal(<div ref={menu} className="themed-select-menu" style={position} onKeyDown={(event) => {
      if (event.key === "Escape") { event.preventDefault(); close(true); }
      else if (event.key === "ArrowDown") { event.preventDefault(); moveFocus(1); }
      else if (event.key === "ArrowUp") { event.preventDefault(); moveFocus(-1); }
      else if (event.target instanceof HTMLButtonElement && event.key === "Home") { event.preventDefault(); menu.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus(); }
      else if (event.target instanceof HTMLButtonElement && event.key === "End") { event.preventDefault(); Array.from(menu.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []).at(-1)?.focus(); }
    }}>
      {searchable && <label className="themed-select-search"><Search theme="outline" size="16" /><input ref={searchInput} value={query} aria-label={searchPlaceholder} placeholder={searchPlaceholder} onChange={(event) => setQuery(event.target.value)} /></label>}
      <div id={listboxId} className="themed-select-options" role="listbox" aria-label={ariaLabel}>
      {visibleOptions.map((option) => {
        const selected = option.value === value;
        const media = Boolean(option.imageUrl || option.description);
        return <button ref={selected ? selectedOption : undefined} key={option.value} type="button" role="option" aria-selected={selected} className={`${selected ? "is-selected" : ""}${media ? " has-media" : ""}`} disabled={option.disabled} onClick={() => { onChange(option.value); close(true); }}>{media && (option.imageUrl ? <img src={option.imageUrl} referrerPolicy="no-referrer" alt="" loading="lazy" /> : <span className="themed-select-image-placeholder" aria-hidden="true" />)}{media ? <span className="themed-select-option-copy"><strong>{option.label}</strong><small>{option.description}</small></span> : <span>{option.label}</span>}<span className="themed-select-check" aria-hidden="true">✓</span></button>;
      })}
      {visibleOptions.length === 0 && <p className="themed-select-empty">没有匹配的选项</p>}
      </div>
    </div>, document.body)}
  </div>;
}
