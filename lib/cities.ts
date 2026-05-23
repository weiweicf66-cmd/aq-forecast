export type City = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  region: "京津冀" | "山西" | "山东" | "河南" | "长三角" | "珠三角" | "其他";
  /**
   * 在 public/geo/regions.json 中对应 feature.properties.name。
   * 京津冀及周边 + 长三角 + 珠三角 粒度到地级市；远程城市退回省级。
   */
  featureName: string;
};

export const CITIES: City[] = [
  // 京津冀 (13) — 地级市粒度
  { id: "beijing",      name: "北京",   lat: 39.9042, lon: 116.4074, region: "京津冀", featureName: "北京市" },
  { id: "tianjin",      name: "天津",   lat: 39.0851, lon: 117.1995, region: "京津冀", featureName: "天津市" },
  { id: "shijiazhuang", name: "石家庄", lat: 38.0428, lon: 114.5149, region: "京津冀", featureName: "石家庄市" },
  { id: "tangshan",     name: "唐山",   lat: 39.6320, lon: 118.1804, region: "京津冀", featureName: "唐山市" },
  { id: "qinhuangdao",  name: "秦皇岛", lat: 39.9354, lon: 119.6004, region: "京津冀", featureName: "秦皇岛市" },
  { id: "handan",       name: "邯郸",   lat: 36.6256, lon: 114.5391, region: "京津冀", featureName: "邯郸市" },
  { id: "xingtai",      name: "邢台",   lat: 37.0682, lon: 114.5048, region: "京津冀", featureName: "邢台市" },
  { id: "baoding",      name: "保定",   lat: 38.8748, lon: 115.4646, region: "京津冀", featureName: "保定市" },
  { id: "zhangjiakou",  name: "张家口", lat: 40.8242, lon: 114.9087, region: "京津冀", featureName: "张家口市" },
  { id: "chengde",      name: "承德",   lat: 40.9758, lon: 117.9382, region: "京津冀", featureName: "承德市" },
  { id: "cangzhou",     name: "沧州",   lat: 38.3045, lon: 116.8388, region: "京津冀", featureName: "沧州市" },
  { id: "langfang",     name: "廊坊",   lat: 39.5188, lon: 116.7035, region: "京津冀", featureName: "廊坊市" },
  { id: "hengshui",     name: "衡水",   lat: 37.7349, lon: 115.6705, region: "京津冀", featureName: "衡水市" },

  // 山西 11 (京津冀及周边大气污染传输通道)
  { id: "taiyuan",   name: "太原", lat: 37.8706, lon: 112.5489, region: "山西", featureName: "太原市" },
  { id: "datong",    name: "大同", lat: 40.0768, lon: 113.3001, region: "山西", featureName: "大同市" },
  { id: "yangquan",  name: "阳泉", lat: 37.8574, lon: 113.5817, region: "山西", featureName: "阳泉市" },
  { id: "changzhi",  name: "长治", lat: 36.1955, lon: 113.1163, region: "山西", featureName: "长治市" },
  { id: "jincheng",  name: "晋城", lat: 35.4910, lon: 112.8513, region: "山西", featureName: "晋城市" },
  { id: "shuozhou",  name: "朔州", lat: 39.3315, lon: 112.4329, region: "山西", featureName: "朔州市" },
  { id: "jinzhong",  name: "晋中", lat: 37.6873, lon: 112.7528, region: "山西", featureName: "晋中市" },
  { id: "yuncheng",  name: "运城", lat: 35.0263, lon: 111.0067, region: "山西", featureName: "运城市" },
  { id: "xinzhou",   name: "忻州", lat: 38.4163, lon: 112.7344, region: "山西", featureName: "忻州市" },
  { id: "linfen",    name: "临汾", lat: 36.0883, lon: 111.5190, region: "山西", featureName: "临汾市" },
  { id: "lvliang",   name: "吕梁", lat: 37.5191, lon: 111.1442, region: "山西", featureName: "吕梁市" },

  // 山东 8
  { id: "jinan",     name: "济南", lat: 36.6512, lon: 117.1201, region: "山东", featureName: "济南市" },
  { id: "zibo",      name: "淄博", lat: 36.8136, lon: 118.0548, region: "山东", featureName: "淄博市" },
  { id: "zaozhuang", name: "枣庄", lat: 34.8107, lon: 117.3236, region: "山东", featureName: "枣庄市" },
  { id: "jining",    name: "济宁", lat: 35.4150, lon: 116.5871, region: "山东", featureName: "济宁市" },
  { id: "taian",     name: "泰安", lat: 36.1944, lon: 117.0879, region: "山东", featureName: "泰安市" },
  { id: "liaocheng", name: "聊城", lat: 36.4565, lon: 115.9854, region: "山东", featureName: "聊城市" },
  { id: "dezhou",    name: "德州", lat: 37.4346, lon: 116.3578, region: "山东", featureName: "德州市" },
  { id: "binzhou",   name: "滨州", lat: 37.3866, lon: 117.9707, region: "山东", featureName: "滨州市" },

  // 河南 7
  { id: "zhengzhou", name: "郑州", lat: 34.7466, lon: 113.6253, region: "河南", featureName: "郑州市" },
  { id: "kaifeng",   name: "开封", lat: 34.7986, lon: 114.3074, region: "河南", featureName: "开封市" },
  { id: "anyang",    name: "安阳", lat: 36.0991, lon: 114.3931, region: "河南", featureName: "安阳市" },
  { id: "hebi",      name: "鹤壁", lat: 35.7474, lon: 114.2954, region: "河南", featureName: "鹤壁市" },
  { id: "xinxiang",  name: "新乡", lat: 35.3030, lon: 113.9268, region: "河南", featureName: "新乡市" },
  { id: "jiaozuo",   name: "焦作", lat: 35.2159, lon: 113.2418, region: "河南", featureName: "焦作市" },
  { id: "puyang",    name: "濮阳", lat: 35.7681, lon: 115.0292, region: "河南", featureName: "濮阳市" },

  // 长三角 (4) — 地级市粒度
  { id: "shanghai",  name: "上海", lat: 31.2304, lon: 121.4737, region: "长三角", featureName: "上海市" },
  { id: "nanjing",   name: "南京", lat: 32.0617, lon: 118.7778, region: "长三角", featureName: "南京市" },
  { id: "suzhou",    name: "苏州", lat: 31.2989, lon: 120.5853, region: "长三角", featureName: "苏州市" },
  { id: "hangzhou",  name: "杭州", lat: 30.2741, lon: 120.1551, region: "长三角", featureName: "杭州市" },

  // 珠三角 (3) — 地级市粒度
  { id: "guangzhou", name: "广州", lat: 23.1291, lon: 113.2644, region: "珠三角", featureName: "广州市" },
  { id: "shenzhen",  name: "深圳", lat: 22.5431, lon: 114.0579, region: "珠三角", featureName: "深圳市" },
  { id: "dongguan",  name: "东莞", lat: 23.0207, lon: 113.7517, region: "珠三角", featureName: "东莞市" },

  // 其他 (3) — 退回省级
  { id: "chengdu",   name: "成都", lat: 30.5728, lon: 104.0668, region: "其他", featureName: "四川省" },
  { id: "xian",      name: "西安", lat: 34.3416, lon: 108.9398, region: "其他", featureName: "陕西省" },
  { id: "wuhan",     name: "武汉", lat: 30.5928, lon: 114.3055, region: "其他", featureName: "湖北省" },
];
