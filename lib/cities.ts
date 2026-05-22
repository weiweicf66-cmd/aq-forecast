export type City = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  region: "京津冀" | "长三角" | "珠三角" | "其他";
};

export const CITIES: City[] = [
  // 京津冀 (13)
  { id: "beijing",      name: "北京",   lat: 39.9042, lon: 116.4074, region: "京津冀" },
  { id: "tianjin",      name: "天津",   lat: 39.0851, lon: 117.1995, region: "京津冀" },
  { id: "shijiazhuang", name: "石家庄", lat: 38.0428, lon: 114.5149, region: "京津冀" },
  { id: "tangshan",     name: "唐山",   lat: 39.6320, lon: 118.1804, region: "京津冀" },
  { id: "qinhuangdao",  name: "秦皇岛", lat: 39.9354, lon: 119.6004, region: "京津冀" },
  { id: "handan",       name: "邯郸",   lat: 36.6256, lon: 114.5391, region: "京津冀" },
  { id: "xingtai",      name: "邢台",   lat: 37.0682, lon: 114.5048, region: "京津冀" },
  { id: "baoding",      name: "保定",   lat: 38.8748, lon: 115.4646, region: "京津冀" },
  { id: "zhangjiakou",  name: "张家口", lat: 40.8242, lon: 114.9087, region: "京津冀" },
  { id: "chengde",      name: "承德",   lat: 40.9758, lon: 117.9382, region: "京津冀" },
  { id: "cangzhou",     name: "沧州",   lat: 38.3045, lon: 116.8388, region: "京津冀" },
  { id: "langfang",     name: "廊坊",   lat: 39.5188, lon: 116.7035, region: "京津冀" },
  { id: "hengshui",     name: "衡水",   lat: 37.7349, lon: 115.6705, region: "京津冀" },

  // 长三角 (4)
  { id: "shanghai",  name: "上海", lat: 31.2304, lon: 121.4737, region: "长三角" },
  { id: "nanjing",   name: "南京", lat: 32.0617, lon: 118.7778, region: "长三角" },
  { id: "suzhou",    name: "苏州", lat: 31.2989, lon: 120.5853, region: "长三角" },
  { id: "hangzhou",  name: "杭州", lat: 30.2741, lon: 120.1551, region: "长三角" },

  // 珠三角 (3)
  { id: "guangzhou", name: "广州", lat: 23.1291, lon: 113.2644, region: "珠三角" },
  { id: "shenzhen",  name: "深圳", lat: 22.5431, lon: 114.0579, region: "珠三角" },
  { id: "dongguan",  name: "东莞", lat: 23.0207, lon: 113.7517, region: "珠三角" },

  // 其他 (3)
  { id: "chengdu",   name: "成都", lat: 30.5728, lon: 104.0668, region: "其他" },
  { id: "xian",      name: "西安", lat: 34.3416, lon: 108.9398, region: "其他" },
  { id: "wuhan",     name: "武汉", lat: 30.5928, lon: 114.3055, region: "其他" },
];
