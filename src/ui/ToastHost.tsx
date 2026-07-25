import { useSyncExternalStore } from "react";
import { CheckOne, CloseOne, Info } from "@icon-park/react";
import { toastStore } from "@/ui/toast";
import "@/ui/toast.scss";

export default function ToastHost() {
  const items = useSyncExternalStore(toastStore.subscribe, toastStore.getSnapshot, toastStore.getSnapshot);
  return (
    <div className="toast-host" role="region" aria-live="polite" aria-label="页面提示">
      {items.map((item) => (
        <div key={item.id} className={`toast-item is-${item.tone}`}>
          {item.tone === "success" ? <CheckOne /> : item.tone === "error" ? <CloseOne /> : <Info />}
          <span>{item.message}</span>
        </div>
      ))}
    </div>
  );
}
