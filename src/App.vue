<template>
  <!-- 加载 -->
  <Loading />
  <!-- 壁纸 -->
  <Background @loadComplete="loadComplete" @imageLoaded="onImageLoaded" />
  <!-- 主界面 -->
  <Transition name="fade" mode="out-in">
    <main id="main" v-if="store.imgLoadStatus">
      <div class="page-container" v-show="!store.backgroundShow">
        <section class="all" v-show="!store.setOpenState">
          <MainLeft />
          <MainRight v-show="!store.boxOpenState" />
          <Box v-show="store.boxOpenState" />
        </section>
        <section class="more" v-show="store.setOpenState" @click="store.setOpenState = false">
          <MoreSet />
        </section>
      </div>
      <ThemeSwitcher v-show="!store.backgroundShow && !store.setOpenState" />
      <!-- 移动端菜单按钮 -->
      <Icon class="menu" size="24" v-show="!store.backgroundShow"
        @click="store.mobileOpenState = !store.mobileOpenState">
        <component :is="store.mobileOpenState ? CloseSmall : HamburgerButton" />
      </Icon>
      <!-- 页脚 -->
      <Transition name="fade" mode="out-in">
        <Footer class="f-ter" v-show="!store.backgroundShow && !store.setOpenState" />
      </Transition>
    </main>
  </Transition>
</template>

<script setup lang="ts">
import { helloInit, checkDays } from "@/utils/getTime.js";
import { HamburgerButton, CloseSmall } from "@icon-park/vue-next";
import { mainStore } from "@/store";
import { Icon } from "@vicons/utils";
import Loading from "@/components/Loading.vue";
import MainLeft from "@/views/Main/Left.vue";
import MainRight from "@/views/Main/Right.vue";
import Background from "@/components/Background.vue";
import ThemeSwitcher from "@/components/ThemeSwitcher.vue";
import Footer from "@/components/Footer.vue";
import Box from "@/views/Box/index.vue";
import MoreSet from "@/views/MoreSet/index.vue";
import { useTheme } from "@/composables/useTheme";
import cursorInit from "@/utils/cursor";

const store = mainStore();
const { applyBackgroundTheme } = useTheme(store);
let disposeCursor: (() => void) | null = null;

// 页面宽度
const getWidth = () => {
  store.setInnerWidth(window.innerWidth);
};

// 加载完成事件
const loadComplete = () => {
  nextTick(() => {
    // 欢迎提示
    helloInit();
    // 默哀模式
    checkDays();
  });
};

// 监听宽度变化
watch(
  () => store.innerWidth,
  (value) => {
    if (value != null && value < 721) {
      store.boxOpenState = false;
      store.setOpenState = false;
    }
  },
);

const onImageLoaded = (img: HTMLImageElement) => {
  void applyBackgroundTheme(img);
};

const handleMiddleMouse = (event: MouseEvent) => {
  if (event.button !== 1) return;
  store.backgroundShow = !store.backgroundShow;
  ElMessage({
    message: `已${store.backgroundShow ? "开启" : "退出"}壁纸展示状态`,
    grouping: true,
  });
};

onMounted(() => {
  disposeCursor = cursorInit();

  // 鼠标中键事件
  window.addEventListener("mousedown", handleMiddleMouse);

  // 监听当前页面宽度
  getWidth();
  window.addEventListener("resize", getWidth);
});

onBeforeUnmount(() => {
  disposeCursor?.();
  disposeCursor = null;
  window.removeEventListener("resize", getWidth);
  window.removeEventListener("mousedown", handleMiddleMouse);
});
</script>

<style lang="scss" scoped>
#main {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  // transform: scale(1.2);
  transition: transform 0.3s;
  animation: fade-blur-main-in 0.65s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
  animation-delay: 0.5s;

  .page-container {
    width: 100%;
    height: 100%;
    margin: 0 auto;
    padding: 0 0.5vw;

    .all {
      width: 100%;
      height: 100%;
      padding: 0 0.75rem;
      display: flex;
      flex-direction: row;
      justify-content: center;
      align-items: center;
      overflow: hidden;
    }

    .more {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: #00000080;
      -webkit-backdrop-filter: blur(20px);
      backdrop-filter: blur(20px);
      z-index: 2;
      animation: fade 0.5s;
    }


    @media (max-width: 1200px) {
      padding: 0;
    }
  }

  .menu {
    position: absolute;
    display: flex;
    justify-content: center;
    align-items: center;
    top: 84%;
    left: calc(50% - 28px);
    width: 56px;
    height: 34px;
    background: var(--card-background-color);
    -webkit-backdrop-filter: blur(10px);
    backdrop-filter: blur(10px);
    border-radius: 6px;
    transition: transform 0.3s;
    animation: fade 0.5s;

    &:active {
      transform: scale(0.95);
    }

    .i-icon {
      transform: translateY(2px);
    }

    @media (min-width: 721px) {
      display: none;
    }
  }

  @media (max-height: 650px) {
    overflow-y: auto;
    overflow-x: hidden;

    .page-container {
      height: 650px;

      .more {
        height: 650px;
        width: calc(100% + 6px);
      }
    }

    .menu {
      top: calc(650px * 0.84);
      left: calc(360px * 0.5 - 25px);

      @media (min-width: 360px) {
        left: calc(50% - 25px);
      }
    }

    .f-ter {
      top: calc(650px - 46px);

      @media (min-width: 360px) {
        padding-left: 6px;
      }
    }
  }

  @media (max-width: 360px) {
    overflow-x: auto;
    overflow: hidden;

    .page-container {
      width: 360px;
    }

    .menu {
      left: calc(360px * 0.5 - 28px);
    }

    .f-ter {
      width: 360px;
    }

    @media (min-height: 721px) {
      overflow-y: hidden;
    }
  }

}
</style>
