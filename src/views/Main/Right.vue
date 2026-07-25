<template>
  <div :class="store.mobileOpenState ? 'right' : 'right is-hidden'">
    <button
      v-if="!ownerPanelOpen"
      type="button"
      class="owner-edit"
      aria-label="打开所有者设置"
      @click="openOwnerPanel"
    >
      <EditTwo theme="outline" size="22" />
    </button>
    <Transition name="fade" mode="out-in">
      <div v-if="!ownerPanelOpen" key="home" class="right-home">
        <!-- 移动端 Logo -->
        <div class="logo text-truncate-ellipsis" @click="store.mobileFuncState = !store.mobileFuncState">
          <span class="bg">{{ siteUrl[0] }}</span>
          <span class="sm">.{{ siteUrl[1] }}</span>
        </div>
        <!-- 功能区 -->
        <Func />
        <!-- 网站链接 -->
        <Link />
      </div>
      <OwnerPanel v-else key="owner" @close="ownerPanelOpen = false" />
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { EditTwo } from "@icon-park/vue-next";
import { mainStore } from "@/store";
import { useAuthStore } from "@/stores/auth";
import { useSiteContentStore } from "@/stores/siteContent";
import OwnerPanel from "@/components/OwnerPanel.vue";
import Func from "@/views/Func/index.vue";
import Link from "@/components/Links.vue";
const store = mainStore();
const auth = useAuthStore();
const siteContent = useSiteContentStore();
const ownerPanelOpen = ref(false);

const openOwnerPanel = () => {
  ownerPanelOpen.value = true;
  if (auth.status === "checking") void auth.checkSession();
};

// 站点链接
const siteUrl = computed(() => {
  const url = siteContent.profile.siteUrl;
  if (!url) return "imsyy.top".split(".");
  let urlFormat = url;
  // 判断协议前缀
  urlFormat = urlFormat.replace(/^(https?:\/\/)/, "");
  const domainOnly = urlFormat.split('/')[0];
  const hostname = domainOnly.split(':')[0];
  return hostname.split(".");
});
</script>

<style lang="scss" scoped>
.right {
  // flex: 1 0 0%;
  position: relative;
  width: 50%;
  margin-left: 0.75rem;

  .owner-edit {
    position: absolute;
    top: 50%;
    left: -38px;
    z-index: 1;
    width: 34px;
    height: 34px;
    display: grid;
    place-items: center;
    padding: 0;
    border: 0;
    color: var(--text-color);
    background: transparent;
    cursor: pointer;
    opacity: 0.42;
    transform: translateY(-50%);
    transition: opacity 0.2s, transform 0.2s;

    &:hover,
    &:focus-visible {
      opacity: 0.78;
    }

    &:active {
      transform: translateY(-50%) scale(0.9);
    }
  }

  .right-home {
    width: 100%;
  }

  .logo {
    width: 100%;
    font-family: "Pacifico-Regular";
    color: var(--background-color);
    font-size: 2.25rem;
    position: fixed;
    top: 6%;
    left: 0;
    text-align: center;
    transition: transform 0.3s;
    animation: fade 0.5s;
    &:active {
      transform: scale(0.95);
    }
    @media (min-width: 721px) {
      display: none;
    }
    @media (max-height: 720px) {
      width: calc(100% + 6px);
      top: 43.26px; // 721px * 0.06
    }
    @media (max-width: 390px) {
        width: 391px;
    }
  }
  @media (max-width: 720px) {
    margin-left: 0;
    width: 100%;

    .owner-edit {
      position: fixed;
      top: 6%;
      right: 54px;
      left: auto;
      transform: none;

      &:active {
        transform: scale(0.9);
      }
    }

    &.is-hidden {
      display: none;
    }
  }
}
</style>
