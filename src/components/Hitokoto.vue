<template>
  <Transition name="el-fade-in-linear" mode="out-in">
    <div :key="hitokotoData.text" class="hitokoto cards">
      <Icon class="quote-icon quote-start" size="18" aria-hidden="true">
        <QuoteLeft />
      </Icon>
      <div class="content">
        <span class="text">{{ hitokotoData.text }}</span>
        <span class="from">-「&nbsp;{{ hitokotoData.from }}&nbsp;」</span>
      </div>
      <Icon class="quote-icon quote-end" size="18" aria-hidden="true">
        <QuoteRight />
      </Icon>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { Icon } from "@vicons/utils";
import { QuoteLeft, QuoteRight } from "@vicons/fa";
import { Error } from "@icon-park/vue-next";
import { getHitokoto } from "@/api";

// 一言数据
const hitokotoData = reactive({
  text: "这里应该显示一句话",
  from: "無名",
});

// 获取一言数据
const getHitokotoData = async () => {
  try {
    const result = await getHitokoto();
    hitokotoData.text = result.hitokoto;
    hitokotoData.from = result.from;
  } catch (error) {
    ElMessage({
      message: "一言获取失败",
      icon: h(Error, {
        theme: "filled",
        fill: "var(--el-message-icon-color)",
      }),
    });
    hitokotoData.text = "这里应该显示一句话";
    hitokotoData.from = "無名";
  }
};

onMounted(() => {
  getHitokotoData();
});
</script>

<style lang="scss" scoped>
.hitokoto {
  position: relative;
  width: 100%;
  min-height: 112px;
  padding: 18px 20px;
  border: 0;
  color: inherit;
  font: inherit;
  text-align: left;
  animation: fade 0.5s;

  .quote-icon {
    position: absolute;
    width: 18px;
    height: 18px;

    &.quote-start {
      top: 16px;
      left: 16px;
    }

    &.quote-end {
      right: 16px;
      bottom: 16px;
    }
  }

  .content {
    min-height: 76px;
    padding: 4px 24px;
    display: flex;
    flex-direction: column;
    justify-content: space-evenly;

    .text {
      overflow: hidden;
      display: -webkit-box;
      font-size: 1.1rem;
      line-height: 1.75;
      text-overflow: ellipsis;
      word-break: break-all;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 3;
    }

    .from {
      align-self: flex-end;
      margin: 8px 18px 0 0;
      font-size: 1.1rem;
      font-weight: bold;
    }
  }
}
</style>
