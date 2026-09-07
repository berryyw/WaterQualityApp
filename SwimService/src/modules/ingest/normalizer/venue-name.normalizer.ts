const SUFFIX_STRIPS = [
  '有限公司',
  '股份有限公司',
  '有限责任公司',
  '股份公司',
  '分公司',
  '集团',
  '管理',
  '管理有限公司',
  '运营中心',
  '运营',
  '文化传播',
  '体育发展',
  '体育',
  '健身',
  '健身服务',
  '休闲娱乐',
  '娱乐',
  '俱乐部',
  '会所',
  '（',
  '(',
];

const PREFIX_STRIPS = [
  '北京市',
  '上海市',
  '广州市',
  '深圳市',
  '杭州市',
  '成都市',
  '天津市',
  '重庆市',
  '武汉市',
  '西安市',
  '区',
];

const BRACKET_PATTERN = /[\[【（(（].*?[\]】）)）]/g;
const WHITESPACE_PATTERN = /\s+/g;
const PUNCT_PATTERN = /[，,。.、；;：:·\-—\/\\]/g;

export function normalizeVenueName(rawName: string): string {
  if (!rawName) return '';
  let s = String(rawName).trim();
  s = s.replace(BRACKET_PATTERN, ' ');
  for (const prefix of PREFIX_STRIPS) {
    if (s.startsWith(prefix)) s = s.slice(prefix.length);
  }
  for (const suffix of SUFFIX_STRIPS) {
    if (s.endsWith(suffix)) s = s.slice(0, -suffix.length);
  }
  s = s.replace(PUNCT_PATTERN, ' ');
  s = s.replace(WHITESPACE_PATTERN, ' ');
  s = s.trim();
  return s;
}

export function isVenueNameLikelyPool(normalizedName: string): boolean {
  if (!normalizedName) return false;
  const zhPositive = [
    '游泳馆',
    '游泳池',
    '泳池',
    '游泳',
    '恒温',
    '跳水馆',
    '水世界',
    '水上乐园',
  ];
  const enPositive = [
    'swim',
    'pool',
    'swimming',
    'aquatic',
    'natatorium',
    'lap pool',
    'ymca',
    'ywca',
    'rec center',
    'recreation center',
    'aquatics',
    'swim center',
    'swim school',
  ];
  const positive = [...zhPositive, ...enPositive];
  const zhNegative = [
    '婴儿',
    '儿童乐园',
    '洗澡',
    '浴室',
    '洗浴',
    '桑拿',
    '温泉度假酒店',
    '酒店会议中心',
  ];
  const enNegative = [
    'pool hall',
    'billiard',
    'billiards',
    'wading pool',
    'hot tub',
    'jacuzzi',
    'sauna',
    'spray ground',
    'splash pad',
    'splash park',
    'fishing',
    'fish pond',
    'fountain',
    'spa',
    'hot spring',
  ];
  const negative = [...zhNegative, ...enNegative];
  const lower = normalizedName.toLowerCase();
  const hitPositive = positive.some((p) => lower.includes(p.toLowerCase()));
  const hitNegative = negative.some((n) => lower.includes(n.toLowerCase()));
  return hitPositive && !hitNegative;
}
