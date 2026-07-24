<template>
  <div class="mobileset" v-if="store.mobileOpenState" @mouseenter="closeShow = true" @mouseleave="closeShow = false"
    @click.stop>
    <transition name="el-fade-in-linear">
      <close-one class="close" theme="filled" size="28" fill="var(--close-icon-color)"
        @click="store.setOpenState = false" />
    </transition>
    <el-row>
      <el-col class="left">
        <div class="logo text-truncate-ellipsis">
          <span class="bg">{{ siteUrl[0] }}</span>
          <span class="sm">.{{ siteUrl[1] }}</span>
        </div>
        <!-- 移动端设置菜单 -->
        <div class="title">
          <setting-two theme="filled" size="28" fill="var(--close-icon-color)" />
          <span class="name">全局设置</span>
        </div>
        <div class="mobileset-scrollable">
          <Set />
        </div>
        <div class="version">
          <div class="num">v&nbsp;{{ config.version }}</div>
          <github-one class="github" theme="outline" size="24" @click="jumpTo(config.github)" />
          <file-editing-one class="github" theme="outline" size="24" @click="jumpTo(config.efug)" />
        </div>
      </el-col>
    </el-row>
  </div>
  <div class="set" v-else @mouseenter="closeShow = true" @mouseleave="closeShow = false" @click.stop>
    <transition name="el-fade-in-linear">
      <close-one class="close" theme="filled" size="28" fill="var(--close-icon-color)" v-show="closeShow"
        @click="store.setOpenState = false" />
    </transition>
    <el-row :gutter="40">
      <el-col :span="12" class="left">
        <div class="logo text-truncate-ellipsis">
          <span class="bg">{{ siteUrl[0] }}</span>
          <span class="sm">.{{ siteUrl[1] }}</span>
        </div>
        <div class="version">
          <el-tooltip content="Version" placement="top" effect="color" :show-arrow="false">
            <div class="num">v&nbsp;{{ config.version }}</div>
          </el-tooltip>
          <el-tooltip content="Github 源代码仓库" placement="top" effect="color" :show-arrow="false">
            <github-one class="github" theme="outline" size="24" @click="jumpTo(config.github)" />
          </el-tooltip>
          <el-tooltip content="扩展功能更新仓库" placement="top" effect="color" :show-arrow="false">
            <file-editing-one class="github" theme="outline" size="24" @click="jumpTo(config.efug)" />
          </el-tooltip>
        </div>
        <!-- <el-card class="update">
          <template #header>
            <div class="card-header">
              <span>更新日志</span>
            </div>
          </template>
<div class="upnote">
  <div v-for="item in upData.new" :key="item" class="uptext">
    <add-one theme="outline" size="22" />
    {{ item }}
  </div>
  <div v-for="item in upData.fix" :key="item" class="uptext">
    <bug theme="outline" size="22" />
    {{ item }}
  </div>
</div>
</el-card> -->
      </el-col>
      <!-- 桌面端设置菜单 -->
      <el-col :span="12" class="right">
        <div class="title">
          <setting-two theme="filled" size="28" fill="var(--close-icon-color)" />
          <span class="name">全局设置</span>
        </div>
        <div class="set-scrollable">
          <Set />
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { CloseOne, SettingTwo, GithubOne, AddOne, Bug, FileEditingOne } from "@icon-park/vue-next";
import { mainStore } from "@/store";
import Set from "@/components/Set.vue";
import config from "@/../package.json";

const store = mainStore();
const closeShow = ref(false);

// 站点链接
const siteUrl = computed(() => {
  const url = envConfig.VITE_SITE_URL;
  if (!url) return "imsyy.top".split(".");
  let urlFormat = url;
  // 判断协议前缀
  urlFormat = urlFormat.replace(/^(https?:\/\/)/, "");
  const domainOnly = urlFormat.split('/')[0];
  const hostname = domainOnly.split(':')[0];
  return hostname.split(".");
});

// 更新日志
const upData = reactive({
  new: [
    "增加逐字歌词功能",
    "依赖组件更新",
    "支持在移动端打开设置",
    "添加音乐进度条",
    "动效优化",
    "交互优化",
    "支持在移动端显示不同的壁纸",
  ],
  fix: ["消除依赖及功能弃用提示", "增强网页兼容性", "修复 Player 模块的故障"],
});

// 跳转源代码仓库
const jumpTo = (url) => {
  window.open(url);
};
</script>

<style lang="scss" scoped>
.set {
  position: absolute;
  top: 50%;
  left: 50%;
  -webkit-transform: translate(-50%, -50%);
  transform: translate(-50%, -50%);
  width: 80%;
  height: 80%;
  background: var(--set-background-color);
  border-radius: 6px;
  padding: 40px;

  .close {
    position: absolute;
    top: 14px;
    right: 14px;
    width: 28px;
    height: 28px;

    &:hover {
      transform: scale(1.2);
    }

    &:active {
      transform: scale(1);
    }
  }

  .el-row {
    height: 100%;
    flex-wrap: nowrap;

    .left {
      height: 100%;
      padding-left: 40px !important;
      padding-bottom: 20px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;

      .logo {
        transform: translateY(-8%);
        font-family: "Pacifico-Regular";
        padding-left: 22px;
        width: 100%;
        height: 260px;
        min-height: 140px;

        .bg {
          font-size: 5rem;
        }

        .sm {
          margin-left: 6px;
          font-size: 2rem;
        }

        @media (max-width: 990px) {
          .bg {
            font-size: 4.5rem;
          }

          .sm {
            font-size: 1.7rem;
          }
        }

        @media (max-width: 825px) {
          .bg {
            font-size: 3.8rem;
          }

          .sm {
            font-size: 1.3rem;
          }
        }
      }

      .version {
        display: flex;
        flex-direction: row;
        align-items: center;

        .num {
          font-size: 1rem;
          font-family: "Pacifico-Regular";
        }

        .el-popper {
          background: linear-gradient(90deg, rgb(159, 229, 151), rgb(204, 229, 129));
        }

        .github {
          width: 24px;
          height: 24px;
          margin-left: 12px;
          margin-top: 6px;

          &:hover {
            transform: scale(1.2);
          }
        }
      }

      .update {
        margin-top: 30px;
        height: 100%;

        :deep(.el-card__body) {
          height: 100%;

          .upnote {
            padding: 20px;
            height: calc(100% - 56px);
            overflow-y: auto;

            .uptext {
              display: flex;
              flex-direction: row;
              align-items: center;
              padding-bottom: 16px;

              &:nth-last-of-type(1) {
                padding: 0;
              }

              .i-icon {
                width: 22px;
                height: 22px;
                margin-right: 8px;
              }
            }
          }
        }
      }
    }

    .right {
      height: 100%;
      padding-right: 40px !important;
      display: flex;
      flex-direction: column;
      justify-content: center;

      .title {
        display: flex;
        align-items: center;
        flex-direction: row;
        font-size: 18px;
        margin-bottom: 16px;

        .i-icon {
          width: 28px;
          height: 28px;
          margin-right: 6px;
        }
      }

      .set-scrollable {
        flex: 1;
        overflow-y: auto;
      }
    }
  }
}

.mobileset {
  position: absolute;
  top: 50%;
  left: 50%;
  -webkit-transform: translate(-50%, -50%);
  transform: translate(-50%, -50%);
  width: 82%;
  height: 86%;
  background: var(--set-background-color);
  border-radius: 6px;
  padding: 36px;

  .close {
    position: absolute;
    top: 14px;
    right: 14px;
    width: 28px;
    height: 28px;

    &:hover {
      transform: scale(1.2);
    }

    &:active {
      transform: scale(1);
    }
  }

  .el-row {
    height: 100%;
    flex-wrap: nowrap;

    .left {
      height: 100%;
      padding-left: 24px !important;
      padding-bottom: 24px;
      display: flex;
      flex-direction: column;
      // justify-content: space-between;

      .logo {
        transform: translateY(-8%);
        font-family: "Pacifico-Regular";
        padding-left: 6px;
        width: 72%;
        height: auto;

        .bg {
          font-size: 2rem;
        }

        .sm {
          margin-left: 6px;
          font-size: 1.2rem;
        }
      }

      .title {
        display: flex;
        align-items: center;
        flex-direction: row;
        font-size: 18px;
        margin-bottom: 16px;
        padding-top: 18px;

        .i-icon {
          width: 28px;
          height: 28px;
          margin-right: 6px;
        }
      }

      .mobileset-scrollable {
        flex: 1;
        overflow-y: auto;
      }

      .version {
        display: flex;
        flex-direction: row;
        align-items: center;
        margin-top: auto;

        .num {
          font-size: 1rem;
          font-family: "Pacifico-Regular";
        }

        .github {
          width: 24px;
          height: 24px;
          margin-left: 12px;
          margin-top: 6px;

          &:hover {
            transform: scale(1.2);
          }
        }
      }

      .update {
        margin-top: 30px;
        height: 100%;

        :deep(.el-card__body) {
          height: 100%;

          .upnote {
            padding: 20px;
            height: calc(100% - 56px);
            overflow-y: auto;

            .uptext {
              display: flex;
              flex-direction: row;
              align-items: center;
              padding-bottom: 16px;

              &:nth-last-of-type(1) {
                padding: 0;
              }

              .i-icon {
                width: 22px;
                height: 22px;
                margin-right: 8px;
              }
            }
          }
        }
      }
    }
  }
}
</style>
