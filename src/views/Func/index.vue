<template>
  <!-- 功能区域 -->
  <div :class="store.mobileFuncState ? 'function mobile' : 'function'">
    <el-row :gutter="20">
      <el-col :span="12">
        <div class="left">
          <Music :key="siteContent.snapshot.sectionRevisions.music" />
        </div>
      </el-col>
      <el-col :span="12">
        <div class="right cards">
          <div class="time">
            <div class="date">
              <span>{{ currentTime.year }}&nbsp;年&nbsp;</span>
              <span>{{ currentTime.month }}&nbsp;月&nbsp;</span>
              <span>{{ currentTime.day }}&nbsp;日&nbsp;</span>
            </div>
            <div class="lunar-date">
              <span>{{ lunarDate }}</span>
              <span aria-hidden="true">&nbsp;·&nbsp;</span>
              <span>{{ weekdayText }}</span>
            </div>
            <div class="text">
              <span> {{ currentTime.hour }}:{{ currentTime.minute }}:{{ currentTime.second }}</span>
            </div>
          </div>
          <Weather />
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";
import { getCurrentTime } from "@/utils/getTime";
import { mainStore } from "@/store";
import { useSiteContentStore } from "@/stores/siteContent";
import Music from "@/components/Music.vue";
import Weather from "@/components/Weather.vue";

const store = mainStore();
const siteContent = useSiteContentStore();

interface CurrentTime {
  year: number;
  month: number;
  day: number;
  weekday: string;
  hour: number;
  minute: number;
  second: number;
};

// 当前时间
const currentTime = ref < CurrentTime > ({
  year: 0,
  month: 0,
  day: 0,
  weekday: "",
  hour: 0,
  minute: 0,
  second: 0,
});
const timeInterval = ref < number | null > (null);
const lunarDate = ref("");
const weekdayText = ref("");

const lunarFormatter = new Intl.DateTimeFormat("zh-CN-u-ca-chinese", {
  month: "long",
  day: "numeric",
});
const weekdayFormatter = new Intl.DateTimeFormat("zh-CN", {
  weekday: "short",
});
const lunarDayNames = [
  "",
  "初一",
  "初二",
  "初三",
  "初四",
  "初五",
  "初六",
  "初七",
  "初八",
  "初九",
  "初十",
  "十一",
  "十二",
  "十三",
  "十四",
  "十五",
  "十六",
  "十七",
  "十八",
  "十九",
  "二十",
  "廿一",
  "廿二",
  "廿三",
  "廿四",
  "廿五",
  "廿六",
  "廿七",
  "廿八",
  "廿九",
  "三十",
];
let calendarDateKey = "";

// 更新农历与星期，仅在日期变化时重新格式化
const updateCalendarText = (date: Date) => {
  const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  if (dateKey === calendarDateKey) return;

  calendarDateKey = dateKey;
  const lunarParts = lunarFormatter.formatToParts(date);
  const lunarMonth = lunarParts.find((part) => part.type === "month")?.value || "";
  const lunarDay = Number(lunarParts.find((part) => part.type === "day")?.value || 0);
  lunarDate.value = `${lunarMonth}${lunarDayNames[lunarDay] || ""}`;
  weekdayText.value = weekdayFormatter.format(date);
};

// 更新时间
const updateTimeData = () => {
  updateCalendarText(new Date());
  Object.assign(currentTime.value, getCurrentTime());
};

onMounted(() => {
  updateTimeData();
  timeInterval.value = setInterval(updateTimeData, 1000) as unknown as number;
});

onBeforeUnmount(() => {
  if (timeInterval.value !== null) {
    clearInterval(timeInterval.value);
  };
});
</script>

<style lang="scss" scoped>
.function {
  height: 165px;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;

  &.mobile {
    .el-row {
      .el-col {
        &:nth-of-type(1) {
          display: contents;
        }

        &:nth-of-type(2) {
          display: none;
        }
      }
    }
  }

  .el-row {
    height: 100%;
    width: 100%;
    margin: 0 !important;

    .el-col {
      &:nth-of-type(1) {
        padding-left: 0 !important;
      }

      &:nth-of-type(2) {
        padding-right: 0 !important;
      }

      @media (max-width: 910px) {
        &:nth-of-type(1) {
          display: none;
        }

        &:nth-of-type(2) {
          padding: 0 !important;
          flex: none;
          max-width: none;
          width: 100%;
        }
      }
    }

    .left,
    .right {
      width: 100%;
      height: 100%;
    }

    .right {
      padding: 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      animation: fade 0.5s;

      .time {
        font-size: 1.1rem;
        text-align: center;

        .date {
          text-overflow: ellipsis;
          overflow-x: hidden;
          white-space: nowrap;
        }

        .lunar-date {
          margin-top: 3px;
          font-size: 0.82rem;
          opacity: 0.72;
          white-space: nowrap;
        }

        .text {
          margin-top: 7px;
          font-size: 3.25rem;
          letter-spacing: 2px;
          font-family: "UnidreamLED";
        }

        @media (min-width: 1201px) and (max-width: 1280px) {
          font-size: 1rem;
        }

        @media (min-width: 911px) and (max-width: 992px) {
          font-size: 1rem;

          .text {
            font-size: 2.75rem;
          }
        }
      }

      .weather {
        text-align: center;
        width: 100%;
        text-overflow: ellipsis;
        overflow-x: hidden;
        white-space: nowrap;
      }
    }
  }
}
</style>
