export type City = { id: string; name: string; lat: number; lon: number };

export const CITIES: City[] = [
  { id: "beijing",   name: "北京", lat: 39.9042, lon: 116.4074 },
  { id: "shanghai",  name: "上海", lat: 31.2304, lon: 121.4737 },
  { id: "guangzhou", name: "广州", lat: 23.1291, lon: 113.2644 },
  { id: "shenzhen",  name: "深圳", lat: 22.5431, lon: 114.0579 },
  { id: "chengdu",   name: "成都", lat: 30.5728, lon: 104.0668 },
  { id: "xian",      name: "西安", lat: 34.3416, lon: 108.9398 },
];
