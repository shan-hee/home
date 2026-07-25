<template>
  <!-- 社交链接 -->
  <div class="social">
    <div class="link">
      <a v-for="item in socialLinks" :key="item.name" :href="item.url" target="_blank"
        rel="noopener noreferrer" :aria-label="item.name"
        @mouseenter="socialTip = item.tip" @mouseleave="socialTip = '通过这里联系我吧'">
        <span class="icon" :class="item.iconClass" aria-hidden="true" />
      </a>
    </div>
    <span class="tip">{{ socialTip }}</span>
  </div>
</template>

<script setup lang="ts">
import { useSiteContentStore } from "@/stores/siteContent";

const socialIconClasses = {
  github: "i-ri-github-fill",
  bilibili: "i-ri-bilibili-fill",
  qq: "i-ri-qq-fill",
  mail: "i-ri-mail-fill",
  "twitter-x": "i-ri-twitter-x-fill",
  telegram: "i-ri-telegram-fill",
} as const;

const siteContent = useSiteContentStore();
const socialLinks = computed(() => siteContent.sections.socialLinks
  .filter((item) => item.enabled)
  .map(({ icon, ...item }) => ({
    ...item,
    iconClass: socialIconClasses[icon],
  })));

// 社交链接提示
const socialTip = ref("通过这里联系我吧");
</script>

<style lang="scss" scoped>
.social {
  margin-top: 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 460px;
  width: 100%;
  height: 42px;
  background-color: transparent;
  border-radius: 6px;
  -webkit-backdrop-filter: blur(0);
  backdrop-filter: blur(0);
  animation: fade 0.5s;
  transition:
    background-color 0.3s,
    backdrop-filter 0.3s;

  @media (max-width: 840px) {
    max-width: 100%;
    justify-content: center;

    .link {
      justify-content: space-evenly !important;
      width: 90%;
    }

    .tip {
      display: none !important;
      color: var(--social-font-color);
    }
  }

  .link {
    display: flex;
    align-items: center;
    justify-content: center;

    a {
      display: flex;
      align-items: center;
      color: var(--social-font-color);

      &:focus-visible {
        border-radius: 4px;
        outline: 2px solid currentColor;
        outline-offset: 4px;
      }

      .icon {
        display: inline-block;
        width: 24px;
        height: 24px;
        margin: 0 12px;
        transition: transform 0.3s;
      }

      &:hover .icon {
        transform: scale(1.1);
      }

      &:active .icon {
        transform: scale(1);
      }
    }
  }

  .tip {
    color: var(--social-font-color);
    display: none;
    margin-right: 12px;
    animation: fade 0.5s;
  }

  @media (min-width: 768px) {
    &:hover {
      background-color: var(--social-background-color);
      -webkit-backdrop-filter: blur(5px);
      backdrop-filter: blur(5px);

      .tip {
        display: block;
        color: var(--social-font-color);
      }
    }
  }
}
</style>
