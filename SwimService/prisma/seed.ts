import { PrismaClient, Prisma } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

type SeedVenueInput = {
  cityId: string;
  name: string;
  district: string;
  address: string;
  latitude: number;
  longitude: number;
  summary: string;
  imageCaption: string;
  followersCount: number;
  rankingMomentum: number;
  waterQuality: {
    grade: 'excellent' | 'good' | 'attention';
    note: string;
    updatedAt: string;
    turbidity: number;
    waterTemperature: number;
    phValue: number;
    freeChlorine: number;
    combinedChlorine: number;
    orp: number;
    bacterialCount: string;
    totalColiforms: string;
    urea: number;
    cyanuricAcid: number;
    tds: number;
  };
};

const CITY_SEEDS = [
  {
    code: 'la',
    name: '洛杉矶',
    sortOrder: 0,
    center: { latitude: 34.0522, longitude: -118.2437 },
    venues: [],
  },
  {
    code: 'beijing',
    name: '北京',
    sortOrder: 1,
    center: { latitude: 39.9042, longitude: 116.4074 },
    venues: [
      { name: '朝阳云汐游泳馆', district: '朝阳区', address: '北京市朝阳区望京湖畔路 18 号', grade: 'excellent' as const },
      { name: '海淀清波游泳中心', district: '海淀区', address: '北京市海淀区中关村南大街 56 号', grade: 'excellent' as const },
      { name: '东城镜湖恒温泳馆', district: '东城区', address: '北京市东城区东直门外大街 88 号', grade: 'good' as const },
      { name: '西城北展游泳馆', district: '西城区', address: '北京市西城区德胜门西大街 21 号', grade: 'good' as const },
      { name: '通州运河蓝湾泳馆', district: '通州区', address: '北京市通州区运河东大街 66 号', grade: 'excellent' as const },
      { name: '丰台星跃游泳馆', district: '丰台区', address: '北京市丰台区马家堡西路 15 号', grade: 'attention' as const },
      { name: '石景山首钢水境中心', district: '石景山区', address: '北京市石景山区石景山路 68 号', grade: 'good' as const },
      { name: '昌平未来科学城泳馆', district: '昌平区', address: '北京市昌平区定泗路 109 号', grade: 'excellent' as const },
      { name: '大兴临空畅游馆', district: '大兴区', address: '北京市大兴区礼贤东路 27 号', grade: 'good' as const },
      { name: '顺义奥林清澜泳馆', district: '顺义区', address: '北京市顺义区安泰大街 39 号', grade: 'excellent' as const },
    ],
  },
  {
    code: 'shanghai',
    name: '上海',
    sortOrder: 2,
    center: { latitude: 31.2304, longitude: 121.4737 },
    venues: [
      { name: '徐汇镜海泳馆', district: '徐汇区', address: '上海市徐汇区龙华中路 788 号', grade: 'excellent' as const },
      { name: '浦东星河恒温泳馆', district: '浦东新区', address: '上海市浦东新区锦绣路 1288 号', grade: 'excellent' as const },
      { name: '静安晶澜游泳中心', district: '静安区', address: '上海市静安区共和新路 3666 号', grade: 'good' as const },
      { name: '长宁虹桥水韵馆', district: '长宁区', address: '上海市长宁区仙霞西路 99 号', grade: 'good' as const },
      { name: '闵行春申蓝湾泳馆', district: '闵行区', address: '上海市闵行区都市路 5001 号', grade: 'excellent' as const },
      { name: '杨浦滨江跃浪泳馆', district: '杨浦区', address: '上海市杨浦区杨树浦路 2888 号', grade: 'attention' as const },
      { name: '宝山顾村水光泳馆', district: '宝山区', address: '上海市宝山区陆翔路 111 号', grade: 'good' as const },
      { name: '普陀云澈游泳馆', district: '普陀区', address: '上海市普陀区真北路 818 号', grade: 'excellent' as const },
      { name: '松江大学城畅游馆', district: '松江区', address: '上海市松江区文翔路 1900 号', grade: 'good' as const },
      { name: '青浦朱家角水境馆', district: '青浦区', address: '上海市青浦区淀山湖大道 1088 号', grade: 'excellent' as const },
    ],
  },
  {
    code: 'shenzhen',
    name: '深圳',
    sortOrder: 3,
    center: { latitude: 22.5431, longitude: 114.0579 },
    venues: [
      { name: '南山涟漪泳池中心', district: '南山区', address: '深圳市南山区科苑南路 2666 号', grade: 'good' as const },
      { name: '福田市民蓝湾泳馆', district: '福田区', address: '深圳市福田区福华一路 88 号', grade: 'excellent' as const },
      { name: '罗湖银湖恒温馆', district: '罗湖区', address: '深圳市罗湖区银湖路 12 号', grade: 'good' as const },
      { name: '宝安壹方清澜泳馆', district: '宝安区', address: '深圳市宝安区新安一路 99 号', grade: 'excellent' as const },
      { name: '龙华红山游泳中心', district: '龙华区', address: '深圳市龙华区腾龙路 36 号', grade: 'good' as const },
      { name: '龙岗大运水韵馆', district: '龙岗区', address: '深圳市龙岗区龙翔大道 3001 号', grade: 'attention' as const },
      { name: '盐田海景跃浪泳馆', district: '盐田区', address: '深圳市盐田区深盐路 2015 号', grade: 'excellent' as const },
      { name: '坪山燕子湖畅游馆', district: '坪山区', address: '深圳市坪山区坪山大道 5068 号', grade: 'good' as const },
      { name: '光明科学城泳馆', district: '光明区', address: '深圳市光明区光明大道 1888 号', grade: 'excellent' as const },
      { name: '前海湾流线泳馆', district: '南山区', address: '深圳市南山区前海大道 6199 号', grade: 'good' as const },
    ],
  },
];

async function upsertCities() {
  const results: Record<string, { id: string }> = {};

  for (const city of CITY_SEEDS) {
    const result = await prisma.city.upsert({
      where: { code: city.code },
      update: {
        name: city.name,
        status: 'enabled',
        sortOrder: city.sortOrder,
      },
      create: {
        code: city.code,
        name: city.name,
        status: 'enabled',
        sortOrder: city.sortOrder,
      },
      select: { id: true },
    });

    results[city.code] = result;
  }

  return results;
}

async function upsertAdmin() {
  const passwordHash = await hash('admin', 10);

  await prisma.adminAccount.upsert({
    where: { account: 'admin' },
    update: {
      name: '默认管理员',
      status: 'active',
      passwordHash,
    },
    create: {
      account: 'admin',
      name: '默认管理员',
      role: 'admin',
      status: 'active',
      passwordHash,
    },
  });
}

function buildWaterQuality(
  cityName: string,
  venueName: string,
  index: number,
  grade: SeedVenueInput['waterQuality']['grade'],
): SeedVenueInput['waterQuality'] {
  const baseDate = Date.UTC(2026, 6, 12, 6, 30, 0);

  return {
    grade,
    note:
      grade === 'excellent'
        ? `${cityName}样板泳馆，当前主要指标稳定，适合日常训练。`
        : grade === 'good'
          ? `${venueName}整体达标，建议结合更新时间判断。`
          : `${venueName}近期有波动，建议优先关注最新巡检结果。`,
    updatedAt: new Date(baseDate + index * 45 * 60 * 1000).toISOString(),
    turbidity: Number((0.2 + (index % 3) * 0.1).toFixed(2)),
    waterTemperature: Number((27.0 + (index % 5) * 0.3).toFixed(2)),
    phValue: Number((7.1 + (index % 4) * 0.1).toFixed(2)),
    freeChlorine: Number((0.35 + (index % 3) * 0.04).toFixed(2)),
    combinedChlorine: Number((0.08 + (index % 3) * 0.02).toFixed(2)),
    orp: 700 + index * 4,
    bacterialCount: `${8 + index}CFU/mL`,
    totalColiforms: '未检出',
    urea: Number((1.8 + index * 0.12).toFixed(2)),
    cyanuricAcid: Number((16.5 + index * 0.7).toFixed(2)),
    tds: 380 + index * 11,
  };
}

function buildCityVenues(city: (typeof CITY_SEEDS)[number], cityId: string) {
  return city.venues.map((venue, index) => ({
    cityId,
    name: venue.name,
    district: venue.district,
    address: venue.address,
    latitude: Number((city.center.latitude + (index - 4.5) * 0.018).toFixed(6)),
    longitude: Number((city.center.longitude + (index % 5 - 2) * 0.022).toFixed(6)),
    summary: `${city.name}${venue.district}热门训练泳馆，适合通勤后日常游泳与周末打卡。`,
    imageCaption: '测试场馆封面图待上传',
    followersCount: 120 + index * 37,
    rankingMomentum: 6 + (index % 5) * 4,
    waterQuality: buildWaterQuality(city.name, venue.name, index, venue.grade),
  }));
}

async function upsertVenue(input: SeedVenueInput) {
  const activeAdmin = await prisma.adminAccount.findFirst({
    where: { account: 'admin' },
    select: { id: true },
  });

  if (!activeAdmin) {
    throw new Error('默认管理员不存在，无法写入水质报告');
  }

  const existingVenue = await prisma.venue.findFirst({
    where: {
      cityId: input.cityId,
      name: input.name,
      address: input.address,
    },
    select: { id: true },
  });

  const venue = existingVenue
    ? await prisma.venue.update({
        where: { id: existingVenue.id },
        data: {
          district: input.district,
          latitude: new Prisma.Decimal(input.latitude),
          longitude: new Prisma.Decimal(input.longitude),
          summary: input.summary,
          imageCaption: input.imageCaption,
          followersCount: input.followersCount,
          rankingMomentum: input.rankingMomentum,
          status: 'normal',
        },
      })
    : await prisma.venue.create({
        data: {
          cityId: input.cityId,
          name: input.name,
          district: input.district,
          address: input.address,
          latitude: new Prisma.Decimal(input.latitude),
          longitude: new Prisma.Decimal(input.longitude),
          summary: input.summary,
          imageCaption: input.imageCaption,
          followersCount: input.followersCount,
          rankingMomentum: input.rankingMomentum,
          status: 'normal',
        },
      });

  const currentReport = await prisma.waterQualityReport.findFirst({
    where: {
      venueId: venue.id,
      isCurrent: true,
    },
    select: { id: true },
  });

  const reportData = {
    venueId: venue.id,
    grade: input.waterQuality.grade,
    note: input.waterQuality.note,
    updatedAt: new Date(input.waterQuality.updatedAt),
    turbidity: new Prisma.Decimal(input.waterQuality.turbidity),
    waterTemperature: new Prisma.Decimal(input.waterQuality.waterTemperature),
    phValue: new Prisma.Decimal(input.waterQuality.phValue),
    freeChlorine: new Prisma.Decimal(input.waterQuality.freeChlorine),
    combinedChlorine: new Prisma.Decimal(input.waterQuality.combinedChlorine),
    orp: input.waterQuality.orp,
    bacterialCount: input.waterQuality.bacterialCount,
    totalColiforms: input.waterQuality.totalColiforms,
    urea: new Prisma.Decimal(input.waterQuality.urea),
    cyanuricAcid: new Prisma.Decimal(input.waterQuality.cyanuricAcid),
    tds: input.waterQuality.tds,
    createdByAdminId: activeAdmin.id,
    isCurrent: true,
  };

  if (currentReport) {
    await prisma.waterQualityReport.update({
      where: { id: currentReport.id },
      data: reportData,
    });
  } else {
    await prisma.waterQualityReport.create({
      data: reportData,
    });
  }

  return venue;
}

async function main() {
  const cities = await upsertCities();
  await upsertAdmin();

  let totalVenues = 0;

  for (const city of CITY_SEEDS) {
    const cityVenues = buildCityVenues(city, cities[city.code].id);
    for (const venue of cityVenues) {
      await upsertVenue(venue);
      totalVenues += 1;
    }
  }

  console.log(`Seed 完成：已写入/更新 ${CITY_SEEDS.length} 个城市，${totalVenues} 个测试泳馆。`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
