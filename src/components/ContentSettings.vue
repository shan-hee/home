<template>
  <div class="content-settings">
    <div class="section-heading">
      <div>
        <strong>站点内容</strong>
        <small>保存后公开页面会在后台刷新，无需重启服务</small>
      </div>
      <button type="button" class="text-button" :disabled="loading" @click="loadContent">
        {{ loading ? "加载中…" : "重新加载" }}
      </button>
    </div>

    <p v-if="loadError" class="inline-error">{{ loadError }}</p>
    <div v-else-if="!drafts" class="empty-state">正在读取站点内容…</div>

    <el-collapse v-else v-model="activeSection" accordion class="admin-collapse">
      <el-collapse-item title="站点资料" name="profile">
        <div class="form-grid">
          <label>站点名称<input v-model="drafts.profile.siteName" /></label>
          <label>作者<input v-model="drafts.profile.author" /></label>
          <label>主页名称<input v-model="drafts.profile.mainName" /></label>
          <label>站点地址<input v-model="drafts.profile.siteUrl" type="url" /></label>
          <label class="wide">关键词<input v-model="drafts.profile.keywords" /></label>
          <label class="wide">简介<textarea v-model="drafts.profile.description" rows="2" /></label>
          <label>站点图标<input v-model="drafts.profile.siteLogo" /></label>
          <label>主页图标<input v-model="drafts.profile.mainLogo" /></label>
          <label>Apple 图标<input v-model="drafts.profile.appleLogo" /></label>
          <label>建站日期<input v-model="drafts.profile.startDate" placeholder="YYYY-MM-DD" /></label>
          <label>ICP备案号<input v-model="drafts.profile.icp" /></label>
          <label>公安备案号<input v-model="drafts.profile.mps" /></label>
          <label class="wide">代码仓库<input v-model="drafts.profile.repositoryUrl" type="url" /></label>
        </div>
        <SectionSave section="profile" :state="saveStates.profile" @save="saveSection('profile')" />
      </el-collapse-item>

      <el-collapse-item title="网站列表" name="siteLinks">
        <div v-for="(item, index) in drafts.siteLinks" :key="index" class="list-editor">
          <div class="list-editor-head">
            <strong>网站 {{ index + 1 }}</strong>
            <button type="button" class="danger-link" @click="drafts.siteLinks.splice(index, 1)">删除</button>
          </div>
          <div class="form-grid compact">
            <label>名称<input v-model="item.name" /></label>
            <label>图标
              <select v-model="item.icon">
                <option v-for="icon in siteIcons" :key="icon" :value="icon">{{ icon }}</option>
              </select>
            </label>
            <label class="wide">地址<input v-model="item.link" type="url" /></label>
          </div>
        </div>
        <button type="button" class="add-button" @click="addSiteLink">＋ 添加网站</button>
        <SectionSave section="siteLinks" :state="saveStates.siteLinks" @save="saveSection('siteLinks')" />
      </el-collapse-item>

      <el-collapse-item title="社交链接" name="socialLinks">
        <div v-for="(item, index) in drafts.socialLinks" :key="index" class="list-editor">
          <div class="list-editor-head">
            <strong>链接 {{ index + 1 }}</strong>
            <button type="button" class="danger-link" @click="drafts.socialLinks.splice(index, 1)">删除</button>
          </div>
          <div class="form-grid compact">
            <label>名称<input v-model="item.name" /></label>
            <label>图标
              <select v-model="item.icon">
                <option v-for="icon in socialIcons" :key="icon" :value="icon">{{ icon }}</option>
              </select>
            </label>
            <label>悬浮提示<input v-model="item.tip" /></label>
            <label class="wide">地址<input v-model="item.url" /></label>
          </div>
        </div>
        <button type="button" class="add-button" @click="addSocialLink">＋ 添加社交链接</button>
        <SectionSave section="socialLinks" :state="saveStates.socialLinks" @save="saveSection('socialLinks')" />
      </el-collapse-item>

      <el-collapse-item title="音乐来源" name="music">
        <div class="form-grid">
          <label>平台
            <select v-model="drafts.music.server">
              <option value="netease">网易云音乐</option>
              <option value="tencent">QQ 音乐</option>
            </select>
          </label>
          <label>类型
            <select v-model="drafts.music.type">
              <option value="playlist">歌单</option>
              <option value="song">单曲</option>
            </select>
          </label>
          <label class="wide">音乐 ID<input v-model="drafts.music.id" /></label>
        </div>
        <SectionSave section="music" :state="saveStates.music" @save="saveSection('music')" />
      </el-collapse-item>

      <el-collapse-item title="壁纸资源" name="wallpaper">
        <div class="form-grid">
          <label>配置版本<input v-model.number="drafts.wallpaper.version" type="number" min="1" /></label>
        </div>
        <div v-for="target in wallpaperTargets" :key="target.key" class="list-editor">
          <div class="list-editor-head"><strong>{{ target.label }}</strong></div>
          <div class="form-grid compact">
            <label>数量<input v-model.number="drafts.wallpaper[target.key].count" type="number" min="1" max="200" /></label>
            <label class="wide">路径模板<input v-model="drafts.wallpaper[target.key].pattern" placeholder="/images/background{id}.jpg" /></label>
            <label class="wide">回退图片<input v-model="drafts.wallpaper[target.key].fallback" /></label>
          </div>
        </div>
        <SectionSave section="wallpaper" :state="saveStates.wallpaper" @save="saveSection('wallpaper')" />
      </el-collapse-item>

      <el-collapse-item title="一言" name="hitokoto">
        <div class="form-grid">
          <label>模式
            <select v-model="drafts.hitokoto.mode">
              <option value="remote">远程一言</option>
              <option value="fixed">固定内容</option>
            </select>
          </label>
          <label class="wide">远程分类（逗号分隔）<input v-model="hitokotoCategories" /></label>
          <label class="wide">固定内容<textarea v-model="drafts.hitokoto.fixedText" rows="2" /></label>
          <label>固定内容来源<input v-model="drafts.hitokoto.fixedFrom" /></label>
          <label class="wide">失败时内容<textarea v-model="drafts.hitokoto.fallbackText" rows="2" /></label>
          <label>失败时来源<input v-model="drafts.hitokoto.fallbackFrom" /></label>
        </div>
        <SectionSave section="hitokoto" :state="saveStates.hitokoto" @save="saveSection('hitokoto')" />
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<script setup lang="ts">
import { defineComponent, h, type PropType } from "vue";
import { ApiClientError, requestJson } from "@/services/apiClient";
import { useAuthStore } from "@/stores/auth";
import { useSiteContentStore } from "@/stores/siteContent";
import type {
  SiteContentSections,
  SiteContentSnapshot,
  SiteIcon,
  SocialIcon,
} from "@/typings/siteContent";

type ContentSectionKey = keyof SiteContentSections;
type SaveState = { saving: boolean; message: string; error: boolean };

const sectionKeys: ContentSectionKey[] = ["profile", "siteLinks", "socialLinks", "music", "wallpaper", "hitokoto"];
const siteIcons: SiteIcon[] = ["Blog", "Cloud", "Compass", "Book", "Fire", "LaptopCode"];
const socialIcons: SocialIcon[] = ["github", "bilibili", "qq", "mail", "twitter-x", "telegram"];
const wallpaperTargets = [
  { key: "desktop" as const, label: "桌面端" },
  { key: "mobile" as const, label: "移动端" },
];
const emptySaveStates = () => Object.fromEntries(sectionKeys.map((key) => [
  key,
  { saving: false, message: "", error: false },
])) as Record<ContentSectionKey, SaveState>;

const auth = useAuthStore();
const siteContent = useSiteContentStore();
const activeSection = ref("profile");
const loading = ref(false);
const loadError = ref("");
const snapshot = ref<SiteContentSnapshot | null>(null);
const drafts = ref<SiteContentSections | null>(null);
const saveStates = reactive(emptySaveStates());

const SectionSave = defineComponent({
  props: {
    section: { type: String, required: true },
    state: { type: Object as PropType<SaveState>, required: true },
  },
  emits: ["save"],
  setup(props, { emit }) {
    return () => h("div", { class: "save-row" }, [
      h("span", { class: props.state.error ? "save-error" : "save-message" }, props.state.message),
      h("button", {
        type: "button",
        class: "save-button",
        disabled: props.state.saving,
        onClick: () => emit("save"),
      }, props.state.saving ? "保存中…" : "保存本节"),
    ]);
  },
});

const hitokotoCategories = computed({
  get: () => drafts.value?.hitokoto.categories.join(", ") || "",
  set: (value: string) => {
    if (!drafts.value) return;
    drafts.value.hitokoto.categories = value.split(/[,，]/).map((item) => item.trim()).filter(Boolean);
  },
});

const loadContent = async () => {
  if (loading.value) return;
  loading.value = true;
  loadError.value = "";
  try {
    const response = await requestJson<SiteContentSnapshot>("/api/admin/content");
    snapshot.value = response;
    drafts.value = structuredClone(response.sections);
    sectionKeys.forEach((key) => Object.assign(saveStates[key], { saving: false, message: "", error: false }));
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 401) auth.expireSession();
    loadError.value = error instanceof ApiClientError ? error.message : "站点内容暂时无法读取";
  } finally {
    loading.value = false;
  }
};

const saveSection = async (section: ContentSectionKey) => {
  if (!snapshot.value || !drafts.value || saveStates[section].saving) return;
  const state = saveStates[section];
  Object.assign(state, { saving: true, message: "", error: false });
  try {
    const response = await requestJson<{
      section: ContentSectionKey;
      content: SiteContentSections[ContentSectionKey];
      revision: number;
    }>(`/api/admin/content/${section}`, {
      method: "PUT",
      body: JSON.stringify({
        baseRevision: snapshot.value.sectionRevisions[section],
        content: drafts.value[section],
      }),
    });
    snapshot.value.sectionRevisions[section] = response.revision;
    snapshot.value.sections = {
      ...snapshot.value.sections,
      [section]: structuredClone(response.content),
    } as SiteContentSections;
    drafts.value = {
      ...drafts.value,
      [section]: structuredClone(response.content),
    } as SiteContentSections;
    state.message = "已保存";
    void siteContent.refresh();
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 401) auth.expireSession();
    state.error = true;
    state.message = error instanceof ApiClientError
      ? (error.status === 409 ? "内容已在其它页面更新，请重新加载后再编辑" : error.message)
      : "保存失败，请稍后再试";
  } finally {
    state.saving = false;
  }
};

const addSiteLink = () => drafts.value?.siteLinks.push({
  icon: "Compass",
  name: "",
  link: "https://",
});

const addSocialLink = () => drafts.value?.socialLinks.push({
  name: "",
  icon: "github",
  tip: "",
  url: "https://",
});

onMounted(() => void loadContent());
</script>

<style lang="scss" scoped>
.content-settings {
  color: var(--text-color);
}

.section-heading,
.save-row,
.list-editor-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.section-heading {
  padding: 4px 3px 14px;

  div {
    display: grid;
    gap: 3px;
  }

  small {
    font-size: 0.72rem;
    opacity: 0.55;
  }
}

.text-button,
.add-button,
.save-button,
.danger-link {
  border: 0;
  color: inherit;
  background: transparent;
  cursor: pointer;
}

.text-button,
.danger-link {
  opacity: 0.65;
}

.admin-collapse {
  border: 0;
  --el-collapse-content-bg-color: transparent;

  :deep(.el-collapse-item__header) {
    padding: 0 12px;
    border-color: rgba(from currentColor r g b / 0.1);
    color: var(--text-color);
    background: rgba(from currentColor r g b / 0.055);
  }

  :deep(.el-collapse-item__wrap) {
    border-color: rgba(from currentColor r g b / 0.08);
    background: transparent;
  }

  :deep(.el-collapse-item__content) {
    padding: 14px 10px 18px;
    color: var(--text-color);
  }
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 11px;

  label {
    min-width: 0;
    display: grid;
    gap: 5px;
    font-size: 0.74rem;
    opacity: 0.78;
  }

  .wide {
    grid-column: 1 / -1;
  }

  input:not([type="checkbox"]),
  textarea,
  select {
    width: 100%;
    min-height: 34px;
    padding: 6px 9px;
    border: 1px solid rgba(from currentColor r g b / 0.17);
    border-radius: 6px;
    outline: 0;
    color: var(--text-color);
    background: rgba(from currentColor r g b / 0.07);
    font: inherit;
    resize: vertical;

    &:focus {
      border-color: rgba(from currentColor r g b / 0.42);
    }
  }

  select option {
    color: #222;
  }

}

.list-editor {
  margin-bottom: 12px;
  padding: 11px;
  border: 1px solid rgba(from currentColor r g b / 0.11);
  border-radius: 8px;
  background: rgba(from currentColor r g b / 0.035);
}

.list-editor-head {
  margin-bottom: 10px;
  font-size: 0.78rem;
}

.danger-link,
.save-error,
.inline-error {
  color: rgb(255 165 165);
}

.add-button {
  width: 100%;
  padding: 8px;
  border: 1px dashed rgba(from currentColor r g b / 0.22);
  border-radius: 7px;
  opacity: 0.68;
}

.save-row {
  min-height: 44px;
  margin-top: 12px;
}

.save-message,
.save-error {
  font-size: 0.74rem;
}

.save-button {
  padding: 7px 13px;
  border-radius: 7px;
  background: rgba(from currentColor r g b / 0.1);

  &:disabled {
    cursor: wait;
    opacity: 0.45;
  }
}

.inline-error,
.empty-state {
  padding: 24px 8px;
  text-align: center;
  font-size: 0.8rem;
}

@media (max-width: 460px) {
  .form-grid {
    grid-template-columns: 1fr;

    .wide {
      grid-column: auto;
    }
  }
}
</style>
