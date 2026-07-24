<template>
  <footer id="footer" :class="store.footerBlur ? 'blur' : null">
    <Transition name="fade" mode="out-in">
      <div v-if="!shouldShowLyrics" class="power">
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
      <div v-else class="lrc" aria-live="polite">
        <!-- 音乐进度条 -->
        <ProgressBar v-if="store.footerProgressBar" />
        <Transition name="fade" mode="out-in" v-if="useWordLyrics">
          <div class="lrc-all" :key="`word-${lyricLineKey}-${store.lyricSeekVersion}`">
            <music-one theme="filled" size="18" fill="var(--footer-music-icon-color)" />
            &nbsp;
            <Icon size="20" style="transform: rotate(-18deg);" class="paws-1"
              color="var(--footer-music-paw-icon-color)">
              <paw />
            </Icon>
            <span class="dwrc-box">
              <span class="dwrc-2 lrc-text text-truncate-ellipsis" id="dwrc-2-wrap">
                <span v-for="(item, index) in wordLyrics" :key="`lrc-over-char-${item[2]}-${item[3]}-${index}`"
                  v-html="item[4]">
                </span>
              </span>
              <span class="dwrc-1 lrc-text text-truncate-ellipsis" id="dwrc-1-wrap">
                <span v-for="(item, index) in wordLyrics" :key="`lrc-char-${item[2]}-${item[3]}-${index}`" :class="[
                  'dwrc-char',
                  item[0] && Number(item[6]) > 0 ? 'fade-in' : 'fade-in-start',
                  item[0] && Number(item[5]) > 600 && Number(item[6]) > 0 ? 'long-tone' : '',
                  item[0] && Number(item[6]) <= 0 ? 'fade-out' : '',
                  item[0] && Number(item[5]) > 600 && Number(item[6]) <= 0 ? 'long-tone-out' : '',
                  item[1] ? 'dwrc-style-s2' : 'dwrc-style-s1'
                ]" :id="`lrc-char-${item[2]}-${item[3]}`" v-html="item[4]">
                </span>
              </span>
            </span>
            <Icon size="20" style="transform: rotate(18deg);" class="paws-2" color="var(--footer-music-paw-icon-color)">
              <paw />
            </Icon>
            &nbsp;
            <music-one theme="filled" size="18" fill="var(--footer-music-icon-color)" />
          </div>
        </Transition>
        <Transition name="fade" mode="out-in" v-else>
          <!-- 逐行模块 -->
          <div class="lrc-all" :key="`line-${lyricLineKey}-${lineLyric}`">
            <music-one theme="filled" size="18" fill="var(--footer-music-icon-color)" />
            &nbsp;
            <Icon size="20" style="transform: rotate(-18deg);" class="paws-3"
              color="var(--footer-music-paw-icon-color)">
              <paw />
            </Icon>
            <span class="lrc-text text-truncate-ellipsis lrc-char">{{ lineLyric }}</span>
            <Icon size="20" style="transform: rotate(18deg);" class="paws-4" color="var(--footer-music-paw-icon-color)">
              <paw />
            </Icon>
            &nbsp;
            <music-one theme="filled" size="18" fill="var(--footer-music-icon-color)" />
          </div>
        </Transition>
      </div>
    </Transition>
  </footer>
</template>

<script setup lang="ts">
import ProgressBar from "@/components/ProgressBar.vue";
import { MusicOne } from "@icon-park/vue-next";
import { Icon } from "@vicons/utils";
import { Paw } from "@vicons/ionicons5";
import { mainStore } from "@/store";
import type { WordLyricLine, WordLyricToken } from "@/typings/store";
import { computed, nextTick, onBeforeUnmount, watch } from "vue";

const store = mainStore();
const currentYear = new Date().getFullYear();
const repositoryUrl = "https://github.com/shan-hee/home";
const siteIcp = envConfig.VITE_SITE_ICP.trim();

type FooterLyricItem = [boolean, boolean | number, number, number, string, number?, number?];

const shouldShowLyrics = computed(() => {
  return store.playerLrcShow && store.playerHasStarted && store.playerStatus !== "error";
});

const wordLyrics = computed(() => {
  return (store.playerLrc as FooterLyricItem[]).filter((item) => (
    Array.isArray(item) &&
    typeof item[4] === "string" &&
    item[4].replace(/&nbsp;/g, " ").trim().length > 0 &&
    Number.isFinite(Number(item[5])) &&
    Number.isFinite(Number(item[6]))
  ));
});

const useWordLyrics = computed(() => {
  return store.dwrcEnable && !store.dwrcLoading && store.dwrcTemp.length > 0 && wordLyrics.value.length > 0;
});

const fallbackLyric = computed(() => {
  return `${store.playerTitle || "未知歌曲"} · ${store.playerArtist || "未知歌手"}`;
});

const lineLyric = computed(() => {
  const value = (store.playerLrc as FooterLyricItem[])?.[0]?.[4];
  if (typeof value !== "string" || ["", "Loading", "Not available", "歌词加载中..."].includes(value.trim())) {
    return fallbackLyric.value;
  }
  return value.replace(/&nbsp;/g, " ");
});

const lyricLineKey = computed(() => Number((store.playerLrc as FooterLyricItem[])?.[0]?.[2]) || 0);
const activeAnimations = new Set<Animation>();

const clearLyricAnimations = () => {
  activeAnimations.forEach((animation) => animation.cancel());
  activeAnimations.clear();
};

// dwrc part
watch(() => store.getPlayerLrc, async () => {
  clearLyricAnimations();
  const isLineByLine = !store.dwrcEnable || store.dwrcTemp.length === 0 || store.dwrcLoading;
  if (!store.playerDWRCShowPro || isLineByLine || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  };
  await nextTick();
  const audio = document.querySelector('audio');
  if (!audio) {
    return;
  };
  const now = audio.currentTime * 1000;
  const dwrc2 = document.getElementsByClassName("dwrc-box")[0] as HTMLElement;
  if (!dwrc2 || dwrc2 == undefined) {
    return;
  };
  const outputDom = dwrc2.querySelectorAll("#dwrc-2-wrap span");
  const inputDom = dwrc2.querySelectorAll("#dwrc-1-wrap span");
  if (inputDom.length == 0 || outputDom.length == 0) {
    return;
  };
  const dwrcFiltered = (store.dwrcTemp as WordLyricLine[]).filter(
    (i) => i[0] < now && now < i[0] + i[1]
  );
  if (dwrcFiltered.length == 0) {
    return;
  };
  const nowLine = dwrcFiltered[dwrcFiltered.length - 1][2];
  for (let i = 0; i < nowLine.length; i++) {
    const item = nowLine[i] as WordLyricToken;
    const [[start, duration], _a, _b, _c] = item;
    const inputItem = inputDom[i] as HTMLElement;
    if (!inputItem || inputItem.hasAttribute('data-start')) {
      continue;
    };
    const computedStyle = window.getComputedStyle(inputItem);
    const width = parseFloat(computedStyle.width);
    if (isNaN(width)) {
      inputItem.removeAttribute('data-start');
      continue;
    };
    const outputItem = outputDom[i] as HTMLElement;
    const animateOptions: KeyframeAnimationOptions = {
      delay: Math.max(0, start - now),
      duration: duration,
      fill: "forwards" as FillMode,
      easing: "linear",
    };
    outputItem.style.transform = "translateY(-1px)";
    const outputAnimate = outputItem.animate(
      [
        { width: 0 },
        { width: `${width}px` },
      ],
      animateOptions,
    );
    activeAnimations.add(outputAnimate);
    outputAnimate.onfinish = () => {
      activeAnimations.delete(outputAnimate);
      outputItem.style.transform = "translateY(1px)";
      const settleAnimation = outputItem.animate(
        [
          { transform: "translateY(-1px)" },
          { transform: "translateY(1px)" },
        ],
        {
          duration: 300,
          fill: "forwards",
          easing: "linear",
        }
      );
      activeAnimations.add(settleAnimation);
      settleAnimation.onfinish = () => activeAnimations.delete(settleAnimation);
    };
    inputItem.setAttribute("data-start", "true");
  };
});

onBeforeUnmount(clearLyricAnimations);

</script>

<style lang="scss" scoped>
// 逐字模块1
.dwrc-char {
  display: inline-block;
  opacity: 1;
  -webkit-transform: translateY(1px);
  transform: translateY(1px);
  -webkit-background-clip: text;
  background-clip: text;
  font-family: MiSans VF;
  font-weight: 520;
  font-size: 1.05rem;
  transition:
    // opacity 0.3s linear,
    color 0.5s linear,
    transform 0.3s linear;

  &.fade-in-start {
    text-shadow: 0px 0px 2px var(--footer-dwrc-shadow-first-color);
    opacity: 0.6; // 初始显示的透明度
    -webkit-transform: translateY(1px);
    transform: translateY(1px);
    transition:
      color 0.5s linear,
      opacity 0.3s linear,
      transform 0.3s linear;
  }

  &.fade-in {
    opacity: 1;
    -webkit-transform: translateY(-1px);
    transform: translateY(-1px);
    animation: colorFade 0.7s ease-in-out forwards;
    transition:
      color 0.5s linear,
      opacity 0.3s linear,
      transform 0.3s linear;
  }

  &.fade-out {
    opacity: 1 !important;
    -webkit-transform: translateY(1px);
    transform: translateY(1px);
    text-shadow: 0px 0px 6px var(--footer-dwrc-shadow-first-color),
      0px 0px 2px rgba(176, 224, 230, 1),
      0px 0px 2px rgba(230, 230, 250, 1);
    transition:
      color 0.5s linear,
      opacity 0.3s linear,
      transform 0.3s linear;
  }

  &.fade-enter-active {
    animation: float-up 0.3s linear forwards;
  }

  &.long-tone {
    opacity: 1;
    -webkit-transform: translateY(-1px);
    transform: translateY(-1px);
    animation: pulse 1.2s ease-in-out forwards !important;
    transition:
      color 0.5s linear,
      opacity 0.3s linear,
      transform 0.3s linear;
  }

  &.long-tone-out {
    opacity: 1 !important;
    -webkit-transform: translateY(1px);
    transform: translateY(1px);
    animation: pulse-out 0.7s ease-in-out forwards !important;
    animation-iteration-count: 1;
    transition:
      color 0.5s linear,
      opacity 0.3s linear,
      transform 0.3s linear;
  }

  &.dwrc-style-s1 {
    opacity: 0.6;
    color: var(--footer-dwrc-start-color);
    transition:
      color 0.5s linear,
      opacity 0.3s linear,
      transform 0.3s linear;
  }

  &.dwrc-style-s2 {
    opacity: 1;
    color: var(--footer-dwrc-end-color);
    text-shadow: 0px 0px 6px var(--footer-dwrc-shadow-first-color),
      0px 0px 2px rgba(176, 224, 230, 1),
      0px 0px 2px rgba(230, 230, 250, 1);
    transition:
      color 0.5s linear,
      opacity 0.3s linear,
      transform 0.3s linear;
  }
}

@keyframes float-up {
  from {
    -webkit-transform: translateY(1px);
    transform: translateY(1px);
  }

  to {
    -webkit-transform: translateY(-1px);
    transform: translateY(-1px);
  }
}

@keyframes colorFade {
  from {
    color: var(--footer-dwrc-start-color);
    opacity: 0.6;
    text-shadow: 0px 0px 3px var(--footer-dwrc-shadow-first-color),
      0px 0px 0px rgba(176, 224, 230, 1),
      0px 0px 0px rgba(230, 230, 250, 1);
  }

  to {
    color: var(--footer-dwrc-end-color);
    opacity: 1;
    text-shadow: 0px 0px 6px var(--footer-dwrc-shadow-first-color),
      0px 0px 2px rgba(176, 224, 230, 1),
      0px 0px 2px rgba(230, 230, 250, 1);
  }
}

@keyframes pulse {
  from {
    color: var(--footer-dwrc-start-color);
    opacity: 0.6;
    text-shadow: 0px 0px 3px var(--footer-dwrc-shadow-first-color),
      0px 0px 0px rgba(255, 182, 193, 0.3),
      0px 0px 0px rgba(255, 192, 203, 0.3),
      0px 0px 0px rgba(255, 182, 193, 0.3),
      0px 0px 0px rgba(255, 192, 203, 0.3),
      0px 0px 0px rgba(255, 182, 193, 1),
      0px 0px 0px rgba(255, 192, 203, 1),
      0px 0px 0px rgba(255, 182, 193, 1),
      0px 0px 0px rgba(255, 192, 203, 1);
  }

  to {
    color: var(--footer-dwrc-end-color);
    opacity: 1;
    text-shadow: 3px 3px 7px var(--footer-dwrc-shadow-first-color),
      0px 0px 4px rgba(255, 182, 193, 0.3),
      0px 0px 4px rgba(255, 192, 203, 0.3),
      0px 0px 8px rgba(255, 182, 193, 0.3),
      0px 0px 8px rgba(255, 192, 203, 0.3),
      0px 0px 12px rgba(255, 182, 193, 1),
      0px 0px 12px rgba(255, 192, 203, 1),
      0px 0px 16px rgba(255, 182, 193, 1),
      0px 0px 16px rgba(255, 192, 203, 1);
  }
}

@keyframes pulse-out {
  from {
    color: var(--footer-dwrc-end-color);
    opacity: 1;
    text-shadow: 3px 3px 7px var(--footer-dwrc-shadow-first-color),
      0px 0px 4px rgba(255, 182, 193, 0.3),
      0px 0px 4px rgba(255, 192, 203, 0.3),
      0px 0px 8px rgba(255, 182, 193, 0.3),
      0px 0px 8px rgba(255, 192, 203, 0.3),
      0px 0px 12px rgba(255, 182, 193, 1),
      0px 0px 12px rgba(255, 192, 203, 1),
      0px 0px 16px rgba(255, 182, 193, 1),
      0px 0px 16px rgba(255, 192, 203, 1);
  }

  to {
    color: var(--footer-dwrc-start-color);
    opacity: 1;
    text-shadow: 0px 0px 3px var(--footer-dwrc-shadow-first-color),
      0px 0px 0px rgba(255, 182, 193, 0.3),
      0px 0px 0px rgba(255, 192, 203, 0.3),
      0px 0px 0px rgba(255, 182, 193, 0.3),
      0px 0px 0px rgba(255, 192, 203, 0.3),
      0px 0px 0px rgba(255, 182, 193, 1),
      0px 0px 0px rgba(255, 192, 203, 1),
      0px 0px 0px rgba(255, 182, 193, 1),
      0px 0px 0px rgba(255, 192, 203, 1);
  }
}

// 逐字模块2
#dwrc-2-wrap>span {
  display: inline-block;
  transform: translateY(1px);
  white-space: nowrap;
  overflow: hidden;
  width: 0;
  opacity: 0.8;
  transition:
    opacity 0.3s linear,
    color 0.5s linear,
    transform 0.3s linear,
    width 0.3s linear;
}

#dwrc-2-wrap {
  display: inline-block;
  position: absolute;
  width: auto;
  opacity: 0.8;
  color: var(--footer-dwrc-two-color);
  text-shadow: 0 0 6px rgba(0, 191, 255, 0.8),
    0px 0px 2px rgba(176, 224, 230, 0.8),
    0px 0px 2px rgba(230, 230, 250, 0.8);
  font-family: MiSans VF;
  font-weight: 520;
  font-size: 1.05rem;
  overflow: hidden;
  white-space: nowrap;
  transition:
    opacity 0.3s linear,
    color 0.5s linear,
    transform 0.3s linear,
    width 0.3s linear;
}

// 逐行部分
.lrc-char {
  display: inline;
  opacity: 1;
  -webkit-background-clip: text;
  background-clip: text;
  color: var(--footer-dwrc-end-color);
  text-shadow: 0 0 6px var(--footer-dwrc-shadow-first-color),
    0 0 2px rgba(255, 165, 0, 1),
    0 0 2px rgba(255, 179, 71, 1);
  font-family: MiSans VF;
  font-weight: 520;
  font-size: 1.05rem;
  transition:
    opacity 0.3s linear,
    color 0.5s linear;
}

// End

#footer {
  width: 100%;
  position: absolute;
  bottom: 0;
  left: 0;
  height: 46px;
  line-height: 46px;
  text-align: center;
  z-index: 0;
  font-size: 1rem;
  // 文字不换行
  word-break: keep-all;
  white-space: nowrap;
  color: var(--footer-font-color);

  .power {
    animation: fade 0.3s;
  }

  .lrc {
    padding: 0 20px;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    z-index: 1;
    justify-content: flex-start;

    .lrc-all {
      width: 98%;
      display: flex;
      flex-direction: row;
      justify-content: center;
      align-items: center;
      white-space: nowrap;

      .lrc-text {
        margin: 0 8px;
      }

      .i-icon {
        width: 18px;
        height: 18px;
        display: inherit;
      }

      .dwrc-box {
        justify-content: flex-start;
        position: relative;
        white-space: nowrap;
        align-items: center;
        width: auto;
        height: auto;
        z-index: 0;

        .dwrc-1,
        .dwrc-2 {
          white-space: nowrap;
        }

        .dwrc-1 {
          z-index: 1;
        }

        .dwrc-2 {
          position: absolute;
          z-index: 1000;
        }
      }
    }

    .lrc-container {
      position: relative;
      overflow: hidden;
      width: 100%;
      height: 46px;
      white-space: nowrap;
    }

    .lrc-scroll {
      display: flex;
      transition: transform 0.3s ease;
    }

    .lrc-line {
      display: inline-block;
      padding: 0 10px;
      white-space: nowrap;
      font-size: 1.05rem;
      opacity: 0.6;
      transition: opacity 0.3s, color 0.3s;
    }

    .lrc-line.active {
      opacity: 1;
      color: #fff;
    }

    .lrc-line.played {
      color: #aaa;
    }
  }

  &.blur {
    -webkit-backdrop-filter: blur(10px);
    backdrop-filter: blur(10px);
    background: var(--footer-background-color);
    font-size: 1rem;
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

  .fade-enter-to,
  .fade-leave-from {
    opacity: 1;
    transform: translateY(0);
  }

  @media (max-width: 720px) {
    font-size: 0.9rem;

    &.blur {
      font-size: 0.9rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .dwrc-char,
    #dwrc-2-wrap > span,
    .lrc-char,
    .fade-enter-active,
    .fade-leave-active {
      animation: none !important;
      transition: none !important;
      transform: none !important;
    }
  }

}
</style>
