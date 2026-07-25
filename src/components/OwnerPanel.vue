<template>
  <section
    :class="['owner-panel', 'cards', { 'is-login': !auth.authenticated }]"
    aria-live="polite"
  >
    <header class="panel-header">
      <button type="button" class="icon-button" aria-label="返回主页内容" @click="emit('close')">
        <BackOne theme="outline" size="22" />
      </button>
      <span>{{ auth.authenticated ? "设置" : "所有者登录" }}</span>
      <button
        v-if="auth.authenticated"
        type="button"
        class="icon-button"
        aria-label="退出登录"
        :disabled="loggingOut"
        @click="logout"
      >
        <Logout theme="outline" size="21" />
      </button>
      <span v-else class="header-spacer" aria-hidden="true" />
    </header>

    <div v-if="auth.status === 'checking'" class="panel-state">
      正在确认登录状态…
    </div>

    <form v-else-if="!auth.authenticated" class="login-form" @submit.prevent="login">
      <div class="password-control" :class="{ invalid: Boolean(errorMessage) }">
        <input
          id="owner-password"
          ref="passwordInput"
          v-model="password"
          type="password"
          autocomplete="off"
          placeholder="请输入密码"
          aria-label="所有者密码"
          :disabled="submitting"
          :aria-invalid="Boolean(errorMessage)"
          :aria-describedby="errorMessage ? 'owner-login-error' : undefined"
        />
        <button type="submit" aria-label="登录" :disabled="submitting || !password">
          <ArrowRight theme="outline" size="21" />
        </button>
      </div>
      <p v-if="errorMessage" id="owner-login-error" class="login-error">{{ errorMessage }}</p>
    </form>

    <div v-else class="settings-content">
      <div class="session-summary">
        <span>{{ sync.statusLabel }}</span>
        <small>{{ auth.device?.name || "当前设备" }}</small>
      </div>
      <nav class="settings-tabs" aria-label="设置分类">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          type="button"
          :class="{ active: activeTab === tab.key }"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
        </button>
      </nav>
      <Set v-if="activeTab === 'preferences'" />
      <ContentSettings v-else-if="activeTab === 'content'" />
      <SecuritySettings v-else @logged-out="activeTab = 'preferences'" />
    </div>
  </section>
</template>

<script setup lang="ts">
import { ArrowRight, BackOne, Logout } from "@icon-park/vue-next";
import { ApiClientError } from "@/services/apiClient";
import { useAuthStore } from "@/stores/auth";
import { useSettingsSyncStore } from "@/stores/settingsSync";
import Set from "@/components/Set.vue";
import ContentSettings from "@/components/ContentSettings.vue";
import SecuritySettings from "@/components/SecuritySettings.vue";

const emit = defineEmits<{
  close: [];
}>();
const auth = useAuthStore();
const sync = useSettingsSyncStore();
const activeTab = ref<"preferences" | "content" | "security">("preferences");
const tabs = [
  { key: "preferences" as const, label: "偏好" },
  { key: "content" as const, label: "内容" },
  { key: "security" as const, label: "设备" },
];
const password = ref("");
const errorMessage = ref("");
const submitting = ref(false);
const loggingOut = ref(false);
const passwordInput = ref<HTMLInputElement | null>(null);

const focusPassword = () => {
  void nextTick(() => passwordInput.value?.focus());
};

const login = async () => {
  if (!password.value || submitting.value) return;
  submitting.value = true;
  errorMessage.value = "";
  try {
    await auth.login(password.value);
    password.value = "";
  } catch (error) {
    password.value = "";
    errorMessage.value = error instanceof ApiClientError
      ? error.message
      : "登录服务暂时不可用";
    focusPassword();
  } finally {
    submitting.value = false;
  }
};

const logout = async () => {
  if (loggingOut.value) return;
  loggingOut.value = true;
  try {
    await auth.logout();
    activeTab.value = "preferences";
    focusPassword();
  } catch (error) {
    errorMessage.value = error instanceof ApiClientError
      ? error.message
      : "退出失败，请稍后再试";
  } finally {
    loggingOut.value = false;
  }
};

watch(password, (value) => {
  if (value) errorMessage.value = "";
});

onMounted(() => {
  if (!auth.authenticated) focusPassword();
});
</script>

<style lang="scss" scoped>
.owner-panel {
  width: 100%;
  height: min(610px, 76vh);
  min-height: 430px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: fade 0.35s;

  &:hover {
    transform: none;
  }

  &.is-login {
    width: min(440px, 100%);
    height: 240px;
    min-height: 0;
    margin: 0 auto;
  }
}

.panel-header {
  min-height: 54px;
  display: grid;
  grid-template-columns: 40px 1fr 40px;
  align-items: center;
  padding: 7px 10px;
  text-align: center;
  font-size: 1rem;
}

.icon-button,
.password-control button {
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  color: inherit;
  background: transparent;
  cursor: pointer;
  opacity: 0.64;
  transition: opacity 0.2s, transform 0.2s;

  &:hover,
  &:focus-visible {
    opacity: 1;
  }

  &:active {
    transform: scale(0.92);
  }

  &:disabled {
    cursor: wait;
    opacity: 0.3;
  }
}

.icon-button,
.header-spacer {
  width: 40px;
  height: 40px;
}

.panel-state,
.login-form {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.panel-state {
  opacity: 0.66;
}

.login-form {
  width: min(340px, calc(100% - 40px));
  margin: 0 auto;
  flex-direction: column;
  align-items: stretch;
}

.password-control {
  height: 44px;
  display: grid;
  grid-template-columns: 1fr 44px;
  border: 1px solid rgba(from currentColor r g b / 0.24);
  border-radius: 9px;
  background: rgba(from currentColor r g b / 0.08);
  transition: border-color 0.2s, background 0.2s;

  &:focus-within {
    border-color: rgba(from currentColor r g b / 0.55);
    background: rgba(from currentColor r g b / 0.12);
  }

  &.invalid {
    border-color: rgb(255 135 135 / 72%);
  }

  input {
    min-width: 0;
    padding: 0 4px 0 14px;
    border: 0;
    outline: 0;
    color: inherit;
    background: transparent;
    font: inherit;

    &::placeholder {
      color: inherit;
      opacity: 0.45;
    }
  }
}

.login-error {
  min-height: 20px;
  margin: 9px 2px 0;
  font-size: 0.76rem;
  color: rgb(255 165 165);
}

.settings-content {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 14px;
}

.session-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 4px 12px;
  font-size: 0.84rem;

  small {
    opacity: 0.58;
  }
}

.settings-tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 5px;
  margin-bottom: 12px;
  padding: 3px;
  border-radius: 8px;
  background: rgba(from currentColor r g b / 0.055);

  button {
    min-height: 31px;
    padding: 0 8px;
    border: 0;
    border-radius: 6px;
    color: inherit;
    background: transparent;
    cursor: pointer;
    opacity: 0.52;
    transition: opacity 0.2s, background 0.2s;

    &.active,
    &:hover,
    &:focus-visible {
      opacity: 0.92;
      background: rgba(from currentColor r g b / 0.09);
    }
  }
}

@media (max-width: 720px) {
  .owner-panel {
    height: min(600px, 72vh);
    min-height: 400px;
  }
}
</style>
