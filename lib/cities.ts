// 城市列表唯一数据源 → cities.json
// 任何修改：编辑 cities.json，然后 `npm run build:n8n` 同步到 n8n 模板产物。
import citiesData from "./cities.json";

export type City = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  region: "京津冀" | "山西" | "山东" | "河南" | "长三角" | "珠三角" | "其他";
  featureName: string;
};

export const CITIES: City[] = citiesData as City[];
