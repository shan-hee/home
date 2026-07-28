import { AddOne, Link } from "@icon-park/react";
import { DndContext, DragOverlay, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { Swiper, SwiperSlide } from "swiper/react";
import { Mousewheel, Pagination } from "swiper/modules";
import ItemContextMenu, { getContextMenuPosition } from "@/components/ItemContextMenu";
import type { ContextMenuPosition } from "@/components/ItemContextMenu";
import LinkManagerDialog from "@/components/LinkManagerDialog";
import SiteLinkIcon from "@/components/SiteLinkIcon";
import useDragCursorLock from "@/composables/useDragCursorLock";
import useLongPressContextMenu from "@/composables/useLongPressContextMenu";
import { ApiClientError } from "@/services/apiClient";
import { saveSiteContentSection } from "@/services/siteContentEditor";
import { useAuthStore } from "@/stores/auth";
import { useSiteContentStore } from "@/stores/siteContent";
import type { SiteLinkConfig } from "@/typings/siteContent";
import { toast } from "@/ui/toast";
import NavigationSafePointerSensor, { NAVIGATION_SAFE_POINTER_SENSOR_OPTIONS } from "@/utils/NavigationSafePointerSensor";
import "@/components/Links.scss";

const PAGE_SIZE = 12;

interface SiteLinkEntry {
  id: string;
  item: SiteLinkConfig;
  index: number;
}

interface LinkContextMenu extends ContextMenuPosition {
  id: string;
}

interface DragOverlaySize {
  width: number;
  height: number;
}

const siteLinkIdentity = (item: SiteLinkConfig) => JSON.stringify([
  item.name,
  item.link,
  item.iconMode,
  item.iconValue,
  item.iconColor,
]);

interface SortableSiteLinkProps extends SiteLinkEntry {
  disabled: boolean;
  onOpenMenu: (clientX: number, clientY: number, id: string) => void;
}

const saveErrorMessage = (reason: unknown) => {
  if (reason instanceof ApiClientError && reason.status === 409) return "列表已在其它页面更新，请重试";
  return reason instanceof ApiClientError ? reason.message : "保存失败，请稍后再试";
};

function SortableSiteLink({ id, item, disabled, onOpenMenu }: SortableSiteLinkProps) {
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
      className={`link-column${isDragging ? " is-dragging" : ""}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <div className="item">
        <a
          ref={setActivatorNodeRef}
          className="site-icon cards swiper-no-swiping"
          href={item.link}
          draggable={false}
          aria-label={item.name}
          style={{ color: item.iconColor }}
          title={item.name}
          onContextMenu={openContextMenu}
          onKeyDown={openContextMenuFromKeyboard}
          onPointerDown={startPointerInteraction}
          onPointerMove={longPress.onPointerMove}
          onPointerUp={longPress.onPointerUp}
          onPointerCancel={longPress.onPointerCancel}
          onClickCapture={longPress.onClickCapture}
        >
          <SiteLinkIcon link={item} />
        </a>
        <span className="name text-truncate-ellipsis">{item.name}</span>
      </div>
    </div>
  );
}

function SiteLinkDragOverlay({ item, size }: { item: SiteLinkConfig; size: DragOverlaySize | null }) {
  return (
    <div className="site-drag-overlay" style={size || undefined}>
      <span className="site-icon" style={{ color: item.iconColor }} aria-hidden="true"><SiteLinkIcon link={item} /></span>
      <span className="name text-truncate-ellipsis">{item.name}</span>
    </div>
  );
}

export default function Links() {
  const links = useSiteContentStore((state) => state.snapshot.sections.siteLinks);
  const authenticated = useAuthStore((state) => state.status === "authenticated" || state.status === "offline-owner");
  const [orderedLinks, setOrderedLinks] = useState<SiteLinkConfig[]>(links);
  const [editingIndex, setEditingIndex] = useState<number | "new" | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragOverlaySize, setDragOverlaySize] = useState<DragOverlaySize | null>(null);
  const [contextMenu, setContextMenu] = useState<LinkContextMenu | null>(null);
  const [saving, setSaving] = useState(false);
  const itemIdsRef = useRef(new Map<string, string[]>());
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

  const entries = useMemo<SiteLinkEntry[]>(() => {
    const occurrences = new Map<string, number>();
    return orderedLinks.map((item, index) => {
      const identity = siteLinkIdentity(item);
      const occurrence = occurrences.get(identity) || 0;
      occurrences.set(identity, occurrence + 1);
      const identityIds = itemIdsRef.current.get(identity) || [];
      let id = identityIds[occurrence];
      if (!id) {
        nextIdRef.current += 1;
        id = `site-link-${nextIdRef.current}`;
        identityIds[occurrence] = id;
        itemIdsRef.current.set(identity, identityIds);
      }
      return { id, item, index };
    });
  }, [orderedLinks]);

  const pages = useMemo(() => {
    const slots = entries.length + (authenticated ? 1 : 0);
    const result: SiteLinkEntry[][] = [];
    const count = Math.max(1, Math.ceil(slots / PAGE_SIZE));
    for (let pageIndex = 0; pageIndex < count; pageIndex += 1) {
      result.push(entries.slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE));
    }
    return result;
  }, [entries, authenticated]);

  const saveList = async (next: SiteLinkConfig[], successMessage: string) => {
    setSaving(true);
    try {
      const saved = await saveSiteContentSection("siteLinks", next);
      setOrderedLinks(saved);
      toast.success(successMessage);
      return true;
    } catch (reason) {
      setOrderedLinks(useSiteContentStore.getState().snapshot.sections.siteLinks);
      toast.error(saveErrorMessage(reason));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const submitEditor = async (value: SiteLinkConfig) => {
    if (editingIndex === null || saving) return;
    const next = editingIndex === "new"
      ? [...orderedLinks, value]
      : orderedLinks.map((item, index) => index === editingIndex ? value : item);
    const saved = await saveList(next, editingIndex === "new" ? "网站已添加" : "网站已更新");
    if (saved) setEditingIndex(null);
  };

  const deleteAt = async (index: number) => {
    if (saving || !orderedLinks[index]) return;
    const next = orderedLinks.filter((_, itemIndex) => itemIndex !== index);
    const saved = await saveList(next, "网站已删除");
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
    void saveList(next, "网站顺序已保存");
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setDragOverlaySize(null);
  };

  const activeEntry = activeId ? entries.find((entry) => entry.id === activeId) : undefined;
  const menuEntry = contextMenu ? entries.find((entry) => entry.id === contextMenu.id) : undefined;
  const sortingDisabled = !authenticated || saving;

  return (
    <div className={`links${authenticated ? " is-managing" : ""}`}>
      <div className="line"><Link className="iconl" size={20} /><span className="title text-truncate-ellipsis">网站列表</span></div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
        <Swiper
          modules={[Pagination, Mousewheel]}
          slidesPerView={1}
          spaceBetween={40}
          allowTouchMove={activeId === null}
          noSwiping
          pagination={{ el: ".site-pagination", clickable: true, bulletElement: "div" }}
          mousewheel
        >
          {pages.map((page, pageIndex) => {
            const showAdd = authenticated && pageIndex === pages.length - 1;
            return <SwiperSlide key={`site-${pageIndex}`}>
              <SortableContext items={page.map((entry) => entry.id)} strategy={rectSortingStrategy}>
                <div className="link-all">
                  {page.map((entry) => <SortableSiteLink key={entry.id} {...entry} disabled={sortingDisabled} onOpenMenu={openContextMenu} />)}
                  {showAdd && (
                    <div className="link-column add-column">
                      <div className="item">
                        <button
                          type="button"
                          className="site-icon cards add-link"
                          disabled={saving}
                          aria-label="添加网站"
                          title="添加网站"
                          onClick={() => setEditingIndex("new")}
                        >
                          <AddOne theme="outline" size={29} />
                        </button>
                        <span className="name">添加网站</span>
                      </div>
                    </div>
                  )}
                </div>
              </SortableContext>
            </SwiperSlide>;
          })}
          {pages.length > 1 && <div className="swiper-pagination site-pagination" />}
        </Swiper>
        {createPortal(
          <DragOverlay
            adjustScale={false}
            style={{ pointerEvents: "none", transition: "none", willChange: "transform" }}
          >
            {activeEntry ? <SiteLinkDragOverlay item={activeEntry.item} size={dragOverlaySize} /> : null}
          </DragOverlay>,
          document.body,
        )}
      </DndContext>
      <LinkManagerDialog
        kind="site"
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
