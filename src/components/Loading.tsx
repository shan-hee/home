import { useMainStore } from "@/store";
import { useSiteContentStore } from "@/stores/siteContent";
import "@/components/Loading.scss";

export default function Loading() {
  const loaded = useMainStore((state) => state.imgLoadStatus);
  const siteName = useSiteContentStore((state) => state.snapshot.sections.profile.siteName);
  return (
    <div id="loader-wrapper" className={loaded ? "loaded" : undefined}>
      <div className="loader">
        <div className="loader-circle" />
        <div className="loader-text">
          <span className="name">{siteName}</span>
          <span className="tip">Loading...</span>
        </div>
      </div>
      <div className="loader-section section-left" />
      <div className="loader-section section-right" />
    </div>
  );
}
