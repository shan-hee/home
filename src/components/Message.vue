<template>
  <!-- 基本信息 -->
  <div class="message">
    <!-- Logo -->
    <div class="logo">
      <img class="logo-img" :src="siteLogo" alt="logo" />
      <div :class="{ name: true, 'text-truncate-ellipsis': true, long: siteUrl[0].length >= 6 }">
        <span class="bg">{{ siteUrl[0] }}</span>
        <span class="sm">.{{ siteUrl[1] }}</span>
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
      transform: translateY(-8px);
      font-family: "Pacifico-Regular";

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
