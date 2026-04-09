"use client";

import type { Merchant, MerchantReview } from "@/lib/api";

export const DEMO_REVIEW_CATEGORIES = ["餐點", "環境", "服務", "價格", "出餐速度", "其他"] as const;

export type DemoReviewCategory = (typeof DEMO_REVIEW_CATEGORIES)[number];

export type DemoCommentRecord = {
  id: string;
  merchantId: string;
  memberId: number;
  memberName: string;
  category: DemoReviewCategory;
  rating: number;
  content: string;
  createdAt: string;
};

export type DemoMenuRecord = {
  id: string;
  merchantId: string;
  name: string;
  price: number;
  description: string;
  createdByMemberId: number;
  createdByName: string;
  createdAt: string;
};

export type DemoRedemptionRecord = {
  id: string;
  memberId: number;
  rewardId: string;
  rewardName: string;
  costPoints: number;
  grantedTitle: string;
  createdAt: string;
};

type DemoState = {
  comments: DemoCommentRecord[];
  menuRecords: DemoMenuRecord[];
  redemptions: DemoRedemptionRecord[];
};

export type PersonalBadgeLevel = {
  key: string;
  label: string;
  level: number;
  threshold: number;
};

export type StoreBadge = {
  label: string;
  tone: "gold" | "emerald" | "blue" | "orange";
};

export type StoreBuildingInfo = {
  stage: string;
  title: string;
  floors: number;
  score: number;
  nextScore: number;
  badges: StoreBadge[];
};

export type RewardCatalogItem = {
  id: string;
  name: string;
  costPoints: number;
  grantedTitle: string;
  description: string;
};

const STORAGE_KEY = "mealvote.demo.achievement.v1";

const EMPTY_STATE: DemoState = {
  comments: [],
  menuRecords: [],
  redemptions: []
};

export const REWARD_CATALOG: RewardCatalogItem[] = [
  {
    id: "bronze_title",
    name: "銅階勳章稱號",
    costPoints: 20,
    grantedTitle: "銅階評論家",
    description: "顯示在會員名稱下方的入門稱號。"
  },
  {
    id: "silver_title",
    name: "銀階勳章稱號",
    costPoints: 45,
    grantedTitle: "銀階探索者",
    description: "代表你已累積穩定評論與店家參與度。"
  },
  {
    id: "gold_title",
    name: "金階勳章稱號",
    costPoints: 80,
    grantedTitle: "金階美食策展人",
    description: "高活躍會員可展示的進階勳章稱號。"
  }
];

export function readDemoState(): DemoState {
  if (typeof window === "undefined") return EMPTY_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STATE;
    const parsed = JSON.parse(raw) as Partial<DemoState>;
    return {
      comments: Array.isArray(parsed.comments) ? parsed.comments : [],
      menuRecords: Array.isArray(parsed.menuRecords) ? parsed.menuRecords : [],
      redemptions: Array.isArray(parsed.redemptions) ? parsed.redemptions : []
    };
  } catch {
    return EMPTY_STATE;
  }
}

function writeDemoState(state: DemoState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function addDemoComment(payload: Omit<DemoCommentRecord, "id" | "createdAt">) {
  const state = readDemoState();
  const next: DemoCommentRecord = {
    ...payload,
    id: `comment_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString()
  };
  state.comments = [next, ...state.comments];
  writeDemoState(state);
  return next;
}

export function addDemoMenuRecord(payload: Omit<DemoMenuRecord, "id" | "createdAt">) {
  const state = readDemoState();
  const next: DemoMenuRecord = {
    ...payload,
    id: `menu_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString()
  };
  state.menuRecords = [next, ...state.menuRecords];
  writeDemoState(state);
  return next;
}

export function redeemReward(memberId: number, rewardId: string) {
  const reward = REWARD_CATALOG.find((item) => item.id === rewardId);
  if (!reward) {
    throw new Error("找不到指定的勳章稱號。");
  }

  const state = readDemoState();
  const points = getMemberPoints(memberId);
  const spent = getSpentPoints(memberId, state);
  const available = points - spent;
  if (available < reward.costPoints) {
    throw new Error("目前積分不足，無法兌換這個勳章稱號。");
  }

  const record: DemoRedemptionRecord = {
    id: `redeem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    memberId,
    rewardId: reward.id,
    rewardName: reward.name,
    costPoints: reward.costPoints,
    grantedTitle: reward.grantedTitle,
    createdAt: new Date().toISOString()
  };

  state.redemptions = [record, ...state.redemptions];
  writeDemoState(state);
  return record;
}

export function getMemberComments(memberId: number) {
  return readDemoState().comments.filter((comment) => comment.memberId === memberId);
}

export function getMerchantComments(merchantId: string) {
  return readDemoState().comments.filter((comment) => comment.merchantId === merchantId);
}

export function getMerchantMenuRecords(merchantId: string) {
  return readDemoState().menuRecords.filter((item) => item.merchantId === merchantId);
}

export function getMemberRedemptions(memberId: number) {
  return readDemoState().redemptions.filter((record) => record.memberId === memberId);
}

export function getCurrentMemberTitle(memberId: number) {
  return getMemberRedemptions(memberId)[0]?.grantedTitle || "";
}

export function getMemberPoints(memberId: number) {
  return getMemberComments(memberId).length * 5;
}

export function getAvailableMemberPoints(memberId: number) {
  const state = readDemoState();
  return getMemberPoints(memberId) - getSpentPoints(memberId, state);
}

function getSpentPoints(memberId: number, state = readDemoState()) {
  return state.redemptions
    .filter((record) => record.memberId === memberId)
    .reduce((sum, record) => sum + record.costPoints, 0);
}

export function getPersonalBadgeLevels(memberId: number): PersonalBadgeLevel[] {
  const commentCount = getMemberComments(memberId).length;
  const thresholds = [
    { key: "reviewer", label: "評論新星", threshold: 3 },
    { key: "critic", label: "星等評論家", threshold: 6 },
    { key: "architect", label: "蓋樓推進者", threshold: 10 }
  ];

  return thresholds.map((item) => ({
    ...item,
    level: commentCount >= item.threshold ? 1 : 0
  }));
}

export function mergeMerchantReviews(detailReviews: MerchantReview[], demoComments: DemoCommentRecord[]): MerchantReview[] {
  const mappedDemo: MerchantReview[] = demoComments.map((comment, index) => ({
    id: Number(`${Date.now()}`.slice(-6)) + index,
    merchantId: comment.merchantId,
    memberId: comment.memberId,
    memberName: comment.memberName,
    rating: comment.rating,
    comment: `【${comment.category}】${comment.content}`,
    createdAt: comment.createdAt
  }));

  return [...mappedDemo, ...detailReviews].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

export function getMerchantBuildingInfo(merchant: Merchant, detailReviews?: MerchantReview[]) {
  const demoComments = getMerchantComments(merchant.id);
  const allReviewCount = (merchant.reviewCount || 0) + demoComments.length;
  const combinedRatings = [
    ...(detailReviews || []).map((item) => item.rating),
    ...demoComments.map((item) => item.rating)
  ];
  const averageRating = combinedRatings.length
    ? combinedRatings.reduce((sum, rating) => sum + rating, 0) / combinedRatings.length
    : merchant.averageRating || 0;
  const categories = new Set(demoComments.map((comment) => comment.category));
  const score = allReviewCount * 5 + Math.round(averageRating * 4) + categories.size * 3;

  let floors = 1;
  if (score >= 60) floors = 10;
  else if (score >= 48) floors = 8;
  else if (score >= 36) floors = 6;
  else if (score >= 24) floors = 4;
  else if (score >= 12) floors = 2;

  let stage = "木屋";
  let title = "起步店屋";
  let nextScore = 12;
  if (floors >= 10) {
    stage = "高樓大廈";
    title = "城市地標館";
    nextScore = score;
  } else if (floors >= 6) {
    stage = "商圈塔樓";
    title = "商圈成長塔";
    nextScore = 60;
  } else if (floors >= 4) {
    stage = "社群公寓";
    title = "口碑公寓館";
    nextScore = 48;
  } else if (floors >= 2) {
    stage = "雙層店屋";
    title = "蓋樓小館";
    nextScore = 24;
  }

  const badges: StoreBadge[] = [];
  if (averageRating >= 4.5) badges.push({ label: "高星口碑", tone: "gold" });
  if (allReviewCount >= 5) badges.push({ label: "人氣店家", tone: "orange" });
  if (categories.size >= 3) badges.push({ label: "多元評價", tone: "blue" });
  if (floors >= 6) badges.push({ label: "建築升級", tone: "emerald" });

  return {
    stage,
    title,
    floors,
    score,
    nextScore,
    badges
  } satisfies StoreBuildingInfo;
}
