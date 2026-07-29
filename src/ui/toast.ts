type ToastTone = "info" | "success" | "error";

interface ToastItem {
  id: string;
  message: string;
  tone: ToastTone;
}

let items: ToastItem[] = [];
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

const push = (message: string, tone: ToastTone = "info", duration = 2800) => {
  const item = { id: crypto.randomUUID(), message, tone };
  items = [...items, item];
  emit();
  window.setTimeout(() => {
    items = items.filter(({ id }) => id !== item.id);
    emit();
  }, duration);
  return item.id;
};

export const toast = Object.assign(
  (message: string) => push(message),
  {
    info: (message: string) => push(message, "info"),
    success: (message: string) => push(message, "success"),
    error: (message: string) => push(message, "error", 3600),
  },
);

export const toastStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot() {
    return items;
  },
};

export const confirmAction = async (message: string) => window.confirm(message);
