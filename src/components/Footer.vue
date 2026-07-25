<template>
  <footer id="footer" :class="store.footerBlur ? 'blur' : null">
    <Transition name="fade" mode="out-in">
      <div v-if="!shouldShowPlayer" key="copyright" class="power">
        <span>
          &copy;&nbsp;{{ currentYear }}
          &nbsp;&amp;&nbsp;by&nbsp;
          <a :href="repositoryUrl" target="_blank" rel="noopener noreferrer">shanhee</a>
        </span>
        <span v-if="siteIcp">
          &nbsp;&amp;&nbsp;
          <a href="https://beian.miit.gov.cn" target="_blank" rel="noopener noreferrer">
            {{ siteIcp }}
          </a>
        </span>
      </div>

      <div v-else key="player" class="footer-player">
        <ProgressBar />
        <div class="lyric-line" aria-live="polite">
          <span class="lyric-text text-truncate-ellipsis">{{ currentLyric }}</span>
        </div>
      </div>
    </Transition>
  </footer>
</template>

<script setup lang="ts">
import ProgressBar from "@/components/ProgressBar.vue";
import { mainStore } from "@/store";
import { useSiteContentStore } from "@/stores/siteContent";

const store = mainStore();
const siteContent = useSiteContentStore();
const currentYear = new Date().getFullYear();
const repositoryUrl = computed(() => siteContent.profile.repositoryUrl);
const siteIcp = computed(() => siteContent.profile.icp.trim());

const shouldShowPlayer = computed(() => {
  return (
    store.footerPlayerShow &&
    store.musicIsOk &&
    store.playerStatus === "playing"
  );
});

const currentLyric = computed(() => {
  return store.playerLyric || `${store.playerTitle || "未知歌曲"} · ${store.playerArtist || "未知歌手"}`;
});
</script>

<style lang="scss" scoped>
#footer {
  position: absolute;
  bottom: 0;
  left: 0;
  z-index: 0;
  width: 100%;
  height: 46px;
  color: var(--footer-text-color);
  font-size: 1rem;
  line-height: 46px;
  text-align: center;
  white-space: nowrap;
  word-break: keep-all;

  .power {
    animation: fade 0.3s;
  }

  .footer-player {
    height: 100%;
    padding: 0 20px;
  }

  .lyric-line {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .lyric-text {
    max-width: min(960px, 88vw);
    color: var(--footer-text-color);
    font-family: "MiSans VF", sans-serif;
    font-size: 1.05rem;
    font-weight: 520;
    text-shadow: 0 0 6px rgba(from var(--footer-text-color) r g b / 0.35);
  }

  &.blur {
    background: var(--footer-background-color);
    -webkit-backdrop-filter: blur(10px);
    backdrop-filter: blur(10px);
  }

  .fade-enter-active,
  .fade-leave-active {
    transition:
      opacity 0.2s linear,
      transform 0.2s linear;
  }

  .fade-enter-from,
  .fade-leave-to {
    opacity: 0;
    transform: translateY(2px);
  }

  @media (max-width: 720px) {
    font-size: 0.9rem;

    .footer-player {
      padding: 0 12px;
    }

    .lyric-text {
      max-width: 88vw;
      font-size: 0.92rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .fade-enter-active,
    .fade-leave-active {
      transition: none;
    }
  }
}
</style>
