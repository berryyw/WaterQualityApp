const PROVINCE_PREFIX =
  /^(北京市|上海市|天津市|重庆市|河北省|山西省|辽宁省|吉林省|黑龙江省|江苏省|浙江省|安徽省|福建省|江西省|山东省|河南省|湖北省|湖南省|广东省|海南省|四川省|贵州省|云南省|陕西省|甘肃省|青海省|台湾省|内蒙古自治区|广西壮族自治区|西藏自治区|宁夏回族自治区|新疆维吾尔自治区|香港特别行政区|澳门特别行政区)/;

const CITY_PREFIX =
  /^(北京|上海|天津|重庆|广州|深圳|杭州|南京|武汉|成都|西安|苏州|郑州|长沙|沈阳|青岛|宁波|东莞|佛山|无锡|合肥|福州|厦门|济南|昆明|哈尔滨|长春|石家庄|太原|南宁|贵阳|兰州|乌鲁木齐|呼和浩特|银川|西宁|海口|三亚)/;

const EN_CITY_PREFIX =
  /^(los angeles|la|san francisco|sf|new york|ny|chicago|houston|phoenix|philadelphia|san antonio|san diego|dallas|san jose|austin|jacksonville|fort worth|columbus|charlotte|indianapolis|seattle|denver|washington|boston|el paso|nashville|detroit|oklahoma city|portland|las vegas|memphis|louisville|baltimore|milwaukee|albuquerque|tucson|fresno|sacramento|long beach|kansas city|mesa|atlanta|virginia beach|colorado springs|raleigh|omaha|miami|oakland|minneapolis|tulsa|wichita|new orleans|arlington)/i;

const EN_STATE_PREFIX =
  /^(california|ca|texas|tx|florida|fl|new york|ny|illinois|il|pennsylvania|pa|ohio|oh|georgia|ga|north carolina|nc|michigan|mi|new jersey|nj|virginia|va|washington|wa|massachusetts|ma|arizona|az|tennessee|tn|indiana|in|missouri|mo|maryland|md|wisconsin|wi|minnesota|mn|colorado|co|south carolina|sc|alabama|al|louisiana|la|kentucky|ky|oregon|or|oklahoma|ok|connecticut|ct|utah|ut|iowa|ia|nevada|nv|arkansas|ar|mississippi|ms|kansas|ks|new mexico|nm|nebraska|ne|west virginia|wv|idaho|id|hawaii|hi|new hampshire|nh|maine|me|montana|mt|rhode island|ri|delaware|de|south dakota|sd|north dakota|nd|alaska|ak|vermont|vt|wyoming|wy)/i;

const WHITESPACE_PATTERN = /\s+/g;
const PUNCT_PATTERN = /[，,。.、；;：:·\-—\/\\（)()（【】\[\]「」『』]/g;

export function normalizeAddress(rawAddress: string): string {
  if (!rawAddress) return '';
  let s = String(rawAddress).trim();
  s = s.replace(PROVINCE_PREFIX, ' ');
  s = s.replace(CITY_PREFIX, ' ');
  s = s.replace(EN_CITY_PREFIX, ' ');
  s = s.replace(EN_STATE_PREFIX, ' ');
  s = s.replace(PUNCT_PATTERN, ' ');
  s = s.replace(WHITESPACE_PATTERN, ' ');
  s = s.trim();
  return s;
}
