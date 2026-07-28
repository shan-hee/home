import { DndContext, DragOverlay, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import DynamicIcon from "@/components/DynamicIcon";
import ItemContextMenu, { getContextMenuPosition } from "@/components/ItemContextMenu";
import type { ContextMenuPosition } from "@/components/ItemContextMenu";
import LinkManagerDialog from "@/components/LinkManagerDialog";
import useDragCursorLock from "@/composables/useDragCursorLock";
import useLongPressContextMenu from "@/composables/useLongPressContextMenu";
import { ApiClientError } from "@/services/apiClient";
import { saveSiteContentSection } from "@/services/siteContentEditor";
import { useAuthStore } from "@/stores/auth";
import { useSiteContentStore } from "@/stores/siteContent";
import type { SocialLinkConfig } from "@/typings/siteContent";
import { toast } from "@/ui/toast";
import NavigationSafePointerSensor, { NAVIGATION_SAFE_POINTER_SENSOR_OPTIONS } from "@/utils/NavigationSafePointerSensor";
import "@/components/SocialLinks.scss";

interface SocialLinkEntry {
  id: string;
  item: SocialLinkConfig;
  index: number;
}

interface SocialContextMenu extends ContextMenuPosition {
  id: string;
}

interface DragOverlaySize {
  width: number;
  height: number;
}

interface SortableSocialLinkProps extends SocialLinkEntry {
  disabled: boolean;
  onOpenMenu: (clientX: number, clientY: number, id: string) => void;
}

const saveErrorMessage = (reason: unknown) => {
  if (reason instanceof ApiClientError && reason.status === 409) return "社交方式已在其它页面更新，请重试";
  return reason instanceof ApiClientError ? reason.message : "保存失败，请稍后再试";
};

function SortableSocialLink({ id, item, disabled, onOpenMenu }: SortableSocialLinkProps) {
  const { setNodeRef, setActivatorNodeRef, transform, transition, isDragging, listeners } = useSortable({ id, disabled });
  const longPress = useLongPressContextMenu((clientX, clientY) => onOpenMenu(clientX, clientY, id), disabled);

  const openContextMenu = (event: ReactMouseEvent) => {
    if (disabled) return;
    event.preventDefault();
    event.stopPropagation();
    onOpenMenu(event.clientX, event.clientY, id);
  };

  const openContextMenuFromKeyboard = (event: KeyboardEvent) => {
    if (disabled || (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10"))) return;
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    onOpenMenu(bounds.left + 8, bounds.bottom, id);
  };

  const startPointerInteraction = (event: ReactPointerEvent) => {
    longPress.onPointerDown(event);
    listeners?.onPointerDown?.(event);
  };

  return (
    <div
      ref={setNodeRef}
      className={`social-item${isDragging ? " is-dragging" : ""}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <a
        ref={setActivatorNodeRef}
        href={item.url}
        draggable={false}
        aria-label={item.name}
        title={item.name}
        onContextMenu={openContextMenu}
        onKeyDown={openContextMenuFromKeyboard}
        onPointerDown={startPointerInteraction}
        onPointerMove={longPress.onPointerMove}
        onPointerUp={longPress.onPointerUp}
        onPointerCancel={longPress.onPointerCancel}
        onClickCapture={longPress.onClickCapture}
      >
        <DynamicIcon className="icon" code={item.icon} size={24} />
      </a>
    </div>
  );
}

export default function SocialLinks() {
  const links = useSiteContentStore((state) => state.snapshot.sections.socialLinks);
  const authenticated = useAuthStore((state) => state.status === "authenticated" || state.status === "offline-owner");
  const [orderedLinks, setOrderedLinks] = useState<SocialLinkConfig[]>(links);
  const [editingIndex, setEditingIndex] = useState<number | "new" | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragOverlaySize, setDragOverlaySize] = useState<DragOverlaySize | null>(null);
  const [contextMenu, setContextMenu] = useState<SocialContextMenu | null>(null);
  const [saving, setSaving] = useState(false);
  const itemIdsRef = useRef(new WeakMap<SocialLinkConfig, string>());
  const nextIdRef = useRef(0);
  const sensors = useSensors(useSensor(NavigationSafePointerSensor, NAVIGATION_SAFE_POINTER_SENSOR_OPTIONS));
  const closeContextMenu = useCallback(() => setContextMenu(null), []);
  useDragCursorLock(activeId !== null);

  useEffect(() => {
    setOrderedLinks(links);
    setContextMenu(null);
  }, [links]);
  useEffect(() => {
    if (!authenticated) {
      setEditingIndex(null);
      setActiveId(null);
      setDragOverlaySize(null);
      setContextMenu(null);
    }
  }, [authenticated]);

  const entries = useMemo<SocialLinkEntry[]>(() => orderedLinks.map((item, index) => {
    let id = itemIdsRef.current.get(item);
    if (!id) {
      nextIdRef.current += 1;
      id = `social-link-${nextIdRef.current}`;
      itemIdsRef.current.set(item, id);
    }
    return { id, item, index };
  }), [orderedLinks]);

  const saveList = async (next: SocialLinkConfig[], successMessage: string) => {
    setSaving(true);
    try {
      const saved = await saveSiteContentSection("socialLinks", next);
      setOrderedLinks(saved);
      toast.success(successMessage);
      return true;
    } catch (reason) {
      setOrderedLinks(useSiteContentStore.getState().snapshot.sections.socialLinks);
      toast.error(saveErrorMessage(reason));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const submitEditor = async (value: SocialLinkConfig) => {
    if (editingIndex === null || saving) return;
    const next = editingIndex === "new"
      ? [...orderedLinks, value]
      : orderedLinks.map((item, index) => index === editingIndex ? value : item);
    const saved = await saveList(next, editingIndex === "new" ? "社交方式已添加" : "社交方式已更新");
    if (saved) setEditingIndex(null);
  };

  const deleteAt = async (index: number) => {
    if (saving || !orderedLinks[index]) return;
    const next = orderedLinks.filter((_, itemIndex) => itemIndex !== index);
    const saved = await saveList(next, "社交方式已删除");
    if (saved && editingIndex === index) setEditingIndex(null);
  };

  const openContextMenu = useCallback((clientX: number, clientY: number, id: string) => {
    if (!authenticated || saving) return;
    setContextMenu({ id, ...getContextMenuPosition(clientX, clientY) });
  }, [authenticated, saving]);

  const handleDragStart = ({ active }: DragStartEvent) => {
    setContextMenu(null);
    setActiveId(String(active.id));
    const initialRect = active.rect.current.initial;
    setDragOverlaySize(initialRect ? { width: initialRect.width, height: initialRect.height } : null);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    setDragOverlaySize(null);
    if (!over || active.id === over.id || saving) return;
    const from = entries.findIndex((entry) => entry.id === active.id);
    const to = entries.findIndex((entry) => entry.id === over.id);
    if (from < 0 || to < 0) return;
    const next = arrayMove(orderedLinks, from, to);
    setOrderedLinks(next);
    void saveList(next, "社交方式顺序已保存");
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setDragOverlaySize(null);
  };

  const activeEntry = activeId ? entries.find((entry) => entry.id === activeId) : undefined;
  const menuEntry = contextMenu ? entries.find((entry) => entry.id === contextMenu.id) : undefined;
  const sortingDisabled = !authenticated || saving;

  return (
    <div className={`social${authenticated ? " is-managing" : ""}`}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
        <SortableContext items={entries.map((entry) => entry.id)} strategy={horizontalListSortingStrategy}>
          <div className="link">
            {entries.map((entry) => (
              <SortableSocialLink
                key={entry.id}
                {...entry}
                disabled={sortingDisabled}
                onOpenMenu={openContextMenu}
              />
            ))}
            {authenticated && <button type="button" className="add-social" aria-label="添加社交方式" title="添加社交方式" disabled={saving} onClick={() => setEditingIndex("new")}><DynamicIcon code="ri:add-circle-line" size={24} /></button>}
          </div>
        </SortableContext>
        {createPortal(
          <DragOverlay
            adjustScale={false}
            style={{ pointerEvents: "none", transition: "none", willChange: "transform" }}
          >
            {activeEntry ? <div className="social-drag-overlay" style={dragOverlaySize || undefined}><DynamicIcon className="icon" code={activeEntry.item.icon} size={24} /></div> : null}
          </DragOverlay>,
          document.body,
        )}
      </DndContext>
      <LinkManagerDialog
        kind="social"
        open={editingIndex !== null}
        saving={saving}
        initial={typeof editingIndex === "number" ? orderedLinks[editingIndex] || null : null}
        onClose={() => setEditingIndex(null)}
        onSave={(value) => void submitEditor(value)}
        onDelete={typeof editingIndex === "number" ? () => void deleteAt(editingIndex) : undefined}
      />
      {contextMenu && menuEntry && (
        <ItemContextMenu
          label={`${menuEntry.item.name}管理菜单`}
          left={contextMenu.left}
          top={contextMenu.top}
          onClose={closeContextMenu}
          onEdit={() => { setContextMenu(null); setEditingIndex(menuEntry.index); }}
          onDelete={() => { setContextMenu(null); void deleteAt(menuEntry.index); }}
        />
      )}
    </div>
  );
}
