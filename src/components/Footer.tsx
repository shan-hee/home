import ProgressBar from "@/components/ProgressBar";
import { useMainStore } from "@/store";
import { useSiteContentStore } from "@/stores/siteContent";
import "@/components/Footer.scss";

export default function Footer({ className = "" }: { className?: string }) {
  const blur = useSiteContentStore((state) => state.snapshot.sections.preferences.footerBlur);
  const footerPlayer = useMainStore((state) => state.footerPlayerShow);
  const musicReady = useMainStore((state) => state.musicIsOk);
  const status = useMainStore((state) => state.playerStatus);
  const lyric = useMainStore((state) => state.playerLyric);
  const title = useMainStore((state) => state.playerTitle);
  const artist = useMainStore((state) => state.playerArtist);
  const profile = useSiteContentStore((state) => state.snapshot.sections.profile);
  const showPlayer = footerPlayer && musicReady && status === "playing";
  return (
    <footer id="footer" className={`${blur ? "blur " : ""}${className}`.trim()}>
      {!showPlayer ? (
        <div className="power">
          <span>&copy;&nbsp;{new Date().getFullYear()}&nbsp;&amp;&nbsp;by&nbsp;<a href={profile.repositoryUrl} target="_blank" rel="noopener noreferrer">shanhee</a></span>
          {profile.icp.trim() && <span>&nbsp;&amp;&nbsp;<a href="https://beian.miit.gov.cn" target="_blank" rel="noopener noreferrer">{profile.icp.trim()}</a></span>}
        </div>
      ) : (
        <div className="footer-player"><ProgressBar /><div className="lyric-line" aria-live="polite"><span className="lyric-text text-truncate-ellipsis">{lyric || `${title || "未知歌曲"} · ${artist || "未知歌手"}`}</span></div></div>
      )}
    </footer>
  );
}
