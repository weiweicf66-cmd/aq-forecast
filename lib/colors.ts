import type { AqiCategory } from "./aqi";

// 配色参考中国环境监测总站发布颜色 + Tailwind 调色板靠近值
export const CATEGORY_BG: Record<AqiCategory, string> = {
  "优":       "bg-emerald-500",
  "良":       "bg-yellow-400",
  "轻度污染": "bg-orange-500",
  "中度污染": "bg-red-500",
  "重度污染": "bg-purple-700",
  "严重污染": "bg-rose-950",
};

export const CATEGORY_TEXT: Record<AqiCategory, string> = {
  "优":       "text-emerald-700",
  "良":       "text-yellow-700",
  "轻度污染": "text-orange-700",
  "中度污染": "text-red-700",
  "重度污染": "text-purple-200",
  "严重污染": "text-rose-200",
};

export const CATEGORY_HEX: Record<AqiCategory, string> = {
  "优":       "#10b981",
  "良":       "#facc15",
  "轻度污染": "#f97316",
  "中度污染": "#ef4444",
  "重度污染": "#7e22ce",
  "严重污染": "#4c0519",
};
