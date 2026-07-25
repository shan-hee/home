import { Delete, EditTwo } from "@icon-park/react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import "@/components/ItemContextMenu.scss";

const MENU_WIDTH = 152;
const MENU_HEIGHT = 86;
const VIEWPORT_GAP = 8;

export interface ContextMenuPosition {
  left: number;
  top: number;
}

export const getContextMenuPosition = (clientX: number, clientY: number): ContextMenuPosition => ({
  left: Math.max(VIEWPORT_GAP, Math.min(clientX, window.innerWidth - MENU_WIDTH - VIEWPORT_GAP)),
  top: Math.max(VIEWPORT_GAP, Math.min(clientY, window.innerHeight - MENU_HEIGHT - VIEWPORT_GAP)),
});

interface ItemContextMenuProps extends ContextMenuPosition {
  label: string;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function ItemContextMenu({ label, left, top, onClose, onEdit, onDelete }: ItemContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const closeOnPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    };
    const closeOnKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnKeyDown);
    window.addEventListener("resize", onClose);
    window.addEventListener("scroll", onClose, true);
    const focusFrame = window.requestAnimationFrame(() => menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus());
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnKeyDown);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("scroll", onClose, true);
      window.cancelAnimationFrame(focusFrame);
    };
  }, [onClose]);

  return createPortal(
    <div ref={menuRef} className="item-context-menu" role="menu" aria-label={label} style={{ left, top }} onContextMenu={(event) => event.preventDefault()}>
      <button type="button" role="menuitem" onClick={onEdit}><EditTwo theme="outline" size={17} />编辑</button>
      <button type="button" role="menuitem" className="danger" onClick={onDelete}><Delete theme="outline" size={17} />删除</button>
    </div>,
    document.body,
  );
}
