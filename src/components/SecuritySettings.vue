<template>
  <div class="security-settings">
    <section class="security-section">
      <div class="section-heading">
        <div>
          <strong>登录设备</strong>
          <small>撤销设备会立即注销该设备上的所有会话</small>
        </div>
        <button type="button" class="text-button" :disabled="loading" @click="loadData">
          {{ loading ? "加载中…" : "刷新" }}
        </button>
      </div>
      <p v-if="errorMessage" class="inline-error">{{ errorMessage }}</p>
      <div v-else-if="!devices.length && loading" class="empty-state">正在读取设备…</div>
      <div v-else-if="!devices.length" class="empty-state">暂无设备记录</div>
      <article v-for="device in devices" :key="device.id" class="device-row">
        <div>
          <strong>{{ device.name }} <span v-if="device.current">当前设备</span></strong>
          <small>最近使用 {{ formatTime(device.lastSeenAt) }} · {{ device.activeSessions }} 个活动会话</small>
        </div>
        <button
          type="button"
          class="danger-button"
          :disabled="revokingId === device.id || Boolean(device.revokedAt)"
          @click="revokeDevice(device)"
        >
          {{ device.revokedAt ? "已撤销" : revokingId === device.id ? "撤销中…" : "撤销" }}
        </button>
      </article>
    </section>

    <section class="security-section">
      <div class="section-heading">
        <div>
          <strong>会话安全</strong>
          <small>所有者密码只存在于 Cloudflare Secret，不会写入 D1</small>
        </div>
      </div>
      <p class="security-note">如需修改密码，请更新部署环境中的 <code>OWNER_PASSWORD</code>，重新加载服务后注销全部设备，使旧会话立即失效。</p>
      <button type="button" class="logout-all" :disabled="loggingOutAll" @click="logoutEverywhere">
        {{ loggingOutAll ? "正在注销…" : "注销全部设备" }}
      </button>
      <p v-if="actionMessage" :class="actionError ? 'inline-error' : 'action-message'">{{ actionMessage }}</p>
    </section>

    <section class="security-section">
      <div class="section-heading">
        <div>
          <strong>最近操作</strong>
          <small>最多显示最近 100 条内容与安全审计记录</small>
        </div>
      </div>
      <div v-if="!auditEntries.length" class="empty-state">暂无审计记录</div>
      <ol v-else class="audit-list">
        <li v-for="entry in auditEntries" :key="entry.id">
          <div>
            <strong>{{ actionName(entry.action) }}</strong>
            <span>{{ entry.target }}</span>
          </div>
          <time>{{ formatTime(entry.createdAt) }}</time>
        </li>
      </ol>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ApiClientError, requestJson } from "@/services/apiClient";
import { useAuthStore } from "@/stores/auth";

interface DeviceRecord {
  id: string;
  name: string;
  userAgent: string;
  createdAt: string;
  lastSeenAt: string;
  revokedAt: string | null;
  activeSessions: number;
  current: boolean;
}

interface AuditEntry {
  id: number;
  action: string;
  target: string;
  details: unknown;
  deviceId: string | null;
  createdAt: string;
}

const emit = defineEmits<{ loggedOut: [] }>();
const auth = useAuthStore();
const devices = ref<DeviceRecord[]>([]);
const auditEntries = ref<AuditEntry[]>([]);
const loading = ref(false);
const revokingId = ref("");
const loggingOutAll = ref(false);
const errorMessage = ref("");
const actionMessage = ref("");
const actionError = ref(false);

const handleUnauthorized = (error: unknown) => {
  if (error instanceof ApiClientError && error.status === 401) {
    auth.expireSession();
    emit("loggedOut");
    return true;
  }
  return false;
};

const loadData = async () => {
  if (loading.value) return;
  loading.value = true;
  errorMessage.value = "";
  try {
    const [deviceResponse, auditResponse] = await Promise.all([
      requestJson<{ devices: DeviceRecord[] }>("/api/admin/devices"),
      requestJson<{ entries: AuditEntry[] }>("/api/admin/audit"),
    ]);
    devices.value = deviceResponse.devices;
    auditEntries.value = auditResponse.entries;
  } catch (error) {
    if (handleUnauthorized(error)) return;
    errorMessage.value = error instanceof ApiClientError ? error.message : "设备信息暂时无法读取";
  } finally {
    loading.value = false;
  }
};

const revokeDevice = async (device: DeviceRecord) => {
  if (revokingId.value) return;
  revokingId.value = device.id;
  actionMessage.value = "";
  try {
    const response = await requestJson<{ currentSessionRevoked: boolean }>(
      `/api/admin/devices/${encodeURIComponent(device.id)}`,
      { method: "DELETE" },
    );
    if (response.currentSessionRevoked) {
      auth.expireSession();
      emit("loggedOut");
      return;
    }
    await loadData();
  } catch (error) {
    if (handleUnauthorized(error)) return;
    actionError.value = true;
    actionMessage.value = error instanceof ApiClientError ? error.message : "撤销设备失败";
  } finally {
    revokingId.value = "";
  }
};

const logoutEverywhere = async () => {
  if (loggingOutAll.value) return;
  loggingOutAll.value = true;
  actionMessage.value = "";
  actionError.value = false;
  try {
    await auth.logoutAll();
    emit("loggedOut");
  } catch (error) {
    if (handleUnauthorized(error)) return;
    actionError.value = true;
    actionMessage.value = error instanceof ApiClientError ? error.message : "注销全部设备失败";
  } finally {
    loggingOutAll.value = false;
  }
};

const formatTime = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const actionNames: Record<string, string> = {
  "auth.login": "登录",
  "auth.logout": "退出登录",
  "auth.logout_all": "注销全部设备",
  "device.revoke": "撤销设备",
  "content.update": "更新站点内容",
};
const actionName = (action: string) => actionNames[action] || action;

onMounted(() => void loadData());
</script>

<style lang="scss" scoped>
.security-settings {
  display: grid;
  gap: 14px;
  color: var(--text-color);
}

.security-section {
  padding: 13px;
  border: 1px solid rgba(from currentColor r g b / 0.11);
  border-radius: 9px;
  background: rgba(from currentColor r g b / 0.035);
}

.section-heading,
.device-row,
.audit-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.section-heading {
  margin-bottom: 10px;

  div,
  .device-row div {
    display: grid;
    gap: 3px;
  }

  small {
    font-size: 0.71rem;
    opacity: 0.54;
  }
}

.device-row {
  padding: 10px 0;
  border-top: 1px solid rgba(from currentColor r g b / 0.08);

  div {
    min-width: 0;
    display: grid;
    gap: 4px;
  }

  strong {
    font-size: 0.8rem;

    span {
      margin-left: 5px;
      padding: 1px 5px;
      border-radius: 99px;
      font-size: 0.62rem;
      background: rgba(from currentColor r g b / 0.1);
    }
  }

  small {
    overflow: hidden;
    font-size: 0.69rem;
    opacity: 0.52;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.text-button,
.danger-button,
.logout-all {
  border: 0;
  border-radius: 7px;
  color: inherit;
  background: rgba(from currentColor r g b / 0.08);
  cursor: pointer;

  &:disabled {
    cursor: wait;
    opacity: 0.4;
  }
}

.text-button,
.danger-button {
  flex: 0 0 auto;
  padding: 6px 9px;
  font-size: 0.72rem;
}

.danger-button,
.logout-all,
.inline-error {
  color: rgb(255 165 165);
}

.security-note {
  margin: 7px 0 11px;
  font-size: 0.73rem;
  line-height: 1.7;
  opacity: 0.68;

  code {
    font-size: 0.69rem;
  }
}

.logout-all {
  width: 100%;
  padding: 9px;
  background: rgb(180 65 65 / 0.13);
}

.inline-error,
.action-message,
.empty-state {
  margin: 8px 0 0;
  font-size: 0.72rem;
}

.empty-state {
  padding: 10px 0;
  text-align: center;
  opacity: 0.52;
}

.audit-list {
  max-height: 230px;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;

  li {
    padding: 8px 0;
    border-top: 1px solid rgba(from currentColor r g b / 0.07);
    font-size: 0.72rem;

    div {
      min-width: 0;
      display: flex;
      gap: 8px;
    }

    span,
    time {
      opacity: 0.52;
    }

    time {
      flex: 0 0 auto;
      font-size: 0.66rem;
    }
  }
}
</style>
