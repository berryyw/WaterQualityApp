export type VenueStatus = "normal" | "disabled";
export type UserStatus = "normal" | "disabled";
export type ReviewStatus = "normal" | "disabled";
export type FollowType = "follow" | "unfollow";
export type CityStatus = "enabled" | "disabled";
export type AdminStatus = "active" | "disabled";

export type QualityMetric = {
  label: string;
  value: string;
};

export type WaterQualityGroup = {
  title: string;
  metrics: QualityMetric[];
};

export type WaterQuality = {
  physical: WaterQualityGroup;
  chemical: WaterQualityGroup;
  biological: WaterQualityGroup;
  other: WaterQualityGroup;
};

export type VenueItem = {
  id: string;
  cityId: string;
  cityName: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  status: VenueStatus;
  followersCount: number;
  waterQualityUpdatedAt: string;
  waterQuality: WaterQuality;
};

export type UserItem = {
  id: string;
  avatarUrl: string;
  nickname: string;
  email: string;
  status: UserStatus;
  joinedAt: string;
};

export type ReviewItem = {
  id: string;
  venueId: string;
  venueName: string;
  userId: string;
  userNickname: string;
  content: string;
  createdAt: string;
  status: ReviewStatus;
};

export type FollowRecordItem = {
  id: string;
  venueId: string;
  venueName: string;
  userId: string;
  userNickname: string;
  type: FollowType;
  operatedAt: string;
};

export type CityItem = {
  id: string;
  name: string;
  code: string;
  status: CityStatus;
  venueCount: number;
};

export type AdminAccountItem = {
  id: string;
  account: string;
  name: string;
  role: "admin";
  status: AdminStatus;
  lastLoginAt: string;
};

export type VenueFilters = {
  name: string;
  location: string;
  status: "all" | VenueStatus;
  startDate: string;
  endDate: string;
};

export type UserFilters = {
  nickname: string;
  email: string;
  status: "all" | UserStatus;
};

export type ReviewFilters = {
  userId: string;
  nickname: string;
  content: string;
  status: "all" | ReviewStatus;
  startDate: string;
  endDate: string;
};

export type FollowFilters = {
  venueId: string;
  venueName: string;
  userId: string;
  userNickname: string;
  type: "all" | FollowType;
  startDate: string;
  endDate: string;
};
