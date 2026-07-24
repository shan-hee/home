<template>
  <nav class="theme-switcher" aria-label="主题切换">
    <button
      type="button"
      class="theme-trigger"
      :aria-label="`展开主题选项，当前为${currentThemeLabel}`"
      :title="`当前主题：${currentThemeLabel}`"
    >
      <component :is="currentThemeOption.icon" theme="outline" size="22" fill="currentColor" />
    </button>
    <div class="theme-options">
      <button
        v-for="option in availableThemeOptions"
        :key="option.value"
        type="button"
        class="theme-option"
        :aria-label="option.label"
        :title="option.label"
        @click="store.theme = option.value"
      >
        <component :is="option.icon" theme="outline" size="20" fill="currentColor" />
      </button>
    </div>
  </nav>
</template>

<script setup lang="ts">
import type { Component } from "vue";
import { Moon, Pic, Sun, System, Time } from "@icon-park/vue-next";
import { mainStore } from "@/store";
import type { MainState } from "@/typings/store";

interface ThemeOption {
  value: MainState["theme"];
  label: string;
  icon: Component;
}

const store = mainStore();

const themeOptions: ThemeOption[] = [
  { value: "system", label: "跟随系统", icon: System },
  { value: "time", label: "跟随时间", icon: Time },
  { value: "bg", label: "跟随背景", icon: Pic },
  { value: "light", label: "浅色模式", icon: Sun },
  { value: "dark", label: "深色模式", icon: Moon },
];

const currentThemeOption = computed(() => (
  themeOptions.find((option) => option.value === store.theme) ?? themeOptions[0]!
));

const currentThemeLabel = computed(() => currentThemeOption.value.label);

const availableThemeOptions = computed(() => (
  themeOptions.filter((option) => option.value !== store.theme)
));
</script>

<style lang="scss" scoped>
.theme-switcher {
  position: fixed;
  top: 18px;
  right: 18px;
  z-index: 3;
  height: 42px;
  padding: 3px;
  display: flex;
  flex-direction: row-reverse;
  align-items: center;
  color: var(--text-color);

  &:hover,
  &:focus-within {
    .theme-options {
      width: 152px;
      opacity: 1;
      visibility: visible;
      pointer-events: auto;
      transform: translateX(0);
    }
  }
}

.theme-trigger,
.theme-option {
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  padding: 0;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 6px;
  color: inherit;
  background: transparent;
  cursor: pointer;
  transition: opacity 0.2s ease, transform 0.2s ease;

  &:hover,
  &:focus-visible {
    opacity: 0.18;
    outline: none;
  }

  &:active {
    transform: scale(0.9);
  }
}

.theme-trigger {
  opacity: 0.28;
}

.theme-options {
  width: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  overflow: hidden;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transform: translateX(8px);
  transition:
    width 0.28s ease,
    opacity 0.2s ease,
    visibility 0.2s ease,
    transform 0.28s ease;
}

.theme-option {
  opacity: 0.4;
}

@media (max-width: 720px) {
  .theme-switcher {
    top: 14px;
    right: 14px;

    &:hover,
    &:focus-within {
      .theme-options {
        width: 146px;
      }
    }
  }

  .theme-options {
    gap: 2px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .theme-switcher,
  .theme-options,
  .theme-trigger,
  .theme-option {
    transition: none;
  }
}
</style>
