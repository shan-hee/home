<template>
  <!-- 基本信息 -->
  <div class="message">
    <!-- Logo -->
    <div class="logo">
      <img class="logo-img" :src="siteLogo" alt="logo" />
      <div :class="{ name: true, long: siteUrl[0].length >= 6 }">
        <span class="site-address text-truncate-ellipsis">
          <span class="bg">{{ siteUrl[0] }}</span>
          <span class="sm">.{{ siteUrl[1] }}</span>
        </span>
        <button
          type="button"
          class="owner-entry"
          aria-label="打开所有者设置"
          title="编辑站点"
          @click="emit('open-owner-panel')"
        >
          <svg class="owner-entry-icon" viewBox="0 0 48 48" aria-hidden="true">
            <path
              fill="currentColor"
              fill-rule="evenodd"
              d="M38.9 6.4c-7.7.8-14.4 3.7-19.2 8.5-5.1 5.1-7.7 11.8-8.1 20.5l-3.4 3.4a1.7 1.7 0 0 0 2.4 2.4l3.4-3.4c8.7-.4 15.4-3 20.5-8.1 4.8-4.8 7.7-11.5 8.5-19.2.3-2.6-1.5-4.4-4.1-4.1ZM17.1 33.2c.7-6.6 2.8-11.5 6.5-15.2 3.6-3.6 8.4-5.9 14.2-7-1.1 5.9-3.4 10.6-7 14.2-3.7 3.7-8.6 5.8-15.2 6.5l8.8-8.8a1.7 1.7 0 1 0-2.4-2.4l-4.9 4.9v7.8Z"
              clip-rule="evenodd"
            />
            <path
              fill="currentColor"
              d="m11.1 8.2.8 2.3 2.3.8-2.3.8-.8 2.3-.8-2.3-2.3-.8 2.3-.8.8-2.3Zm7.2-4.1.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5.5-1.5Z"
            />
          </svg>
        </button>
      </div>
    </div>
    <!-- 一言 -->
    <div
      class="description"
      role="button"
      tabindex="0"
      title="切换拓展盒子"
      @click="changeBox"
      @keydown.enter="changeBox"
      @keydown.space.prevent="changeBox"
    >
      <Hitokoto />
    </div>
  </div>
</template>

<script setup lang="ts">
import { Error } from "@icon-park/vue-next";
import Hitokoto from "@/components/Hitokoto.vue";
import { mainStore } from "@/store";
import { useSiteContentStore } from "@/stores/siteContent";
const store = mainStore();
const siteContent = useSiteContentStore();
const emit = defineEmits<{
  openOwnerPanel: [];
}>();

// 主页站点logo
const siteLogo = computed(() => siteContent.profile.mainLogo);
// 站点链接
const siteUrl = computed(() => {
  let mns: string | null = null;
  if (store.msgNameShow) {
    mns = siteContent.profile.mainName || siteContent.profile.siteUrl || "imsyy.top";
    // 这里并没有处理显示自定义内容后的分段点，因为这个点看着也不错，有种写字时封笔的感觉，就不处理啦~
    // 才不是懒的！（x）
  } else {
    mns = siteContent.profile.siteUrl || "imsyy.top";
  };
  const url = mns;
  if (!url) return "imsyy.top".split(".");
  let urlFormat = url;
  // 判断协议前缀
  urlFormat = urlFormat.replace(/^(https?:\/\/)/, "");
  const domainOnly = urlFormat.split('/')[0];
  const hostname = domainOnly.split(':')[0];
  return hostname.split(".");
});

// 切换右侧功能区
const changeBox = () => {
  if ((store.getInnerWidth ?? 0) >= 721) {
    store.boxOpenState = !store.boxOpenState;
  } else {
    ElMessage({
      message: "当前显示分辨率不足以打开拓展盒子啦qwq【这么“小”还想开impart！（bushi）】",
      grouping: true,
      icon: h(Error, {
        theme: "filled",
        fill: "#efefef",
      }),
    });
  };
};

</script>


<style lang="scss" scoped>
.message {
  .logo {
    display: flex;
    flex-direction: row;
    align-items: center;
    animation: fade 0.5s;
    max-width: 460px;
    color: rgba(245, 245, 245, 1);

    .logo-img {
      border-radius: 50%;
      width: 120px;
    }

    .name {
      width: 100%;
      padding-left: 22px;
      display: flex;
      align-items: flex-start;
      transform: translateY(-8px);
      font-family: "Pacifico-Regular";

      .site-address {
        min-width: 0;
      }

      .bg {
        font-size: 5rem;
        color: rgba(245, 245, 245, 1);
      }

      .sm {
        margin-left: 6px;
        font-size: 2rem;
        color: rgba(255, 240, 245, 1);

        @media (min-width: 721px) and (max-width: 789px) {
          display: none;
        }
      }

      .owner-entry {
        width: 46px;
        height: 46px;
        flex: 0 0 46px;
        display: grid;
        place-items: center;
        margin: 1px 0 0 2px;
        padding: 0;
        border: 0;
        color: rgba(245, 245, 245, 1);
        background: transparent;
        cursor: pointer;
        opacity: 0.48;
        transform: translateY(-9px) rotate(-4deg);
        transition: opacity 0.2s ease, transform 0.2s ease;

        &:hover,
        &:focus-visible {
          opacity: 0.9;
          transform: translateY(-12px) rotate(0deg) scale(1.04);
        }

        &:focus-visible {
          outline: 2px solid rgba(245, 245, 245, 0.55);
          outline-offset: -5px;
          border-radius: 50%;
        }

        &:active {
          transform: translateY(-8px) rotate(0deg) scale(0.9);
        }
      }

      .owner-entry-icon {
        width: 36px;
        height: 36px;
      }
    }

    @media (max-width: 768px) {
      .logo-img {
        width: 100px;
      }

      .name {
        height: 128px;

        .bg {
          font-size: 4.5rem;
        }
      }
    }

    @media (max-width: 720px) {
      max-width: 100%;
    }
  }

  .description {
    margin-top: 3.5rem;
    max-width: 460px;
    cursor: pointer;
    animation: fade 0.5s;

    &:focus-visible {
      outline: 2px solid rgba(245, 245, 245, 0.55);
      outline-offset: 5px;
      border-radius: 8px;
    }

    @media (max-width: 720px) {
      max-width: 100%;
    }
  }

  // @media (max-width: 390px) {
  //   .logo {
  //     flex-direction: column;
  //     .logo-img {
  //       display: none;
  //     }
  //     .name {
  //       margin-left: 0;
  //       height: auto;
  //       transform: none;
  //       text-align: center;
  //       .bg {
  //         font-size: 3.5rem;
  //       }
  //       .sm {
  //         font-size: 1.4rem;
  //       }
  //     }
  //   }
  //   .description {
  //     margin-top: 2.5rem;
  //   }
  // }
}
</style>
