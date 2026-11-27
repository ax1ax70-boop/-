import 'dotenv/config';
import {GoogleGenAI, ThinkingLevel, Type} from '@google/genai';
import crypto from 'crypto';
import express, {type NextFunction, type Request, type Response} from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import {fileURLToPath} from 'url';
import {WebSocket, WebSocketServer} from 'ws';
import type {
  AdminAccountSummary,
  AdminGesture,
  AdminMeetConfig,
  AdminMonthlyAnalytics,
  AdminPermission,
  AdminRole,
  AdminSectionScope,
  AppIcons,
  AutomationSettings,
  CardTheme,
  ClassicDawahCard,
  ContentApprovalAction,
  ContentApprovalRequest,
  ContentApprovalSection,
  CustomAdhkarItem,
  CustomBookItem,
  DailyEngagementBucket,
  DawahCardsMeta,
  DawahQuizQuestion,
  DawahQuizState,
  DawahQuizSubject,
  DeafMuteCommunityMessage,
  DeafMuteJoinRequest,
  DeafMuteMemberRole,
  DeafMuteRoomSnapshot,
  DeafMuteVideoItem,
  FatwaItem,
  FatwaScholarId,
  Language,
  LiveSupportMessage,
  LiveSupportSession,
  MediaType,
  MessageInboxStatus,
  MonthlyAnalyticsPoint,
  MotherOasisChapter,
  MotherOasisItem,
  NafahatMeta,
  PermanentArchiveItem,
  PoetryAnecdoteItem,
  Post,
  QuizLeaderboardEntry,
  SadaMaterialItem,
  ScholarlyHubPayload,
  ScholarlySiteItem,
  SiteAppearanceConfig,
  SiteConfig,
  SocialLink,
  SuggestionItem,
  TelegramAudioItem,
  TwitterQuoteItem,
  VisitorProfile,
  VisitorReviewItem,
  VisitorTicketSummary,
  VolunteerItem,
  YouTubeVideoItem,
} from './src/types.ts';
import {INITIAL_DEAF_MUTE_VIDEOS, appendOnlyMergeById} from './src/data/contentRepository.ts';
import {
  CLASSIC_DAWAH_CARDS,
  DAWAH_CARDS_RESET_EPOCH,
  INITIAL_VISITOR_REVIEWS,
  isConciseClassicCard,
} from './src/data/dawahCards.ts';
import {
  ADHKAR_CATEGORIES,
  ALILMIA_SECTIONS,
  DEFAULT_APP_ICONS,
  DEFAULT_SITE_CONFIG,
  FATWA_SCHOLARS,
  HAJOURI_LESSONS,
  INITIAL_FATAWA,
  INITIAL_MOTHER_OASIS_ITEMS,
  INITIAL_POSTS,
  INITIAL_SOCIAL_LINKS,
  INITIAL_TELEGRAM_AUDIOS,
  INITIAL_TWITTER_QUOTES,
  INITIAL_YOUTUBE_VIDEOS,
  MOTHER_OASIS_SIGNATURE,
  POETRY_ANECDOTES_ITEMS,
  SADA_AL_KHAIR_SCHOLARS,
  SADA_SUNNAH_POETS,
  SH_YAHIA_SECTIONS,
  createDefaultTrend,
} from './src/data/seed.ts';

const MIN_CUMULATIVE_VISITORS = 4580;
const MIN_CUMULATIVE_CLICKS = 8540;

const ALL_ADMIN_PERMISSIONS: AdminPermission[] = [
  'manage_posts',
  'manage_fatawa',
  'manage_adhkar_books',
  'manage_sada',
  'manage_mother_oasis',
  'manage_deaf_mute',
  'manage_comments',
  'manage_tickets',
  'manage_live_support',
  'manage_accounts',
  'manage_settings',
];

function getDefaultPermissionsForAccount(
  role: AdminRole,
  scope: AdminSectionScope = 'all',
): AdminPermission[] {
  if (role === 'admin' || scope === 'all') {
    return [...ALL_ADMIN_PERMISSIONS];
  }
  switch (scope) {
    case 'sada-alkhair':
      return ['manage_sada', 'manage_posts'];
    case 'mother-oasis':
      return ['manage_mother_oasis', 'manage_posts'];
    case 'deaf-mute':
      return ['manage_deaf_mute'];
    case 'fatawa':
      return ['manage_fatawa'];
    case 'adhkar-books':
      return ['manage_adhkar_books'];
    case 'live-support':
      return ['manage_tickets', 'manage_comments'];
    default:
      return ['manage_posts', 'manage_comments'];
  }
}

interface StoredAccount {
  username: string;
  displayName?: string;
  role: AdminRole;
  assignedSection?: AdminSectionScope;
  permissions?: AdminPermission[];
  disabled?: boolean;
  isFounder?: boolean;
  passwordHash: string;
}

interface StoredVisitorRecord extends VisitorProfile {
  firebaseUid?: string;
  username?: string;
  passwordHash?: string;
  bookmarks?: string[];
  likedPostIds?: string[];
  bookmarkedPostIds?: string[];
  bookmarkedFatwaIds?: string[];
  adhkar?: unknown;
  adhkarLifetime?: unknown;
  wird?: unknown;
  quizProgress?: DawahQuizState;
}

interface StoreState {
  posts: Post[];
  fatawa: FatwaItem[];
  motherPrayersCount: number;
  visitorsCount: number;
  clicksCount: number;
  registeredMembersCount: number;
  lastNafahatDate: string;
  lastNafahatUpdatedAt: string;
  lastNafahatSource: 'ai' | 'manual' | 'seed';
  lastDawahCardsAiDate: string;
  lastDawahCardsAiAt: string;
  lastDawahCardsSource: 'ai' | 'manual' | 'seed';
  dawahCardsResetVersion?: string;
  lastPoetryAiDate: string;
  poetryItems: PoetryAnecdoteItem[];
  permanentArchive: PermanentArchiveItem[];
  motherOasisItems: MotherOasisItem[];
  deafMuteVideos: DeafMuteVideoItem[];
  customAdhkar: CustomAdhkarItem[];
  customBooks: CustomBookItem[];
  sadaMaterials: SadaMaterialItem[];
  aiDawahCards: ClassicDawahCard[];
  pendingApprovals: ContentApprovalRequest[];
  dawahRegenUsage: Record<string, {date: string; count: number}>;
  cardEngagement: Record<string, number>;
  liveSupportSessions: LiveSupportSession[];
  meetConfig: AdminMeetConfig;
  deafMuteRoom: {
    publishedLinkUrl: string;
    linkTitle: string;
    updatedAt: string;
    requests: DeafMuteJoinRequest[];
    messages: DeafMuteCommunityMessage[];
  };
  visitorReviews: VisitorReviewItem[];
  visitorAccounts: Record<string, StoredVisitorRecord>;
  nextTicketSeq: number;
  automationSettings: AutomationSettings;
  siteAppearance: SiteAppearanceConfig;
  brandHandle: string;
  socialLinks: SocialLink[];
  appIcons: AppIcons;
  siteConfig: SiteConfig;
  gesture: AdminGesture;
  authSecret: string;
  accounts: StoredAccount[];
  suggestions: SuggestionItem[];
  volunteers: VolunteerItem[];
  dailyStats: Record<string, DailyEngagementBucket>;
  adhkarCategoryStats: Record<string, number>;
  sectionStats: Record<string, {visits: number; interactions: number; shares?: number}>;
  quizDailyStats: Record<string, {participantsCount: number; totalPointsAwarded: number}>;
  quizAiQuestionsByDate: Record<string, DawahQuizQuestion[]>;
  quizLeaderboard: QuizLeaderboardEntry[];
}

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(`mawaedh_salt_2026:${password}`).digest('hex');
}

function hashVisitorPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

function verifyVisitorPassword(password: string, stored?: string): boolean {
  if (!stored) return false;
  if (stored.startsWith('scrypt:')) {
    const parts = stored.split(':');
    if (parts.length !== 3) return false;
    const [, salt, derivedHex] = parts;
    try {
      const actual = crypto.scryptSync(password, salt, 64);
      const expected = Buffer.from(derivedHex, 'hex');
      if (actual.length !== expected.length) return false;
      return crypto.timingSafeEqual(actual, expected);
    } catch {
      return false;
    }
  }
  return safeEqualHex(hashPassword(password), stored);
}

function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

const DEFAULT_ACCOUNTS: StoredAccount[] = [
  {
    username: 'moalwbri',
    displayName: 'المشرف المؤسس · مواعظ وعبر',
    role: 'admin',
    assignedSection: 'all',
    permissions: [...ALL_ADMIN_PERMISSIONS],
    disabled: false,
    isFounder: true,
    passwordHash: hashPassword('715315541'),
  },
  {
    username: 'ax1ax70',
    displayName: 'المحرر العام',
    role: 'editor',
    assignedSection: 'all',
    permissions: ['manage_posts', 'manage_comments', 'manage_fatawa', 'manage_adhkar_books'],
    disabled: false,
    isFounder: false,
    passwordHash: hashPassword('123456'),
  },
  {
    username: 'sada_brother',
    displayName: 'مسؤول خدمة صدى الخير الدعوية',
    role: 'supervisor',
    assignedSection: 'sada-alkhair',
    permissions: ['manage_sada', 'manage_posts'],
    disabled: false,
    isFounder: false,
    passwordHash: hashPassword('sada2026'),
  },
];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');

function getInitialPoetryItems(): PoetryAnecdoteItem[] {
  return POETRY_ANECDOTES_ITEMS.map((entry, idx) => ({
    id: entry.id,
    kind: entry.id.startsWith('anecdote') ? 'anecdote' : 'islamic_poetry',
    title: entry.title,
    author: entry.author,
    summary: entry.summary,
    body: entry.body,
    sourceUrl: entry.sourceUrl,
    isAiGenerated: false,
    createdAt: new Date(Date.now() - idx * 3600_000).toISOString(),
  }));
}

const DEFAULT_AUTOMATION_SETTINGS: AutomationSettings = {
  autoPostWebhookUrl: '',
  enabledPlatforms: {
    facebook: true,
    whatsapp: true,
    x: true,
  },
  adminNotifyWebhookUrl: '',
  telegramBotToken: '',
  telegramChatId: '',
  emailJsServiceId: '',
  emailJsTemplateId: '',
  emailJsPublicKey: '',
};

const DEFAULT_SITE_APPEARANCE: SiteAppearanceConfig = {
  backgroundPreset: 'default',
  brightness: 100,
  announcementEnabled: false,
  announcementText: '',
  announcementUrl: '',
  maintenanceMode: false,
};

const DEFAULT_MEET_CONFIG: AdminMeetConfig = {
  visibility: 'hidden_admin_only',
  activeRoomUrl: '',
};

function getDefaultStore(): StoreState {
  return {
    posts: INITIAL_POSTS,
    fatawa: INITIAL_FATAWA,
    motherPrayersCount: 0,
    visitorsCount: MIN_CUMULATIVE_VISITORS,
    clicksCount: MIN_CUMULATIVE_CLICKS,
    registeredMembersCount: 0,
    lastNafahatDate: '',
    lastNafahatUpdatedAt: '',
    lastNafahatSource: 'seed',
    lastDawahCardsAiDate: '',
    lastDawahCardsAiAt: '',
    lastDawahCardsSource: 'seed',
    dawahCardsResetVersion: CURRENT_DAWAH_CARDS_RESET_VERSION,
    lastPoetryAiDate: '',
    poetryItems: getInitialPoetryItems(),
    permanentArchive: [],
    motherOasisItems: INITIAL_MOTHER_OASIS_ITEMS,
    deafMuteVideos: INITIAL_DEAF_MUTE_VIDEOS,
    customAdhkar: [],
    customBooks: [],
    sadaMaterials: [],
    aiDawahCards: [],
    pendingApprovals: [],
    dawahRegenUsage: {},
    cardEngagement: {},
    liveSupportSessions: [],
    meetConfig: DEFAULT_MEET_CONFIG,
    deafMuteRoom: {
      publishedLinkUrl: '',
      linkTitle: 'لقاء المحادثة المباشرة لفئة الصم والبكم',
      updatedAt: '',
      requests: [],
      messages: [],
    },
    visitorReviews: INITIAL_VISITOR_REVIEWS,
    visitorAccounts: {},
    nextTicketSeq: 1001,
    automationSettings: DEFAULT_AUTOMATION_SETTINGS,
    siteAppearance: DEFAULT_SITE_APPEARANCE,
    brandHandle: '@ax1ax70',
    socialLinks: INITIAL_SOCIAL_LINKS,
    appIcons: DEFAULT_APP_ICONS,
    siteConfig: DEFAULT_SITE_CONFIG,
    gesture: 'long_press',
    authSecret: crypto.randomBytes(32).toString('hex'),
    accounts: DEFAULT_ACCOUNTS,
    suggestions: [],
    volunteers: [],
    dailyStats: {},
    adhkarCategoryStats: {},
    sectionStats: {},
    quizDailyStats: {},
    quizAiQuestionsByDate: {},
    quizLeaderboard: [],
  };
}

function loadStore(): StoreState {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, {recursive: true});
    }
    if (!fs.existsSync(STORE_PATH)) {
      const initial = getDefaultStore();
      fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), 'utf8');
      return initial;
    }
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<StoreState>;
    const defaults = getDefaultStore();
    return {
      posts: appendOnlyMergeById(parsed.posts, INITIAL_POSTS),
      fatawa: appendOnlyMergeById(parsed.fatawa, INITIAL_FATAWA),
      motherPrayersCount:
        typeof parsed.motherPrayersCount === 'number'
          ? parsed.motherPrayersCount
          : defaults.motherPrayersCount,
      visitorsCount:
        typeof parsed.visitorsCount === 'number'
          ? Math.max(MIN_CUMULATIVE_VISITORS, parsed.visitorsCount)
          : defaults.visitorsCount,
      clicksCount:
        typeof parsed.clicksCount === 'number'
          ? Math.max(MIN_CUMULATIVE_CLICKS, parsed.clicksCount)
          : defaults.clicksCount,
      registeredMembersCount: Math.max(
        typeof parsed.registeredMembersCount === 'number' ? parsed.registeredMembersCount : 0,
        parsed.visitorAccounts && typeof parsed.visitorAccounts === 'object'
          ? Object.keys(parsed.visitorAccounts).length
          : 0,
      ),
      lastNafahatDate: typeof parsed.lastNafahatDate === 'string' ? parsed.lastNafahatDate : '',
      lastNafahatUpdatedAt:
        typeof parsed.lastNafahatUpdatedAt === 'string' ? parsed.lastNafahatUpdatedAt : '',
      lastNafahatSource:
        parsed.lastNafahatSource === 'ai' || parsed.lastNafahatSource === 'manual'
          ? parsed.lastNafahatSource
          : 'seed',
      lastDawahCardsAiDate:
        parsed.dawahCardsResetVersion === CURRENT_DAWAH_CARDS_RESET_VERSION &&
        typeof parsed.lastDawahCardsAiDate === 'string'
          ? parsed.lastDawahCardsAiDate
          : '',
      lastDawahCardsAiAt:
        parsed.dawahCardsResetVersion === CURRENT_DAWAH_CARDS_RESET_VERSION &&
        typeof parsed.lastDawahCardsAiAt === 'string'
          ? parsed.lastDawahCardsAiAt
          : '',
      lastDawahCardsSource:
        parsed.dawahCardsResetVersion === CURRENT_DAWAH_CARDS_RESET_VERSION &&
        (parsed.lastDawahCardsSource === 'ai' || parsed.lastDawahCardsSource === 'manual')
          ? parsed.lastDawahCardsSource
          : 'seed',
      dawahCardsResetVersion: CURRENT_DAWAH_CARDS_RESET_VERSION,
      brandHandle:
        typeof parsed.brandHandle === 'string' && parsed.brandHandle.trim()
          ? parsed.brandHandle
          : defaults.brandHandle,
      socialLinks: (() => {
        const list =
          Array.isArray(parsed.socialLinks) && parsed.socialLinks.length > 0
            ? parsed.socialLinks
                .filter((l) => l.id !== 'x_alt')
                .map((l) =>
                  l.id === 'x' &&
                  (l.handle === '@ax1ax70' ||
                    l.url.includes('twitter.com/ax1ax70') ||
                    l.url.includes('x.com/ax1ax70') ||
                    l.name.includes('تويتر') ||
                    l.description.includes('تويتر'))
                    ? {
                        ...l,
                        name: 'منصة إكس (X) · الحساب الرسمي',
                        handle: '@ax1ax71',
                        description:
                          'حساب مواعظ وعبر الرسمي عبر منصة إكس (X) لنشر السلاسل والتغريدات الدعوية الموثقة والتأملات القرآنية.',
                        url: 'https://x.com/ax1ax71',
                      }
                    : l.name.includes('تويتر') || l.description.includes('تويتر')
                      ? {
                          ...l,
                          name: l.name.replace(/تويتر/g, 'منصة إكس (X)'),
                          description: l.description.replace(/تويتر/g, 'منصة إكس (X)'),
                        }
                      : l,
                )
            : [...defaults.socialLinks];
        for (const seedLink of INITIAL_SOCIAL_LINKS) {
          if ((seedLink.id === 'sh_yahia' || seedLink.id === 'alilmia') && !list.some((x) => x.id === seedLink.id)) {
            list.push(seedLink);
          }
        }
        return list;
      })(),
      appIcons: parsed.appIcons ? {...DEFAULT_APP_ICONS, ...parsed.appIcons} : defaults.appIcons,
      siteConfig: parsed.siteConfig
        ? {
            ...DEFAULT_SITE_CONFIG,
            ...parsed.siteConfig,
            appTagline:
              typeof parsed.siteConfig.appTagline === 'string' &&
              !/نفحات إيمانية وحكم خالدة|Timeless Faith Reflections/i.test(parsed.siteConfig.appTagline)
                ? parsed.siteConfig.appTagline
                : '',
            supportEmail:
              typeof parsed.siteConfig.supportEmail === 'string' &&
              parsed.siteConfig.supportEmail.trim() &&
              parsed.siteConfig.supportEmail.trim().toLowerCase() !==
                Buffer.from('cmF3YXlpZWFsZWlsbUBnbWFpbC5jb20=', 'base64').toString()
                ? parsed.siteConfig.supportEmail.trim()
                : DEFAULT_SITE_CONFIG.supportEmail,
            modernUxClause:
              typeof parsed.siteConfig.modernUxClause === 'string' && parsed.siteConfig.modernUxClause.trim()
                ? parsed.siteConfig.modernUxClause.trim()
                : DEFAULT_SITE_CONFIG.modernUxClause,
            motherBadge:
              !parsed.siteConfig.motherBadge || parsed.siteConfig.motherBadge.includes('وقفة بر')
                ? DEFAULT_SITE_CONFIG.motherBadge
                : parsed.siteConfig.motherBadge,
            navHisn:
              !parsed.siteConfig.navHisn || parsed.siteConfig.navHisn.includes('حصن')
                ? DEFAULT_SITE_CONFIG.navHisn
                : parsed.siteConfig.navHisn,
            navAdhkar:
              !parsed.siteConfig.navAdhkar ||
              parsed.siteConfig.navAdhkar === 'الأذكار' ||
              parsed.siteConfig.navAdhkar === 'أدعية وأذكار' ||
              parsed.siteConfig.navAdhkar.includes('حصن')
                ? 'الأذكار والأدعية الجامعة'
                : parsed.siteConfig.navAdhkar,
            hisnTitle:
              !parsed.siteConfig.hisnTitle || parsed.siteConfig.hisnTitle.includes('حصن')
                ? DEFAULT_SITE_CONFIG.hisnTitle
                : parsed.siteConfig.hisnTitle,
          }
        : defaults.siteConfig,
      gesture: parsed.gesture === 'multi_tap' ? 'multi_tap' : 'long_press',
      authSecret:
        typeof parsed.authSecret === 'string' && parsed.authSecret.length >= 16
          ? parsed.authSecret
          : defaults.authSecret,
      accounts: (() => {
        const baseList =
          Array.isArray(parsed.accounts) && parsed.accounts.length >= 1
            ? parsed.accounts.map((acc) => {
                const scope = acc.assignedSection || 'all';
                return {
                  ...acc,
                  assignedSection: scope,
                  displayName: acc.displayName || (acc.username === 'moalwbri' ? 'المشرف المؤسس · مواعظ وعبر' : acc.username),
                  permissions:
                    Array.isArray(acc.permissions) && acc.permissions.length > 0
                      ? acc.permissions
                      : getDefaultPermissionsForAccount(acc.role, scope),
                  disabled: acc.username === 'moalwbri' ? false : Boolean(acc.disabled),
                  isFounder: acc.username === 'moalwbri' ? true : Boolean(acc.isFounder),
                };
              })
            : [...defaults.accounts];
        for (const seedAcc of DEFAULT_ACCOUNTS) {
          if (!baseList.some((a) => a.username === seedAcc.username)) {
            baseList.push(seedAcc);
          }
        }
        return baseList;
      })(),
      lastPoetryAiDate: typeof parsed.lastPoetryAiDate === 'string' ? parsed.lastPoetryAiDate : '',
      poetryItems: appendOnlyMergeById(parsed.poetryItems, defaults.poetryItems),
      permanentArchive: Array.isArray(parsed.permanentArchive) ? parsed.permanentArchive : [],
      motherOasisItems: appendOnlyMergeById(parsed.motherOasisItems, defaults.motherOasisItems).map((it) => ({
        ...it,
        signature:
          it.signature && !/إكرام|عبده علي|Ikram/i.test(it.signature)
            ? it.signature
            : MOTHER_OASIS_SIGNATURE,
      })),
      deafMuteVideos: appendOnlyMergeById(parsed.deafMuteVideos, defaults.deafMuteVideos).map((vid) => ({
        ...vid,
        managerName:
          vid.managerName && !/يونس|عبد\s*الكريم|Abdul\s*Karim/i.test(vid.managerName)
            ? vid.managerName
            : 'إدارة قسم الصم والبكم',
      })),
      customAdhkar: Array.isArray(parsed.customAdhkar) ? parsed.customAdhkar : [],
      customBooks: Array.isArray(parsed.customBooks) ? parsed.customBooks : [],
      sadaMaterials: Array.isArray(parsed.sadaMaterials) ? parsed.sadaMaterials : [],
      aiDawahCards:
        parsed.dawahCardsResetVersion === CURRENT_DAWAH_CARDS_RESET_VERSION &&
        Array.isArray(parsed.aiDawahCards)
          ? parsed.aiDawahCards.filter(
              (c) => isConciseClassicCard(c) && (!c.createdAt || c.createdAt >= DAWAH_CARDS_RESET_EPOCH),
            )
          : [],
      pendingApprovals: Array.isArray(parsed.pendingApprovals) ? parsed.pendingApprovals.slice(0, 300) : [],
      dawahRegenUsage:
        parsed.dawahRegenUsage && typeof parsed.dawahRegenUsage === 'object'
          ? parsed.dawahRegenUsage
          : {},
      cardEngagement:
        parsed.cardEngagement && typeof parsed.cardEngagement === 'object'
          ? parsed.cardEngagement
          : {},
      liveSupportSessions: Array.isArray(parsed.liveSupportSessions)
        ? parsed.liveSupportSessions.slice(0, 80)
        : [],
      meetConfig: parsed.meetConfig
        ? {
            ...DEFAULT_MEET_CONFIG,
            ...parsed.meetConfig,
          }
        : DEFAULT_MEET_CONFIG,
      deafMuteRoom: parsed.deafMuteRoom
        ? {
            publishedLinkUrl:
              typeof parsed.deafMuteRoom.publishedLinkUrl === 'string'
                ? parsed.deafMuteRoom.publishedLinkUrl
                : '',
            linkTitle:
              typeof parsed.deafMuteRoom.linkTitle === 'string' && parsed.deafMuteRoom.linkTitle.trim()
                ? parsed.deafMuteRoom.linkTitle
                : 'لقاء المحادثة المباشرة لفئة الصم والبكم',
            updatedAt:
              typeof parsed.deafMuteRoom.updatedAt === 'string' ? parsed.deafMuteRoom.updatedAt : '',
            requests: Array.isArray(parsed.deafMuteRoom.requests)
              ? parsed.deafMuteRoom.requests.slice(0, 120)
              : [],
            messages: Array.isArray(parsed.deafMuteRoom.messages)
              ? parsed.deafMuteRoom.messages.slice(-120)
              : [],
          }
        : defaults.deafMuteRoom,
      visitorReviews: appendOnlyMergeById(parsed.visitorReviews, defaults.visitorReviews).map((rev) => ({
        ...rev,
        name: rev.name === 'سليمان المكي' ? 'مستفيد من البطاقات' : rev.name,
      })),
      visitorAccounts:
        parsed.visitorAccounts && typeof parsed.visitorAccounts === 'object'
          ? parsed.visitorAccounts
          : {},
      nextTicketSeq:
        typeof parsed.nextTicketSeq === 'number' && parsed.nextTicketSeq >= 1001
          ? parsed.nextTicketSeq
          : 1001,
      automationSettings: parsed.automationSettings
        ? {
            ...DEFAULT_AUTOMATION_SETTINGS,
            ...parsed.automationSettings,
            enabledPlatforms: {
              ...DEFAULT_AUTOMATION_SETTINGS.enabledPlatforms,
              ...(parsed.automationSettings.enabledPlatforms || {}),
            },
          }
        : DEFAULT_AUTOMATION_SETTINGS,
      siteAppearance: parsed.siteAppearance
        ? {
            ...DEFAULT_SITE_APPEARANCE,
            ...parsed.siteAppearance,
          }
        : DEFAULT_SITE_APPEARANCE,
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      volunteers: Array.isArray(parsed.volunteers) ? parsed.volunteers : [],
      dailyStats:
        parsed.dailyStats && typeof parsed.dailyStats === 'object' ? parsed.dailyStats : {},
      adhkarCategoryStats:
        parsed.adhkarCategoryStats && typeof parsed.adhkarCategoryStats === 'object'
          ? parsed.adhkarCategoryStats
          : {},
      sectionStats:
        parsed.sectionStats && typeof parsed.sectionStats === 'object'
          ? parsed.sectionStats
          : {},
      quizDailyStats:
        parsed.quizDailyStats && typeof parsed.quizDailyStats === 'object'
          ? parsed.quizDailyStats
          : {},
      quizAiQuestionsByDate:
        parsed.quizAiQuestionsByDate && typeof parsed.quizAiQuestionsByDate === 'object'
          ? parsed.quizAiQuestionsByDate
          : {},
      quizLeaderboard: Array.isArray(parsed.quizLeaderboard) ? parsed.quizLeaderboard.slice(0, 300) : [],
    };
  } catch {
    return getDefaultStore();
  }
}

function getDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function createEmptyDailyBucket(date: string): DailyEngagementBucket {
  return {
    date,
    visitors: 0,
    clicks: 0,
    sermonReads: 0,
    sermonLikes: 0,
    sermonComments: 0,
    sermonShares: 0,
    adhkarTaps: 0,
    adhkarCompletions: 0,
    motherAmens: 0,
  };
}

function recordDailyMetric(
  field: keyof Omit<DailyEngagementBucket, 'date'>,
  amount = 1,
  dateKey = getDateKey(),
): void {
  const safeAmount = Math.max(0, Math.min(200, Math.floor(amount)));
  if (safeAmount <= 0) return;
  const bucket = store.dailyStats[dateKey]
    ? {...createEmptyDailyBucket(dateKey), ...store.dailyStats[dateKey]}
    : createEmptyDailyBucket(dateKey);
  bucket[field] = (bucket[field] || 0) + safeAmount;
  store.dailyStats[dateKey] = bucket;

  // Keep up to 90 most recent days to bound JSON size cleanly
  const keys = Object.keys(store.dailyStats).sort();
  if (keys.length > 90) {
    for (const oldKey of keys.slice(0, keys.length - 90)) {
      delete store.dailyStats[oldKey];
    }
  }
}

function saveStore(state: StoreState): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, {recursive: true});
    }
    fs.writeFileSync(STORE_PATH, JSON.stringify(state, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to persist store.json:', err);
  }
}

const CURRENT_DAWAH_CARDS_RESET_VERSION = '20261127_diverse_short_v4';
let store = loadStore();
saveStore(store);

function signToken(
  username: string,
  role: AdminRole,
  assignedSection: AdminSectionScope = 'all',
): string {
  const payloadObj = {
    u: username,
    r: role,
    s: assignedSection,
    // Long-lived session until admin manually signs out
    exp: Date.now() + 365 * 24 * 60 * 60 * 1000,
  };
  const payload = Buffer.from(JSON.stringify(payloadObj), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', store.authSecret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyToken(
  token: string,
): {
  username: string;
  role: AdminRole;
  assignedSection: AdminSectionScope;
  permissions: AdminPermission[];
  isFounder: boolean;
} | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payload, sig] = parts;
    const expectedSig = crypto.createHmac('sha256', store.authSecret).update(payload).digest('base64url');
    if (!safeEqualHex(sig, expectedSig)) return null;
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      u?: string;
      r?: AdminRole;
      s?: AdminSectionScope;
      exp?: number;
    };
    if (
      !decoded.u ||
      (decoded.r !== 'admin' && decoded.r !== 'editor' && decoded.r !== 'supervisor') ||
      !decoded.exp
    ) {
      return null;
    }
    if (Date.now() > decoded.exp) return null;
    const account = store.accounts.find((acc) => acc.username === decoded.u);
    if (!account || account.disabled) return null;
    const scope = account.assignedSection || 'all';
    const permissions =
      Array.isArray(account.permissions) && account.permissions.length > 0
        ? account.permissions
        : getDefaultPermissionsForAccount(account.role, scope);
    return {
      username: account.username,
      role: account.role,
      assignedSection: scope,
      permissions,
      isFounder: Boolean(account.isFounder || account.username === 'moalwbri'),
    };
  } catch {
    return null;
  }
}

function signVisitorToken(visitorId: string): string {
  const payloadObj = {
    v: visitorId,
    exp: Date.now() + 365 * 24 * 60 * 60 * 1000,
  };
  const payload = Buffer.from(JSON.stringify(payloadObj), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', store.authSecret).update(`vis:${payload}`).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyVisitorToken(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payload, sig] = parts;
    const expectedSig = crypto.createHmac('sha256', store.authSecret).update(`vis:${payload}`).digest('base64url');
    if (!safeEqualHex(sig, expectedSig)) return null;
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      v?: string;
      exp?: number;
    };
    if (!decoded.v || !decoded.exp || Date.now() > decoded.exp) return null;
    return decoded.v;
  } catch {
    return null;
  }
}

function sanitizeVisitorProfile(rec: StoredVisitorRecord): VisitorProfile {
  const {passwordHash: _hiddenHash, ...safeProfile} = rec;
  void _hiddenHash;
  return safeProfile;
}

interface AuthedRequest extends Request {
  authUser?: {
    username: string;
    role: AdminRole;
    assignedSection: AdminSectionScope;
    permissions: AdminPermission[];
    isFounder: boolean;
  };
}

function isPrimaryAdminUser(user?: AuthedRequest['authUser']): boolean {
  return Boolean(user && (user.role === 'admin' || user.isFounder));
}

function hasAdminPermission(user: AuthedRequest['authUser'], permission: AdminPermission): boolean {
  if (!user) return false;
  if (user.role === 'admin' || user.isFounder || user.assignedSection === 'all') return true;
  return user.permissions.includes(permission);
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const verified = token ? verifyToken(token) : null;
  if (!verified) {
    res.status(401).json({error: 'يلزم تسجيل الدخول بحساب مفعل لإتمام هذا الإجراء'});
    return;
  }
  req.authUser = verified;
  next();
}

function requirePrimaryAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (!isPrimaryAdminUser(req.authUser)) {
      res.status(403).json({error: 'هذه الصلاحية مخصصة للمسؤول الرئيسي فقط'});
      return;
    }
    next();
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({limit: '25mb'}));

  const activeAdminSockets = new Set<WebSocket>();
  const deafMuteRoomClients = new Map<WebSocket, {peerId: string}>();

  const getDeafMuteOnlineCount = (): number => {
    const uniquePeers = new Set<string>();
    for (const [sock, info] of deafMuteRoomClients.entries()) {
      if (sock.readyState === WebSocket.OPEN && info.peerId) {
        uniquePeers.add(info.peerId);
      }
    }
    return uniquePeers.size;
  };

  const resolveDeafMutePeerStatus = (peerId: string): DeafMuteMemberRole => {
    const req = store.deafMuteRoom.requests.find((r) => r.id === peerId);
    if (!req) return 'none';
    if (req.status === 'pending') {
      return req.requestedMode === 'watch' ? 'pending_watch' : 'pending_participate';
    }
    return req.status;
  };

  const buildDeafMuteRoomSnapshotForVisitor = (peerId: string): DeafMuteRoomSnapshot => {
    const yourStatus = peerId ? resolveDeafMutePeerStatus(peerId) : 'none';
    const isApproved = yourStatus === 'approved_viewer' || yourStatus === 'approved_participant';
    const hasPublishedLink = Boolean(store.deafMuteRoom.publishedLinkUrl.trim());
    const approvedCount = store.deafMuteRoom.requests.filter(
      (r) => r.status === 'approved_viewer' || r.status === 'approved_participant',
    ).length;
    return {
      onlineCount: getDeafMuteOnlineCount(),
      approvedCount,
      hasPublishedLink,
      publishedLinkUrl: isApproved ? store.deafMuteRoom.publishedLinkUrl : '',
      linkTitle: store.deafMuteRoom.linkTitle,
      yourStatus,
      messages: isApproved ? store.deafMuteRoom.messages.slice(-80) : [],
    };
  };

  const buildDeafMuteRoomSnapshotForAdmin = (): DeafMuteRoomSnapshot => {
    const approvedCount = store.deafMuteRoom.requests.filter(
      (r) => r.status === 'approved_viewer' || r.status === 'approved_participant',
    ).length;
    return {
      onlineCount: getDeafMuteOnlineCount(),
      approvedCount,
      hasPublishedLink: Boolean(store.deafMuteRoom.publishedLinkUrl.trim()),
      publishedLinkUrl: store.deafMuteRoom.publishedLinkUrl,
      linkTitle: store.deafMuteRoom.linkTitle,
      yourStatus: 'approved_participant',
      messages: store.deafMuteRoom.messages.slice(-80),
      requests: store.deafMuteRoom.requests,
    };
  };

  const broadcastDeafMuteRoom = () => {
    for (const [sock, info] of deafMuteRoomClients.entries()) {
      if (sock.readyState === WebSocket.OPEN) {
        sock.send(
          JSON.stringify({
            type: 'dm_room_state',
            room: buildDeafMuteRoomSnapshotForVisitor(info.peerId),
          }),
        );
      }
    }
    const adminPayload = JSON.stringify({
      type: 'dm_room_state',
      room: buildDeafMuteRoomSnapshotForAdmin(),
    });
    for (const adminSock of activeAdminSockets) {
      if (adminSock.readyState === WebSocket.OPEN) {
        adminSock.send(adminPayload);
      }
    }
  };

  const canModerateDeafMute = (user?: AuthedRequest['authUser']): boolean =>
    Boolean(
      user &&
        (user.role === 'admin' ||
          user.assignedSection === 'all' ||
          user.assignedSection === 'deaf-mute' ||
          user.assignedSection === 'live-support'),
    );

  const needsLiveEscalation = (msg: string): boolean =>
    /تواصل|مقابلة|الصم|البكم|مشرف|إدارة|مشكلة|استفسار|دعم|مكالمة|فيديو|انضمام|وظيفة|عمل|مشاركة|متطوع|contact|admin|interview|deaf|support|help|call/i.test(
      msg,
    );

  // Open CORS & APK/PWA packaging compatibility headers
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  // Android TWA / APK Digital Asset Links open endpoint
  app.get('/.well-known/assetlinks.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    const customLinks = process.env.ASSET_LINKS_JSON;
    if (customLinks) {
      try {
        res.json(JSON.parse(customLinks));
        return;
      } catch {
        // Fallback to empty array if malformed
      }
    }
    res.json([]);
  });

  const activePresence = new Map<string, number>();
  const PRESENCE_TTL_MS = 90_000;

  function updateAndCountOnline(opts?: {touchSessionId?: string; removeSessionId?: string}): number {
    const now = Date.now();
    for (const [sid, ts] of activePresence.entries()) {
      if (now - ts > PRESENCE_TTL_MS) {
        activePresence.delete(sid);
      }
    }
    const cleanRemove = opts?.removeSessionId?.trim().slice(0, 80);
    if (cleanRemove) {
      activePresence.delete(cleanRemove);
    }
    const cleanTouch = opts?.touchSessionId?.trim().slice(0, 80);
    if (cleanTouch) {
      activePresence.set(cleanTouch, now);
    }
    return activePresence.size;
  }

  function normalizeArabicForDedup(raw: string): string {
    return raw
      .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  const SHORT_CARD_COLOR_SCHEMES: Array<[
    '#111827' | '#1E3A8A' | '#991B1B' | '#065F46' | '#B45309',
    '#111827' | '#1E3A8A' | '#991B1B' | '#065F46' | '#B45309',
    '#111827' | '#1E3A8A' | '#991B1B' | '#065F46' | '#B45309',
  ]> = [
    ['#1E3A8A', '#111827', '#1E3A8A'],
    ['#991B1B', '#111827', '#991B1B'],
    ['#111827', '#991B1B', '#065F46'],
    ['#B45309', '#111827', '#B45309'],
    ['#065F46', '#111827', '#1E3A8A'],
  ];

  function resolveDiverseDawahCategory(rawCategory?: string, speakerLine?: string): string {
    const cat = (rawCategory || '').trim();
    const spk = (speakerLine || '').trim();
    if (cat.includes('أحاديث') || spk.includes('رَسُول') || spk.includes('رسول')) {
      return 'أحاديث نبوية صحيحة';
    }
    if (cat.includes('شعر') || spk.includes('الشَّافِعِي') || spk.includes('العَتَاهِي') || spk.includes('أبيات')) {
      return 'أبيات شعر عربية';
    }
    if (cat.includes('طرائف') || cat.includes('نوادر') || spk.includes('طَرَائِف') || spk.includes('نَوَادِر')) {
      return 'طرائف موثقة';
    }
    return 'خواطر ومواعظ قصيرة';
  }

  function normalizeShortThreeLineCard(rawLines: string[]): string[] | null {
    const cleaned = rawLines
      .map((l) => String(l || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    if (cleaned.length === 0) return null;

    const fullText = cleaned.join(' ').replace(/\s+/g, ' ').trim();
    const words = fullText.split(/\s+/).filter(Boolean);
    if (words.length < 4 || words.length > 20 || fullText.length > 125) {
      return null;
    }

    if (
      cleaned.length >= 2 &&
      cleaned.length <= 4 &&
      cleaned.every((line) => line.length <= 44 && line.split(/\s+/).length <= 7)
    ) {
      return cleaned;
    }

    // Rebalance into 3 crisp, visually balanced lines (matching reference card layout)
    const totalLen = fullText.length;
    const t1 = Math.round(totalLen / 3);
    const t2 = Math.round((totalLen * 2) / 3);
    let bestSplit: [string, string, string] | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (let i = 1; i < words.length - 1; i++) {
      for (let j = i + 1; j < words.length; j++) {
        const l1 = words.slice(0, i).join(' ');
        const l2 = words.slice(i, j).join(' ');
        const l3 = words.slice(j).join(' ');
        if (
          l1.length > 44 ||
          l2.length > 44 ||
          l3.length > 44 ||
          i > 7 ||
          j - i > 7 ||
          words.length - j > 7
        ) {
          continue;
        }
        const score = Math.abs(l1.length - t1) + Math.abs(l1.length + l2.length - t2);
        if (score < bestScore) {
          bestScore = score;
          bestSplit = [l1, l2, l3];
        }
      }
    }

    if (bestSplit) return bestSplit;
    return null;
  }

  function getConciseAiDawahCards(): ClassicDawahCard[] {
    return store.aiDawahCards.filter(
      (c) => isConciseClassicCard(c) && (!c.createdAt || c.createdAt >= DAWAH_CARDS_RESET_EPOCH),
    );
  }

  function buildDawahCardsMeta(): DawahCardsMeta {
    return {
      lastUpdatedDate: store.lastDawahCardsAiDate || '',
      lastUpdatedAt: store.lastDawahCardsAiAt || '',
      source: store.lastDawahCardsSource || 'seed',
      count: getConciseAiDawahCards().length,
    };
  }

  function getRotatedSeedCards(date = new Date()): ClassicDawahCard[] {
    const conciseSeeds = CLASSIC_DAWAH_CARDS.filter((c) => isConciseClassicCard(c));
    if (conciseSeeds.length <= 1) return [...conciseSeeds];
    const dayOfYear = Math.floor(
      (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86_400_000,
    );
    const offset = Math.abs(dayOfYear) % conciseSeeds.length;
    return [
      ...conciseSeeds.slice(offset),
      ...conciseSeeds.slice(0, offset),
    ];
  }

  let nafahatSyncInFlight: Promise<{
    updated: boolean;
    heroWisdomText: string;
    heroWisdomAuthor: string;
    siteConfig: SiteConfig;
    nafahatMeta: NafahatMeta;
    post?: Post;
    posts?: Post[];
  }> | null = null;

  async function generateDailyNafahatWithAI(opts?: {force?: boolean}): Promise<{
    updated: boolean;
    heroWisdomText: string;
    heroWisdomAuthor: string;
    siteConfig: SiteConfig;
    nafahatMeta: NafahatMeta;
    post?: Post;
    posts?: Post[];
  }> {
    const todayKey = getDateKey();
    if (!opts?.force && store.lastNafahatDate === todayKey && store.lastNafahatSource === 'ai') {
      return {
        updated: false,
        heroWisdomText: store.siteConfig.heroWisdomText,
        heroWisdomAuthor: store.siteConfig.heroWisdomAuthor,
        siteConfig: store.siteConfig,
        nafahatMeta: {
          lastUpdatedDate: store.lastNafahatDate,
          lastUpdatedAt: store.lastNafahatUpdatedAt,
          source: store.lastNafahatSource,
        },
      };
    }

    if (nafahatSyncInFlight) {
      return nafahatSyncInFlight;
    }

    nafahatSyncInFlight = (async () => {
      const apiKey = process.env.GEMINI_API_KEY?.trim();
      if (!apiKey) {
        throw new Error('مفتاح الذكاء الاصطناعي (GEMINI_API_KEY) غير متوفر في إعدادات الخادم');
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {headers: {'User-Agent': 'aistudio-build'}},
      });

      const knownTitlesSet = new Set<string>([
        ...store.posts.map((p) => normalizeArabicForDedup(p.title)),
        ...store.permanentArchive.map((a) => normalizeArabicForDedup(a.title)),
      ]);

      const recentTitles = [
        ...store.posts.slice(0, 45).map((p) => p.title),
        ...store.permanentArchive.slice(0, 25).map((a) => a.title),
      ]
        .filter(Boolean)
        .slice(0, 60)
        .join(' | ');

      const prompt = `أنت عالم ومحرر محتوى دعوي متمكن على منهج أهل السنة والجماعة. أنشئ الإصدار اليومي الشامل لتطبيق «مواعظ وعبر» ليوم ${todayKey}.
الشروط الشرعية والعلمية الصارمة:
1. التزم تماماً بالقرآن الكريم أو صحيح البخاري ومسلم والسنن الثابتة (التي صححها أئمة الحديث كالبخاري ومسلم والألباني والوادعي) أو أقوال أئمة السلف وعلماء السنة الموثوقين (كابن تيمية وابن القيم وابن رجب وابن كثير والذهبي وابن باز وابن عثيمين). يُمنع تماماً ذكر أي حديث ضعيف أو موضوع أو قصة مكذوبة أو بدون سند موثق.
2. أنشئ موعظة البطاقة الرئيسية (wisdomText) مركّزة وبليغة بين علامتي اقتباس «...» (أقل من 185 حرفاً) مع ذكر قائلها/مصدرها بدقة في (wisdomAuthor).
3. أنشئ ٤ مواد يومية متكاملة (dailyItems) تتجدد يومياً وتغطي التصنيفات التالية بتنوّع وتفصيل مفيد:
   - المادة ١ (أحاديث نبوية صحيحة): حديث نبوي صحيح من البخاري أو مسلم مع شرحه الميسر وفوائده الإيمانية وتخريجه الدقيق.
   - المادة ٢ (قصص وعبر): قصة حقيقية موثقة من القرآن الكريم أو الصحيحين أو سير السلف الصالح مع بيان العبرة العملية منها وذكر المصدر الموثوق.
   - المادة ٣ (إيمانيات أو تزكية النفس أو فقه أو أخلاق): موعظة يومية رصينة أو فائدة فقهية في إصلاح القلب والخشوع.
   - المادة ٤ (خواطر قصيرة أو صدى الخير): رسالة دعوية بليغة جاهزة للنشر عبر خدمة صدى الخير.
4. ممنوع منعاً باتاً تكرار أي موضوع أو عنوان قريب من هذه العناوين السابقة: ${recentTitles || 'لا يوجد'}.`;

      const dailyConfig = {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            wisdomText: {
              type: Type.STRING,
              description: 'موعظة اليوم المختصرة والعميقة بين علامتي اقتباس «...»',
            },
            wisdomAuthor: {
              type: Type.STRING,
              description: 'مصدر الموعظة أو قائلها بدقة علمية',
            },
            dailyItems: {
              type: Type.ARRAY,
              description: 'أربع مواد يومية موثقة في الأحاديث الصحيحة وقصص وعبر والمواعظ',
              items: {
                type: Type.OBJECT,
                properties: {
                  title: {type: Type.STRING, description: 'عنوان عربي بليغ وواضح'},
                  excerpt: {type: Type.STRING, description: 'خلاصة قصيرة من سطرين'},
                  body: {type: Type.STRING, description: 'نص متكامل من فقرتين إلى أربع فقرات'},
                  category: {
                    type: Type.STRING,
                    description:
                      'واحد من: أحاديث نبوية صحيحة، قصص وعبر، إيمانيات، تزكية النفس، فقه، أخلاق، خواطر قصيرة، صدى الخير',
                  },
                  sourceReference: {
                    type: Type.STRING,
                    description: 'المصدر الموثوق بدقة مثل: صحيح البخاري أو مدارج السالكين لابن القيم',
                  },
                },
                required: ['title', 'excerpt', 'body', 'category', 'sourceReference'],
              },
            },
          },
          required: ['wisdomText', 'wisdomAuthor', 'dailyItems'],
        },
      };

      let response;
      try {
        response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: prompt,
          config: dailyConfig,
        });
      } catch {
        response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: prompt,
          config: dailyConfig,
        });
      }

      const rawText =
        response.candidates?.[0]?.content?.parts
          ?.filter((part) => typeof part.text === 'string' && !part.thought)
          .map((part) => part.text)
          .join('') || '';

      if (!rawText.trim()) {
        throw new Error('لم تُرجع خدمة الذكاء الاصطناعي نصاً صالحاً للنفحة اليومية');
      }

      const parsed = JSON.parse(rawText) as {
        wisdomText?: string;
        wisdomAuthor?: string;
        dailyItems?: Array<{
          title?: string;
          excerpt?: string;
          body?: string;
          category?: string;
          sourceReference?: string;
        }>;
      };

      const rawWisdom = (parsed.wisdomText || '').trim();
      const wisdomText = rawWisdom.startsWith('«') ? rawWisdom : `«${rawWisdom.replace(/^[«"]|[»"]$/g, '')}»`;
      const wisdomAuthor = (parsed.wisdomAuthor || 'نفحات متجددة · مواعظ وعبر').trim();
      const allowedCats = [
        'أحاديث نبوية صحيحة',
        'قصص وعبر',
        'إيمانيات',
        'تزكية النفس',
        'فقه',
        'أخلاق',
        'خواطر قصيرة',
        'صدى الخير',
      ];

      if (!wisdomText || wisdomText.length < 10) {
        throw new Error('المحتوى الناتج من الذكاء الاصطناعي غير مكتمل');
      }

      const nowIso = new Date().toISOString();
      store.siteConfig = {
        ...store.siteConfig,
        heroWisdomText: wisdomText,
        heroWisdomAuthor: wisdomAuthor,
      };
      store.lastNafahatDate = todayKey;
      store.lastNafahatUpdatedAt = nowIso;
      store.lastNafahatSource = 'ai';

      const themes: CardTheme[] = ['emerald', 'gold', 'azure', 'midnight'];
      const incomingItems = Array.isArray(parsed.dailyItems) ? parsed.dailyItems.slice(0, 6) : [];
      const generatedPosts: Post[] = incomingItems
        .filter((it) => {
          const title = (it.title || '').trim();
          const body = (it.body || '').trim();
          if (body.length <= 15 || title.length <= 4) return false;
          const norm = normalizeArabicForDedup(title);
          if (!opts?.force && knownTitlesSet.has(norm)) return false;
          knownTitlesSet.add(norm);
          return true;
        })
        .map((it, idx) => {
          const cat = it.category && allowedCats.includes(it.category.trim()) ? it.category.trim() : 'إيمانيات';
          const ref = (it.sourceReference || wisdomAuthor).trim();
          const postId =
            opts?.force
              ? `ai_daily_${todayKey}_${Date.now().toString(36)}_${idx}`
              : idx === 0
                ? `ai_nafahat_${todayKey}`
                : `ai_daily_${todayKey}_${idx}`;
          const postBody = (it.body || '').trim();
          return {
            id: postId,
            title: (it.title || '').trim(),
            excerpt: (it.excerpt || postBody.slice(0, 140)).trim(),
            body: postBody,
            author: ref,
            sourceLabel:
              cat === 'أحاديث نبوية صحيحة'
                ? 'حديث نبوي صحيح · تجديد آلي موثق'
                : cat === 'قصص وعبر'
                  ? 'قصص وعبر · ذكاء اصطناعي موثق'
                  : 'إصدار يومي موثق بالذكاء الاصطناعي',
            category: cat,
            mediaType: cat === 'صدى الخير' ? 'sada' : 'quote',
            platformTag: cat === 'صدى الخير' ? 'صدى الخير' : undefined,
            cardTheme: themes[idx % themes.length],
            likes: 0,
            commentsCount: 0,
            comments: [],
            publishedAtLabel: 'تحديث اليوم',
            createdAt: new Date(Date.now() - idx * 60_000).toISOString(),
            syncedPlatforms: ['telegram', 'x', 'whatsapp', 'instagram'],
            listeningTrend: createDefaultTrend(0),
          };
        });

      for (const genPost of [...generatedPosts].reverse()) {
        const existingIdx = store.posts.findIndex((p) => p.id === genPost.id);
        if (existingIdx >= 0) {
          store.posts[existingIdx] = {
            ...store.posts[existingIdx],
            ...genPost,
            likes: store.posts[existingIdx].likes,
            comments: store.posts[existingIdx].comments,
            commentsCount: store.posts[existingIdx].commentsCount,
            listeningTrend: store.posts[existingIdx].listeningTrend,
          };
        } else {
          store.posts = [genPost, ...store.posts];
        }
      }

      // Keep feed caches aligned with today's refresh
      mediaFeedCache.cacheDate = '';
      scholarlyCache.cacheDate = '';
      liveFatwaArchiveCache.cacheDate = '';

      // Permanently archive AI-generated Nafahat & daily wisdom without deleting past entries
      const archiveAdditions: PermanentArchiveItem[] = [
        {
          id: `arch_wisdom_${todayKey}`,
          title: `نفحة وحكمة يوم ${todayKey}`,
          body: wisdomText,
          excerpt: wisdomText,
          author: wisdomAuthor,
          sectionType: 'wisdom',
          sourceLabel: 'الأرشيف الشامل · النفحة اليومية',
          publishedDate: todayKey,
          createdAt: nowIso,
        },
        ...generatedPosts.map((gp) => ({
          id: `arch_${gp.id}`,
          title: gp.title,
          body: gp.body,
          excerpt: gp.excerpt,
          author: gp.author,
          sectionType: 'nafahat' as const,
          sourceLabel: gp.category,
          publishedDate: todayKey,
          createdAt: gp.createdAt,
        })),
      ];
      const existingArchIds = new Set(store.permanentArchive.map((a) => a.id));
      for (const arch of [...archiveAdditions].reverse()) {
        if (!existingArchIds.has(arch.id)) {
          store.permanentArchive = [arch, ...store.permanentArchive];
          existingArchIds.add(arch.id);
        }
      }

      saveStore(store);

      const primaryDailyPost = generatedPosts[0] || store.posts[0];
      return {
        updated: true,
        heroWisdomText: store.siteConfig.heroWisdomText,
        heroWisdomAuthor: store.siteConfig.heroWisdomAuthor,
        siteConfig: store.siteConfig,
        nafahatMeta: {
          lastUpdatedDate: store.lastNafahatDate,
          lastUpdatedAt: store.lastNafahatUpdatedAt,
          source: store.lastNafahatSource,
        },
        post: primaryDailyPost,
        posts: store.posts,
      };
    })();

    try {
      return await nafahatSyncInFlight;
    } finally {
      nafahatSyncInFlight = null;
    }
  }

  let dawahCardsSyncInFlight: Promise<{
    updated: boolean;
    added: ClassicDawahCard[];
    cards: ClassicDawahCard[];
    aiDawahCards: ClassicDawahCard[];
    dawahCardsMeta: DawahCardsMeta;
  }> | null = null;

  async function generateDailyDawahCardsBatchWithAI(opts?: {
    force?: boolean;
    count?: number;
    resetOld?: boolean;
  }): Promise<{
    updated: boolean;
    added: ClassicDawahCard[];
    cards: ClassicDawahCard[];
    aiDawahCards: ClassicDawahCard[];
    dawahCardsMeta: DawahCardsMeta;
  }> {
    const todayKey = getDateKey();
    const targetCount = Math.min(8, Math.max(1, opts?.count || 5));
    const currentConcise = opts?.resetOld ? [] : getConciseAiDawahCards();
    if (!opts?.force && !opts?.resetOld && store.lastDawahCardsAiDate === todayKey && currentConcise.length > 0) {
      return {
        updated: false,
        added: [],
        cards: appendOnlyMergeById(currentConcise, getRotatedSeedCards()),
        aiDawahCards: currentConcise,
        dawahCardsMeta: buildDawahCardsMeta(),
      };
    }
    if (dawahCardsSyncInFlight) return dawahCardsSyncInFlight;

    dawahCardsSyncInFlight = (async () => {
      const apiKey = process.env.GEMINI_API_KEY?.trim();
      if (!apiKey) {
        throw new Error('مفتاح الذكاء الاصطناعي (GEMINI_API_KEY) غير متوفر لتحديث البطاقات');
      }
      const ai = new GoogleGenAI({apiKey, httpOptions: {headers: {'User-Agent': 'aistudio-build'}}});

      const knownNorms = new Set<string>();
      for (const c of [...currentConcise, ...CLASSIC_DAWAH_CARDS]) {
        const line0 = normalizeArabicForDedup(c.lines?.[0]?.text || '');
        const full = normalizeArabicForDedup(`${c.speakerLine} ${c.lines.map((l) => l.text).join(' ')}`);
        if (line0) knownNorms.add(line0);
        if (full) knownNorms.add(full);
      }

      const recentLinesSample = [
        ...currentConcise.slice(0, 30).map((c) => `${c.speakerLine}: ${c.lines.map((l) => l.text).join(' ')}`),
        ...CLASSIC_DAWAH_CARDS.slice(0, 12).map((c) => `${c.speakerLine}: ${c.lines.map((l) => l.text).join(' ')}`),
      ]
        .filter(Boolean)
        .slice(0, 40)
        .join(' | ');

      const prompt = `أنت باحث علمي وأديب عربي على منهج أهل السنة والجماعة.
أنشئ دفعة يومية متنوعة من ${targetCount} بطاقات قصيرة جداً وسريعة القراءة ليوم ${todayKey} لا تقتصر على الأحاديث فقط، بل تتوزع على الأقسام الأربعة التالية:
1) «خواطر ومواعظ قصيرة»: خاطرة هادئة أو موعظة مؤثرة مختصرة من كلام السلف والعلماء (٣ سطور قصيرة).
2) «أبيات شعر عربية»: بيت شعر عربي فصيح وواضح في الحكمة والزهد والأخلاق (شطران في سطرين واضحين للشافعي أو أبي العتاهية أو ابن المبارك أو غيرهم).
3) «طرائف موثقة»: طرفة حقيقية موثقة من كتب التراث والأدب والعلماء (مثل أخبار الظرفاء لابن الجوزي، البيان والتبيين للجاحظ، عيون الأخبار، طرائف الشعبي والأصمعي وإياس بن معاوية والأحنف بن قيس) — يُشترط الصدق التام والمصداقية ومنع القصص المختلقة أو المشكوك فيها.
4) «أحاديث نبوية صحيحة»: حديث نبوي قصير جداً من جوامع الكلم في الصحيحين فقط.

شروط إلزامية صارمة:
- كل بطاقة تتكون من ٢ إلى ٣ سطور قصيرة جداً (٤ إلى ١٨ كلمة كحد أقصى للبطاقة كلها، مرتبة ومريحة للعين).
- التشكيل العربي الصحيح وذكر المصدر أو الديوان أو الكتاب الموثق بدقة واختصار.
- ممنوع تكرار أي من هذه النصوص: ${recentLinesSample || 'لا يوجد'}.`;

      const schemaConfig = {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            cards: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  speakerLine: {
                    type: Type.STRING,
                    description: 'القائل أو العنوان باختصار مثل: قَالَ الإِمَامُ الشَّافِعِيُّ أو مِنْ طَرَائِفِ الشَّعْبِيِّ أو خَاطِرَةٌ إِيمَانِيَّةٌ أو قَالَ رَسُولُ اللَّهِ ﷺ',
                  },
                  lines: {
                    type: Type.ARRAY,
                    items: {type: Type.STRING},
                    description: '٢ إلى ٣ سطور عربية مشكولة قصيرة جداً (إجمالي ٥ إلى ١٨ كلمة للبطاقة كلها)',
                  },
                  source: {type: Type.STRING, description: 'المصدر الموثق باختصار مثل: ديوان الشافعي أو أخبار الظرفاء لابن الجوزي أو صحيح البخاري'},
                  category: {
                    type: Type.STRING,
                    description: 'أحد هذه التصنيفات الأربعة فقط: «خواطر ومواعظ قصيرة» أو «أبيات شعر عربية» أو «طرائف موثقة» أو «أحاديث نبوية صحيحة»',
                  },
                },
                required: ['speakerLine', 'lines', 'source', 'category'],
              },
            },
          },
          required: ['cards'],
        },
      };

      let response;
      try {
        response = await ai.models.generateContent({model: 'gemini-4-hydrogen', contents: prompt, config: schemaConfig});
      } catch {
        response = await ai.models.generateContent({model: 'gemini-3.1-flash-lite', contents: prompt, config: schemaConfig});
      }

      const rawText =
        response.candidates?.[0]?.content?.parts
          ?.filter((p) => typeof p.text === 'string' && !p.thought)
          .map((p) => p.text)
          .join('') || '';
      const parsed = JSON.parse(rawText) as {
        cards?: Array<{speakerLine?: string; lines?: string[]; source?: string; category?: string}>;
      };

      const nowIso = new Date().toISOString();
      const createdCards: ClassicDawahCard[] = [];

      for (const [idx, rawCard] of (parsed.cards || []).slice(0, 10).entries()) {
        const speakerLine = String(rawCard.speakerLine || '').trim();
        const normalizedLines = Array.isArray(rawCard.lines)
          ? normalizeShortThreeLineCard(rawCard.lines)
          : null;
        if (!speakerLine || !normalizedLines) continue;

        const firstNorm = normalizeArabicForDedup(normalizedLines[0]);
        const fullNorm = normalizeArabicForDedup(`${speakerLine} ${normalizedLines.join(' ')}`);
        if ((firstNorm && knownNorms.has(firstNorm)) || (fullNorm && knownNorms.has(fullNorm))) {
          continue;
        }
        if (firstNorm) knownNorms.add(firstNorm);
        if (fullNorm) knownNorms.add(fullNorm);

        const scheme = SHORT_CARD_COLOR_SCHEMES[(createdCards.length + idx) % SHORT_CARD_COLOR_SCHEMES.length];
        const card: ClassicDawahCard = {
          id: `ai_batch_${todayKey}_${Date.now().toString(36)}_${idx}`,
          speakerLine,
          lines: normalizedLines.map((text, lineIdx) => ({
            text,
            color: scheme[lineIdx % scheme.length],
          })),
          source: String(rawCard.source || 'من المصادر الموثقة').trim(),
          category: resolveDiverseDawahCategory(rawCard.category, speakerLine),
          isAiGenerated: true,
          isTrending: false,
          createdAt: new Date(Date.now() - idx * 1000).toISOString(),
        };
        createdCards.push(card);
        if (createdCards.length >= targetCount) break;
      }

      if (createdCards.length === 0) {
        throw new Error('لم يولّد الذكاء الاصطناعي بطاقات قصيرة مطابقة للشروط في هذه المحاولة');
      }

      store.aiDawahCards = [...createdCards, ...currentConcise].slice(0, 120);
      store.lastDawahCardsAiDate = todayKey;
      store.lastDawahCardsAiAt = nowIso;
      store.lastDawahCardsSource = 'ai';
      store.dawahCardsResetVersion = CURRENT_DAWAH_CARDS_RESET_VERSION;

      const existingArchIds = new Set(store.permanentArchive.map((a) => a.id));
      for (const c of [...createdCards].reverse()) {
        const archId = `arch_${c.id}`;
        if (!existingArchIds.has(archId)) {
          store.permanentArchive = [
            {
              id: archId,
              title: `${c.speakerLine} (${c.category})`,
              body: c.lines.map((l) => l.text).join('\n'),
              excerpt: `${c.lines[0]?.text || ''} — ${c.source}`,
              author: c.speakerLine,
              sectionType: 'wisdom',
              sourceLabel: 'البطاقات الدعوية القصيرة · تحديث يومي آلي',
              publishedDate: todayKey,
              createdAt: c.createdAt || nowIso,
            },
            ...store.permanentArchive,
          ];
          existingArchIds.add(archId);
        }
      }

      saveStore(store);
      return {
        updated: true,
        added: createdCards,
        cards: appendOnlyMergeById(store.aiDawahCards, getRotatedSeedCards()),
        aiDawahCards: store.aiDawahCards,
        dawahCardsMeta: buildDawahCardsMeta(),
      };
    })();

    try {
      return await dawahCardsSyncInFlight;
    } finally {
      dawahCardsSyncInFlight = null;
    }
  }

  function queueContentApprovalRequest(opts: {
    section: ContentApprovalSection;
    action: ContentApprovalAction;
    targetId?: string;
    title: string;
    summary: string;
    payload: Record<string, unknown>;
    user: NonNullable<AuthedRequest['authUser']>;
  }): ContentApprovalRequest {
    const reqItem: ContentApprovalRequest = {
      id: `apr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      section: opts.section,
      action: opts.action,
      targetId: opts.targetId,
      title: opts.title.slice(0, 180),
      summary: opts.summary.slice(0, 260),
      payload: opts.payload,
      submittedBy: opts.user.username,
      submittedByRole: opts.user.role,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    store.pendingApprovals = [reqItem, ...store.pendingApprovals].slice(0, 300);
    saveStore(store);
    return reqItem;
  }

  function applyApprovedContentRequest(reqItem: ContentApprovalRequest): Record<string, unknown> {
    const p = reqItem.payload || {};
    const nowIso = new Date().toISOString();
    switch (reqItem.section) {
      case 'post': {
        if (reqItem.action === 'create') {
          const item = p.item as Post;
          store.posts = [item, ...store.posts.filter((x) => x.id !== item.id)];
          return {appliedItem: item, posts: store.posts};
        }
        if (reqItem.action === 'update' && reqItem.targetId) {
          store.posts = store.posts.map((cur) =>
            cur.id === reqItem.targetId ? {...cur, ...(p.patch as Partial<Post>)} : cur,
          );
          const updated = store.posts.find((x) => x.id === reqItem.targetId);
          return {appliedItem: updated, posts: store.posts};
        }
        if (reqItem.action === 'delete' && reqItem.targetId) {
          store.posts = store.posts.filter((x) => x.id !== reqItem.targetId);
          return {deletedId: reqItem.targetId, posts: store.posts};
        }
        return {};
      }
      case 'dawah_card': {
        if (reqItem.action === 'create') {
          const card = p.item as ClassicDawahCard;
          store.aiDawahCards = [card, ...store.aiDawahCards.filter((x) => x.id !== card.id)].slice(0, 150);
          store.lastDawahCardsSource = 'manual';
          store.lastDawahCardsAiAt = nowIso;
          return {appliedItem: card, aiDawahCards: store.aiDawahCards, dawahCardsMeta: buildDawahCardsMeta()};
        }
        if (reqItem.action === 'update' && reqItem.targetId) {
          store.aiDawahCards = store.aiDawahCards.map((c) =>
            c.id === reqItem.targetId ? {...c, ...(p.patch as Partial<ClassicDawahCard>)} : c,
          );
          const updated = store.aiDawahCards.find((c) => c.id === reqItem.targetId);
          return {appliedItem: updated, aiDawahCards: store.aiDawahCards};
        }
        if (reqItem.action === 'delete' && reqItem.targetId) {
          store.aiDawahCards = store.aiDawahCards.filter((c) => c.id !== reqItem.targetId);
          return {deletedId: reqItem.targetId, aiDawahCards: store.aiDawahCards};
        }
        return {};
      }
      case 'fatwa': {
        if (reqItem.action === 'create') {
          const fatwa = p.item as FatwaItem;
          store.fatawa = [fatwa, ...store.fatawa.filter((f) => f.id !== fatwa.id)];
          return {appliedItem: fatwa, fatawa: store.fatawa};
        }
        if (reqItem.action === 'delete' && reqItem.targetId) {
          store.fatawa = store.fatawa.filter((f) => f.id !== reqItem.targetId);
          return {deletedId: reqItem.targetId, fatawa: store.fatawa};
        }
        return {};
      }
      case 'mother_oasis': {
        if (reqItem.action === 'create') {
          const item = p.item as MotherOasisItem;
          store.motherOasisItems = [item, ...store.motherOasisItems.filter((x) => x.id !== item.id)];
          return {appliedItem: item, motherOasisItems: store.motherOasisItems};
        }
        if (reqItem.action === 'update' && reqItem.targetId) {
          store.motherOasisItems = store.motherOasisItems.map((it) =>
            it.id === reqItem.targetId ? {...it, ...(p.patch as Partial<MotherOasisItem>)} : it,
          );
          const updated = store.motherOasisItems.find((x) => x.id === reqItem.targetId);
          return {appliedItem: updated, motherOasisItems: store.motherOasisItems};
        }
        if (reqItem.action === 'delete' && reqItem.targetId) {
          store.motherOasisItems = store.motherOasisItems.filter((it) => it.id !== reqItem.targetId);
          return {deletedId: reqItem.targetId, motherOasisItems: store.motherOasisItems};
        }
        return {};
      }
      case 'sada_material': {
        if (reqItem.action === 'create') {
          const item = p.item as SadaMaterialItem;
          store.sadaMaterials = [item, ...store.sadaMaterials.filter((x) => x.id !== item.id)];
          return {appliedItem: item, sadaMaterials: store.sadaMaterials};
        }
        if (reqItem.action === 'update' && reqItem.targetId) {
          store.sadaMaterials = store.sadaMaterials.map((m) =>
            m.id === reqItem.targetId ? {...m, ...(p.patch as Partial<SadaMaterialItem>), updatedAt: nowIso} : m,
          );
          const updated = store.sadaMaterials.find((x) => x.id === reqItem.targetId);
          return {appliedItem: updated, sadaMaterials: store.sadaMaterials};
        }
        if (reqItem.action === 'delete' && reqItem.targetId) {
          store.sadaMaterials = store.sadaMaterials.filter((m) => m.id !== reqItem.targetId);
          return {deletedId: reqItem.targetId, sadaMaterials: store.sadaMaterials};
        }
        return {};
      }
      case 'adhkar': {
        if (reqItem.action === 'create') {
          const item = p.item as CustomAdhkarItem;
          store.customAdhkar = [item, ...store.customAdhkar.filter((x) => x.id !== item.id)];
          return {appliedItem: item, customAdhkar: store.customAdhkar};
        }
        if (reqItem.action === 'delete' && reqItem.targetId) {
          store.customAdhkar = store.customAdhkar.filter((d) => d.id !== reqItem.targetId);
          return {deletedId: reqItem.targetId, customAdhkar: store.customAdhkar};
        }
        return {};
      }
      case 'book': {
        if (reqItem.action === 'create') {
          const item = p.item as CustomBookItem;
          store.customBooks = [item, ...store.customBooks.filter((x) => x.id !== item.id)];
          return {appliedItem: item, customBooks: store.customBooks};
        }
        if (reqItem.action === 'delete' && reqItem.targetId) {
          store.customBooks = store.customBooks.filter((b) => b.id !== reqItem.targetId);
          return {deletedId: reqItem.targetId, customBooks: store.customBooks};
        }
        return {};
      }
      case 'deaf_mute_video': {
        if (reqItem.action === 'create') {
          const item = p.item as DeafMuteVideoItem;
          store.deafMuteVideos = [item, ...store.deafMuteVideos.filter((x) => x.id !== item.id)];
          return {appliedItem: item, deafMuteVideos: store.deafMuteVideos};
        }
        if (reqItem.action === 'update' && reqItem.targetId) {
          store.deafMuteVideos = store.deafMuteVideos.map((v) =>
            v.id === reqItem.targetId ? {...v, ...(p.patch as Partial<DeafMuteVideoItem>)} : v,
          );
          const updated = store.deafMuteVideos.find((x) => x.id === reqItem.targetId);
          return {appliedItem: updated, deafMuteVideos: store.deafMuteVideos};
        }
        if (reqItem.action === 'delete' && reqItem.targetId) {
          store.deafMuteVideos = store.deafMuteVideos.filter((v) => v.id !== reqItem.targetId);
          return {deletedId: reqItem.targetId, deafMuteVideos: store.deafMuteVideos};
        }
        return {};
      }
      case 'poetry': {
        if (reqItem.action === 'create') {
          const item = p.item as PoetryAnecdoteItem;
          store.poetryItems = [item, ...store.poetryItems.filter((x) => x.id !== item.id)];
          return {appliedItem: item, poetryItems: store.poetryItems};
        }
        if (reqItem.action === 'delete' && reqItem.targetId) {
          store.poetryItems = store.poetryItems.filter((x) => x.id !== reqItem.targetId);
          return {deletedId: reqItem.targetId, poetryItems: store.poetryItems};
        }
        return {};
      }
      default:
        return {};
    }
  }

  // SSRF-safe external webhook URL validator (blocks private/loopback/link-local hosts)
  function validateExternalWebhookUrl(rawUrl: string): URL | null {
    const trimmed = rawUrl.trim();
    if (!trimmed) return null;
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
      const host = parsed.hostname.toLowerCase();
      if (
        host === 'localhost' ||
        host === '0.0.0.0' ||
        host === '::1' ||
        host.endsWith('.local') ||
        host.endsWith('.internal') ||
        host.startsWith('127.') ||
        host.startsWith('10.') ||
        host.startsWith('192.168.') ||
        host.startsWith('169.254.') ||
        /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
        /^fc00:|^fd00:|^fe80:/i.test(host)
      ) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  async function dispatchSafeWebhook(rawUrl: string, payload: Record<string, unknown>): Promise<boolean> {
    const valid = validateExternalWebhookUrl(rawUrl);
    if (!valid) return false;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(valid.toString(), {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'User-Agent': 'Mawaedh-Bot/1.0'},
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return res.ok;
    } catch {
      return false;
    }
  }

  async function dispatchAdminTicketAlert(summary: string, details: Record<string, unknown>): Promise<void> {
    const cfg = store.automationSettings;
    if (cfg.adminNotifyWebhookUrl) {
      void dispatchSafeWebhook(cfg.adminNotifyWebhookUrl, {event: 'new_ticket', summary, ...details});
    }
    if (cfg.telegramBotToken?.trim() && cfg.telegramChatId?.trim()) {
      const token = cfg.telegramBotToken.trim();
      const chatId = cfg.telegramChatId.trim();
      if (/^\d+:[A-Za-z0-9_-]{20,}$/.test(token)) {
        try {
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({chat_id: chatId, text: summary}),
          });
        } catch {
          // silent background delivery
        }
      }
    }
    if (cfg.emailJsServiceId?.trim() && cfg.emailJsTemplateId?.trim() && cfg.emailJsPublicKey?.trim()) {
      try {
        await fetch('https://api.emailjs.com/api/v1.0/email/send', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            service_id: cfg.emailJsServiceId.trim(),
            template_id: cfg.emailJsTemplateId.trim(),
            user_id: cfg.emailJsPublicKey.trim(),
            template_params: {message: summary, ...details},
          }),
        });
      } catch {
        // silent background delivery
      }
    }
  }

  let poetrySyncInFlight: Promise<{updated: boolean; item?: PoetryAnecdoteItem; poetryItems: PoetryAnecdoteItem[]}> | null = null;

  async function generatePoetryWithAI(opts?: {force?: boolean; preferredKind?: 'islamic_poetry' | 'anecdote'}): Promise<{
    updated: boolean;
    item?: PoetryAnecdoteItem;
    poetryItems: PoetryAnecdoteItem[];
  }> {
    const todayKey = getDateKey();
    if (!opts?.force && store.lastPoetryAiDate === todayKey) {
      return {updated: false, poetryItems: store.poetryItems};
    }
    if (poetrySyncInFlight) return poetrySyncInFlight;

    poetrySyncInFlight = (async () => {
      const apiKey = process.env.GEMINI_API_KEY?.trim();
      if (!apiKey) {
        throw new Error('مفتاح الذكاء الاصطناعي (GEMINI_API_KEY) غير متوفر');
      }
      const ai = new GoogleGenAI({apiKey, httpOptions: {headers: {'User-Agent': 'aistudio-build'}}});
      const kind = opts?.preferredKind || (store.poetryItems.length % 2 === 0 ? 'anecdote' : 'islamic_poetry');
      const existingTitles = store.poetryItems.slice(0, 12).map((p) => p.title).join(' | ');
      const prompt =
        kind === 'anecdote'
          ? `أنت أديب وباحث في التراث العربي والإسلامي. أنشئ طُرفة أو نادرة عربية تاريخية راقية ومبهجة (من نوادر العرب والبلغاء والقضاة كالشعبي وإياس بن معاوية والأصمعي) للترويح المباح دون كذب أو استهزاء بالدين أو فحش أو أي محاذير شرعية. لا تكرر العناوين التالية: ${existingTitles}.`
          : `أنت أديب وشاعر فصيح على منهج أهل السنة. أنشئ قصيدة أو أبياتاً شعرية إسلامية بليغة وموزونة في الزهد أو الحكمة أو مكارم الأخلاق أو شرف العلم بأسلوب شعري أصيل مع ضبط الكلمات. لا تكرر العناوين التالية: ${existingTitles}.`;

      const schemaConfig = {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: {type: Type.STRING, description: 'عنوان أدبي جميل وواضح'},
            author: {type: Type.STRING, description: 'المصدر الأدبي أو القائل الموثق'},
            summary: {type: Type.STRING, description: 'ملخص موجز من سطر واحد'},
            body: {type: Type.STRING, description: 'النص الكامل للأبيات أو الطرفة'},
          },
          required: ['title', 'author', 'summary', 'body'],
        },
      };

      let response;
      try {
        response = await ai.models.generateContent({model: 'gemini-4-hydrogen', contents: prompt, config: schemaConfig});
      } catch {
        response = await ai.models.generateContent({model: 'gemini-3.1-flash-lite', contents: prompt, config: schemaConfig});
      }

      const rawText =
        response.candidates?.[0]?.content?.parts
          ?.filter((part) => typeof part.text === 'string' && !part.thought)
          .map((part) => part.text)
          .join('') || '';
      const parsed = JSON.parse(rawText) as {title?: string; author?: string; summary?: string; body?: string};
      const title = (parsed.title || '').trim();
      const bodyText = (parsed.body || '').trim();
      if (!title || !bodyText) {
        throw new Error('تعذر توليد مادة أدبية مكتملة');
      }

      const nowIso = new Date().toISOString();
      const item: PoetryAnecdoteItem = {
        id: `ai_${kind}_${Date.now().toString(36)}`,
        kind,
        title,
        author: (parsed.author || 'واحة الشعر والطرائف · مواعظ وعبر').trim(),
        summary: (parsed.summary || bodyText.slice(0, 120)).trim(),
        body: bodyText,
        isAiGenerated: true,
        createdAt: nowIso,
      };
      store.poetryItems = [item, ...store.poetryItems];
      store.lastPoetryAiDate = todayKey;

      const archiveItem: PermanentArchiveItem = {
        id: `arch_${item.id}`,
        title: item.title,
        body: item.body,
        excerpt: item.summary,
        author: item.author,
        sectionType: kind === 'anecdote' ? 'anecdote' : 'poetry',
        sourceLabel: kind === 'anecdote' ? 'واحة الشعر والطرائف · نوادر' : 'واحة الشعر والطرائف · شعر إسلامي',
        publishedDate: todayKey,
        createdAt: nowIso,
      };
      store.permanentArchive = [archiveItem, ...store.permanentArchive];
      saveStore(store);
      return {updated: true, item, poetryItems: store.poetryItems};
    })();

    try {
      return await poetrySyncInFlight;
    } finally {
      poetrySyncInFlight = null;
    }
  }

  // Public bootstrap (100% open to all visitors; admin sees hidden items too when authenticated)
  app.get('/api/bootstrap', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    const isAuthed = Boolean(token && verifyToken(token));

    const visiblePosts = (isAuthed
      ? store.posts
      : store.posts
          .filter((p) => !p.hidden)
          .map((p) => ({
            ...p,
            comments: Array.isArray(p.comments) ? p.comments.filter((c) => !c.hidden) : [],
            commentsCount: Array.isArray(p.comments)
              ? p.comments.filter((c) => !c.hidden).length
              : p.commentsCount,
          }))
    ).map((p) => ({
      ...p,
      isTrending: Boolean(p.isTrending || (p.likes || 0) >= 3 || (p.commentsCount || 0) >= 2),
    }));

    const visibleReviews = isAuthed
      ? store.visitorReviews
      : store.visitorReviews.filter((r) => !r.hidden);

    res.json({
      posts: visiblePosts,
      fatawa: store.fatawa,
      gesture: store.gesture,
      motherPrayersCount: store.motherPrayersCount,
      visitorsCount: Math.max(MIN_CUMULATIVE_VISITORS, store.visitorsCount),
      onlineVisitorsCount: updateAndCountOnline(),
      clicksCount: Math.max(MIN_CUMULATIVE_CLICKS, store.clicksCount),
      registeredMembersCount: Math.max(
        store.registeredMembersCount || 0,
        Object.keys(store.visitorAccounts || {}).length,
      ),
      nafahatMeta: {
        lastUpdatedDate: store.lastNafahatDate || '',
        lastUpdatedAt: store.lastNafahatUpdatedAt || '',
        source: store.lastNafahatSource || 'seed',
      },
      dawahCardsMeta: buildDawahCardsMeta(),
      poetryItems: store.poetryItems,
      lastPoetryAiDate: store.lastPoetryAiDate || '',
      permanentArchive: store.permanentArchive,
      motherOasisItems: store.motherOasisItems,
      deafMuteVideos: store.deafMuteVideos,
      customAdhkar: store.customAdhkar,
      customBooks: store.customBooks,
      sadaMaterials: store.sadaMaterials,
      aiDawahCards: getConciseAiDawahCards().map((c) => ({
        ...c,
        isTrending: Boolean(c.isTrending || (store.cardEngagement[c.id] || 0) >= 3),
      })),
      cardEngagement: store.cardEngagement,
      sectionStats: store.sectionStats || {},
      meetConfig:
        isAuthed || store.meetConfig.visibility === 'all_subscribers'
          ? store.meetConfig
          : {visibility: store.meetConfig.visibility, activeRoomUrl: ''},
      visitorReviews: visibleReviews,
      siteAppearance: store.siteAppearance,
      brandHandle: store.brandHandle,
      socialLinks: store.socialLinks,
      appIcons: store.appIcons,
      siteConfig: {
        ...store.siteConfig,
        supportEmail: isAuthed ? store.siteConfig.supportEmail : '',
      },
    });
  });

  // Dawah Cards endpoints (Auto Daily AI Batch + Rotated Classic Seed + AI Instant Regeneration capped at 3 attempts/day)
  app.get('/api/dawah-cards', async (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const todayKey = getDateKey();
    const currentConcise = getConciseAiDawahCards();
    if (
      (store.lastDawahCardsAiDate !== todayKey || currentConcise.length === 0) &&
      process.env.GEMINI_API_KEY?.trim()
    ) {
      await generateDailyDawahCardsBatchWithAI({force: false, count: 5}).catch(() => undefined);
    }
    const cleanAiCards = getConciseAiDawahCards();
    const mergedCards = appendOnlyMergeById(cleanAiCards, getRotatedSeedCards()).map((c) => ({
      ...c,
      isTrending: Boolean(c.isTrending || (store.cardEngagement[c.id] || 0) >= 3),
    }));
    res.json({
      aiDawahCards: cleanAiCards,
      cards: mergedCards,
      cardEngagement: store.cardEngagement,
      dawahCardsMeta: buildDawahCardsMeta(),
    });
  });

  // Admin / Supervisor Manual Fallback AI Refresh for Dawah Cards (Bypasses 3/day visitor cap)
  app.post('/api/admin/dawah-cards/refresh', requireAuth, async (req: AuthedRequest, res) => {
    if (!hasAdminPermission(req.authUser, 'manage_posts')) {
      res.status(403).json({error: 'لا تملك صلاحية تحديث البطاقات الدعوية بالذكاء الاصطناعي'});
      return;
    }
    const body = (req.body || {}) as {count?: number; resetOld?: boolean};
    try {
      const result = await generateDailyDawahCardsBatchWithAI({
        force: true,
        count: typeof body.count === 'number' ? body.count : 5,
        resetOld: Boolean(body.resetOld),
      });
      res.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'تعذر تحديث البطاقات الدعوية بالذكاء الاصطناعي حالياً';
      res.status(503).json({error: msg});
    }
  });

  // Manual Dawah Card Creation / Update / Delete (Gated by Primary Admin approval when submitted by supervisor/editor)
  app.post('/api/admin/dawah-cards', requireAuth, (req: AuthedRequest, res) => {
    if (!hasAdminPermission(req.authUser, 'manage_posts')) {
      res.status(403).json({error: 'لا تملك صلاحية إضافة البطاقات الدعوية'});
      return;
    }
    const body = (req.body || {}) as {
      speakerLine?: string;
      lines?: string[] | string;
      source?: string;
      category?: string;
      qrUrl?: string;
    };
    const speakerLine = String(body.speakerLine || '').trim().slice(0, 180);
    const rawLines = Array.isArray(body.lines)
      ? body.lines.map((l) => String(l || '').trim()).filter(Boolean)
      : String(body.lines || '')
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean);
    if (!speakerLine || rawLines.length === 0) {
      res.status(400).json({error: 'القائل ونص البطاقة مطلوبان'});
      return;
    }
    const palette: Array<'#111827' | '#1E3A8A' | '#991B1B' | '#065F46' | '#B45309'> = [
      '#1E3A8A',
      '#111827',
      '#991B1B',
      '#065F46',
    ];
    const nowIso = new Date().toISOString();
    const card: ClassicDawahCard = {
      id: `man_card_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      speakerLine,
      lines: rawLines.slice(0, 6).map((text, idx) => ({text, color: palette[idx % palette.length]})),
      source: String(body.source || 'فوائد ومواعظ موثقة').trim().slice(0, 180),
      category: String(body.category || 'أحاديث نبوية صحيحة').trim().slice(0, 80),
      isAiGenerated: true,
      isTrending: false,
      createdBy: req.authUser?.username,
      qrUrl: typeof body.qrUrl === 'string' && body.qrUrl.trim() ? body.qrUrl.trim().slice(0, 300) : undefined,
      createdAt: nowIso,
    };

    if (!isPrimaryAdminUser(req.authUser) && req.authUser) {
      const pendingApproval = queueContentApprovalRequest({
        section: 'dawah_card',
        action: 'create',
        title: `${card.speakerLine} (${card.category})`,
        summary: rawLines.slice(0, 2).join(' — '),
        payload: {item: card},
        user: req.authUser,
      });
      res.status(202).json({
        requiresApproval: true,
        pendingApproval,
        message: 'تم إرسال البطاقة الدعوية إلى المسؤول الأول للموافقة عليها قبل النشر للزوار.',
      });
      return;
    }

    store.aiDawahCards = [card, ...store.aiDawahCards].slice(0, 150);
    store.lastDawahCardsSource = 'manual';
    store.lastDawahCardsAiAt = nowIso;
    saveStore(store);
    res.status(201).json({card, aiDawahCards: store.aiDawahCards, dawahCardsMeta: buildDawahCardsMeta()});
  });

  app.put('/api/admin/dawah-cards/:id', requireAuth, (req: AuthedRequest, res) => {
    if (!hasAdminPermission(req.authUser, 'manage_posts')) {
      res.status(403).json({error: 'لا تملك صلاحية تعديل البطاقات الدعوية'});
      return;
    }
    const {id} = req.params;
    const idx = store.aiDawahCards.findIndex((c) => c.id === id);
    if (idx === -1) {
      res.status(404).json({error: 'البطاقة غير موجودة'});
      return;
    }
    const body = (req.body || {}) as {speakerLine?: string; lines?: string[] | string; source?: string; category?: string};
    const palette: Array<'#111827' | '#1E3A8A' | '#991B1B' | '#065F46' | '#B45309'> = [
      '#1E3A8A',
      '#111827',
      '#991B1B',
      '#065F46',
    ];
    const current = store.aiDawahCards[idx];
    const rawLines = Array.isArray(body.lines)
      ? body.lines.map((l) => String(l || '').trim()).filter(Boolean)
      : typeof body.lines === 'string' && body.lines.trim()
        ? body.lines.split('\n').map((l) => l.trim()).filter(Boolean)
        : null;
    const patch: Partial<ClassicDawahCard> = {
      speakerLine:
        typeof body.speakerLine === 'string' && body.speakerLine.trim()
          ? body.speakerLine.trim().slice(0, 180)
          : current.speakerLine,
      lines: rawLines
        ? rawLines.slice(0, 6).map((text, i) => ({text, color: palette[i % palette.length]}))
        : current.lines,
      source:
        typeof body.source === 'string' && body.source.trim()
          ? body.source.trim().slice(0, 180)
          : current.source,
      category:
        typeof body.category === 'string' && body.category.trim()
          ? body.category.trim().slice(0, 80)
          : current.category,
    };

    if (!isPrimaryAdminUser(req.authUser) && req.authUser) {
      const pendingApproval = queueContentApprovalRequest({
        section: 'dawah_card',
        action: 'update',
        targetId: id,
        title: patch.speakerLine || current.speakerLine,
        summary: 'طلب تعديل بطاقة دعوية قائمة',
        payload: {patch},
        user: req.authUser,
      });
      res.status(202).json({
        requiresApproval: true,
        pendingApproval,
        message: 'تم إرسال تعديل البطاقة للمسؤول الأول للموافقة عليه قبل النشر للزوار.',
      });
      return;
    }

    const updated: ClassicDawahCard = {...current, ...patch};
    store.aiDawahCards[idx] = updated;
    saveStore(store);
    res.json({card: updated, aiDawahCards: store.aiDawahCards});
  });

  app.delete('/api/admin/dawah-cards/:id', requireAuth, (req: AuthedRequest, res) => {
    if (!hasAdminPermission(req.authUser, 'manage_posts')) {
      res.status(403).json({error: 'لا تملك صلاحية حذف البطاقات الدعوية'});
      return;
    }
    const {id} = req.params;
    const existing = store.aiDawahCards.find((c) => c.id === id);
    if (!isPrimaryAdminUser(req.authUser) && req.authUser) {
      const pendingApproval = queueContentApprovalRequest({
        section: 'dawah_card',
        action: 'delete',
        targetId: id,
        title: existing?.speakerLine || 'حذف بطاقة دعوية',
        summary: 'طلب حذف بطاقة دعوية',
        payload: {},
        user: req.authUser,
      });
      res.status(202).json({
        requiresApproval: true,
        pendingApproval,
        message: 'تم إرسال طلب حذف البطاقة للمسؤول الأول للموافقة.',
      });
      return;
    }
    store.aiDawahCards = store.aiDawahCards.filter((c) => c.id !== id);
    saveStore(store);
    res.json({aiDawahCards: store.aiDawahCards});
  });

  // Primary Admin Approval Queue Endpoints
  app.get('/api/admin/approvals', requireAuth, (req: AuthedRequest, res) => {
    const isPrimary = isPrimaryAdminUser(req.authUser);
    const items = isPrimary
      ? store.pendingApprovals
      : store.pendingApprovals.filter((a) => a.submittedBy === req.authUser?.username);
    const pendingCount = store.pendingApprovals.filter((a) => a.status === 'pending').length;
    res.json({approvals: items, pendingCount, isPrimaryAdmin: isPrimary});
  });

  app.post('/api/admin/approvals/:id/approve', requirePrimaryAdmin, (req: AuthedRequest, res) => {
    const {id} = req.params;
    const {reviewNote} = (req.body || {}) as {reviewNote?: string};
    const idx = store.pendingApprovals.findIndex((a) => a.id === id);
    if (idx === -1) {
      res.status(404).json({error: 'طلب الاعتماد غير موجود'});
      return;
    }
    const current = store.pendingApprovals[idx];
    if (current.status !== 'pending') {
      res.status(400).json({error: 'تم البت في هذا الطلب مسبقاً'});
      return;
    }
    const appliedSlice = applyApprovedContentRequest(current);
    const updatedApproval: ContentApprovalRequest = {
      ...current,
      status: 'approved',
      reviewedBy: req.authUser?.username || 'moalwbri',
      reviewNote: typeof reviewNote === 'string' && reviewNote.trim() ? reviewNote.trim().slice(0, 300) : undefined,
      reviewedAt: new Date().toISOString(),
    };
    store.pendingApprovals[idx] = updatedApproval;
    saveStore(store);
    res.json({
      approval: updatedApproval,
      section: current.section,
      action: current.action,
      ...appliedSlice,
    });
  });

  app.post('/api/admin/approvals/:id/reject', requirePrimaryAdmin, (req: AuthedRequest, res) => {
    const {id} = req.params;
    const {reviewNote} = (req.body || {}) as {reviewNote?: string};
    const idx = store.pendingApprovals.findIndex((a) => a.id === id);
    if (idx === -1) {
      res.status(404).json({error: 'طلب الاعتماد غير موجود'});
      return;
    }
    const current = store.pendingApprovals[idx];
    if (current.status !== 'pending') {
      res.status(400).json({error: 'تم البت في هذا الطلب مسبقاً'});
      return;
    }
    const updatedApproval: ContentApprovalRequest = {
      ...current,
      status: 'rejected',
      reviewedBy: req.authUser?.username || 'moalwbri',
      reviewNote: typeof reviewNote === 'string' && reviewNote.trim() ? reviewNote.trim().slice(0, 300) : undefined,
      reviewedAt: new Date().toISOString(),
    };
    store.pendingApprovals[idx] = updatedApproval;
    saveStore(store);
    res.json({approval: updatedApproval});
  });

  app.post('/api/dawah-cards/regenerate', async (req, res) => {
    const {visitorKey, preferredCategory} = (req.body || {}) as {
      visitorKey?: string;
      style?: 'light' | 'classic';
      preferredCategory?: string;
    };
    const todayKey = getDateKey();
    const rawIp =
      (typeof req.headers['x-forwarded-for'] === 'string'
        ? req.headers['x-forwarded-for'].split(',')[0]
        : req.ip) || 'visitor';
    const cleanKey = (visitorKey || '').trim().slice(0, 64) || `ip_${crypto.createHash('sha1').update(rawIp).digest('hex').slice(0, 12)}`;
    const currentUsage = store.dawahRegenUsage[cleanKey];
    const usedToday = currentUsage && currentUsage.date === todayKey ? currentUsage.count : 0;

    if (usedToday >= 3) {
      res.status(429).json({
        error: 'بلغت الحد الأقصى اليومي (٣ محاولات لتجديد البطاقات بالذكاء الاصطناعي)، يتجدد الرصيد غداً بإذن الله.',
        usedToday: 3,
        remainingToday: 0,
        limit: 3,
      });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      res.status(503).json({
        error: 'مفتاح الذكاء الاصطناعي (GEMINI_API_KEY) غير متوفر لتجديد البطاقة حالياً',
      });
      return;
    }

    try {
      const ai = new GoogleGenAI({apiKey, httpOptions: {headers: {'User-Agent': 'aistudio-build'}}});
      const currentConcise = getConciseAiDawahCards();
      const existingQuotes = currentConcise
        .slice(0, 12)
        .map((c) => `${c.speakerLine}: ${c.lines.map((l) => l.text).join(' ')}`)
        .join(' | ');
      const rotationCats = [
        'خواطر ومواعظ قصيرة',
        'أبيات شعر عربية',
        'طرائف موثقة',
        'أحاديث نبوية صحيحة',
      ];
      const chosenCat =
        preferredCategory && rotationCats.includes(preferredCategory)
          ? preferredCategory
          : rotationCats[currentConcise.length % rotationCats.length];
      const prompt = `أنت باحث علمي وأديب عربي على منهج أهل السنة والجماعة.
أنشئ بطاقة واحدة قصيرة جداً وسريعة القراءة في تصنيف: «${chosenCat}».
الأنواع المعتمدة لدينا هي:
- خواطر ومواعظ قصيرة هادئة ومؤثرة.
- أبيات شعر عربية فصيحة وواضحة (بيتان/شطران في سطرين).
- طرائف حقيقية معروفة وموثقة من كتب الأدب والعلماء (مثل أخبار الظرفاء والأذكياء لابن الجوزي أو الجاحظ أو الأصمعي أو الشعبي) مع الالتزام التام بالصدق وتجنب المختلقات.
- أحاديث نبوية قصيرة من الصحيحين.

شروط إلزامية:
- ٢ إلى ٣ سطور عربية مشكولة قصيرة جداً (إجمالي ٥ إلى ١٨ كلمة كحد أقصى للبطاقة كلها).
- ذكر القائل والمصدر الموثق بدقة واختصار.
- لا تكرر أياً من العبارات السابقة: ${existingQuotes || 'لا يوجد'}.`;

      const schemaConfig = {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            speakerLine: {
              type: Type.STRING,
              description: 'القائل أو العنوان مختصراً مشكولاً مثل: قَالَ الإِمَامُ الشَّافِعِيُّ أو مِنْ طَرَائِفِ الشَّعْبِيِّ أو خَاطِرَةٌ هَادِئَةٌ أو قَالَ رَسُولُ اللَّهِ ﷺ',
            },
            lines: {
              type: Type.ARRAY,
              items: {type: Type.STRING},
              description: '٢ إلى ٣ سطور قصيرة جداً (إجمالي ٥ إلى ١٨ كلمة) مشكولة تمثل خاطرة أو بيت شعر أو طرفة موثقة أو حديثاً قصيراً',
            },
            source: {type: Type.STRING, description: 'المصدر الموثق باختصار'},
            category: {
              type: Type.STRING,
              description: 'أحد التصنيفات: «خواطر ومواعظ قصيرة» أو «أبيات شعر عربية» أو «طرائف موثقة» أو «أحاديث نبوية صحيحة»',
            },
          },
          required: ['speakerLine', 'lines', 'source', 'category'],
        },
      };

      let response;
      try {
        response = await ai.models.generateContent({model: 'gemini-4-hydrogen', contents: prompt, config: schemaConfig});
      } catch {
        response = await ai.models.generateContent({model: 'gemini-3.1-flash-lite', contents: prompt, config: schemaConfig});
      }

      const rawText =
        response.candidates?.[0]?.content?.parts
          ?.filter((p) => typeof p.text === 'string' && !p.thought)
          .map((p) => p.text)
          .join('') || '';
      const parsed = JSON.parse(rawText) as {
        speakerLine?: string;
        lines?: string[];
        source?: string;
        category?: string;
      };
      const normalizedLines = Array.isArray(parsed.lines)
        ? normalizeShortThreeLineCard(parsed.lines)
        : null;
      const speakerLine = (parsed.speakerLine || '').trim();
      if (!speakerLine || !normalizedLines) {
        res.status(502).json({error: 'لم تطابق البطاقة المولّدة طول ٢ إلى ٣ سطور قصيرة، يرجى المحاولة مجدداً'});
        return;
      }

      const nowIso = new Date().toISOString();
      const scheme = SHORT_CARD_COLOR_SCHEMES[currentConcise.length % SHORT_CARD_COLOR_SCHEMES.length];
      const card: ClassicDawahCard = {
        id: `ai_card_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
        speakerLine,
        lines: normalizedLines.map((text, idx) => ({
          text,
          color: scheme[idx % scheme.length],
        })),
        source: (parsed.source || 'من المصادر الموثقة').trim(),
        category: resolveDiverseDawahCategory(parsed.category || chosenCat, speakerLine),
        isAiGenerated: true,
        isTrending: false,
        createdAt: nowIso,
      };

      store.aiDawahCards = [card, ...currentConcise].slice(0, 120);
      const nextCount = usedToday + 1;
      store.dawahRegenUsage[cleanKey] = {date: todayKey, count: nextCount};

      // Clean stale usage keys older than today so JSON stays compact
      for (const [k, v] of Object.entries(store.dawahRegenUsage)) {
        if (!v || v.date !== todayKey) {
          delete store.dawahRegenUsage[k];
        }
      }

      const archItem: PermanentArchiveItem = {
        id: `arch_${card.id}`,
        title: `${card.speakerLine} (${card.category})`,
        body: card.lines.map((l) => l.text).join('\n'),
        excerpt: `${card.lines[0]?.text || ''} — ${card.source}`,
        author: card.speakerLine,
        sectionType: 'wisdom',
        sourceLabel: 'البطاقات الدعوية القصيرة · تجديد فوري بالذكاء الاصطناعي',
        publishedDate: todayKey,
        createdAt: nowIso,
      };
      store.permanentArchive = [archItem, ...store.permanentArchive];
      saveStore(store);

      res.status(201).json({
        card,
        aiDawahCards: store.aiDawahCards,
        usedToday: nextCount,
        remainingToday: Math.max(0, 3 - nextCount),
        limit: 3,
      });
    } catch {
      res.status(503).json({error: 'تعذر توليد البطاقة بالذكاء الاصطناعي حالياً، يرجى المحاولة بعد قليل'});
    }
  });

  app.post('/api/admin/ai-generate', requireAuth, async (req: AuthedRequest, res) => {
    const body = (req.body || {}) as {
      section?: string;
      topic?: string;
      subOption?: string;
    };
    const section = (body.section || '').trim();
    const topic = (body.topic || '').trim().slice(0, 240);
    const subOption = (body.subOption || '').trim().slice(0, 120);

    const permissionMap: Record<string, AdminPermission> = {
      post: 'manage_posts',
      story: 'manage_posts',
      sada: 'manage_sada',
      fatwa: 'manage_fatawa',
      'mother-oasis': 'manage_mother_oasis',
      adhkar: 'manage_adhkar_books',
      book: 'manage_adhkar_books',
      'deaf-mute': 'manage_deaf_mute',
    };
    const requiredPerm = permissionMap[section];
    if (!requiredPerm) {
      res.status(400).json({error: 'القسم المطلوب غير مدعوم في التوليد الذكي'});
      return;
    }
    if (!hasAdminPermission(req.authUser, requiredPerm)) {
      res.status(403).json({error: 'لا تملك صلاحية التوليد في هذا القسم'});
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      res.status(503).json({error: 'مفتاح الذكاء الاصطناعي (GEMINI_API_KEY) غير متوفر حالياً'});
      return;
    }

    const ai = new GoogleGenAI({apiKey, httpOptions: {headers: {'User-Agent': 'aistudio-build'}}});
    const baseMethodology =
      'أنت محرر علمي شرعي على منهج أهل السنة والجماعة (السلف الصالح: الكتاب والسنة بفهم سلف الأمة، وأئمة الدعوة السلفية مثل الشيخ ابن باز وابن عثيمين والألباني والوادعي والشيخ يحيى الحجوري). لا تذكر أي أسماء شخصية كاملة لأشخاص معاصرين (استخدم ألقاباً عامة أو الكنية المختصرة فقط مثل: أم محمد عند الحاجة لواحة الوالدة). لا تضع روابط خارجية ولا أحاديث ضعيفة.';

    try {
      let prompt = '';
      let responseSchema: Record<string, unknown> = {};

      if (section === 'post' || section === 'story') {
        const isStory = section === 'story' || subOption === 'قصص وعبر';
        prompt = `${baseMethodology}
اكتب مسودة ${isStory ? 'قصة دعوية أو موقف تربوي معبّر بعنوان مشوّق وقصة متكاملة ومؤثرة' : 'موعظة أو خاطرة إيمانية موثقة'} للنشر في قسم "${isStory ? 'قصص وعبر' : subOption || 'رقائق ومواعظ'}".
${topic ? `الموضوع المقترح من المشرف: ${topic}` : 'اختر موضوعاً نافعاً ملامساً للقلوب في التوحيد أو الصبر أو حسن الظن بالله أو بر الوالدين.'}`;
        responseSchema = {
          type: Type.OBJECT,
          properties: {
            title: {type: Type.STRING, description: 'عنوان واضح ومشوّق للموعظة أو القصة'},
            author: {type: Type.STRING, description: 'اسم الإمام أو العالم السلفي أو "موعظة من هدي السلف"'},
            category: {type: Type.STRING},
            body: {type: Type.STRING, description: 'نص المقال أو القصة كاملاً منسقاً بفقرات واضحة'},
            sourceLabel: {type: Type.STRING, description: 'المصدر أو التوثيق الشرعي'},
          },
          required: ['title', 'author', 'category', 'body', 'sourceLabel'],
        };
      } else if (section === 'mother-oasis') {
        const chapterLabel =
          subOption === 'lectures'
            ? 'المحاضرات والدروس المفرغة'
            : subOption === 'stories'
              ? 'قصص أم محمد (قصص وعبر من واقع الحياة)'
              : 'المؤلفات والكتب الدعوية والتربوية';
        prompt = `${baseMethodology}
اكتب مسودة تربوية دافئة وصادقة لقسم «واحة وقصص الوالدة: أم محمد» في باب "${chapterLabel}".
ممنوع ذكر أي اسم شخصي كامل نهائياً؛ يُكتفى بأسلوب الوالدة الحكيمة أم محمد.
${topic ? `الفكرة المطلوبة: ${topic}` : 'اكتب مادة مؤثرة عن تربية البيوت على القرآن أو ثمرة بر الوالدين وحسن التوكل على الله.'}`;
        responseSchema = {
          type: Type.OBJECT,
          properties: {
            title: {type: Type.STRING},
            body: {type: Type.STRING, description: 'النص الكامل منسقاً في فقرتين إلى أربع فقرات'},
          },
          required: ['title', 'body'],
        };
      } else if (section === 'sada') {
        prompt = `${baseMethodology}
أعد مادة علمية أو دعوية موجزة ومحررة لقسم «صدى الخير» تابعة للعلم/التصنيف (${subOption || 'فوائد ومواعظ'}).
${topic ? `الموضوع: ${topic}` : 'اختر فائدة إيمانية أو تربوية سلفية أصيلة ومضبوطة.'}`;
        responseSchema = {
          type: Type.OBJECT,
          properties: {
            title: {type: Type.STRING},
            category: {type: Type.STRING},
            body: {type: Type.STRING},
          },
          required: ['title', 'category', 'body'],
        };
      } else if (section === 'fatwa') {
        prompt = `${baseMethodology}
أعد مسودة سؤال شرعي مهم وجواب علمي مؤصل بالدليل من الكتاب والسنة وأقوال أئمة السنة في باب (${subOption || 'العقيدة والعبادات'}).
${topic ? `موضوع الفتوى: ${topic}` : 'اختر مسألة يحتاجها عامة المسلمين في العقيدة أو الصلاة أو الأذكار.'}`;
        responseSchema = {
          type: Type.OBJECT,
          properties: {
            category: {type: Type.STRING},
            question: {type: Type.STRING},
            answer: {type: Type.STRING},
            source: {type: Type.STRING},
          },
          required: ['category', 'question', 'answer', 'source'],
        };
      } else if (section === 'adhkar') {
        prompt = `${baseMethodology}
أخرج ذكراً أو دعاءً ثابتاً صحيحاً من الكتاب والسنة لنشره في قسم الأذكار والأدعية الجامعة (${subOption || 'أذكار الصباح والمساء والأدعية'}).
${topic ? `الموضوع: ${topic}` : 'اختر ذكراً نافعاً مضبوطاً بالتشكيل مع ذكر فضله الصحيح وتخريجه.'}`;
        responseSchema = {
          type: Type.OBJECT,
          properties: {
            title: {type: Type.STRING},
            text: {type: Type.STRING, description: 'نص الذكر مشكولاً بالكامل'},
            fadl: {type: Type.STRING, description: 'فضل الذكر ومصدره الصحيح'},
            targetCount: {type: Type.INTEGER, description: 'عدد التكرار المشروع مثل 1 أو 3 أو 10 أو 100'},
          },
          required: ['title', 'text', 'fadl', 'targetCount'],
        };
      } else if (section === 'book') {
        prompt = `${baseMethodology}
أعد بطاقة وصفية علمية محررة لكتاب أو رسالة سلفية نافعة لقسم المكتبة العلمية (${subOption || 'مكتبة الشيخ يحيى الحجوري والأئمة الكبار'}).
${topic ? `الكتاب أو الموضوع: ${topic}` : 'اقترح رسالة علمية مشهورة في العقيدة أو الفقه أو السلوك.'}`;
        responseSchema = {
          type: Type.OBJECT,
          properties: {
            title: {type: Type.STRING},
            author: {type: Type.STRING},
            category: {type: Type.STRING},
            summary: {type: Type.STRING},
          },
          required: ['title', 'author', 'category', 'summary'],
        };
      } else {
        prompt = `${baseMethodology}
أعد محتوى درس مرئي/بصري بلغة واضحة جداً ومباشرة وميسرة لإخواننا في قسم الصم والبكم في تصنيف (${subOption || 'العقيدة والتوحيد'}).
${topic ? `الموضوع: ${topic}` : 'اختر درساً أساسياً في صفة الصلاة أو أركان التوحيد أو الأذكار.'}`;
        responseSchema = {
          type: Type.OBJECT,
          properties: {
            title: {type: Type.STRING},
            category: {type: Type.STRING},
            description: {type: Type.STRING, description: 'شرح مبسط وواضح يناسب العرض البصري'},
            benefitText: {type: Type.STRING, description: 'الخلاصة والفائدة العلمية المركزة'},
          },
          required: ['title', 'category', 'description', 'benefitText'],
        };
      }

      const config = {
        responseMimeType: 'application/json',
        responseSchema,
      };

      let response;
      try {
        response = await ai.models.generateContent({model: 'gemini-4-hydrogen', contents: prompt, config});
      } catch {
        response = await ai.models.generateContent({model: 'gemini-3.1-flash-lite', contents: prompt, config});
      }

      const rawText =
        response.candidates?.[0]?.content?.parts
          ?.filter((p) => typeof p.text === 'string' && !p.thought)
          .map((p) => p.text)
          .join('') || '';
      const draft = JSON.parse(rawText) as Record<string, unknown>;
      res.json({draft});
    } catch {
      res.status(503).json({error: 'تعذر التوليد بالذكاء الاصطناعي حالياً، يرجى المحاولة مجدداً'});
    }
  });

  app.post('/api/dawah-cards/:id/engage', (req, res) => {
    const {id} = req.params;
    const nextEng = (store.cardEngagement[id] || 0) + 1;
    store.cardEngagement[id] = nextEng;
    store.aiDawahCards = store.aiDawahCards.map((c) =>
      c.id === id ? {...c, isTrending: c.isTrending || nextEng >= 3} : c,
    );
    store.clicksCount += 1;
    recordDailyMetric('clicks', 1);
    saveStore(store);
    res.json({id, engagement: nextEng, isTrending: nextEng >= 3, cardEngagement: store.cardEngagement});
  });

  // Public & Cloud Sada Al-Khair Service Materials
  app.get('/api/sada-materials', (_req, res) => {
    res.json({items: store.sadaMaterials});
  });

  app.post('/api/admin/sada-materials', requireAuth, (req: AuthedRequest, res) => {
    if (!hasAdminPermission(req.authUser, 'manage_sada')) {
      res.status(403).json({error: 'هذه الصلاحية مخصصة لمسؤول خدمة صدى الخير أو المدير الرئيسي'});
      return;
    }
    const body = req.body as Partial<SadaMaterialItem>;
    const title = (body.title || '').trim();
    const contentBody = (body.body || '').trim();
    const speakerName = (body.speakerName || body.scholarName || '').trim();
    if (!title || !contentBody || !speakerName) {
      res.status(400).json({error: 'العنوان والمحتوى واسم الشيخ أو الشاعر مطلوبان'});
      return;
    }
    let cleanExternalUrl: string | undefined;
    if (typeof body.externalUrl === 'string' && body.externalUrl.trim()) {
      const parsed = validateExternalWebhookUrl(body.externalUrl);
      if (!parsed) {
        res.status(400).json({error: 'الرابط الخارجي يجب أن يبدأ بـ https:// أو http:// دون عناوين محلية'});
        return;
      }
      cleanExternalUrl = parsed.toString();
    }
    const resolvedSpeakerType: 'scholar' | 'poet' = body.speakerType === 'poet' ? 'poet' : 'scholar';
    const resolvedContentType =
      body.contentType || (resolvedSpeakerType === 'poet' ? 'poetry' : cleanExternalUrl ? 'audio_link' : 'article');
    const item: SadaMaterialItem = {
      id: `sada_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      speakerType: resolvedSpeakerType,
      speakerName: speakerName.slice(0, 120),
      scholarName: speakerName.slice(0, 120),
      contentType: resolvedContentType,
      title: title.slice(0, 180),
      body: contentBody.slice(0, 5000),
      category: (body.category || 'فوائد ومواعظ').trim().slice(0, 80),
      externalUrl: cleanExternalUrl,
      sourceLabel: (body.sourceLabel || 'خدمة صدى الخير الدعوية').trim().slice(0, 140),
      createdBy: req.authUser?.username,
      createdAt: new Date().toISOString(),
    };
    if (!isPrimaryAdminUser(req.authUser) && req.authUser) {
      const pendingApproval = queueContentApprovalRequest({
        section: 'sada_material',
        action: 'create',
        title: item.title,
        summary: `${item.speakerName} · ${item.category}`,
        payload: {item},
        user: req.authUser,
      });
      res.status(202).json({
        requiresApproval: true,
        pendingApproval,
        message: 'تم إرسال المادة للمسؤول الأول للموافقة عليها قبل النشر للزوار.',
      });
      return;
    }
    store.sadaMaterials = [item, ...store.sadaMaterials];
    saveStore(store);
    res.status(201).json({created: item, items: store.sadaMaterials});
  });

  app.put('/api/admin/sada-materials/:id', requireAuth, (req: AuthedRequest, res) => {
    if (!hasAdminPermission(req.authUser, 'manage_sada')) {
      res.status(403).json({error: 'هذه الصلاحية مخصصة لمسؤول خدمة صدى الخير أو المدير الرئيسي'});
      return;
    }
    const {id} = req.params;
    const idx = store.sadaMaterials.findIndex((m) => m.id === id);
    if (idx === -1) {
      res.status(404).json({error: 'المادة غير موجودة'});
      return;
    }
    const body = req.body as Partial<SadaMaterialItem>;
    const current = store.sadaMaterials[idx];
    let cleanExternalUrl = current.externalUrl;
    if (typeof body.externalUrl === 'string') {
      if (!body.externalUrl.trim()) {
        cleanExternalUrl = undefined;
      } else {
        const parsed = validateExternalWebhookUrl(body.externalUrl);
        if (!parsed) {
          res.status(400).json({error: 'الرابط الخارجي غير صالح'});
          return;
        }
        cleanExternalUrl = parsed.toString();
      }
    }
    const nextSpeakerName =
      typeof (body.speakerName || body.scholarName) === 'string' && (body.speakerName || body.scholarName || '').trim()
        ? (body.speakerName || body.scholarName || '').trim().slice(0, 120)
        : current.speakerName;
    const nextSpeakerType =
      body.speakerType === 'poet' || body.speakerType === 'scholar'
        ? body.speakerType
        : current.speakerType || 'scholar';
    const patch: Partial<SadaMaterialItem> = {
      speakerType: nextSpeakerType,
      speakerName: nextSpeakerName,
      scholarName: nextSpeakerName,
      contentType: body.contentType || current.contentType || (nextSpeakerType === 'poet' ? 'poetry' : 'article'),
      title: typeof body.title === 'string' && body.title.trim() ? body.title.trim().slice(0, 180) : current.title,
      body: typeof body.body === 'string' && body.body.trim() ? body.body.trim().slice(0, 5000) : current.body,
      category: typeof body.category === 'string' && body.category.trim() ? body.category.trim().slice(0, 80) : current.category,
      externalUrl: cleanExternalUrl,
      updatedAt: new Date().toISOString(),
    };
    if (!isPrimaryAdminUser(req.authUser) && req.authUser) {
      const pendingApproval = queueContentApprovalRequest({
        section: 'sada_material',
        action: 'update',
        targetId: id,
        title: patch.title || current.title,
        summary: 'طلب تعديل مادة في صدى الخير',
        payload: {patch},
        user: req.authUser,
      });
      res.status(202).json({
        requiresApproval: true,
        pendingApproval,
        message: 'تم إرسال التعديل للمسؤول الأول للموافقة عليه قبل النشر للزوار.',
      });
      return;
    }
    const updated: SadaMaterialItem = {...current, ...patch};
    store.sadaMaterials[idx] = updated;
    saveStore(store);
    res.json({updated, items: store.sadaMaterials});
  });

  app.delete('/api/admin/sada-materials/:id', requireAuth, (req: AuthedRequest, res) => {
    if (!hasAdminPermission(req.authUser, 'manage_sada')) {
      res.status(403).json({error: 'هذه الصلاحية مخصصة لمسؤول خدمة صدى الخير أو المدير الرئيسي'});
      return;
    }
    const {id} = req.params;
    const existing = store.sadaMaterials.find((m) => m.id === id);
    if (!isPrimaryAdminUser(req.authUser) && req.authUser) {
      const pendingApproval = queueContentApprovalRequest({
        section: 'sada_material',
        action: 'delete',
        targetId: id,
        title: existing?.title || 'حذف مادة صدى الخير',
        summary: 'طلب حذف مادة من صدى الخير',
        payload: {},
        user: req.authUser,
      });
      res.status(202).json({
        requiresApproval: true,
        pendingApproval,
        message: 'تم إرسال طلب الحذف للمسؤول الأول للموافقة.',
      });
      return;
    }
    store.sadaMaterials = store.sadaMaterials.filter((m) => m.id !== id);
    saveStore(store);
    res.json({items: store.sadaMaterials});
  });

  // Poetry & Anecdotes Oasis routes + Manual Admin Composer + Permanent AI Archive
  app.get('/api/poetry', (_req, res) => {
    res.json({poetryItems: store.poetryItems, lastPoetryAiDate: store.lastPoetryAiDate});
  });

  app.post('/api/admin/poetry', requireAuth, (req: AuthedRequest, res) => {
    if (!hasAdminPermission(req.authUser, 'manage_posts')) {
      res.status(403).json({error: 'لا تملك صلاحية إضافة محتوى واحة الشعر والطرائف'});
      return;
    }
    const body = (req.body || {}) as Partial<PoetryAnecdoteItem>;
    const title = String(body.title || '').trim().slice(0, 180);
    const contentBody = String(body.body || '').trim().slice(0, 15000);
    if (!title || !contentBody) {
      res.status(400).json({error: 'العنوان والنص مطلوبان'});
      return;
    }
    const item: PoetryAnecdoteItem = {
      id: `man_${body.kind === 'anecdote' ? 'anecdote' : 'poetry'}_${Date.now().toString(36)}`,
      kind: body.kind === 'anecdote' ? 'anecdote' : 'islamic_poetry',
      title,
      author: String(body.author || 'واحة الشعر والطرائف · مواعظ وعبر').trim().slice(0, 140),
      summary: String(body.summary || contentBody.slice(0, 120)).trim().slice(0, 400),
      body: contentBody,
      isAiGenerated: false,
      createdAt: new Date().toISOString(),
    };
    if (!isPrimaryAdminUser(req.authUser) && req.authUser) {
      const pendingApproval = queueContentApprovalRequest({
        section: 'poetry',
        action: 'create',
        title: item.title,
        summary: item.summary,
        payload: {item},
        user: req.authUser,
      });
      res.status(202).json({
        requiresApproval: true,
        pendingApproval,
        message: 'تم إرسال المادة للمسؤول الأول للموافقة عليها قبل النشر للزوار.',
      });
      return;
    }
    store.poetryItems = [item, ...store.poetryItems];
    saveStore(store);
    res.status(201).json({item, poetryItems: store.poetryItems});
  });

  app.delete('/api/admin/poetry/:id', requireAuth, (req: AuthedRequest, res) => {
    if (!hasAdminPermission(req.authUser, 'manage_posts')) {
      res.status(403).json({error: 'لا تملك صلاحية حذف محتوى واحة الشعر والطرائف'});
      return;
    }
    const {id} = req.params;
    const existing = store.poetryItems.find((p) => p.id === id);
    if (!isPrimaryAdminUser(req.authUser) && req.authUser) {
      const pendingApproval = queueContentApprovalRequest({
        section: 'poetry',
        action: 'delete',
        targetId: id,
        title: existing?.title || 'حذف مادة شعرية',
        summary: 'طلب حذف مادة من واحة الشعر والطرائف',
        payload: {},
        user: req.authUser,
      });
      res.status(202).json({
        requiresApproval: true,
        pendingApproval,
        message: 'تم إرسال طلب الحذف للمسؤول الأول للموافقة.',
      });
      return;
    }
    store.poetryItems = store.poetryItems.filter((p) => p.id !== id);
    saveStore(store);
    res.json({poetryItems: store.poetryItems});
  });

  app.post('/api/poetry/daily-sync', async (_req, res) => {
    try {
      const result = await generatePoetryWithAI({force: false});
      res.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'تعذر مزامنة واحة الشعر اليومية';
      res.status(503).json({error: msg, poetryItems: store.poetryItems});
    }
  });

  app.post('/api/poetry/generate', async (req, res) => {
    const {kind} = (req.body || {}) as {kind?: 'islamic_poetry' | 'anecdote'};
    try {
      const result = await generatePoetryWithAI({
        force: true,
        preferredKind: kind === 'islamic_poetry' ? 'islamic_poetry' : 'anecdote',
      });
      res.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'تعذر توليد طُرفة جديدة بالذكاء الاصطناعي';
      res.status(503).json({error: msg});
    }
  });

  app.get('/api/archive', (_req, res) => {
    res.json({permanentArchive: store.permanentArchive});
  });

  // Visitor Reviews (with Admin Hide/Delete moderation)
  app.get('/api/reviews', (req, res) => {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    const isAuthed = Boolean(token && verifyToken(token));
    res.json({
      reviews: isAuthed ? store.visitorReviews : store.visitorReviews.filter((r) => !r.hidden),
    });
  });

  app.post('/api/reviews', (req, res) => {
    const {name, rating, comment, role} = req.body as {
      name?: string;
      rating?: number;
      comment?: string;
      role?: string;
    };
    const cleanName = (name || '').trim().slice(0, 60);
    const cleanComment = (comment || '').trim().slice(0, 900);
    const numRating = Math.min(5, Math.max(1, Math.round(Number(rating) || 5)));
    if (!cleanName || !cleanComment) {
      res.status(400).json({error: 'يرجى كتابة الاسم والتعليق'});
      return;
    }
    const item: VisitorReviewItem = {
      id: `rev_${Date.now().toString(36)}`,
      name: cleanName,
      rating: numRating,
      comment: cleanComment,
      role: typeof role === 'string' && role.trim() ? role.trim().slice(0, 60) : 'زائر الموقع',
      hidden: false,
      createdAt: new Date().toISOString(),
    };
    store.visitorReviews = [item, ...store.visitorReviews];
    saveStore(store);
    res.status(201).json({
      review: item,
      reviews: store.visitorReviews.filter((r) => !r.hidden),
    });
  });

  app.patch('/api/admin/reviews/:id/visibility', requireAuth, (req, res) => {
    const {id} = req.params;
    const {hidden} = (req.body || {}) as {hidden?: boolean};
    const idx = store.visitorReviews.findIndex((r) => r.id === id);
    if (idx === -1) {
      res.status(404).json({error: 'التقييم غير موجود'});
      return;
    }
    const nextHidden = typeof hidden === 'boolean' ? hidden : !store.visitorReviews[idx].hidden;
    store.visitorReviews[idx] = {...store.visitorReviews[idx], hidden: nextHidden};
    saveStore(store);
    res.json({reviews: store.visitorReviews});
  });

  app.delete('/api/admin/reviews/:id', requireAuth, (req, res) => {
    const {id} = req.params;
    store.visitorReviews = store.visitorReviews.filter((r) => r.id !== id);
    saveStore(store);
    res.json({reviews: store.visitorReviews});
  });

  // Mother Oasis Routes (STRICTLY TEXT-ONLY — NEVER STORES AUDIO FILES OR RECORDINGS)
  app.get('/api/mother-oasis', (_req, res) => {
    res.json({items: store.motherOasisItems});
  });

  app.post('/api/admin/mother-oasis', requireAuth, (req: AuthedRequest, res) => {
    if (!hasAdminPermission(req.authUser, 'manage_mother_oasis')) {
      res.status(403).json({error: 'لا تملك صلاحية النشر في واحة الوالدة'});
      return;
    }
    const {chapter, title, body} = (req.body || {}) as {
      chapter?: MotherOasisChapter;
      title?: string;
      body?: string;
    };
    const validChapter: MotherOasisChapter =
      chapter === 'lectures' || chapter === 'stories' ? chapter : 'books';
    const cleanTitle = (title || '').trim().slice(0, 140);
    const cleanBody = (body || '').trim().slice(0, 20000);
    if (!cleanTitle || !cleanBody) {
      res.status(400).json({error: 'العنوان والنص مطلوبان للنشر في واحة الداعية الفاضلة'});
      return;
    }
    const item: MotherOasisItem = {
      id: `mo_${validChapter}_${Date.now().toString(36)}`,
      chapter: validChapter,
      title: cleanTitle,
      body: cleanBody,
      signature: MOTHER_OASIS_SIGNATURE,
      createdAt: new Date().toISOString(),
    };
    if (!isPrimaryAdminUser(req.authUser) && req.authUser) {
      const pendingApproval = queueContentApprovalRequest({
        section: 'mother_oasis',
        action: 'create',
        title: item.title,
        summary: `${validChapter === 'stories' ? 'قصص أم محمد' : validChapter === 'lectures' ? 'محاضرة مفرغة' : 'مؤلف/كتاب'} — ${cleanBody.slice(0, 100)}`,
        payload: {item},
        user: req.authUser,
      });
      res.status(202).json({
        requiresApproval: true,
        pendingApproval,
        message: 'تم إرسال المادة للمسؤول الأول للموافقة عليها قبل النشر في واحة أم محمد.',
      });
      return;
    }
    store.motherOasisItems = [item, ...store.motherOasisItems];
    saveStore(store);
    res.status(201).json({item, items: store.motherOasisItems});
  });

  app.put('/api/admin/mother-oasis/:id', requireAuth, (req: AuthedRequest, res) => {
    if (!hasAdminPermission(req.authUser, 'manage_mother_oasis')) {
      res.status(403).json({error: 'لا تملك صلاحية تعديل محتوى واحة الوالدة'});
      return;
    }
    const {id} = req.params;
    const idx = store.motherOasisItems.findIndex((it) => it.id === id);
    if (idx === -1) {
      res.status(404).json({error: 'المادة غير موجودة'});
      return;
    }
    const current = store.motherOasisItems[idx];
    const {chapter, title, body} = (req.body || {}) as {
      chapter?: MotherOasisChapter;
      title?: string;
      body?: string;
    };
    const validChapter: MotherOasisChapter =
      chapter === 'lectures' || chapter === 'stories' || chapter === 'books' ? chapter : current.chapter;
    const patch: Partial<MotherOasisItem> = {
      chapter: validChapter,
      title: typeof title === 'string' && title.trim() ? title.trim().slice(0, 140) : current.title,
      body: typeof body === 'string' && body.trim() ? body.trim().slice(0, 20000) : current.body,
    };
    if (!isPrimaryAdminUser(req.authUser) && req.authUser) {
      const pendingApproval = queueContentApprovalRequest({
        section: 'mother_oasis',
        action: 'update',
        targetId: id,
        title: patch.title || current.title,
        summary: 'طلب تعديل مادة في واحة أم محمد',
        payload: {patch},
        user: req.authUser,
      });
      res.status(202).json({
        requiresApproval: true,
        pendingApproval,
        message: 'تم إرسال التعديل للمسؤول الأول للموافقة عليه قبل التحديث.',
      });
      return;
    }
    const updated: MotherOasisItem = {...current, ...patch};
    store.motherOasisItems[idx] = updated;
    saveStore(store);
    res.json({item: updated, items: store.motherOasisItems});
  });

  app.delete('/api/admin/mother-oasis/:id', requireAuth, (req: AuthedRequest, res) => {
    if (!hasAdminPermission(req.authUser, 'manage_mother_oasis')) {
      res.status(403).json({error: 'لا تملك صلاحية حذف محتوى واحة الوالدة'});
      return;
    }
    const {id} = req.params;
    const existing = store.motherOasisItems.find((it) => it.id === id);
    if (!isPrimaryAdminUser(req.authUser) && req.authUser) {
      const pendingApproval = queueContentApprovalRequest({
        section: 'mother_oasis',
        action: 'delete',
        targetId: id,
        title: existing?.title || 'حذف مادة من واحة أم محمد',
        summary: 'طلب حذف مادة من واحة أم محمد',
        payload: {},
        user: req.authUser,
      });
      res.status(202).json({
        requiresApproval: true,
        pendingApproval,
        message: 'تم إرسال طلب الحذف للمسؤول الأول للموافقة.',
      });
      return;
    }
    store.motherOasisItems = store.motherOasisItems.filter((it) => it.id !== id);
    saveStore(store);
    res.json({items: store.motherOasisItems});
  });

  app.post('/api/admin/mother-oasis/transcribe', requireAuth, async (req, res) => {
    const {audioBase64, mimeType} = (req.body || {}) as {
      audioBase64?: string;
      mimeType?: string;
    };
    const cleanBase64 = typeof audioBase64 === 'string' ? audioBase64.replace(/^data:[^;]+;base64,/, '').trim() : '';
    const cleanMime = typeof mimeType === 'string' && mimeType.startsWith('audio/') ? mimeType : 'audio/mp3';
    if (!cleanBase64) {
      res.status(400).json({error: 'يرجى اختيار ملف صوتي صالح للتفريغ النصي'});
      return;
    }
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      res.status(503).json({error: 'مفتاح الذكاء الاصطناعي (GEMINI_API_KEY) غير متوفر في الخادم'});
      return;
    }
    try {
      const ai = new GoogleGenAI({apiKey, httpOptions: {headers: {'User-Agent': 'aistudio-build'}}});
      const promptText =
        'فرّغ هذا التسجيل الصوتي إلى نص عربي فصيح واضح ومنظم بعلامات الترقيم والفقرات بدقة تامة دون زيادة أو تعليق منك، واكتب فقط النص المفرغ.';
      const contentsPayload = {
        parts: [
          {inlineData: {mimeType: cleanMime, data: cleanBase64}},
          {text: promptText},
        ],
      };
      let response;
      try {
        response = await ai.models.generateContent({
          model: 'gemini-3.5-transcribe',
          contents: contentsPayload,
        });
      } catch {
        response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: contentsPayload,
        });
      }
      const text =
        response.candidates?.[0]?.content?.parts
          ?.filter((p) => typeof p.text === 'string' && !p.thought)
          .map((p) => p.text)
          .join('')
          .trim() ||
        response.text?.trim() ||
        '';
      if (!text) {
        res.status(502).json({error: 'لم يتمكن المحرك من استخراج نص من الملف الصوتي'});
        return;
      }
      // Audio payload was processed strictly in memory and is NEVER saved on disk
      res.json({text});
    } catch {
      res.status(503).json({error: 'تعذر تفريغ الملف الصوتي حالياً، يرجى المحاولة بعد لحظات'});
    }
  });

  app.post('/api/admin/mother-oasis/format', requireAuth, async (req, res) => {
    const {text} = (req.body || {}) as {text?: string};
    const cleanText = typeof text === 'string' ? text.trim().slice(0, 15000) : '';
    if (!cleanText) {
      res.status(400).json({error: 'النص المراد تنسيقه فارغ'});
      return;
    }
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      res.status(503).json({error: 'مفتاح الذكاء الاصطناعي (GEMINI_API_KEY) غير متوفر في الخادم'});
      return;
    }
    try {
      const ai = new GoogleGenAI({apiKey, httpOptions: {headers: {'User-Agent': 'aistudio-build'}}});
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `صحح الأخطاء الإملائية الطفيفة ونظّم علامات الترقيم والفقرات في هذا النص الدعوي العربي مع الحفاظ التام على أسلوب الكاتبة وكلماتها ومعانيها دون حذف أو إضافة أفكار جديدة، وأرجع النص المنسق فقط:\n\n${cleanText}`,
        config: {thinkingConfig: {thinkingLevel: ThinkingLevel.LOW}},
      });
      const formattedText =
        response.candidates?.[0]?.content?.parts
          ?.filter((p) => typeof p.text === 'string' && !p.thought)
          .map((p) => p.text)
          .join('')
          .trim() ||
        response.text?.trim() ||
        cleanText;
      res.json({formattedText});
    } catch {
      res.status(503).json({error: 'تعذر تنسيق النص بالذكاء الاصطناعي حالياً'});
    }
  });

  // Verified Quran Multi-Mufassir & 7-Language Tafsir Proxy
  const tafsirCache = new Map<string, {text: string; editionLabel: string}>();

  app.get('/api/quran/tafsir', async (req, res) => {
    const surah = Number(req.query.surah);
    const ayah = Number(req.query.ayah);
    const mufassir = String(req.query.mufassir || 'muyassar');
    const lang = String(req.query.lang || 'ar');

    if (!Number.isInteger(surah) || surah < 1 || surah > 114 || !Number.isInteger(ayah) || ayah < 1) {
      res.status(400).json({error: 'رقم السورة أو الآية غير صحيح'});
      return;
    }

    const arSlugs: Record<string, {slug: string; label: string}> = {
      muyassar: {slug: 'ar-tafsir-muyassar', label: 'التفسير الميسر'},
      saadi: {slug: 'ar-tafseer-al-saddi', label: 'تفسير السعدي'},
      ibn_kathir: {slug: 'ar-tafsir-ibn-kathir', label: 'تفسير ابن كثير'},
      tabari: {slug: 'ar-tafsir-al-tabari', label: 'تفسير الطبري'},
      baghawi: {slug: 'ar-tafsir-al-baghawi', label: 'تفسير البغوي'},
    };
    const chosenMufassir = arSlugs[mufassir] || arSlugs.muyassar;
    const cacheKey = `${chosenMufassir.slug}:${lang}:${surah}:${ayah}`;
    const cached = tafsirCache.get(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const fetchSpa5kTafsir = async (slug: string): Promise<string | null> => {
      try {
        const url = `https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir/${slug}/${surah}/${ayah}.json`;
        const r = await fetch(url, {headers: {'User-Agent': 'Mawaedh-Ibar/1.0'}});
        if (!r.ok) return null;
        const j = (await r.json()) as {text?: string};
        return typeof j.text === 'string' && j.text.trim() ? j.text.trim() : null;
      } catch {
        return null;
      }
    };

    if (lang === 'ar') {
      const arText = await fetchSpa5kTafsir(chosenMufassir.slug);
      if (!arText) {
        res.status(502).json({error: 'تعذر جلب التفسير المعتمد للآية حالياً'});
        return;
      }
      const payload = {text: arText, editionLabel: chosenMufassir.label};
      if (tafsirCache.size >= 800) tafsirCache.clear();
      tafsirCache.set(cacheKey, payload);
      res.json(payload);
      return;
    }

    // Native localized editions map for exact language accuracy
    const localizedDirect: Record<string, {slug: string; label: string}> = {
      'en:ibn_kathir': {slug: 'en-tafisr-ibn-kathir', label: 'Tafsir Ibn Kathir (English)'},
      'en:muyassar': {slug: 'en-tafsir-al-mukhtasar', label: 'Al-Mukhtasar (English)'},
      'ur:saadi': {slug: 'ur-tafsir-as-saadi-urdu', label: 'تفسیر السعدی (اردو)'},
      'ur:ibn_kathir': {slug: 'ur-tafseer-ibn-e-kaseer', label: 'تفسیر ابن کثیر (اردو)'},
      'id:saadi': {slug: 'id-tafsir-as-saadi', label: 'Tafsir As-Saadi (Indonesia)'},
      'tr:saadi': {slug: 'turkish-tafsir-as-saadi-turkish', label: 'Es-Sadi Tefsiri (Türkçe)'},
    };
    const localizedFallbackByLang: Record<string, {slug: string; label: string; langName: string}> = {
      en: {slug: 'en-tafsir-al-mukhtasar', label: 'English', langName: 'English'},
      fr: {slug: 'french-mokhtasar', label: 'Français (Al-Mokhtasar)', langName: 'French'},
      ur: {slug: 'ur-tafsir-as-saadi-urdu', label: 'اردو (تفسیر السعدی)', langName: 'Urdu'},
      id: {slug: 'indonesian-mokhtasar', label: 'Bahasa Indonesia (Al-Mukhtasar)', langName: 'Indonesian'},
      tr: {slug: 'turkish-mokhtasar', label: 'Türkçe (El-Muhtasar)', langName: 'Turkish'},
      es: {slug: 'spanish-mokhtasar', label: 'Español (Al-Mukhtasar)', langName: 'Spanish'},
    };

    const directKey = `${lang}:${mufassir}`;
    if (localizedDirect[directKey]) {
      const directText = await fetchSpa5kTafsir(localizedDirect[directKey].slug);
      if (directText) {
        const payload = {text: directText, editionLabel: localizedDirect[directKey].label};
        if (tafsirCache.size >= 800) tafsirCache.clear();
        tafsirCache.set(cacheKey, payload);
        res.json(payload);
        return;
      }
    }

    const targetLangMeta = localizedFallbackByLang[lang] || localizedFallbackByLang.en;
    const arBaseText = await fetchSpa5kTafsir(chosenMufassir.slug);
    const apiKey = process.env.GEMINI_API_KEY?.trim();

    if (arBaseText && apiKey) {
      try {
        const ai = new GoogleGenAI({apiKey, httpOptions: {headers: {'User-Agent': 'aistudio-build'}}});
        const trRes = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `Translate this authentic Arabic Quranic Tafsir (${chosenMufassir.label}) faithfully and clearly into ${targetLangMeta.langName}, returning only the translated Tafsir text:\n\n${arBaseText.slice(0, 3500)}`,
          config: {thinkingConfig: {thinkingLevel: ThinkingLevel.LOW}},
        });
        const translated = trRes.text?.trim();
        if (translated) {
          const payload = {
            text: translated,
            editionLabel: `${chosenMufassir.label} · ${targetLangMeta.label}`,
          };
          if (tafsirCache.size >= 800) tafsirCache.clear();
          tafsirCache.set(cacheKey, payload);
          res.json(payload);
          return;
        }
      } catch {
        // Fallback to verified Mokhtasar in target language
      }
    }

    const fallbackText = await fetchSpa5kTafsir(targetLangMeta.slug);
    if (fallbackText) {
      const payload = {text: fallbackText, editionLabel: targetLangMeta.label};
      if (tafsirCache.size >= 800) tafsirCache.clear();
      tafsirCache.set(cacheKey, payload);
      res.json(payload);
      return;
    }

    res.status(502).json({error: 'تعذر جلب التفسير بهذه اللغة حالياً'});
  });

  // Persistent Visitor Registration & Username/Email/Phone + Password Authentication
  app.post('/api/visitor/auth', (req, res) => {
    const {
      mode,
      provider,
      name,
      username,
      identifier,
      password,
      email,
      whatsapp,
      firebaseUid,
      bookmarks,
      likedPostIds,
      bookmarkedPostIds,
      bookmarkedFatwaIds,
    } = req.body as {
      mode?: 'register' | 'login';
      provider?: 'google' | 'facebook' | 'email';
      name?: string;
      username?: string;
      identifier?: string;
      password?: string;
      email?: string;
      whatsapp?: string;
      firebaseUid?: string;
      bookmarks?: string[];
      likedPostIds?: string[];
      bookmarkedPostIds?: string[];
      bookmarkedFatwaIds?: string[];
    };

    const mergeUniqueStrings = (a?: string[], b?: string[]): string[] =>
      [...new Set([...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])])];

    const findVisitorByPhone = (digits: string): StoredVisitorRecord | undefined => {
      if (digits.length < 7) return undefined;
      return Object.values(store.visitorAccounts).find((v) => {
        const storedDigits = (v.whatsapp || '').replace(/[^\d]/g, '');
        if (storedDigits.length < 7) return false;
        return (
          storedDigits === digits ||
          storedDigits.endsWith(digits) ||
          digits.endsWith(storedDigits)
        );
      });
    };

    // --- LOGIN MODE (via username, email, or mobile number + password) ---
    if (mode === 'login') {
      const cleanIdentifier = typeof identifier === 'string' ? identifier.trim() : '';
      const cleanPassword = typeof password === 'string' ? password : '';
      if (!cleanIdentifier || !cleanPassword) {
        res.status(400).json({error: 'يرجى إدخال اسم المستخدم (أو البريد أو الجوال) وكلمة المرور'});
        return;
      }

      const lowerId = cleanIdentifier.toLowerCase();
      const idDigits = cleanIdentifier.replace(/[^\d]/g, '').replace(/^0+/, '');
      const found =
        Object.values(store.visitorAccounts).find(
          (v) =>
            (v.username && v.username.toLowerCase() === lowerId) ||
            (v.email && v.email.toLowerCase() === lowerId),
        ) || findVisitorByPhone(idDigits);

      if (!found) {
        res.status(401).json({error: 'لم يتم العثور على حساب مطابق لاسم المستخدم أو البريد أو الجوال'});
        return;
      }
      if (!found.passwordHash) {
        res.status(401).json({
          error: 'هذا الحساب مسجّل سابقاً بدون كلمة مرور — يرجى اختيار «تسجيل حساب جديد» بنفس البريد لتعيين كلمة مرورك.',
        });
        return;
      }
      if (!verifyVisitorPassword(cleanPassword, found.passwordHash)) {
        res.status(401).json({error: 'كلمة المرور غير صحيحة، يرجى المحاولة مجدداً'});
        return;
      }

      found.lastLoginAt = new Date().toISOString();
      found.bookmarks = mergeUniqueStrings(found.bookmarks, bookmarks);
      found.likedPostIds = mergeUniqueStrings(found.likedPostIds, likedPostIds);
      found.bookmarkedPostIds = mergeUniqueStrings(found.bookmarkedPostIds, bookmarkedPostIds);
      found.bookmarkedFatwaIds = mergeUniqueStrings(found.bookmarkedFatwaIds, bookmarkedFatwaIds);
      store.visitorAccounts[found.id] = found;
      store.visitorsCount = Math.max(MIN_CUMULATIVE_VISITORS, store.visitorsCount) + 1;
      store.clicksCount = Math.max(MIN_CUMULATIVE_CLICKS, store.clicksCount) + 1;
      store.registeredMembersCount = Math.max(
        store.registeredMembersCount || 0,
        Object.keys(store.visitorAccounts).length,
      );
      recordDailyMetric('visitors', 1);
      recordDailyMetric('clicks', 1);
      saveStore(store);

      res.json({
        profile: sanitizeVisitorProfile(found),
        sessionToken: signVisitorToken(found.id),
        visitorsCount: store.visitorsCount,
        clicksCount: store.clicksCount,
        registeredMembersCount: store.registeredMembersCount,
      });
      return;
    }

    // --- REGISTER / CREATE OR UPGRADE ACCOUNT MODE ---
    const cleanProvider: VisitorProfile['provider'] =
      provider === 'google' || provider === 'facebook' ? provider : 'email';
    const cleanName = typeof name === 'string' ? name.trim().slice(0, 60) : '';
    const cleanUsername =
      typeof username === 'string'
        ? username.trim().replace(/\s+/g, '_').slice(0, 32)
        : '';
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase().slice(0, 120) : '';
    const cleanWhatsapp = typeof whatsapp === 'string' ? whatsapp.trim().slice(0, 40) : '';
    const cleanPassword = typeof password === 'string' ? password : '';
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail);
    const phoneDigits = cleanWhatsapp.replace(/[^\d]/g, '');

    if (!cleanName) {
      res.status(400).json({error: 'يرجى إدخال الاسم أو الكنية للتسجيل'});
      return;
    }
    if (!emailValid) {
      res.status(400).json({error: 'يجب إدخال بريد إلكتروني صحيح للتسجيل'});
      return;
    }
    if (phoneDigits.length < 7) {
      res.status(400).json({error: 'يجب إدخال رقم جوال صحيح (٧ أرقام على الأقل) للتسجيل'});
      return;
    }
    if (cleanPassword.length < 6) {
      res.status(400).json({error: 'يجب أن تتكون كلمة المرور من ٦ أحرف أو أرقام على الأقل'});
      return;
    }

    if (cleanUsername) {
      const usernameTaken = Object.values(store.visitorAccounts).find(
        (v) =>
          v.username &&
          v.username.toLowerCase() === cleanUsername.toLowerCase() &&
          v.email?.toLowerCase() !== cleanEmail,
      );
      if (usernameTaken) {
        res.status(409).json({error: 'اسم المستخدم مستخدم مسبقاً، يرجى اختيار اسم مستخدم آخر'});
        return;
      }
    }

    const cleanUid = typeof firebaseUid === 'string' && firebaseUid.trim() ? firebaseUid.trim().slice(0, 128) : undefined;
    const keySeed = cleanUid ? `uid:${cleanUid}` : `email:${cleanEmail}`;
    const visitorId = `vis_${crypto.createHash('sha1').update(keySeed).digest('hex').slice(0, 12)}`;

    const existing = store.visitorAccounts[visitorId];
    if (existing?.passwordHash && !verifyVisitorPassword(cleanPassword, existing.passwordHash)) {
      res.status(409).json({
        error: 'هذا البريد الإلكتروني مسجّل مسبقاً — يرجى استخدام تبويب «تسجيل الدخول» للدخول بكلمة مرورك.',
      });
      return;
    }

    const nowIso = new Date().toISOString();
    const record: StoredVisitorRecord = {
      id: visitorId,
      firebaseUid: cleanUid || existing?.firebaseUid,
      username: cleanUsername || existing?.username || cleanEmail.split('@')[0],
      passwordHash: existing?.passwordHash || hashVisitorPassword(cleanPassword),
      provider: cleanProvider,
      name: cleanName,
      email: cleanEmail,
      whatsapp: cleanWhatsapp,
      createdAt: existing?.createdAt || nowIso,
      lastLoginAt: nowIso,
      bookmarks: mergeUniqueStrings(existing?.bookmarks, bookmarks),
      likedPostIds: mergeUniqueStrings(existing?.likedPostIds, likedPostIds),
      bookmarkedPostIds: mergeUniqueStrings(existing?.bookmarkedPostIds, bookmarkedPostIds),
      bookmarkedFatwaIds: mergeUniqueStrings(existing?.bookmarkedFatwaIds, bookmarkedFatwaIds),
      adhkar: existing?.adhkar,
      adhkarLifetime: existing?.adhkarLifetime,
      wird: existing?.wird,
    };
    const isNewAccount = !store.visitorAccounts[visitorId];
    store.visitorAccounts[visitorId] = record;
    store.visitorsCount = Math.max(MIN_CUMULATIVE_VISITORS, store.visitorsCount) + 1;
    store.clicksCount = Math.max(MIN_CUMULATIVE_CLICKS, store.clicksCount) + (isNewAccount ? 2 : 1);
    store.registeredMembersCount = Math.max(
      (store.registeredMembersCount || 0) + (isNewAccount ? 1 : 0),
      Object.keys(store.visitorAccounts).length,
    );
    recordDailyMetric('visitors', 1);
    recordDailyMetric('clicks', isNewAccount ? 2 : 1);
    saveStore(store);
    res.json({
      profile: sanitizeVisitorProfile(record),
      sessionToken: signVisitorToken(record.id),
      visitorsCount: store.visitorsCount,
      clicksCount: store.clicksCount,
      registeredMembersCount: store.registeredMembersCount,
    });
  });

  app.get('/api/visitor/session', (req, res) => {
    const authHeader = String(req.headers.authorization || '');
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const visitorId = token ? verifyVisitorToken(token) : null;
    if (!visitorId || !store.visitorAccounts[visitorId]) {
      res.status(401).json({error: 'انتهت صلاحية الجلسة'});
      return;
    }
    const rec = store.visitorAccounts[visitorId];
    rec.lastLoginAt = new Date().toISOString();
    saveStore(store);
    res.json({profile: sanitizeVisitorProfile(rec)});
  });

  // Public privacy-safe list of registered member short labels ONLY (never expose full names, emails, or phones)
  const maskVisitorPublicName = (rawName: string): string => {
    const parts = rawName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'عضو';
    if (parts.length === 1) return parts[0];
    if (/^(أبو|أم|أبي|ابو|ام)$/.test(parts[0])) {
      return `${parts[0]} ${parts[1]}`;
    }
    return `${parts[0]} ${parts[1].charAt(0)}.`;
  };

  app.get('/api/visitors/names', (_req, res) => {
    const members = Object.values(store.visitorAccounts)
      .filter((v) => Boolean(v && v.name))
      .map((v) => ({
        id: v.id,
        name: maskVisitorPublicName(v.name),
        createdAt: v.createdAt,
        lastLoginAt: v.lastLoginAt || v.createdAt,
      }))
      .sort((a, b) => (b.lastLoginAt || b.createdAt).localeCompare(a.lastLoginAt || a.createdAt));
    res.json({total: members.length, members});
  });

  app.put('/api/visitor/sync', (req, res) => {
    const {
      visitorId,
      bookmarks,
      likedPostIds,
      bookmarkedPostIds,
      bookmarkedFatwaIds,
      adhkar,
      adhkarLifetime,
      wird,
      quizProgress,
      whatsapp,
      firebaseUid,
    } = req.body as {
      visitorId?: string;
      bookmarks?: string[];
      likedPostIds?: string[];
      bookmarkedPostIds?: string[];
      bookmarkedFatwaIds?: string[];
      adhkar?: unknown;
      adhkarLifetime?: unknown;
      wird?: unknown;
      quizProgress?: DawahQuizState;
      whatsapp?: string;
      firebaseUid?: string;
    };
    if (!visitorId || !store.visitorAccounts[visitorId]) {
      res.status(404).json({error: 'الحساب المسجّل غير موجود'});
      return;
    }
    const current = store.visitorAccounts[visitorId];
    const mergedQuizProgress =
      quizProgress && typeof quizProgress === 'object'
        ? {
            ...quizProgress,
            totalPoints: Math.max(
              Number(current.quizProgress?.totalPoints || 0),
              Number(quizProgress.totalPoints || 0),
            ),
            totalCorrect: Math.max(
              Number(current.quizProgress?.totalCorrect || 0),
              Number(quizProgress.totalCorrect || 0),
            ),
            totalAnswered: Math.max(
              Number(current.quizProgress?.totalAnswered || 0),
              Number(quizProgress.totalAnswered || 0),
            ),
            streakDays: Math.max(
              Number(current.quizProgress?.streakDays || 0),
              Number(quizProgress.streakDays || 0),
            ),
          }
        : current.quizProgress;
    store.visitorAccounts[visitorId] = {
      ...current,
      ...(typeof firebaseUid === 'string' && firebaseUid.trim() ? {firebaseUid: firebaseUid.trim().slice(0, 128)} : {}),
      ...(Array.isArray(bookmarks) ? {bookmarks} : {}),
      ...(Array.isArray(likedPostIds) ? {likedPostIds} : {}),
      ...(Array.isArray(bookmarkedPostIds) ? {bookmarkedPostIds} : {}),
      ...(Array.isArray(bookmarkedFatwaIds) ? {bookmarkedFatwaIds} : {}),
      ...(adhkar !== undefined ? {adhkar} : {}),
      ...(adhkarLifetime !== undefined ? {adhkarLifetime} : {}),
      ...(wird !== undefined ? {wird} : {}),
      ...(mergedQuizProgress ? {quizProgress: mergedQuizProgress} : {}),
      ...(typeof whatsapp === 'string' ? {whatsapp: whatsapp.trim().slice(0, 40)} : {}),
    };
    saveStore(store);
    res.json({profile: sanitizeVisitorProfile(store.visitorAccounts[visitorId])});
  });

  // Daily Dawah Quiz endpoints (persistent community stats + visitor score sync)
  app.get('/api/dawah-quiz', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const todayKey = getDateKey();
    const bucket = store.quizDailyStats[todayKey] || {participantsCount: 0, totalPointsAwarded: 0};
    const aiQuestions = Array.isArray(store.quizAiQuestionsByDate[todayKey])
      ? store.quizAiQuestionsByDate[todayKey]
      : [];
    res.json({
      dateKey: todayKey,
      aiQuestions,
      participantsToday: bucket.participantsCount || 0,
      totalPointsAwarded: bucket.totalPointsAwarded || 0,
    });
  });

  app.post('/api/dawah-quiz/submit', (req, res) => {
    const body = (req.body || {}) as {
      visitorId?: string;
      questionId?: string;
      earnedPoints?: number;
      quizProgress?: DawahQuizState;
      dateKey?: string;
    };
    const todayKey =
      typeof body.dateKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.dateKey)
        ? body.dateKey
        : getDateKey();
    const earned = Math.max(0, Math.min(60, Math.floor(Number(body.earnedPoints) || 0)));

    const currentBucket = store.quizDailyStats[todayKey] || {
      participantsCount: 0,
      totalPointsAwarded: 0,
    };
    const updatedBucket = {
      participantsCount: currentBucket.participantsCount + 1,
      totalPointsAwarded: currentBucket.totalPointsAwarded + earned,
    };
    store.quizDailyStats[todayKey] = updatedBucket;

    // Keep last 45 days of quiz buckets
    const quizKeys = Object.keys(store.quizDailyStats).sort();
    if (quizKeys.length > 45) {
      for (const oldKey of quizKeys.slice(0, quizKeys.length - 45)) {
        delete store.quizDailyStats[oldKey];
      }
    }

    if (
      body.visitorId &&
      typeof body.visitorId === 'string' &&
      store.visitorAccounts[body.visitorId] &&
      body.quizProgress &&
      typeof body.quizProgress === 'object'
    ) {
      const acc = store.visitorAccounts[body.visitorId];
      store.visitorAccounts[body.visitorId] = {
        ...acc,
        quizProgress: {
          ...body.quizProgress,
          totalPoints: Math.max(
            Number(acc.quizProgress?.totalPoints || 0),
            Number(body.quizProgress.totalPoints || 0),
          ),
          totalCorrect: Math.max(
            Number(acc.quizProgress?.totalCorrect || 0),
            Number(body.quizProgress.totalCorrect || 0),
          ),
          totalAnswered: Math.max(
            Number(acc.quizProgress?.totalAnswered || 0),
            Number(body.quizProgress.totalAnswered || 0),
          ),
          streakDays: Math.max(
            Number(acc.quizProgress?.streakDays || 0),
            Number(body.quizProgress.streakDays || 0),
          ),
        },
      };
    }

    store.clicksCount = Math.max(MIN_CUMULATIVE_CLICKS, store.clicksCount) + 1;
    recordDailyMetric('clicks', 1, todayKey);
    saveStore(store);

    res.json({
      clicksCount: store.clicksCount,
      participantsToday: updatedBucket.participantsCount,
      totalPointsAwarded: updatedBucket.totalPointsAwarded,
    });
  });

  const QUIZ_LEADERBOARD_CATS = new Set<DawahQuizSubject>([
    'all',
    'aqeedah',
    'quran',
    'hadith_seerah',
    'fiqh',
    'akhlaq',
  ]);

  function sortQuizLeaderboard(list: QuizLeaderboardEntry[]): QuizLeaderboardEntry[] {
    return [...list].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
      return String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt));
    });
  }

  app.get('/api/dawah-quiz/leaderboard', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const rawCat = String(req.query.category || 'all').trim() as DawahQuizSubject;
    const category: DawahQuizSubject = QUIZ_LEADERBOARD_CATS.has(rawCat) ? rawCat : 'all';
    const filtered = store.quizLeaderboard.filter((e) => e.category === category);
    const entries = sortQuizLeaderboard(filtered).slice(0, 10);
    res.json({category, entries});
  });

  app.post('/api/dawah-quiz/leaderboard', (req, res) => {
    const body = (req.body || {}) as {
      participantId?: string;
      id?: string;
      nickname?: string;
      category?: string;
      score?: number;
      correctCount?: number;
      totalQuestions?: number;
      streakDays?: number;
      dateKey?: string;
    };
    const rawCat = String(body.category || 'all').trim() as DawahQuizSubject;
    const category: DawahQuizSubject = QUIZ_LEADERBOARD_CATS.has(rawCat) ? rawCat : 'all';
    const rawParticipant = String(body.participantId || 'guest').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 72);
    const rawId =
      typeof body.id === 'string' && body.id.trim()
        ? body.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 110)
        : `${rawParticipant}_${category}`;
    const entryId = rawId.length >= 2 ? rawId : `qlb_${Date.now().toString(36)}`;
    const cleanNick = String(body.nickname || 'طالب علم').trim().slice(0, 40) || 'طالب علم';
    const nickname = cleanNick.length >= 2 ? cleanNick : `${cleanNick} ✦`;
    const score = Math.max(0, Math.min(50000, Math.floor(Number(body.score) || 0)));
    const correctCount = Math.max(0, Math.min(500, Math.floor(Number(body.correctCount) || 0)));
    const totalQuestions = Math.max(1, Math.min(500, Math.floor(Number(body.totalQuestions) || 1)));
    const streakDays = Math.max(0, Math.min(3650, Math.floor(Number(body.streakDays) || 0)));
    const dateKey =
      typeof body.dateKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.dateKey)
        ? body.dateKey
        : getDateKey();
    const nowIso = new Date().toISOString();

    const idx = store.quizLeaderboard.findIndex((e) => e.id === entryId);
    let savedEntry: QuizLeaderboardEntry;
    if (idx >= 0) {
      const existing = store.quizLeaderboard[idx];
      savedEntry = {
        ...existing,
        id: entryId,
        nickname,
        category,
        score: Math.max(existing.score || 0, score),
        correctCount: Math.max(existing.correctCount || 0, correctCount),
        totalQuestions: Math.max(existing.totalQuestions || 1, totalQuestions),
        streakDays: Math.max(existing.streakDays || 0, streakDays),
        dateKey,
        createdAt: existing.createdAt || nowIso,
        updatedAt: nowIso,
      };
      store.quizLeaderboard[idx] = savedEntry;
    } else {
      savedEntry = {
        id: entryId,
        nickname,
        category,
        score,
        correctCount,
        totalQuestions,
        streakDays,
        dateKey,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      store.quizLeaderboard.push(savedEntry);
    }

    // Keep top entries bounded cleanly across categories
    if (store.quizLeaderboard.length > 250) {
      store.quizLeaderboard = sortQuizLeaderboard(store.quizLeaderboard).slice(0, 200);
    }
    saveStore(store);

    const topForCategory = sortQuizLeaderboard(
      store.quizLeaderboard.filter((e) => e.category === category),
    ).slice(0, 10);

    res.json({entry: savedEntry, entries: topForCategory});
  });

  function formatPlainTicketNo(raw?: string, fallbackId?: string): string {
    const cleaned = String(raw || '').trim().replace(/^#?(?:REQ-?)?/i, '');
    if (cleaned) return cleaned;
    const digits = String(fallbackId || '').replace(/\D/g, '').slice(-4);
    return digits || '1001';
  }

  function mapTicketSummary(
    item: SuggestionItem | VolunteerItem,
    kind: 'suggestion' | 'volunteer',
  ): VisitorTicketSummary {
    return {
      id: item.id,
      ticketNumber: formatPlainTicketNo(item.ticketNumber, item.id),
      kind,
      categoryLabel:
        kind === 'volunteer'
          ? `انضمام / تطوع: ${(item as VolunteerItem).field}`
          : (item as SuggestionItem).type === 'join'
            ? 'طلب انضمام للفريق'
            : (item as SuggestionItem).type === 'help'
              ? 'طلب مساعدة'
              : 'اقتراح / مشاركة دعوية',
      senderName: item.senderName,
      text: kind === 'volunteer' ? (item as VolunteerItem).skills : (item as SuggestionItem).text,
      status: item.status || 'new',
      adminNote: item.adminNote,
      whatsappNotifiedAt: item.whatsappNotifiedAt,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  // Public Ticket Inquiry & Visitor Ticket History (Privacy safe: never leaks admin contact)
  app.get('/api/tickets/track', (req, res) => {
    const q = String(req.query.q || '').trim().toUpperCase().replace(/^#?(?:REQ-?)?/, '');
    const tickets: VisitorTicketSummary[] = [
      ...store.suggestions.map((s) => mapTicketSummary(s, 'suggestion')),
      ...store.volunteers.map((v) => mapTicketSummary(v, 'volunteer')),
    ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    if (!q) {
      res.json({tickets: tickets.slice(0, 20)});
      return;
    }
    const matched = tickets.filter((t) =>
      t.ticketNumber.toUpperCase().replace(/^#?(?:REQ-?)?/, '').includes(q) ||
      t.id.toUpperCase().includes(q),
    );
    res.json({tickets: matched});
  });

  app.get('/api/visitor/:visitorId/tickets', (req, res) => {
    const {visitorId} = req.params;
    const tickets: VisitorTicketSummary[] = [
      ...store.suggestions
        .filter((s) => s.visitorId === visitorId)
        .map((s) => mapTicketSummary(s, 'suggestion')),
      ...store.volunteers
        .filter((v) => v.visitorId === visitorId)
        .map((v) => mapTicketSummary(v, 'volunteer')),
    ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({tickets});
  });

  // Auto daily AI sync for «نفحات متجددة» + «البطاقات الدعوية والأحاديث» (triggers once per calendar day if stale)
  app.post('/api/nafahat/daily-sync', async (_req, res) => {
    try {
      const [nafahatResult, cardsResult] = await Promise.all([
        generateDailyNafahatWithAI({force: false}),
        generateDailyDawahCardsBatchWithAI({force: false, count: 5}).catch(() => ({
          generated: false,
          added: [] as ClassicDawahCard[],
          aiDawahCards: store.aiDawahCards,
          dawahCardsMeta: buildDawahCardsMeta(),
        })),
      ]);
      res.json({
        ...nafahatResult,
        aiDawahCards: cardsResult.aiDawahCards,
        dawahCardsMeta: cardsResult.dawahCardsMeta,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'تعذر تحديث نفحات اليوم بالذكاء الاصطناعي';
      res.status(503).json({error: msg});
    }
  });

  // Admin/Editor manual immediate AI renewal for «نفحات متجددة»
  app.post('/api/admin/nafahat/refresh', requireAuth, async (_req, res) => {
    try {
      const result = await generateDailyNafahatWithAI({force: true});
      res.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'تعذر توليد نفحة جديدة عبر الذكاء الاصطناعي';
      res.status(500).json({error: msg});
    }
  });

  let mediaFeedCache: {
    youtubeVideos: YouTubeVideoItem[];
    telegramAudios: TelegramAudioItem[];
    twitterQuotes: TwitterQuoteItem[];
    fetchedAt: number;
    cacheDate: string;
  } = {
    youtubeVideos: INITIAL_YOUTUBE_VIDEOS,
    telegramAudios: INITIAL_TELEGRAM_AUDIOS,
    twitterQuotes: INITIAL_TWITTER_QUOTES,
    fetchedAt: 0,
    cacheDate: '',
  };

  const decodeEntities = (str: string): string =>
    str
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&#39;/g, "'")
      .replace(/&#33;/g, '!')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();

  async function fetchYouTubeChannelVideos(): Promise<YouTubeVideoItem[]> {
    const channelId = 'UCsfQM68Mnr1JTK1OuVWYCLQ';
    const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, {
      headers: {'User-Agent': 'Mozilla/5.0'},
    });
    if (!res.ok) throw new Error(`YT HTTP ${res.status}`);
    const xml = await res.text();
    const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)];
    const parsed: YouTubeVideoItem[] = [];
    for (const m of entries) {
      const e = m[1];
      const id = (e.match(/<yt:videoId>(.*?)<\/yt:videoId>/) || [])[1]?.trim();
      const rawTitle = (e.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
      const title = decodeEntities(rawTitle);
      const publishedAt = ((e.match(/<published>(.*?)<\/published>/) || [])[1] || '').slice(0, 10);
      const views = Number((e.match(/views="(\d+)"/) || [])[1] || 0);
      if (id && title) {
        parsed.push({
          id,
          title,
          url: `https://www.youtube.com/watch?v=${id}`,
          thumbnail: `https://i4.ytimg.com/vi/${id}/hqdefault.jpg`,
          publishedAt: publishedAt || '2020-01-15',
          views,
        });
      }
    }
    return parsed.length > 0 ? parsed : INITIAL_YOUTUBE_VIDEOS;
  }

  async function fetchTelegramChannelAudios(): Promise<TelegramAudioItem[]> {
    const map = new Map<string, TelegramAudioItem>();
    for (const item of INITIAL_TELEGRAM_AUDIOS) {
      map.set(item.msgId, item);
    }

    const queries = ['تلاوة', 'الشيخ', 'خطبة'];
    for (const q of queries) {
      try {
        const res = await fetch(`https://t.me/s/ax1ax70?q=${encodeURIComponent(q)}`, {
          headers: {'User-Agent': 'Mozilla/5.0'},
        });
        if (!res.ok) continue;
        const html = await res.text();
        const matches = [
          ...html.matchAll(
            /<a class="tgme_widget_message_document_wrap" href="https:\/\/t\.me\/ax1ax70\/(\d+)[^"]*">\s*<div class="tgme_widget_message_document_icon[^"]*audio[^"]*"[^>]*><\/div>\s*<div class="tgme_widget_message_document">\s*<div class="tgme_widget_message_document_title[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<div class="tgme_widget_message_document_extra[^"]*"[^>]*>([\s\S]*?)<\/div>/g,
          ),
        ];
        for (const m of matches) {
          const msgId = m[1];
          const title = decodeEntities(m[2].replace(/<[^>]+>/g, ''));
          const rawSpeaker = decodeEntities(m[3].replace(/<[^>]+>/g, ''));
          if (!msgId || !title) continue;
          const speaker =
            rawSpeaker && rawSpeaker !== '<unknown>' ? rawSpeaker : 'قناة مواعظ وعبر · @ax1ax70';
          const category = title.includes('خطبة')
            ? 'خطب ومحاضرات'
            : title.includes('دعاء')
              ? 'أدعية مختارة'
              : title.includes('سورة') || title.includes('تلاوة') || title.includes('قراءة')
                ? 'تلاوات خاشعة'
                : 'مواعظ ودروس';
          if (!map.has(msgId)) {
            map.set(msgId, {
              id: `tg_${msgId}`,
              msgId,
              title,
              speaker,
              url: `https://t.me/ax1ax70/${msgId}`,
              embedUrl: `https://t.me/ax1ax70/${msgId}?embed=1`,
              category,
            });
          }
        }
      } catch {
        // Ignore transient Telegram query errors and keep accumulated items
      }
    }

    return [...map.values()];
  }

  async function fetchTwitterQuotes(): Promise<TwitterQuoteItem[]> {
    const xLink = store.socialLinks.find((l) => l.id === 'x') || store.socialLinks.find((l) => l.url.includes('twitter.com') || l.url.includes('x.com'));
    const xPrimary = xLink?.url || 'https://twitter.com/ax1ax71';
    const xHandleMatch = xPrimary.match(/(?:twitter\.com|x\.com)\/([A-Za-z0-9_]+)/i);
    const screenName = xHandleMatch?.[1] || 'ax1ax71';
    const baseList: TwitterQuoteItem[] = [];
    try {
      const res = await fetch(`https://syndication.twitter.com/srv/timeline-profile/screen-name/${encodeURIComponent(screenName)}`, {
        headers: {'User-Agent': 'Mozilla/5.0'},
      });
      if (res.ok) {
        const html = await res.text();
        const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
        if (nextDataMatch?.[1]) {
          const parsed = JSON.parse(nextDataMatch[1]) as {
            props?: {pageProps?: {timeline?: {entries?: Array<{content?: {tweet?: {id_str?: string; full_text?: string; text?: string}}}>}}};
          };
          const entries = parsed.props?.pageProps?.timeline?.entries || [];
          for (const entry of entries.slice(0, 6)) {
            const tw = entry.content?.tweet;
            const rawText = (tw?.full_text || tw?.text || '').replace(/https?:\/\/\S+/g, '').trim();
            if (tw?.id_str && rawText.length > 15) {
              baseList.push({
                id: `tw_live_${tw.id_str}`,
                text: rawText,
                handle: `@${screenName}`,
                tag: 'تغريدة مباشرة',
                url: `https://twitter.com/${screenName}/status/${tw.id_str}`,
              });
            }
          }
        }
      }
    } catch {
      // Ignore rate limits or transient network failure and keep curated fallback
    }
    if (baseList.length > 0) return baseList;
    return INITIAL_TWITTER_QUOTES.map((q) => ({
      ...q,
      handle: `@${screenName}`,
      url: xPrimary,
    }));
  }

  // Official YouTube + Telegram + X/Twitter media feeds
  app.get('/api/feeds/media', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const forceRefresh = req.query.refresh === '1';
    const todayKey = getDateKey();
    const isFresh =
      mediaFeedCache.cacheDate === todayKey &&
      Date.now() - mediaFeedCache.fetchedAt < 10 * 60 * 1000;

    if (!forceRefresh && isFresh && mediaFeedCache.fetchedAt > 0) {
      res.json({
        youtubeVideos: mediaFeedCache.youtubeVideos,
        telegramAudios: mediaFeedCache.telegramAudios,
        twitterQuotes: mediaFeedCache.twitterQuotes,
        source: 'cache',
      });
      return;
    }

    try {
      const [ytResult, tgResult, twResult] = await Promise.allSettled([
        fetchYouTubeChannelVideos(),
        fetchTelegramChannelAudios(),
        fetchTwitterQuotes(),
      ]);

      mediaFeedCache = {
        youtubeVideos:
          ytResult.status === 'fulfilled' ? ytResult.value : mediaFeedCache.youtubeVideos,
        telegramAudios:
          tgResult.status === 'fulfilled' ? tgResult.value : mediaFeedCache.telegramAudios,
        twitterQuotes:
          twResult.status === 'fulfilled' ? twResult.value : mediaFeedCache.twitterQuotes,
        fetchedAt: Date.now(),
        cacheDate: todayKey,
      };

      res.json({
        youtubeVideos: mediaFeedCache.youtubeVideos,
        telegramAudios: mediaFeedCache.telegramAudios,
        twitterQuotes: mediaFeedCache.twitterQuotes,
        source: 'live',
      });
    } catch {
      res.json({
        youtubeVideos: INITIAL_YOUTUBE_VIDEOS,
        telegramAudios: INITIAL_TELEGRAM_AUDIOS,
        twitterQuotes: INITIAL_TWITTER_QUOTES,
        source: 'seed',
      });
    }
  });

  let scholarlyCache: {
    liveItems: ScholarlySiteItem[];
    fetchedAt: number;
    fetchedAtIso: string;
    cacheDate: string;
  } = {
    liveItems: [],
    fetchedAt: 0,
    fetchedAtIso: new Date().toISOString(),
    cacheDate: '',
  };

  async function fetchShYahiaLiveItems(): Promise<ScholarlySiteItem[]> {
    const items: ScholarlySiteItem[] = [];
    const seen = new Set<string>();
    const res = await fetch('https://sh-yahia.net/', {
      headers: {'User-Agent': 'Mozilla/5.0'},
    });
    if (!res.ok) throw new Error(`sh-yahia HTTP ${res.status}`);
    const html = await res.text();
    const linkRegex = /<a[^>]+href=["'](show_(sound|fatawa|art|book)_\d+\.html)["'][^>]*>([\s\S]*?)<\/a>/gi;
    for (const m of html.matchAll(linkRegex)) {
      const rel = m[1];
      const kind = m[2]?.toLowerCase() || 'sound';
      const title = decodeEntities(m[3].replace(/<[^>]+>/g, '').replace(/\s+/g, ' '));
      if (!title || title.length < 8 || seen.has(rel)) continue;
      seen.add(rel);
      const kindLabels: Record<string, {ar: string; en: string}> = {
        sound: {ar: 'صوتيات ودرس', en: 'Audio / Lesson'},
        fatawa: {ar: 'فتوى شرعية', en: 'Fatwa'},
        art: {ar: 'مقال وفائدة', en: 'Article'},
        book: {ar: 'كتاب / رسالة', en: 'Book / Treatise'},
      };
      const lbl = kindLabels[kind] || kindLabels.sound;
      items.push({
        id: `sy_live_${rel.replace(/\W+/g, '_')}`,
        siteId: 'sh_yahia',
        siteNameAr: 'موقع الشيخ يحيى الحجوري',
        siteNameEn: 'Sheikh Al-Hajouri Site',
        kindLabelAr: lbl.ar,
        kindLabelEn: lbl.en,
        title: title.slice(0, 140),
        url: `https://sh-yahia.net/${rel}`,
      });
      if (items.length >= 12) break;
    }
    return items;
  }

  async function fetchAlilmiaLiveItems(): Promise<ScholarlySiteItem[]> {
    const items: ScholarlySiteItem[] = [];
    const seen = new Set<string>();
    const res = await fetch('https://alilmia.com/', {
      headers: {'User-Agent': 'Mozilla/5.0'},
    });
    if (!res.ok) throw new Error(`alilmia HTTP ${res.status}`);
    const html = await res.text();
    const linkRegex = /<a[^>]+href=["'](item\.php\?id=\d+[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
    for (const m of html.matchAll(linkRegex)) {
      const rel = decodeEntities(m[1]);
      const title = decodeEntities(m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' '));
      if (!title || title.length < 8 || seen.has(rel)) continue;
      seen.add(rel);
      const kindAr = title.includes('تلاوة') || title.includes('سورة') ? 'تلاوة قرآنية' : title.includes('خطبة') ? 'خطبة منبرية' : 'مادة علمية';
      const kindEn = title.includes('تلاوة') || title.includes('سورة') ? 'Quran Audio' : title.includes('خطبة') ? 'Khutbah' : 'Scholarly Item';
      items.push({
        id: `al_live_${rel.replace(/\W+/g, '_')}`,
        siteId: 'alilmia',
        siteNameAr: 'الشبكة العلمية',
        siteNameEn: 'Alilmia Network',
        kindLabelAr: kindAr,
        kindLabelEn: kindEn,
        title: title.slice(0, 140),
        url: `https://alilmia.com/${rel}`,
      });
      if (items.length >= 12) break;
    }
    return items;
  }

  // Official Scholarly Sites Integration Hub (sh-yahia.net & alilmia.com)
  app.get('/api/feeds/scholarly', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const forceRefresh = req.query.refresh === '1';
    const todayKey = getDateKey();
    const isFresh =
      scholarlyCache.cacheDate === todayKey &&
      Date.now() - scholarlyCache.fetchedAt < 15 * 60 * 1000;

    if (!forceRefresh && isFresh && scholarlyCache.fetchedAt > 0) {
      const payload: ScholarlyHubPayload = {
        sections: {shYahia: SH_YAHIA_SECTIONS, alilmia: ALILMIA_SECTIONS},
        liveItems: scholarlyCache.liveItems,
        fetchedAt: scholarlyCache.fetchedAtIso,
        source: 'cache',
      };
      res.json(payload);
      return;
    }

    const [syRes, alRes] = await Promise.allSettled([
      fetchShYahiaLiveItems(),
      fetchAlilmiaLiveItems(),
    ]);
    const liveItems: ScholarlySiteItem[] = [];
    if (syRes.status === 'fulfilled') liveItems.push(...syRes.value);
    if (alRes.status === 'fulfilled') liveItems.push(...alRes.value);

    const finalItems = liveItems.length > 0 ? liveItems : scholarlyCache.liveItems;
    const fetchedAtIso = new Date().toISOString();
    if (finalItems.length > 0) {
      scholarlyCache = {
        liveItems: finalItems,
        fetchedAt: Date.now(),
        fetchedAtIso,
        cacheDate: todayKey,
      };
    }

    const payload: ScholarlyHubPayload = {
      sections: {shYahia: SH_YAHIA_SECTIONS, alilmia: ALILMIA_SECTIONS},
      liveItems: finalItems,
      fetchedAt: fetchedAtIso,
      source: liveItems.length > 0 ? 'live' : 'seed',
    };
    res.json(payload);
  });

  let liveFatwaArchiveCache: {
    items: ScholarlySiteItem[];
    fetchedAt: number;
    cacheDate: string;
  } = {
    items: [],
    fetchedAt: 0,
    cacheDate: '',
  };

  // Live Scholarly Fatawa Archive Index from sh-yahia.net/fatawa.php & alilmia.com/fatawa.php
  app.get('/api/fatawa/archive', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const forceRefresh = req.query.refresh === '1';
    const todayKey = getDateKey();
    const isFresh =
      liveFatwaArchiveCache.cacheDate === todayKey &&
      Date.now() - liveFatwaArchiveCache.fetchedAt < 20 * 60 * 1000;
    if (!forceRefresh && isFresh && liveFatwaArchiveCache.items.length > 0) {
      res.json({items: liveFatwaArchiveCache.items, source: 'cache'});
      return;
    }

    const collected: ScholarlySiteItem[] = [];
    const seenUrls = new Set<string>();

    const [syRes, alRes] = await Promise.allSettled([
      fetch('https://sh-yahia.net/fatawa.php', {headers: {'User-Agent': 'Mozilla/5.0'}}).then((r) =>
        r.ok ? r.text() : '',
      ),
      fetch('https://alilmia.com/fatawa.php', {headers: {'User-Agent': 'Mozilla/5.0'}}).then((r) =>
        r.ok ? r.text() : '',
      ),
    ]);

    if (syRes.status === 'fulfilled' && syRes.value) {
      const syMatches = [
        ...syRes.value.matchAll(/<a[^>]+href=["'](show_fatawa_\d+\.html)["'][^>]*>([\s\S]*?)<\/a>/gi),
      ];
      for (const m of syMatches) {
        const title = decodeEntities(m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' '));
        const fullUrl = `https://sh-yahia.net/${m[1]}`;
        if (!title || title.length < 10 || seenUrls.has(fullUrl)) continue;
        seenUrls.add(fullUrl);
        collected.push({
          id: `sy_fatwa_${m[1].replace(/\W+/g, '_')}`,
          siteId: 'sh_yahia',
          siteNameAr: 'فتاوى الشيخ يحيى الحجوري · sh-yahia.net',
          siteNameEn: 'Sheikh Al-Hajouri Fatawa',
          kindLabelAr: 'فتوى موثقة',
          kindLabelEn: 'Documented Fatwa',
          title: title.slice(0, 180),
          url: fullUrl,
        });
        if (collected.length >= 45) break;
      }
    }

    if (alRes.status === 'fulfilled' && alRes.value) {
      const alMatches = [
        ...alRes.value.matchAll(/<a[^>]+href=["'](item\.php\?id=\d+[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi),
      ];
      for (const m of alMatches) {
        const rel = decodeEntities(m[1]);
        const title = decodeEntities(m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' '));
        const fullUrl = `https://alilmia.com/${rel}`;
        if (!title || title.length < 10 || seenUrls.has(fullUrl)) continue;
        seenUrls.add(fullUrl);
        collected.push({
          id: `al_fatwa_${rel.replace(/\W+/g, '_')}`,
          siteId: 'alilmia',
          siteNameAr: 'فتاوى الشبكة العلمية · alilmia.com',
          siteNameEn: 'Alilmia Fatawa Archive',
          kindLabelAr: 'فتوى علمية',
          kindLabelEn: 'Scholarly Verdict',
          title: title.slice(0, 180),
          url: fullUrl,
        });
        if (collected.length >= 90) break;
      }
    }

    if (collected.length > 0) {
      liveFatwaArchiveCache = {items: collected, fetchedAt: Date.now(), cacheDate: todayKey};
    }

    res.json({
      items: liveFatwaArchiveCache.items,
      source: collected.length > 0 ? 'live' : 'cache',
    });
  });

  // Read full text of a verified sh-yahia.net fatwa page directly inside the app
  app.get('/api/fatawa/remote', async (req, res) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';
    if (
      !rawUrl.startsWith('https://sh-yahia.net/show_fatawa_') &&
      !rawUrl.startsWith('https://alilmia.com/item.php?id=')
    ) {
      res.status(400).json({error: 'رابط الفتوى غير مدعوم'});
      return;
    }

    try {
      const response = await fetch(rawUrl, {headers: {'User-Agent': 'Mozilla/5.0'}});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();

      let question = '';
      let answer = '';
      // Prefer Schema.org FAQ JSON-LD if available (sh-yahia.net)
      const jsonLdMatches = [
        ...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi),
      ];
      for (const block of jsonLdMatches) {
        try {
          const parsed = JSON.parse(block[1]) as {
            '@type'?: string;
            mainEntity?: Array<{name?: string; acceptedAnswer?: {text?: string}}>;
          };
          if (parsed.mainEntity?.[0]) {
            question = decodeEntities((parsed.mainEntity[0].name || '').replace(/<[^>]+>/g, ' '));
            answer = decodeEntities((parsed.mainEntity[0].acceptedAnswer?.text || '').replace(/<[^>]+>/g, ' '));
            if (answer) break;
          }
        } catch {
          // Ignore malformed JSON-LD blocks
        }
      }

      if (!answer) {
        const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
        question = decodeEntities((titleMatch?.[1] || '').replace(/<[^>]+>/g, ' '));
        const stripped = html
          .replace(/<script[\s\S]*?<\/script>/gi, ' ')
          .replace(/<style[\s\S]*?<\/style>/gi, ' ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        const ansIdx = stripped.indexOf('الجواب');
        answer =
          ansIdx >= 0
            ? stripped.slice(ansIdx, Math.min(stripped.length, ansIdx + 2400))
            : stripped.slice(0, 1200);
      }

      res.json({
        url: rawUrl,
        question: question.trim(),
        answer: answer.trim(),
      });
    } catch {
      res.status(502).json({error: 'تعذر جلب نص الفتوى من الموقع الرسمي حالياً'});
    }
  });

  // Grounded In-App AI Chatbot Assistant (Gemini Server-Side Proxy)
  app.post('/api/ai/assistant', async (req, res) => {
    const body = req.body as {
      message?: string;
      history?: Array<{role?: string; text?: string}>;
      lang?: Language;
      uploadedBooks?: Array<{title?: string; author?: string; section?: string}>;
    };
    const userMessage = typeof body.message === 'string' ? body.message.trim() : '';
    if (!userMessage) {
      res.status(400).json({error: 'يرجى كتابة سؤالك أو استفسارك أولاً'});
      return;
    }
    if (userMessage.length > 1500) {
      res.status(400).json({error: 'النص طويل جداً، يرجى اختصار السؤال إلى أقل من ١٥٠٠ حرف'});
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      res.status(503).json({error: 'مفتاح الذكاء الاصطناعي (GEMINI_API_KEY) غير متوفر في إعدادات الخادم'});
      return;
    }

    const reqLang: Language = body.lang === 'en' ? 'en' : 'ar';
    const postSummaries = store.posts
      .slice(0, 8)
      .map((p) => `- ${p.title} (${p.category} · ${p.author}): ${p.excerpt}`)
      .join('\n');
    const fatwaSummaries = store.fatawa
      .slice(0, 8)
      .map((f) => `- [${f.scholarName}] س: ${f.question} | ج: ${f.answer.slice(0, 140)}...`)
      .join('\n');
    const lessonSummaries = HAJOURI_LESSONS.slice(0, 8)
      .map((l) => `- ${l.title} (${l.categoryLabel})`)
      .join('\n');
    const motherOasisSummaries = store.motherOasisItems
      .slice(0, 8)
      .map((m) => `- [${m.chapter}] ${m.title}: ${m.body.slice(0, 120)}...`)
      .join('\n');
    const combinedUploadedBooks = [
      ...(Array.isArray(body.uploadedBooks) ? body.uploadedBooks : []),
      ...store.customBooks.map((b) => ({title: b.title, author: b.author, section: b.section})),
    ];
    const uploadedBooksSummary =
      combinedUploadedBooks.length > 0
        ? combinedUploadedBooks
            .slice(0, 35)
            .map((b) => `- ${String(b.title || '').trim()} (${String(b.author || 'المكتبة العلمية').trim()})`)
            .join('\n')
        : 'كتب الشيخ يحيى الحجوري والأئمة الكبار ومشايخ دار الحديث داخل قسم المكتبة العلمية';

    const sadaScholarsList = SADA_AL_KHAIR_SCHOLARS.map((s) => s.name).join('، ');
    const poetsList = SADA_SUNNAH_POETS.map((p) => p.name).join('، ');

    const systemInstruction = `You are the smart Islamic & platform assistant inside the "Mawaedh & Ibar" (مواعظ وعبر) web app & PWA (founded 2015).
LANGUAGE RULE: Respond primarily in ${reqLang === 'en' ? 'clear, warm, respectful English (keeping Arabic Quranic/Dua terms where appropriate)' : 'عربية فصحى سلسة ومختصرة ومنظمة بنقاط واضحة'}. Keep replies concise, helpful, easy to scan (use short bullet points, avoid long walls of text), and STRICTLY grounded in Salafi Ahlus-Sunnah methodology and the real sections INSIDE this app:

APPROVED AHLUS-SUNNAH SCHOLARS & SECTIONS:
1. Main Scholars of this Site ONLY:
   - فضيلة الشيخ يحيى بن علي الحجوري حفظه الله (الأولوية والمكتبة الرئيسية)
   - الأئمة الكبار: الإمام مقبل بن هادي الوادعي، سماحة الشيخ عبد العزيز بن باز، فضيلة الشيخ محمد بن صالح العثيمين، الإمام المحدث محمد ناصر الدين الألباني رحمهم الله.
   - مشايخ وعلماء صدى الخير الدعوية في الموقع: ${sadaScholarsList}.
   - شعراء السنة: ${poetsList}.
   - واحة وقصص الوالدة: أم محمد (أبواب: المؤلفات والكتب الدعوية والتربوية، المحاضرات والدروس المفرغة، قصص أم محمد).
2. Site Sections:
   - الرئيسية (مواعظ وعبر + اختصارات سريعة + الورد اليومي)
   - المصحف الشريف (١١٤ سورة · ٦٠٤ صفحات بالرسم العثماني + تفسير ٥ أئمة بـ ٧ لغات + وضع القراءة المركزة)
   - الأذكار والأدعية الجامعة (٨ أبواب مرتبة تشمل باب وقفة بر ووفاء + عداد الحسنات وإنجاز اليوم والشهر والإجمالي العام)
   - قسم الصم والبكم (بإشراف إدارة القسم)
   - الفتاوى (فتاوى الشيخ يحيى الحجوري والأئمة الكبار)
   - المكتبة العلمية وصدى الخير (مؤلفات الشيخ يحيى الحجوري، مكتبة الأئمة الكبار، مشايخ وطلاب دار الحديث، مشغل تيليجرام المباشر، وقراء/تحميل ملفات PDF)
   - البطاقات الدعوية، واحة الشعر والطرائف، الأرشيف الشامل الدائم، آراء وتقييمات الزوار، عن الموقع والدعم والمشاركة ومتابعة التذاكر.

UPLOADED & INTERNAL BOOKS INDEX:
${uploadedBooksSummary}

MOTHER OASIS WORKS ON SITE:
${motherOasisSummaries || 'مؤلفات ومحاضرات وقصص الوالدة أم محمد'}

RECENT POSTS ON SITE:
${postSummaries}

FEATURED FATAWA ON SITE:
${fatwaSummaries}

SHEIKH AL-HAJOURI LESSON SERIES:
${lessonSummaries}

STRICT GROUNDING & SAFETY RULES (MANDATORY):
1. NEVER quote, recommend, or cite any scholar, preacher, thinker, or group outside authentic Salaf Imams (such as Ibn Taymiyyah, Ibn Al-Qayyim, Ibn Kathir, Al-Bukhari, Muslim) and the approved Salafi scholars listed above. Strictly avoid any partisan or non-Salafi figures.
2. NEVER output ANY external URLs, website domains, HTTP/HTTPS links, or send visitors to external book websites! Always direct the visitor to the relevant section INSIDE this application (such as: «قسم المكتبة العلمية»، «قسم الفتاوى»، «قسم المصحف الشريف والتفسير»، «قسم الأذكار والأدعية الجامعة»، «واحة الداعية الفاضلة أمي»).
3. Never fabricate weak or unauthenticated hadiths.
4. Never claim, suggest, or hint whether any human admin or staff member is currently online or connected.
5. Never mention API keys, admin credentials, or internal code details.`;

    const safeHistory = Array.isArray(body.history)
      ? body.history
          .filter(
            (m) =>
              m &&
              (m.role === 'user' || m.role === 'model') &&
              typeof m.text === 'string' &&
              m.text.trim().length > 0,
          )
          .slice(-8)
          .map((m) => ({
            role: m.role === 'model' ? 'model' : 'user',
            parts: [{text: (m.text || '').trim().slice(0, 1200)}],
          }))
      : [];

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {headers: {'User-Agent': 'aistudio-build'}},
      });

      const contentsPayload = [
        ...safeHistory,
        {role: 'user', parts: [{text: userMessage}]},
      ];

      let response;
      try {
        response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: contentsPayload,
          config: {
            systemInstruction,
            thinkingConfig: {thinkingLevel: ThinkingLevel.LOW},
          },
        });
      } catch {
        response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: contentsPayload,
          config: {
            systemInstruction,
          },
        });
      }

      const replyText =
        response.candidates?.[0]?.content?.parts
          ?.filter((part) => typeof part.text === 'string' && !part.thought)
          .map((part) => part.text)
          .join('')
          .trim() ||
        response.text?.trim() ||
        '';

      if (!replyText) {
        res.status(502).json({
          error:
            reqLang === 'en'
              ? 'No valid response received from the AI assistant. Please rephrase your question.'
              : 'لم يتم استلام رد صالح من المساعد الذكي، حاول إعادة صياغة سؤالك.',
        });
        return;
      }

      const offerLiveConnect = activeAdminSockets.size > 0 && needsLiveEscalation(userMessage);
      res.json({reply: replyText, offerLiveConnect});
    } catch {
      res.status(503).json({
        error:
          reqLang === 'en'
            ? 'The AI assistant is momentarily busy. Please try again in a few seconds.'
            : 'المساعد الذكي مشغول مؤقتاً الآن بسبب ضغط الطلبات، يرجى المحاولة بعد قليل.',
      });
    }
  });

  // Create new post (primary admin publishes immediately; supervisors queue for Primary Admin approval)
  app.post('/api/posts', requireAuth, (req: AuthedRequest, res) => {
    if (!hasAdminPermission(req.authUser, 'manage_posts')) {
      res.status(403).json({error: 'لا تملك صلاحية إضافة المواعظ والقصص'});
      return;
    }
    const body = req.body as {
      title?: string;
      excerpt?: string;
      body?: string;
      author?: string;
      category?: string;
      mediaType?: MediaType;
      youtubeUrl?: string;
      cardTheme?: CardTheme;
      syncedPlatforms?: string[];
    };

    const content = (body.body || '').trim();
    if (!content) {
      res.status(400).json({error: 'نص الموعظة مطلوب'});
      return;
    }

    const mediaType: MediaType =
      body.mediaType === 'sada' || body.mediaType === 'audio' || body.mediaType === 'video'
        ? body.mediaType
        : 'quote';
    const cardTheme: CardTheme =
      body.cardTheme === 'azure' || body.cardTheme === 'gold' || body.cardTheme === 'midnight'
        ? body.cardTheme
        : 'emerald';

    const post: Post = {
      id: `post_${Date.now().toString(36)}`,
      title: (body.title || content.slice(0, 68)).trim(),
      excerpt: (body.excerpt || content.slice(0, 140)).trim(),
      body: content,
      author: (body.author || 'خدمة صدى الخير الدعوية').trim(),
      sourceLabel:
        mediaType === 'sada' || mediaType === 'audio'
          ? 'خدمة صدى الخير الدعوية'
          : mediaType === 'video'
            ? 'مرئيات مختارة'
            : 'نشر مباشر',
      category: (body.category || 'مواعظ وعبر').trim(),
      mediaType,
      platformTag:
        mediaType === 'video' ? 'يوتيوب' : mediaType === 'sada' || mediaType === 'audio' ? 'صدى الخير' : undefined,
      youtubeUrl: body.youtubeUrl?.trim() || undefined,
      cardTheme,
      likes: 0,
      commentsCount: 0,
      comments: [],
      publishedAtLabel: 'الآن',
      createdAt: new Date().toISOString(),
      syncedPlatforms: Array.isArray(body.syncedPlatforms) ? body.syncedPlatforms : ['telegram'],
      listeningTrend: createDefaultTrend(0),
    };

    if (!isPrimaryAdminUser(req.authUser) && req.authUser) {
      const pendingApproval = queueContentApprovalRequest({
        section: 'post',
        action: 'create',
        targetId: post.id,
        title: `إضافة في ${post.category}: ${post.title}`,
        summary: post.body.slice(0, 180),
        payload: {item: post},
        user: req.authUser,
      });
      res.status(202).json({
        requiresApproval: true,
        pendingApproval,
        message: 'تم إرسال المحتوى إلى المسؤول الأول للموافقة قبل نشره للزوار.',
      });
      return;
    }

    store.posts = [post, ...store.posts];
    saveStore(store);
    res.status(201).json({post});
  });

  // Update post (primary admin applies immediately; supervisors queue for Primary Admin approval)
  app.put('/api/posts/:id', requireAuth, (req: AuthedRequest, res) => {
    if (!hasAdminPermission(req.authUser, 'manage_posts')) {
      res.status(403).json({error: 'لا تملك صلاحية تعديل المواعظ والقصص'});
      return;
    }
    const {id} = req.params;
    const idx = store.posts.findIndex((p) => p.id === id);
    if (idx === -1) {
      res.status(404).json({error: 'المنشور غير موجود'});
      return;
    }
    const body = req.body as Partial<Post>;
    const current = store.posts[idx];
    const patch: Partial<Post> = {
      title: typeof body.title === 'string' && body.title.trim() ? body.title.trim() : current.title,
      excerpt: typeof body.excerpt === 'string' && body.excerpt.trim() ? body.excerpt.trim() : current.excerpt,
      body: typeof body.body === 'string' && body.body.trim() ? body.body.trim() : current.body,
      author: typeof body.author === 'string' && body.author.trim() ? body.author.trim() : current.author,
      category: typeof body.category === 'string' && body.category.trim() ? body.category.trim() : current.category,
      youtubeUrl: typeof body.youtubeUrl === 'string' ? body.youtubeUrl.trim() || undefined : current.youtubeUrl,
    };

    if (!isPrimaryAdminUser(req.authUser) && req.authUser) {
      const pendingApproval = queueContentApprovalRequest({
        section: 'post',
        action: 'update',
        targetId: id,
        title: `تعديل منشور: ${patch.title || current.title}`,
        summary: String(patch.body || current.body).slice(0, 180),
        payload: {patch},
        user: req.authUser,
      });
      res.status(202).json({
        requiresApproval: true,
        pendingApproval,
        message: 'تم إرسال التعديل إلى المسؤول الأول للموافقة قبل تطبيقه للزوار.',
      });
      return;
    }

    const updated: Post = {
      ...current,
      ...patch,
    };
    store.posts[idx] = updated;
    saveStore(store);
    res.json({post: updated});
  });

  // Delete post (primary admin deletes immediately; supervisors queue for Primary Admin approval)
  app.delete('/api/posts/:id', requireAuth, (req: AuthedRequest, res) => {
    if (!hasAdminPermission(req.authUser, 'manage_posts')) {
      res.status(403).json({error: 'لا تملك صلاحية حذف المنشورات'});
      return;
    }
    const {id} = req.params;
    const existing = store.posts.find((p) => p.id === id);
    if (!isPrimaryAdminUser(req.authUser) && req.authUser) {
      const pendingApproval = queueContentApprovalRequest({
        section: 'post',
        action: 'delete',
        targetId: id,
        title: `طلب حذف منشور: ${existing?.title || id}`,
        summary: existing?.body?.slice(0, 160) || 'طلب حذف منشور من الموقع',
        payload: {},
        user: req.authUser,
      });
      res.status(202).json({
        requiresApproval: true,
        pendingApproval,
        message: 'تم إرسال طلب الحذف إلى المسؤول الأول للموافقة.',
      });
      return;
    }
    store.posts = store.posts.filter((p) => p.id !== id);
    saveStore(store);
    res.json({ok: true});
  });

  // Toggle post visibility (hidden/visible)
  app.patch('/api/admin/posts/:id/visibility', requireAuth, (req: AuthedRequest, res) => {
    if (!hasAdminPermission(req.authUser, 'manage_posts')) {
      res.status(403).json({error: 'لا تملك صلاحية تعديل ظهور المنشورات'});
      return;
    }
    const {id} = req.params;
    const {hidden} = req.body as {hidden?: boolean};
    const idx = store.posts.findIndex((p) => p.id === id);
    if (idx === -1) {
      res.status(404).json({error: 'المنشور غير موجود'});
      return;
    }
    const nextHidden = typeof hidden === 'boolean' ? hidden : !store.posts[idx].hidden;
    if (!isPrimaryAdminUser(req.authUser) && req.authUser) {
      const pendingApproval = queueContentApprovalRequest({
        section: 'post',
        action: 'update',
        targetId: id,
        title: `${nextHidden ? 'إخفاء' : 'إظهار'} منشور: ${store.posts[idx].title}`,
        summary: `طلب تغيير حالة الظهور للمنشور إلى ${nextHidden ? 'مخفي' : 'ظاهر'}`,
        payload: {patch: {hidden: nextHidden}},
        user: req.authUser,
      });
      res.status(202).json({
        requiresApproval: true,
        pendingApproval,
        message: 'تم إرسال طلب تغيير الظهور إلى المسؤول الأول للموافقة.',
      });
      return;
    }
    store.posts[idx] = {...store.posts[idx], hidden: nextHidden};
    saveStore(store);
    res.json({post: store.posts[idx]});
  });

  // Comment moderation: Edit, Toggle visibility, Delete
  app.put('/api/admin/posts/:postId/comments/:commentId', requireAuth, (req, res) => {
    const {postId, commentId} = req.params;
    const {text, author} = req.body as {text?: string; author?: string};
    const idx = store.posts.findIndex((p) => p.id === postId);
    if (idx === -1) {
      res.status(404).json({error: 'المنشور غير موجود'});
      return;
    }
    const current = store.posts[idx];
    const comments = (current.comments || []).map((c) =>
      c.id === commentId
        ? {
            ...c,
            ...(typeof text === 'string' && text.trim() ? {text: text.trim().slice(0, 600)} : {}),
            ...(typeof author === 'string' && author.trim() ? {author: author.trim().slice(0, 40)} : {}),
          }
        : c,
    );
    store.posts[idx] = {...current, comments};
    saveStore(store);
    res.json({post: store.posts[idx]});
  });

  app.patch('/api/admin/posts/:postId/comments/:commentId/visibility', requireAuth, (req, res) => {
    const {postId, commentId} = req.params;
    const {hidden} = req.body as {hidden?: boolean};
    const idx = store.posts.findIndex((p) => p.id === postId);
    if (idx === -1) {
      res.status(404).json({error: 'المنشور غير موجود'});
      return;
    }
    const current = store.posts[idx];
    const comments = (current.comments || []).map((c) =>
      c.id === commentId
        ? {...c, hidden: typeof hidden === 'boolean' ? hidden : !c.hidden}
        : c,
    );
    store.posts[idx] = {...current, comments};
    saveStore(store);
    res.json({post: store.posts[idx]});
  });

  app.delete('/api/admin/posts/:postId/comments/:commentId', requireAuth, (req, res) => {
    const {postId, commentId} = req.params;
    const idx = store.posts.findIndex((p) => p.id === postId);
    if (idx === -1) {
      res.status(404).json({error: 'المنشور غير موجود'});
      return;
    }
    const current = store.posts[idx];
    const comments = (current.comments || []).filter((c) => c.id !== commentId);
    store.posts[idx] = {...current, comments, commentsCount: comments.length};
    saveStore(store);
    res.json({post: store.posts[idx]});
  });

  // Silent Auto-Post Webhook execution (Facebook / WhatsApp / X)
  app.post('/api/admin/auto-post', requireAuth, async (req, res) => {
    const {postId} = req.body as {postId?: string};
    const post = store.posts.find((p) => p.id === postId);
    if (!post) {
      res.status(404).json({error: 'الموعظة غير موجودة'});
      return;
    }
    const webhookUrl = store.automationSettings.autoPostWebhookUrl?.trim() || '';
    if (!webhookUrl) {
      res.status(400).json({error: 'يرجى ضبط رابط Webhook للنشر الآلي في لوحة تحكم المشرف أولاً'});
      return;
    }
    const valid = validateExternalWebhookUrl(webhookUrl);
    if (!valid) {
      res.status(400).json({error: 'رابط Webhook غير صالح أو محظور أمنياً'});
      return;
    }
    const platforms = Object.entries(store.automationSettings.enabledPlatforms)
      .filter(([, enabled]) => enabled)
      .map(([name]) => name);

    const ok = await dispatchSafeWebhook(webhookUrl, {
      event: 'auto_publish_post',
      platforms,
      post: {
        id: post.id,
        title: post.title,
        excerpt: post.excerpt,
        body: post.body,
        author: post.author,
        category: post.category,
        brandHandle: store.brandHandle,
      },
      sentAt: new Date().toISOString(),
    });
    if (!ok) {
      res.status(502).json({error: 'تعذر الاتصال بخادم النشر الآلي (تأكد من جاهزية رابط Webhook)'});
      return;
    }
    res.json({ok: true, platforms});
  });

  // Create Fatwa (restricted to 5 approved scholars; supervisors queue for Primary Admin approval)
  app.post('/api/fatawa', requireAuth, (req: AuthedRequest, res) => {
    if (!hasAdminPermission(req.authUser, 'manage_fatawa')) {
      res.status(403).json({error: 'لا تملك صلاحية إضافة الفتاوى'});
      return;
    }
    const body = req.body as {
      scholarId?: FatwaScholarId;
      category?: string;
      question?: string;
      answer?: string;
      source?: string;
      featured?: boolean;
    };
    const scholar = FATWA_SCHOLARS.find((s) => s.id === body.scholarId) || FATWA_SCHOLARS[0];
    const question = (body.question || '').trim();
    const answer = (body.answer || '').trim();
    if (!question || !answer) {
      res.status(400).json({error: 'نص السؤال والجواب مطلوبان'});
      return;
    }
    const item: FatwaItem = {
      id: `ft_${scholar.id}_${Date.now().toString(36)}`,
      scholarId: scholar.id,
      scholarName:
        scholar.id === 'hajouri'
          ? `${scholar.name} حفظه الله`
          : `${scholar.name} رحمه الله`,
      category: (body.category || 'العقيدة والتوحيد').trim(),
      question,
      answer,
      source: (body.source || `فتاوى ${scholar.name}`).trim(),
      featured: body.featured ?? scholar.id === 'hajouri',
      createdAt: new Date().toISOString(),
    };
    if (!isPrimaryAdminUser(req.authUser) && req.authUser) {
      const pendingApproval = queueContentApprovalRequest({
        section: 'fatwa',
        action: 'create',
        targetId: item.id,
        title: `إضافة فتوى (${item.scholarName}): ${question.slice(0, 90)}`,
        summary: answer.slice(0, 180),
        payload: {item},
        user: req.authUser,
      });
      res.status(202).json({
        requiresApproval: true,
        pendingApproval,
        message: 'تم إرسال الفتوى إلى المسؤول الأول للموافقة قبل نشرها للزوار.',
      });
      return;
    }
    store.fatawa = [item, ...store.fatawa];
    saveStore(store);
    res.status(201).json({fatwa: item});
  });

  // Delete Fatwa
  app.delete('/api/fatawa/:id', requireAuth, (req: AuthedRequest, res) => {
    if (!hasAdminPermission(req.authUser, 'manage_fatawa')) {
      res.status(403).json({error: 'لا تملك صلاحية حذف الفتاوى'});
      return;
    }
    const {id} = req.params;
    const existing = store.fatawa.find((f) => f.id === id);
    if (!isPrimaryAdminUser(req.authUser) && req.authUser) {
      const pendingApproval = queueContentApprovalRequest({
        section: 'fatwa',
        action: 'delete',
        targetId: id,
        title: `طلب حذف فتوى: ${existing?.question?.slice(0, 90) || id}`,
        summary: existing?.scholarName || 'طلب حذف فتوى',
        payload: {},
        user: req.authUser,
      });
      res.status(202).json({
        requiresApproval: true,
        pendingApproval,
        message: 'تم إرسال طلب حذف الفتوى إلى المسؤول الأول للموافقة.',
      });
      return;
    }
    store.fatawa = store.fatawa.filter((f) => f.id !== id);
    saveStore(store);
    res.json({ok: true});
  });

  // Like / unlike post
  app.post('/api/posts/:id/like', (req, res) => {
    const {id} = req.params;
    const {liked} = req.body as {liked?: boolean};
    const idx = store.posts.findIndex((p) => p.id === id);
    if (idx === -1) {
      res.status(404).json({error: 'المنشور غير موجود'});
      return;
    }
    const delta = liked ? 1 : -1;
    const current = store.posts[idx];
    const nextLikes = Math.max(0, current.likes + delta);
    const updated: Post = {
      ...current,
      likes: nextLikes,
      isTrending: Boolean(current.isTrending || nextLikes >= 3 || (current.commentsCount || 0) >= 2),
    };
    store.posts[idx] = updated;
    if (liked) {
      recordDailyMetric('sermonLikes', 1);
    }
    saveStore(store);
    res.json({post: updated});
  });

  // Add visitor comment on post (restricted to signed-in visitors or authenticated staff)
  app.post('/api/posts/:id/comments', (req, res) => {
    const {id} = req.params;
    const {author, text, visitorId} = req.body as {
      author?: string;
      text?: string;
      visitorId?: string;
    };

    const authHeader = req.headers.authorization || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const verifiedStaff = bearerToken ? verifyToken(bearerToken) : null;
    const registeredVisitor =
      typeof visitorId === 'string' && visitorId.trim()
        ? store.visitorAccounts[visitorId.trim()]
        : undefined;

    if (!verifiedStaff && !registeredVisitor) {
      res.status(401).json({error: 'التعليق متاح لمن سجل الدخول فقط — يرجى تسجيل الدخول أولاً'});
      return;
    }

    const content = (text || '').trim();
    if (!content) {
      res.status(400).json({error: 'نص التعليق مطلوب'});
      return;
    }
    const idx = store.posts.findIndex((p) => p.id === id);
    if (idx === -1) {
      res.status(404).json({error: 'المنشور غير موجود'});
      return;
    }
    const current = store.posts[idx];
    const existingComments = Array.isArray(current.comments) ? current.comments : [];
    const resolvedAuthor = registeredVisitor
      ? registeredVisitor.name
      : (author || verifiedStaff?.username || 'الإدارة').trim();
    const newComment = {
      id: `cmt_${Date.now().toString(36)}`,
      author: resolvedAuthor.slice(0, 40),
      text: content.slice(0, 600),
      createdAt: new Date().toISOString(),
    };
    const updatedComments = [newComment, ...existingComments];
    const updated: Post = {
      ...current,
      comments: updatedComments,
      commentsCount: updatedComments.length,
      isTrending: Boolean(current.isTrending || (current.likes || 0) >= 3 || updatedComments.length >= 2),
    };
    store.posts[idx] = updated;
    recordDailyMetric('sermonComments', 1);
    saveStore(store);
    res.status(201).json({post: updated, comment: newComment});
  });

  // Increment play / listening trend
  app.post('/api/posts/:id/play', (req, res) => {
    const {id} = req.params;
    const idx = store.posts.findIndex((p) => p.id === id);
    if (idx === -1) {
      recordDailyMetric('sermonReads', 1);
      saveStore(store);
      res.json({ok: true});
      return;
    }
    const current = store.posts[idx];
    const trend =
      Array.isArray(current.listeningTrend) && current.listeningTrend.length > 0
        ? current.listeningTrend.map((item, i, arr) =>
            i === arr.length - 1 ? {...item, listens: item.listens + 1} : item,
          )
        : createDefaultTrend(0).map((item, i, arr) => (i === arr.length - 1 ? {...item, listens: 1} : item));
    const updated: Post = {...current, listeningTrend: trend};
    store.posts[idx] = updated;
    recordDailyMetric('sermonReads', 1);
    saveStore(store);
    res.json({post: updated});
  });

  // Mother's prayer Amen counter
  app.post('/api/prayers/mother/amen', (_req, res) => {
    store.motherPrayersCount += 1;
    recordDailyMetric('motherAmens', 1);
    saveStore(store);
    res.json({count: store.motherPrayersCount});
  });

  const mergeSectionStatsFloor = (
    incoming?: Record<string, {visits?: number; interactions?: number; shares?: number}>,
  ) => {
    if (!store.sectionStats || typeof store.sectionStats !== 'object') {
      store.sectionStats = {};
    }
    if (!incoming || typeof incoming !== 'object') return;
    for (const [rawKey, val] of Object.entries(incoming)) {
      const key = String(rawKey || '').trim().slice(0, 40);
      if (!key || !val || typeof val !== 'object') continue;
      const prev = store.sectionStats[key] || {visits: 0, interactions: 0, shares: 0};
      const nextVisits =
        typeof val.visits === 'number' && Number.isFinite(val.visits)
          ? Math.max(prev.visits, Math.min(prev.visits + 50000, Math.floor(val.visits)))
          : prev.visits;
      const nextInteractions =
        typeof val.interactions === 'number' && Number.isFinite(val.interactions)
          ? Math.max(prev.interactions, Math.min(prev.interactions + 100000, Math.floor(val.interactions)))
          : prev.interactions;
      const prevShares = prev.shares || 0;
      const nextShares =
        typeof val.shares === 'number' && Number.isFinite(val.shares)
          ? Math.max(prevShares, Math.min(prevShares + 100000, Math.floor(val.shares)))
          : prevShares;
      store.sectionStats[key] = {
        visits: nextVisits,
        interactions: nextInteractions,
        shares: nextShares,
      };
    }
  };

  // Visitor session counter (strictly monotonic across devices/restarts, enforced >= 4580 visitors & >= 8540 clicks)
  const applyMonotonicFloors = (body?: {
    clientVisitorsFloor?: number;
    clientClicksFloor?: number;
    clientMembersFloor?: number;
    clientSectionStatsFloor?: Record<string, {visits?: number; interactions?: number; shares?: number}>;
  }) => {
    const currentVisitors = Math.max(MIN_CUMULATIVE_VISITORS, store.visitorsCount || MIN_CUMULATIVE_VISITORS);
    const currentClicks = Math.max(MIN_CUMULATIVE_CLICKS, store.clicksCount || MIN_CUMULATIVE_CLICKS);
    const currentMembers = Math.max(
      store.registeredMembersCount || 0,
      Object.keys(store.visitorAccounts).length,
    );

    // Bounded monotonic high-water restoration (guards against container resets while restoring cloud Firestore totals)
    const incomingV =
      typeof body?.clientVisitorsFloor === 'number' && Number.isFinite(body.clientVisitorsFloor)
        ? Math.min(currentVisitors + 100000, Math.max(MIN_CUMULATIVE_VISITORS, Math.round(body.clientVisitorsFloor)))
        : currentVisitors;
    const incomingC =
      typeof body?.clientClicksFloor === 'number' && Number.isFinite(body.clientClicksFloor)
        ? Math.min(currentClicks + 250000, Math.max(MIN_CUMULATIVE_CLICKS, Math.round(body.clientClicksFloor)))
        : currentClicks;
    const incomingM =
      typeof body?.clientMembersFloor === 'number' && Number.isFinite(body.clientMembersFloor)
        ? Math.min(currentMembers + 5000, Math.max(currentMembers, Math.round(body.clientMembersFloor)))
        : currentMembers;

    store.visitorsCount = Math.max(currentVisitors, incomingV);
    store.clicksCount = Math.max(currentClicks, incomingC);
    store.registeredMembersCount = Math.max(currentMembers, incomingM);
    mergeSectionStatsFloor(body?.clientSectionStatsFloor);
  };

  app.post('/api/telemetry/visit', (req, res) => {
    const body = (req.body || {}) as {
      sessionId?: string;
      clientVisitorsFloor?: number;
      clientClicksFloor?: number;
      clientMembersFloor?: number;
      clientSectionStatsFloor?: Record<string, {visits?: number; interactions?: number; shares?: number}>;
    };
    applyMonotonicFloors(body);
    store.visitorsCount = Math.max(MIN_CUMULATIVE_VISITORS, store.visitorsCount) + 1;
    store.clicksCount = Math.max(MIN_CUMULATIVE_CLICKS, store.clicksCount) + 1;
    recordDailyMetric('visitors', 1);
    recordDailyMetric('clicks', 1);
    saveStore(store);
    const onlineVisitorsCount = updateAndCountOnline({
      touchSessionId: typeof body.sessionId === 'string' ? body.sessionId : undefined,
    });
    res.json({
      visitorsCount: store.visitorsCount,
      clicksCount: store.clicksCount,
      registeredMembersCount: store.registeredMembersCount,
      onlineVisitorsCount,
      sectionStats: store.sectionStats,
    });
  });

  // Live active visitors presence heartbeat
  app.post('/api/telemetry/presence', (req, res) => {
    const body = (req.body || {}) as {
      sessionId?: string;
      leave?: boolean;
      clientVisitorsFloor?: number;
      clientClicksFloor?: number;
      clientMembersFloor?: number;
      clientSectionStatsFloor?: Record<string, {visits?: number; interactions?: number}>;
    };
    const prevV = store.visitorsCount;
    const prevC = store.clicksCount;
    const prevM = store.registeredMembersCount;
    const prevS = JSON.stringify(store.sectionStats || {});
    applyMonotonicFloors(body);
    if (
      store.visitorsCount !== prevV ||
      store.clicksCount !== prevC ||
      store.registeredMembersCount !== prevM ||
      JSON.stringify(store.sectionStats || {}) !== prevS
    ) {
      saveStore(store);
    }
    const sid = typeof body.sessionId === 'string' ? body.sessionId : undefined;
    const onlineVisitorsCount = body.leave
      ? updateAndCountOnline({removeSessionId: sid})
      : updateAndCountOnline({touchSessionId: sid});
    res.json({
      onlineVisitorsCount,
      visitorsCount: Math.max(MIN_CUMULATIVE_VISITORS, store.visitorsCount),
      clicksCount: Math.max(MIN_CUMULATIVE_CLICKS, store.clicksCount),
      registeredMembersCount: Math.max(store.registeredMembersCount || 0, Object.keys(store.visitorAccounts).length),
      sectionStats: store.sectionStats || {},
    });
  });

  // Sync monotonic floor from client / cloud Firestore transaction
  app.post('/api/telemetry/sync-floor', (req, res) => {
    const body = (req.body || {}) as {
      clientVisitorsFloor?: number;
      clientClicksFloor?: number;
      clientMembersFloor?: number;
      clientSectionStatsFloor?: Record<string, {visits?: number; interactions?: number}>;
    };
    applyMonotonicFloors(body);
    saveStore(store);
    res.json({
      visitorsCount: store.visitorsCount,
      clicksCount: store.clicksCount,
      registeredMembersCount: store.registeredMembersCount,
      sectionStats: store.sectionStats || {},
    });
  });

  // Retrieve cumulative per-section Telemetry statistics (visits, interactions & shares)
  app.get('/api/telemetry/sections', (_req, res) => {
    res.json({
      sectionStats: store.sectionStats || {},
      totalVisitors: Math.max(MIN_CUMULATIVE_VISITORS, store.visitorsCount || MIN_CUMULATIVE_VISITORS),
      totalClicks: Math.max(MIN_CUMULATIVE_CLICKS, store.clicksCount || MIN_CUMULATIVE_CLICKS),
      updatedAt: new Date().toISOString(),
    });
  });

  // Cumulative per-section entry counter
  app.post('/api/telemetry/section-visit', (req, res) => {
    const body = (req.body || {}) as {
      section?: string;
      clientSectionStatsFloor?: Record<string, {visits?: number; interactions?: number; shares?: number}>;
    };
    mergeSectionStatsFloor(body.clientSectionStatsFloor);
    const section = typeof body.section === 'string' ? body.section.trim().slice(0, 40) : '';
    if (!section || section === 'splash' || section === 'admin-studio') {
      res.status(400).json({error: 'اسم القسم غير صالح'});
      return;
    }
    const prev = store.sectionStats[section] || {visits: 0, interactions: 0, shares: 0};
    store.sectionStats[section] = {
      visits: Math.max(1, prev.visits + 1),
      interactions: prev.interactions,
      shares: prev.shares || 0,
    };
    saveStore(store);
    res.json({sectionStats: store.sectionStats});
  });

  // Public interaction telemetry for monthly admin charts, live click totals & section interactions
  app.post('/api/telemetry/interaction', (req, res) => {
    const body = (req.body || {}) as {
      kind?: 'click' | 'sermon_read' | 'sermon_share' | 'adhkar_tap' | 'adhkar_complete';
      count?: number;
      category?: string;
      section?: string;
      clientVisitorsFloor?: number;
      clientClicksFloor?: number;
      clientMembersFloor?: number;
      clientSectionStatsFloor?: Record<string, {visits?: number; interactions?: number; shares?: number}>;
    };
    applyMonotonicFloors(body);
    const amount = typeof body.count === 'number' && Number.isFinite(body.count) ? Math.max(1, Math.min(200, Math.round(body.count))) : 1;
    store.clicksCount = Math.max(MIN_CUMULATIVE_CLICKS, store.clicksCount) + amount;
    if (typeof body.section === 'string' && body.section.trim()) {
      const secKey = body.section.trim().slice(0, 40);
      if (secKey !== 'splash' && secKey !== 'admin-studio') {
        const prevSec = store.sectionStats[secKey] || {visits: 0, interactions: 0, shares: 0};
        const shareDelta = body.kind === 'sermon_share' ? amount : 0;
        store.sectionStats[secKey] = {
          visits: prevSec.visits,
          interactions: prevSec.interactions + amount,
          shares: (prevSec.shares || 0) + shareDelta,
        };
      }
    }
    recordDailyMetric('clicks', amount);
    switch (body.kind) {
      case 'click':
        break;
      case 'sermon_read':
        recordDailyMetric('sermonReads', amount);
        break;
      case 'sermon_share':
        recordDailyMetric('sermonShares', amount);
        break;
      case 'adhkar_tap':
        recordDailyMetric('adhkarTaps', amount);
        if (typeof body.category === 'string' && body.category.trim()) {
          const catKey = body.category.trim().slice(0, 32);
          store.adhkarCategoryStats[catKey] = (store.adhkarCategoryStats[catKey] || 0) + amount;
        }
        break;
      case 'adhkar_complete':
        recordDailyMetric('adhkarCompletions', amount);
        break;
      default:
        res.status(400).json({error: 'نوع التفاعل غير مدعوم'});
        return;
    }
    saveStore(store);
    res.json({
      ok: true,
      clicksCount: store.clicksCount,
      visitorsCount: store.visitorsCount,
      registeredMembersCount: store.registeredMembersCount,
      sectionStats: store.sectionStats || {},
    });
  });

  // Visitor suggestions, contribution & help messages (Issues #REQ-xxxx ticket + silent admin alert)
  app.post('/api/suggestions', (req, res) => {
    const {type, senderName, text, contact, visitorWhatsapp, visitorId, source} = req.body as {
      type?: string;
      senderName?: string;
      text?: string;
      contact?: string;
      visitorWhatsapp?: string;
      visitorId?: string;
      source?: string;
    };
    const trimmedText = typeof text === 'string' ? text.trim() : '';
    if (!trimmedText) {
      res.status(400).json({error: 'نص الرسالة أو المقترح مطلوب'});
      return;
    }
    if (trimmedText.length > 2500) {
      res.status(400).json({error: 'النص طويل جداً، يرجى اختصاره إلى أقل من ٢٥٠٠ حرف'});
      return;
    }
    const ticketNumber = String(store.nextTicketSeq++);
    const nowIso = new Date().toISOString();
    const item: SuggestionItem = {
      id: `sug_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      ticketNumber,
      visitorId: typeof visitorId === 'string' && visitorId.trim() ? visitorId.trim().slice(0, 60) : undefined,
      visitorWhatsapp:
        typeof visitorWhatsapp === 'string' && visitorWhatsapp.trim()
          ? visitorWhatsapp.trim().slice(0, 40)
          : undefined,
      type: (type || 'preach').trim().slice(0, 40),
      senderName: typeof senderName === 'string' && senderName.trim() ? senderName.trim().slice(0, 80) : undefined,
      text: trimmedText,
      contact: typeof contact === 'string' && contact.trim() ? contact.trim().slice(0, 140) : undefined,
      source: source === 'assistant' ? 'assistant' : 'support_page',
      status: 'new',
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    store.suggestions = [item, ...store.suggestions];
    saveStore(store);
    void dispatchAdminTicketAlert(
      `تذكرة جديدة ${ticketNumber} (${item.type}) من ${item.senderName || 'زائر'}: ${trimmedText.slice(0, 120)}`,
      {ticketNumber, kind: 'suggestion', senderName: item.senderName || 'زائر'},
    );
    res.status(201).json({suggestion: item, ticketNumber});
  });

  // Volunteer & site team membership application (Issues #REQ-xxxx ticket + silent admin alert)
  app.post('/api/volunteers', (req, res) => {
    const {senderName, field, hours, skills, contact, visitorWhatsapp, visitorId, source} = req.body as {
      senderName?: string;
      field?: string;
      hours?: string;
      skills?: string;
      contact?: string;
      visitorWhatsapp?: string;
      visitorId?: string;
      source?: string;
    };
    const trimmedSkills = typeof skills === 'string' ? skills.trim() : '';
    const trimmedContact = typeof contact === 'string' ? contact.trim() : '';
    if (!trimmedSkills || !trimmedContact) {
      res.status(400).json({error: 'يرجى كتابة الخبرات/التفاصيل ووسيلة التواصل'});
      return;
    }
    const ticketNumber = String(store.nextTicketSeq++);
    const nowIso = new Date().toISOString();
    const item: VolunteerItem = {
      id: `vol_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      ticketNumber,
      visitorId: typeof visitorId === 'string' && visitorId.trim() ? visitorId.trim().slice(0, 60) : undefined,
      visitorWhatsapp:
        typeof visitorWhatsapp === 'string' && visitorWhatsapp.trim()
          ? visitorWhatsapp.trim().slice(0, 40)
          : undefined,
      senderName: typeof senderName === 'string' && senderName.trim() ? senderName.trim().slice(0, 80) : undefined,
      field: (field || 'التدقيق اللغوي والشرعي').trim().slice(0, 120),
      hours: (hours || '2-4').trim().slice(0, 40),
      skills: trimmedSkills.slice(0, 2500),
      contact: trimmedContact.slice(0, 140),
      source: source === 'assistant' ? 'assistant' : 'support_page',
      status: 'new',
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    store.volunteers = [item, ...store.volunteers];
    saveStore(store);
    void dispatchAdminTicketAlert(
      `طلب انضمام جديد ${ticketNumber} (${item.field}) من ${item.senderName || 'متطوع'}: ${trimmedSkills.slice(0, 120)}`,
      {ticketNumber, kind: 'volunteer', field: item.field},
    );
    res.status(201).json({volunteer: item, ticketNumber});
  });

  // Supervisors (editor) & Managers (admin) ONLY: Correspondents, Visitor Messages, Suggestions & Team/Job Applications
  app.get('/api/admin/messages', requireAuth, (_req, res) => {
    res.json({
      suggestions: store.suggestions,
      volunteers: store.volunteers,
    });
  });

  app.patch('/api/admin/messages/:kind/:id', requireAuth, async (req, res) => {
    const {kind, id} = req.params;
    const {status, adminNote} = req.body as {status?: MessageInboxStatus; adminNote?: string};
    const validStatus: MessageInboxStatus | undefined =
      status === 'new' || status === 'reviewed' || status === 'resolved' ? status : undefined;
    const nowIso = new Date().toISOString();

    if (kind === 'suggestion') {
      const target = store.suggestions.find((s) => s.id === id);
      if (!target) {
        res.status(404).json({error: 'الرسالة غير موجودة'});
        return;
      }
      let whatsappNotifiedAt = target.whatsappNotifiedAt;
      if (target.visitorWhatsapp && validStatus && store.automationSettings.adminNotifyWebhookUrl) {
        const sent = await dispatchSafeWebhook(store.automationSettings.adminNotifyWebhookUrl, {
          event: 'visitor_whatsapp_status_update',
          ticketNumber: target.ticketNumber,
          visitorWhatsapp: target.visitorWhatsapp,
          status: validStatus,
          adminNote: typeof adminNote === 'string' ? adminNote.trim() : target.adminNote,
        });
        if (sent) whatsappNotifiedAt = nowIso;
      }
      store.suggestions = store.suggestions.map((s) =>
        s.id === id
          ? {
              ...s,
              ...(validStatus ? {status: validStatus} : {}),
              ...(typeof adminNote === 'string' ? {adminNote: adminNote.trim().slice(0, 500)} : {}),
              whatsappNotifiedAt,
              updatedAt: nowIso,
            }
          : s,
      );
      saveStore(store);
      res.json({suggestions: store.suggestions, volunteers: store.volunteers});
      return;
    }

    if (kind === 'volunteer') {
      const target = store.volunteers.find((v) => v.id === id);
      if (!target) {
        res.status(404).json({error: 'الطلب غير موجود'});
        return;
      }
      let whatsappNotifiedAt = target.whatsappNotifiedAt;
      if (target.visitorWhatsapp && validStatus && store.automationSettings.adminNotifyWebhookUrl) {
        const sent = await dispatchSafeWebhook(store.automationSettings.adminNotifyWebhookUrl, {
          event: 'visitor_whatsapp_status_update',
          ticketNumber: target.ticketNumber,
          visitorWhatsapp: target.visitorWhatsapp,
          status: validStatus,
          adminNote: typeof adminNote === 'string' ? adminNote.trim() : target.adminNote,
        });
        if (sent) whatsappNotifiedAt = nowIso;
      }
      store.volunteers = store.volunteers.map((v) =>
        v.id === id
          ? {
              ...v,
              ...(validStatus ? {status: validStatus} : {}),
              ...(typeof adminNote === 'string' ? {adminNote: adminNote.trim().slice(0, 500)} : {}),
              whatsappNotifiedAt,
              updatedAt: nowIso,
            }
          : v,
      );
      saveStore(store);
      res.json({suggestions: store.suggestions, volunteers: store.volunteers});
      return;
    }

    res.status(400).json({error: 'نوع رسالة غير صالح'});
  });

  app.delete('/api/admin/messages/:kind/:id', requireAuth, (req, res) => {
    const {kind, id} = req.params;
    if (kind === 'suggestion') {
      store.suggestions = store.suggestions.filter((s) => s.id !== id);
      saveStore(store);
      res.json({suggestions: store.suggestions, volunteers: store.volunteers});
      return;
    }
    if (kind === 'volunteer') {
      store.volunteers = store.volunteers.filter((v) => v.id !== id);
      saveStore(store);
      res.json({suggestions: store.suggestions, volunteers: store.volunteers});
      return;
    }
    res.status(400).json({error: 'نوع رسالة غير صالح'});
  });

  // Persistent Admin Session verification endpoint (never expires until manual logout)
  app.get('/api/admin/session', requireAuth, (req: AuthedRequest, res) => {
    res.json({
      ok: true,
      username: req.authUser?.username,
      role: req.authUser?.role,
      assignedSection: req.authUser?.assignedSection || 'all',
      permissions: req.authUser?.permissions || [],
      isFounder: Boolean(req.authUser?.isFounder),
      suggestions: store.suggestions,
      volunteers: store.volunteers,
      automationSettings: store.automationSettings,
      siteAppearance: store.siteAppearance,
      meetConfig: store.meetConfig,
    });
  });

  // Hidden Admin/Editor/Supervisor Username+Password Login
  app.post('/api/admin/login', (req, res) => {
    const {username, password} = req.body as {username?: string; password?: string};
    const u = (username || '').trim();
    const p = (password || '').trim();
    const account = store.accounts.find((acc) => acc.username === u);
    if (!account || !safeEqualHex(hashPassword(p), account.passwordHash)) {
      res.status(401).json({ok: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة'});
      return;
    }
    if (account.disabled && account.username !== 'moalwbri') {
      res.status(403).json({ok: false, error: 'هذا الحساب موقوف مؤقتاً من قبل المشرف المؤسس'});
      return;
    }
    const scope = account.assignedSection || 'all';
    const permissions =
      Array.isArray(account.permissions) && account.permissions.length > 0
        ? account.permissions
        : getDefaultPermissionsForAccount(account.role, scope);
    const isFounder = Boolean(account.isFounder || account.username === 'moalwbri');
    const token = signToken(account.username, account.role, scope);
    res.json({
      ok: true,
      token,
      username: account.username,
      displayName: account.displayName || account.username,
      role: account.role,
      assignedSection: scope,
      permissions,
      isFounder,
      suggestions: store.suggestions,
      volunteers: store.volunteers,
      automationSettings: store.automationSettings,
      siteAppearance: store.siteAppearance,
      meetConfig: store.meetConfig,
    });
  });

  // Primary Admin ONLY: Automation Bot & Notification Webhook settings
  app.get('/api/admin/automation', requirePrimaryAdmin, (_req, res) => {
    res.json({automationSettings: store.automationSettings});
  });

  app.put('/api/admin/automation', requirePrimaryAdmin, (req, res) => {
    const body = req.body as Partial<AutomationSettings>;
    const next: AutomationSettings = {
      autoPostWebhookUrl:
        typeof body.autoPostWebhookUrl === 'string'
          ? body.autoPostWebhookUrl.trim().slice(0, 500)
          : store.automationSettings.autoPostWebhookUrl,
      enabledPlatforms: {
        facebook:
          typeof body.enabledPlatforms?.facebook === 'boolean'
            ? body.enabledPlatforms.facebook
            : store.automationSettings.enabledPlatforms.facebook,
        whatsapp:
          typeof body.enabledPlatforms?.whatsapp === 'boolean'
            ? body.enabledPlatforms.whatsapp
            : store.automationSettings.enabledPlatforms.whatsapp,
        x:
          typeof body.enabledPlatforms?.x === 'boolean'
            ? body.enabledPlatforms.x
            : store.automationSettings.enabledPlatforms.x,
      },
      adminNotifyWebhookUrl:
        typeof body.adminNotifyWebhookUrl === 'string'
          ? body.adminNotifyWebhookUrl.trim().slice(0, 500)
          : store.automationSettings.adminNotifyWebhookUrl,
      telegramBotToken:
        typeof body.telegramBotToken === 'string'
          ? body.telegramBotToken.trim().slice(0, 120)
          : store.automationSettings.telegramBotToken,
      telegramChatId:
        typeof body.telegramChatId === 'string'
          ? body.telegramChatId.trim().slice(0, 80)
          : store.automationSettings.telegramChatId,
      emailJsServiceId:
        typeof body.emailJsServiceId === 'string'
          ? body.emailJsServiceId.trim().slice(0, 80)
          : store.automationSettings.emailJsServiceId,
      emailJsTemplateId:
        typeof body.emailJsTemplateId === 'string'
          ? body.emailJsTemplateId.trim().slice(0, 80)
          : store.automationSettings.emailJsTemplateId,
      emailJsPublicKey:
        typeof body.emailJsPublicKey === 'string'
          ? body.emailJsPublicKey.trim().slice(0, 80)
          : store.automationSettings.emailJsPublicKey,
    };
    store.automationSettings = next;
    saveStore(store);
    res.json({automationSettings: store.automationSettings});
  });

  // Primary Admin ONLY: Appearance Studio, Brightness, Announcement Bar & Maintenance Mode
  app.put('/api/admin/appearance', requirePrimaryAdmin, (req, res) => {
    const body = req.body as Partial<SiteAppearanceConfig>;
    const allowedPresets: SiteAppearanceConfig['backgroundPreset'][] = [
      'default',
      'emerald_mist',
      'warm_parchment',
      'sky_calm',
      'deep_forest',
    ];
    const next: SiteAppearanceConfig = {
      backgroundPreset:
        body.backgroundPreset && allowedPresets.includes(body.backgroundPreset)
          ? body.backgroundPreset
          : store.siteAppearance.backgroundPreset,
      brightness:
        typeof body.brightness === 'number' && Number.isFinite(body.brightness)
          ? Math.min(120, Math.max(70, Math.round(body.brightness)))
          : store.siteAppearance.brightness,
      announcementEnabled:
        typeof body.announcementEnabled === 'boolean'
          ? body.announcementEnabled
          : store.siteAppearance.announcementEnabled,
      announcementText:
        typeof body.announcementText === 'string'
          ? body.announcementText.trim().slice(0, 260)
          : store.siteAppearance.announcementText,
      announcementUrl:
        typeof body.announcementUrl === 'string'
          ? body.announcementUrl.trim().slice(0, 300)
          : store.siteAppearance.announcementUrl,
      maintenanceMode:
        typeof body.maintenanceMode === 'boolean'
          ? body.maintenanceMode
          : store.siteAppearance.maintenanceMode,
    };
    store.siteAppearance = next;
    saveStore(store);
    res.json({siteAppearance: store.siteAppearance});
  });

  // Primary Admin ONLY: Update full site labels, buttons, descriptions
  app.put('/api/admin/site-config', requirePrimaryAdmin, (req, res) => {
    const incoming = req.body as Partial<SiteConfig>;
    const nextConfig: SiteConfig = {...store.siteConfig};
    (Object.keys(DEFAULT_SITE_CONFIG) as Array<keyof SiteConfig>).forEach((key) => {
      const val = incoming[key];
      if (typeof val === 'string') {
        if (key === 'supportEmail') {
          nextConfig[key] = val.trim();
        } else if (val.trim()) {
          nextConfig[key] = val.trim();
        }
      }
    });
    store.siteConfig = nextConfig;
    saveStore(store);
    res.json({siteConfig: store.siteConfig});
  });

  // Primary Admin ONLY: security settings & optional password updates (Founder account protected)
  app.patch('/api/admin/settings', requirePrimaryAdmin, (req: AuthedRequest, res) => {
    const {gesture, targetUsername, newPassword} = req.body as {
      gesture?: AdminGesture;
      targetUsername?: string;
      newPassword?: string;
    };
    if (gesture === 'long_press' || gesture === 'multi_tap') {
      store.gesture = gesture;
    }
    if (typeof newPassword === 'string' && newPassword.trim().length >= 4 && targetUsername) {
      if (targetUsername === 'moalwbri' && req.authUser?.username !== 'moalwbri') {
        res.status(403).json({error: 'كلمة مرور الحساب المؤسس محمية ولا يغيرها إلا المؤسس نفسه'});
        return;
      }
      store.accounts = store.accounts.map((acc) =>
        acc.username === targetUsername ? {...acc, passwordHash: hashPassword(newPassword.trim())} : acc,
      );
    }
    saveStore(store);
    res.json({gesture: store.gesture});
  });

  // Founder-only password update endpoint with currentPassword verification
  app.put('/api/admin/founder-password', requireAuth, (req: AuthedRequest, res) => {
    if (req.authUser?.username !== 'moalwbri') {
      res.status(403).json({error: 'هذه الميزة مخصصة لحساب المشرف المؤسس فقط'});
      return;
    }
    const {currentPassword, newPassword} = (req.body || {}) as {
      currentPassword?: string;
      newPassword?: string;
    };
    const founderIdx = store.accounts.findIndex((a) => a.username === 'moalwbri');
    if (founderIdx === -1) {
      res.status(404).json({error: 'الحساب المؤسس غير موجود'});
      return;
    }
    const curr = (currentPassword || '').trim();
    const next = (newPassword || '').trim();
    if (!curr || !safeEqualHex(hashPassword(curr), store.accounts[founderIdx].passwordHash)) {
      res.status(401).json({error: 'كلمة المرور الحالية غير صحيحة'});
      return;
    }
    if (next.length < 6) {
      res.status(400).json({error: 'يجب أن تتكون كلمة المرور الجديدة من ٦ أحرف أو أرقام على الأقل'});
      return;
    }
    store.accounts[founderIdx] = {
      ...store.accounts[founderIdx],
      passwordHash: hashPassword(next),
    };
    saveStore(store);
    res.json({ok: true});
  });

  // Primary Admin ONLY: customization (brand handle, social links, app icons)
  app.put('/api/admin/customization', requirePrimaryAdmin, (req, res) => {
    const {brandHandle, socialLinks, appIcons} = req.body as {
      brandHandle?: string;
      socialLinks?: SocialLink[];
      appIcons?: AppIcons;
    };
    if (typeof brandHandle === 'string' && brandHandle.trim()) {
      store.brandHandle = brandHandle.trim();
    }
    if (Array.isArray(socialLinks) && socialLinks.length > 0) {
      store.socialLinks = socialLinks;
    }
    if (appIcons) {
      store.appIcons = {...DEFAULT_APP_ICONS, ...appIcons};
    }
    saveStore(store);
    res.json({
      brandHandle: store.brandHandle,
      socialLinks: store.socialLinks,
      appIcons: store.appIcons,
    });
  });

  function mapAccountSummaries(): AdminAccountSummary[] {
    return store.accounts.map((acc) => {
      const scope = acc.assignedSection || 'all';
      return {
        username: acc.username,
        displayName: acc.displayName || acc.username,
        role: acc.role,
        assignedSection: scope,
        permissions:
          Array.isArray(acc.permissions) && acc.permissions.length > 0
            ? acc.permissions
            : getDefaultPermissionsForAccount(acc.role, scope),
        disabled: acc.username === 'moalwbri' ? false : Boolean(acc.disabled),
        isFounder: Boolean(acc.isFounder || acc.username === 'moalwbri'),
      };
    });
  }

  // Primary Admin ONLY: list & add/update/remove delegated accounts with granular permissions
  app.get('/api/admin/accounts', requirePrimaryAdmin, (_req, res) => {
    res.json({accounts: mapAccountSummaries()});
  });

  app.post('/api/admin/accounts', requirePrimaryAdmin, (req: AuthedRequest, res) => {
    const {username, displayName, password, role, assignedSection, permissions} = req.body as {
      username?: string;
      displayName?: string;
      password?: string;
      role?: AdminRole;
      assignedSection?: AdminSectionScope;
      permissions?: AdminPermission[];
    };
    const u = (username || '').trim();
    const p = (password || '').trim();
    if (u === 'moalwbri' && req.authUser?.username !== 'moalwbri') {
      res.status(403).json({error: 'لا يمكن تعديل حساب المشرف المؤسس'});
      return;
    }
    const r: AdminRole =
      role === 'admin' ? 'admin' : role === 'supervisor' ? 'supervisor' : 'editor';
    const scope: AdminSectionScope = r === 'admin' ? 'all' : assignedSection || 'all';
    const resolvedPermissions =
      Array.isArray(permissions) && permissions.length > 0
        ? permissions.filter((perm) => ALL_ADMIN_PERMISSIONS.includes(perm))
        : getDefaultPermissionsForAccount(r, scope);
    if (!u || u.length < 3 || !p || p.length < 4) {
      res.status(400).json({error: 'اسم المستخدم (٣ أحرف فأكثر) وكلمة المرور (٤ أحرف فأكثر) مطلوبان'});
      return;
    }
    const existingIdx = store.accounts.findIndex((a) => a.username === u);
    const nextAcc: StoredAccount = {
      username: u,
      displayName: typeof displayName === 'string' && displayName.trim() ? displayName.trim().slice(0, 80) : u,
      role: u === 'moalwbri' ? 'admin' : r,
      assignedSection: u === 'moalwbri' ? 'all' : scope,
      permissions: u === 'moalwbri' ? [...ALL_ADMIN_PERMISSIONS] : resolvedPermissions,
      disabled: false,
      isFounder: u === 'moalwbri',
      passwordHash: hashPassword(p),
    };
    if (existingIdx >= 0) {
      store.accounts[existingIdx] = nextAcc;
    } else {
      store.accounts.push(nextAcc);
    }
    saveStore(store);
    res.status(201).json({accounts: mapAccountSummaries()});
  });

  app.patch('/api/admin/accounts/:username', requirePrimaryAdmin, (req, res) => {
    const target = req.params.username;
    const idx = store.accounts.findIndex((a) => a.username === target);
    if (idx === -1) {
      res.status(404).json({error: 'الحساب غير موجود'});
      return;
    }
    const current = store.accounts[idx];
    const body = req.body as {
      displayName?: string;
      role?: AdminRole;
      assignedSection?: AdminSectionScope;
      permissions?: AdminPermission[];
      disabled?: boolean;
      password?: string;
    };
    if (target === 'moalwbri') {
      if (body.disabled === true || (body.role && body.role !== 'admin')) {
        res.status(403).json({error: 'الحساب المؤسس محمي ولا يمكن تعطيله أو تقليص صلاحياته'});
        return;
      }
    }
    const nextRole: AdminRole =
      target === 'moalwbri'
        ? 'admin'
        : body.role === 'admin' || body.role === 'supervisor' || body.role === 'editor'
          ? body.role
          : current.role;
    const nextScope: AdminSectionScope =
      target === 'moalwbri' || nextRole === 'admin'
        ? 'all'
        : body.assignedSection || current.assignedSection || 'all';
    const nextPermissions =
      target === 'moalwbri'
        ? [...ALL_ADMIN_PERMISSIONS]
        : Array.isArray(body.permissions)
          ? body.permissions.filter((perm) => ALL_ADMIN_PERMISSIONS.includes(perm))
          : current.permissions || getDefaultPermissionsForAccount(nextRole, nextScope);

    store.accounts[idx] = {
      ...current,
      displayName:
        typeof body.displayName === 'string' && body.displayName.trim()
          ? body.displayName.trim().slice(0, 80)
          : current.displayName || current.username,
      role: nextRole,
      assignedSection: nextScope,
      permissions: nextPermissions,
      disabled: target === 'moalwbri' ? false : typeof body.disabled === 'boolean' ? body.disabled : Boolean(current.disabled),
      passwordHash:
        typeof body.password === 'string' && body.password.trim().length >= 4
          ? hashPassword(body.password.trim())
          : current.passwordHash,
    };
    saveStore(store);
    res.json({accounts: mapAccountSummaries()});
  });

  app.delete('/api/admin/accounts/:username', requirePrimaryAdmin, (req, res) => {
    const target = req.params.username;
    if (target === 'moalwbri') {
      res.status(400).json({error: 'لا يمكن حذف حساب المسؤول المؤسس الأساسي'});
      return;
    }
    store.accounts = store.accounts.filter((a) => a.username !== target);
    saveStore(store);
    res.json({accounts: mapAccountSummaries()});
  });

  // Deaf & Mute YouTube Videos Manager (Primary admin immediate; supervisors queue for Primary Admin approval)
  app.post('/api/admin/deaf-mute-videos', requireAuth, (req: AuthedRequest, res) => {
    if (!hasAdminPermission(req.authUser, 'manage_deaf_mute')) {
      res.status(403).json({error: 'لا تملك صلاحية إدارة قسم الصم والبكم'});
      return;
    }
    const body = req.body as Partial<DeafMuteVideoItem>;
    const title = (body.title || '').trim();
    const description = (body.description || '').trim();
    if (!title || !description) {
      res.status(400).json({error: 'عنوان الفيديو والوصف مطلوبان'});
      return;
    }
    const item: DeafMuteVideoItem = {
      id: `dm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      title: title.slice(0, 200),
      description: description.slice(0, 2500),
      benefitText: typeof body.benefitText === 'string' && body.benefitText.trim()
        ? body.benefitText.trim().slice(0, 3000)
        : undefined,
      youtubeUrl: typeof body.youtubeUrl === 'string' && body.youtubeUrl.trim()
        ? body.youtubeUrl.trim().slice(0, 400)
        : undefined,
      status: body.status === 'published' ? 'published' : 'upcoming',
      category: (body.category || 'العقيدة والتوحيد').trim().slice(0, 80),
      managerName: 'إدارة قسم الصم والبكم',
      createdAt: new Date().toISOString(),
    };
    if (!isPrimaryAdminUser(req.authUser) && req.authUser) {
      const pendingApproval = queueContentApprovalRequest({
        section: 'deaf_mute_video',
        action: 'create',
        targetId: item.id,
        title: `إضافة فيديو الصم والبكم: ${item.title}`,
        summary: item.description.slice(0, 180),
        payload: {item},
        user: req.authUser,
      });
      res.status(202).json({
        requiresApproval: true,
        pendingApproval,
        message: 'تم إرسال مادة الصم والبكم إلى المسؤول الأول للموافقة قبل نشرها.',
      });
      return;
    }
    store.deafMuteVideos = [item, ...store.deafMuteVideos];
    saveStore(store);
    res.status(201).json({created: item, items: store.deafMuteVideos});
  });

  app.put('/api/admin/deaf-mute-videos/:id', requireAuth, (req: AuthedRequest, res) => {
    if (!hasAdminPermission(req.authUser, 'manage_deaf_mute')) {
      res.status(403).json({error: 'لا تملك صلاحية تعديل قسم الصم والبكم'});
      return;
    }
    const {id} = req.params;
    const idx = store.deafMuteVideos.findIndex((v) => v.id === id);
    if (idx === -1) {
      res.status(404).json({error: 'الفيديو غير موجود'});
      return;
    }
    const body = req.body as Partial<DeafMuteVideoItem>;
    const current = store.deafMuteVideos[idx];
    const patch: Partial<DeafMuteVideoItem> = {
      title: typeof body.title === 'string' && body.title.trim() ? body.title.trim().slice(0, 200) : current.title,
      description: typeof body.description === 'string' && body.description.trim() ? body.description.trim().slice(0, 2500) : current.description,
      benefitText:
        typeof body.benefitText === 'string'
          ? body.benefitText.trim().slice(0, 3000) || undefined
          : current.benefitText,
      youtubeUrl:
        typeof body.youtubeUrl === 'string'
          ? body.youtubeUrl.trim().slice(0, 400) || undefined
          : current.youtubeUrl,
      status: body.status === 'published' || body.status === 'upcoming' ? body.status : current.status,
      category: typeof body.category === 'string' && body.category.trim() ? body.category.trim().slice(0, 80) : current.category,
    };
    if (!isPrimaryAdminUser(req.authUser) && req.authUser) {
      const pendingApproval = queueContentApprovalRequest({
        section: 'deaf_mute_video',
        action: 'update',
        targetId: id,
        title: `تعديل فيديو الصم والبكم: ${patch.title || current.title}`,
        summary: String(patch.description || current.description).slice(0, 180),
        payload: {patch},
        user: req.authUser,
      });
      res.status(202).json({
        requiresApproval: true,
        pendingApproval,
        message: 'تم إرسال التعديل إلى المسؤول الأول للموافقة قبل نشره.',
      });
      return;
    }
    const updated: DeafMuteVideoItem = {...current, ...patch};
    store.deafMuteVideos[idx] = updated;
    saveStore(store);
    res.json({updated, items: store.deafMuteVideos});
  });

  app.delete('/api/admin/deaf-mute-videos/:id', requireAuth, (req: AuthedRequest, res) => {
    if (!hasAdminPermission(req.authUser, 'manage_deaf_mute')) {
      res.status(403).json({error: 'لا تملك صلاحية حذف مواد الصم والبكم'});
      return;
    }
    const {id} = req.params;
    const existing = store.deafMuteVideos.find((v) => v.id === id);
    if (!isPrimaryAdminUser(req.authUser) && req.authUser) {
      const pendingApproval = queueContentApprovalRequest({
        section: 'deaf_mute_video',
        action: 'delete',
        targetId: id,
        title: `طلب حذف فيديو الصم والبكم: ${existing?.title || id}`,
        summary: existing?.description?.slice(0, 160) || 'طلب حذف فيديو',
        payload: {},
        user: req.authUser,
      });
      res.status(202).json({
        requiresApproval: true,
        pendingApproval,
        message: 'تم إرسال طلب الحذف إلى المسؤول الأول للموافقة.',
      });
      return;
    }
    store.deafMuteVideos = store.deafMuteVideos.filter((v) => v.id !== id);
    saveStore(store);
    res.json({items: store.deafMuteVideos});
  });

  // Custom Adhkar Manager (Primary admin immediate; supervisors queue for Primary Admin approval)
  app.post('/api/admin/adhkar', requireAuth, (req: AuthedRequest, res) => {
    if (!hasAdminPermission(req.authUser, 'manage_adhkar_books')) {
      res.status(403).json({error: 'لا تملك صلاحية إضافة الأذكار'});
      return;
    }
    const body = req.body as Partial<CustomAdhkarItem>;
    const text = (body.text || '').trim();
    if (!text) {
      res.status(400).json({error: 'نص الذكر أو الدعاء مطلوب'});
      return;
    }
    const item: CustomAdhkarItem = {
      id: `dhikr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      chapterId: (body.chapterId || 'ch1_morning_evening').trim().slice(0, 80),
      title: typeof body.title === 'string' && body.title.trim() ? body.title.trim().slice(0, 180) : undefined,
      text: text.slice(0, 5000),
      fadl: typeof body.fadl === 'string' && body.fadl.trim() ? body.fadl.trim().slice(0, 1800) : undefined,
      targetCount: typeof body.targetCount === 'number' && body.targetCount >= 1
        ? Math.min(1000, Math.round(body.targetCount))
        : 1,
      source: 'الأذكار والأدعية الجامعة',
      createdAt: new Date().toISOString(),
    };
    if (!isPrimaryAdminUser(req.authUser) && req.authUser) {
      const pendingApproval = queueContentApprovalRequest({
        section: 'adhkar',
        action: 'create',
        targetId: item.id,
        title: `إضافة ذكر: ${item.title || item.text.slice(0, 60)}`,
        summary: item.text.slice(0, 180),
        payload: {item},
        user: req.authUser,
      });
      res.status(202).json({
        requiresApproval: true,
        pendingApproval,
        message: 'تم إرسال الذكر إلى المسؤول الأول للموافقة قبل نشره.',
      });
      return;
    }
    store.customAdhkar = [item, ...store.customAdhkar];
    saveStore(store);
    res.status(201).json({created: item, items: store.customAdhkar});
  });

  app.delete('/api/admin/adhkar/:id', requireAuth, (req: AuthedRequest, res) => {
    if (!hasAdminPermission(req.authUser, 'manage_adhkar_books')) {
      res.status(403).json({error: 'لا تملك صلاحية حذف الأذكار'});
      return;
    }
    const {id} = req.params;
    const existing = store.customAdhkar.find((d) => d.id === id);
    if (!isPrimaryAdminUser(req.authUser) && req.authUser) {
      const pendingApproval = queueContentApprovalRequest({
        section: 'adhkar',
        action: 'delete',
        targetId: id,
        title: `طلب حذف ذكر: ${existing?.title || existing?.text?.slice(0, 60) || id}`,
        summary: existing?.text?.slice(0, 160) || 'طلب حذف ذكر',
        payload: {},
        user: req.authUser,
      });
      res.status(202).json({
        requiresApproval: true,
        pendingApproval,
        message: 'تم إرسال طلب الحذف إلى المسؤول الأول للموافقة.',
      });
      return;
    }
    store.customAdhkar = store.customAdhkar.filter((d) => d.id !== id);
    saveStore(store);
    res.json({items: store.customAdhkar});
  });

  // Cloud Scientific Books Manager (Primary admin immediate; supervisors queue for Primary Admin approval)
  app.post('/api/admin/books', requireAuth, (req: AuthedRequest, res) => {
    if (!hasAdminPermission(req.authUser, 'manage_adhkar_books')) {
      res.status(403).json({error: 'لا تملك صلاحية إضافة الكتب العلمية'});
      return;
    }
    const body = req.body as Partial<CustomBookItem>;
    const title = (body.title || '').trim();
    const author = (body.author || '').trim();
    if (!title || !author) {
      res.status(400).json({error: 'اسم الكتاب واسم المؤلف مطلوبان'});
      return;
    }
    const section: CustomBookItem['section'] =
      body.section === 'imams' || body.section === 'students' ? body.section : 'hajouri';
    const item: CustomBookItem = {
      id: `book_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      section,
      title: title.slice(0, 220),
      author: author.slice(0, 160),
      category: (body.category || 'كتب علمية').trim().slice(0, 80),
      summary: typeof body.summary === 'string' && body.summary.trim()
        ? body.summary.trim().slice(0, 2000)
        : undefined,
      pdfUrl: typeof body.pdfUrl === 'string' && body.pdfUrl.trim() ? body.pdfUrl.trim().slice(0, 500) : 'coming_soon',
      pages: typeof body.pages === 'number' ? Math.max(0, Math.round(body.pages)) : undefined,
      sizeLabel: typeof body.sizeLabel === 'string' ? body.sizeLabel.slice(0, 40) : undefined,
      createdAt: new Date().toISOString(),
    };
    if (!isPrimaryAdminUser(req.authUser) && req.authUser) {
      const pendingApproval = queueContentApprovalRequest({
        section: 'book',
        action: 'create',
        targetId: item.id,
        title: `إضافة كتاب: ${item.title}`,
        summary: `${item.author} — ${item.category}`,
        payload: {item},
        user: req.authUser,
      });
      res.status(202).json({
        requiresApproval: true,
        pendingApproval,
        message: 'تم إرسال الكتاب إلى المسؤول الأول للموافقة قبل نشره.',
      });
      return;
    }
    store.customBooks = [item, ...store.customBooks];
    saveStore(store);
    res.status(201).json({created: item, items: store.customBooks});
  });

  app.delete('/api/admin/books/:id', requireAuth, (req: AuthedRequest, res) => {
    if (!hasAdminPermission(req.authUser, 'manage_adhkar_books')) {
      res.status(403).json({error: 'لا تملك صلاحية حذف الكتب العلمية'});
      return;
    }
    const {id} = req.params;
    const existing = store.customBooks.find((b) => b.id === id);
    if (!isPrimaryAdminUser(req.authUser) && req.authUser) {
      const pendingApproval = queueContentApprovalRequest({
        section: 'book',
        action: 'delete',
        targetId: id,
        title: `طلب حذف كتاب: ${existing?.title || id}`,
        summary: existing?.author || 'طلب حذف كتاب',
        payload: {},
        user: req.authUser,
      });
      res.status(202).json({
        requiresApproval: true,
        pendingApproval,
        message: 'تم إرسال طلب الحذف إلى المسؤول الأول للموافقة.',
      });
      return;
    }
    store.customBooks = store.customBooks.filter((b) => b.id !== id);
    saveStore(store);
    res.json({items: store.customBooks});
  });

  // Hidden Google Meet Configuration (Deaf & Mute + Interviews + Future Subscribers Integration)
  app.get('/api/admin/meet-config', requireAuth, (_req, res) => {
    res.json({meetConfig: store.meetConfig});
  });

  app.put('/api/admin/meet-config', requireAuth, (req, res) => {
    const body = req.body as Partial<AdminMeetConfig>;
    const visibility =
      body.visibility === 'deaf_mute_invited' || body.visibility === 'all_subscribers'
        ? body.visibility
        : 'hidden_admin_only';
    const rawUrl = typeof body.activeRoomUrl === 'string' ? body.activeRoomUrl.trim().slice(0, 400) : store.meetConfig.activeRoomUrl;
    if (rawUrl && !/^https:\/\/(meet\.google\.com|[\w.-]+)/i.test(rawUrl)) {
      res.status(400).json({error: 'يرجى إدخال رابط يبدأ بـ https://'});
      return;
    }
    store.meetConfig = {
      visibility,
      activeRoomUrl: rawUrl,
      updatedAt: new Date().toISOString(),
    };
    saveStore(store);
    res.json({meetConfig: store.meetConfig});
  });

  // Live Support Sessions Inbox for Admins
  app.get('/api/admin/live-support', requireAuth, (_req, res) => {
    res.json({sessions: store.liveSupportSessions});
  });

  // Deaf & Mute Community Live Room Controls (Supervisor / Admin Only)
  app.get('/api/admin/deaf-mute-room', requireAuth, (req: AuthedRequest, res) => {
    if (!canModerateDeafMute(req.authUser)) {
      res.status(403).json({error: 'هذه الصلاحية مخصصة لمسؤول قسم الصم والبكم أو المدير الرئيسي'});
      return;
    }
    res.json({room: buildDeafMuteRoomSnapshotForAdmin()});
  });

  app.post('/api/admin/deaf-mute-room/link', requireAuth, (req: AuthedRequest, res) => {
    if (!canModerateDeafMute(req.authUser)) {
      res.status(403).json({error: 'هذه الصلاحية مخصصة لمسؤول قسم الصم والبكم أو المدير الرئيسي'});
      return;
    }
    const {linkUrl, linkTitle} = req.body as {linkUrl?: string; linkTitle?: string};
    const cleanUrl = (linkUrl || '').trim().slice(0, 400);
    if (cleanUrl && !/^https:\/\//i.test(cleanUrl)) {
      res.status(400).json({error: 'يرجى إدخال رابط يبدأ بـ https://'});
      return;
    }
    store.deafMuteRoom.publishedLinkUrl = cleanUrl;
    if (typeof linkTitle === 'string' && linkTitle.trim()) {
      store.deafMuteRoom.linkTitle = linkTitle.trim().slice(0, 120);
    }
    store.deafMuteRoom.updatedAt = new Date().toISOString();
    saveStore(store);
    broadcastDeafMuteRoom();
    res.json({room: buildDeafMuteRoomSnapshotForAdmin()});
  });

  app.post('/api/admin/deaf-mute-room/approve', requireAuth, (req: AuthedRequest, res) => {
    if (!canModerateDeafMute(req.authUser)) {
      res.status(403).json({error: 'هذه الصلاحية مخصصة لمسؤول قسم الصم والبكم أو المدير الرئيسي'});
      return;
    }
    const {peerId, decision} = req.body as {
      peerId?: string;
      decision?: 'approved_participant' | 'approved_viewer' | 'rejected';
    };
    const target = store.deafMuteRoom.requests.find((r) => r.id === peerId);
    if (!target) {
      res.status(404).json({error: 'الطلب غير موجود'});
      return;
    }
    const nextStatus =
      decision === 'approved_viewer' || decision === 'rejected'
        ? decision
        : 'approved_participant';
    const nowIso = new Date().toISOString();
    target.status = nextStatus;
    target.updatedAt = nowIso;
    if (nextStatus === 'approved_participant' || nextStatus === 'approved_viewer') {
      const noteText =
        nextStatus === 'approved_participant'
          ? `انضم «${target.name}» إلى المحادثة المباشرة بعد موافقة مسؤول القسم`
          : `انضم «${target.name}» بصفة مشاهد بعد موافقة مسؤول القسم`;
      store.deafMuteRoom.messages = [
        ...store.deafMuteRoom.messages.slice(-100),
        {
          id: `dm_sys_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
          senderId: 'system',
          senderName: 'إدارة قسم الصم والبكم',
          senderRole: 'supervisor',
          text: noteText,
          createdAt: nowIso,
        },
      ];
    }
    store.deafMuteRoom.updatedAt = nowIso;
    saveStore(store);
    broadcastDeafMuteRoom();
    res.json({room: buildDeafMuteRoomSnapshotForAdmin()});
  });

  app.post('/api/admin/deaf-mute-room/clear', requireAuth, (req: AuthedRequest, res) => {
    if (!canModerateDeafMute(req.authUser)) {
      res.status(403).json({error: 'هذه الصلاحية مخصصة لمسؤول قسم الصم والبكم أو المدير الرئيسي'});
      return;
    }
    const {clearMessages, clearRequests} = req.body as {
      clearMessages?: boolean;
      clearRequests?: boolean;
    };
    if (clearMessages) store.deafMuteRoom.messages = [];
    if (clearRequests) store.deafMuteRoom.requests = [];
    store.deafMuteRoom.updatedAt = new Date().toISOString();
    saveStore(store);
    broadcastDeafMuteRoom();
    res.json({room: buildDeafMuteRoomSnapshotForAdmin()});
  });

  // Online Applicant Interview Acceptance & Scoped Credential Issuance
  app.post('/api/admin/interviews/accept-issue', requirePrimaryAdmin, (req, res) => {
    const {volunteerId, username, password, role, assignedSection, meetUrl} = req.body as {
      volunteerId?: string;
      username?: string;
      password?: string;
      role?: AdminRole;
      assignedSection?: AdminSectionScope;
      meetUrl?: string;
    };
    const u = (username || '').trim();
    if (!u || u.length < 3) {
      res.status(400).json({error: 'اسم المستخدم للمتقدم مطلوب (٣ أحرف فأكثر)'});
      return;
    }
    const volunteer = store.volunteers.find((v) => v.id === volunteerId);
    if (!volunteer) {
      res.status(404).json({error: 'طلب المتقدم غير موجود'});
      return;
    }
    const tempPassword =
      typeof password === 'string' && password.trim().length >= 4
        ? password.trim()
        : `Mawaedh@${crypto.randomBytes(3).toString('hex')}`;
    const issuedRole: AdminRole =
      role === 'admin' ? 'admin' : role === 'supervisor' ? 'supervisor' : 'editor';
    const scope: AdminSectionScope = issuedRole === 'admin' ? 'all' : assignedSection || 'all';

    const existingIdx = store.accounts.findIndex((a) => a.username === u);
    const nextAcc: StoredAccount = {
      username: u,
      role: issuedRole,
      assignedSection: scope,
      passwordHash: hashPassword(tempPassword),
    };
    if (existingIdx >= 0) store.accounts[existingIdx] = nextAcc;
    else store.accounts.push(nextAcc);

    const nowIso = new Date().toISOString();
    const roleLabel =
      issuedRole === 'admin' ? 'مدير كامل' : issuedRole === 'supervisor' ? 'مشرف قسم' : 'محرر محتوى';
    const noteText = `تم القبول بعد المقابلة وإصدار حساب ${roleLabel} (القسم: ${scope}) · اسم المستخدم: ${u}${meetUrl?.trim() ? ` · غرفة المقابلة: ${meetUrl.trim()}` : ''}`;
    store.volunteers = store.volunteers.map((v) =>
      v.id === volunteer.id
        ? {...v, status: 'resolved', adminNote: noteText, updatedAt: nowIso}
        : v,
    );
    saveStore(store);
    res.status(201).json({
      credentials: {
        username: u,
        tempPassword,
        role: issuedRole,
        assignedSection: scope,
      },
      suggestions: store.suggestions,
      volunteers: store.volunteers,
    });
  });

  // Primary Admin ONLY: Registered visitors contact directory (names, emails & mobile numbers)
  app.get('/api/admin/visitors', requirePrimaryAdmin, (_req, res) => {
    const visitors = Object.values(store.visitorAccounts || {})
      .map((v) => ({
        id: v.id,
        name: v.name,
        email: v.email || '',
        whatsapp: v.whatsapp || '',
        provider: v.provider,
        createdAt: v.createdAt,
        lastLoginAt: v.lastLoginAt || v.createdAt,
      }))
      .sort((a, b) => (b.lastLoginAt || b.createdAt).localeCompare(a.lastLoginAt || a.createdAt));
    res.json({visitors});
  });

  // Primary Admin ONLY: Monthly engagement analytics for Sermons, Adhkar, Visitors & Clicks
  app.get('/api/admin/analytics', requirePrimaryAdmin, (req, res) => {
    const rawDays = Number(req.query.days);
    const days = Number.isFinite(rawDays) && rawDays >= 7 && rawDays <= 60 ? Math.round(rawDays) : 30;
    const today = new Date();
    const dailySeries: MonthlyAnalyticsPoint[] = [];

    const totals = {
      visitorsCount: Math.max(MIN_CUMULATIVE_VISITORS, store.visitorsCount),
      onlineVisitorsCount: updateAndCountOnline(),
      clicksCount: store.clicksCount,
      periodVisitors: 0,
      periodClicks: 0,
      sermonsEngagement: 0,
      adhkarEngagement: 0,
      sermonReads: 0,
      sermonLikes: 0,
      sermonComments: 0,
      sermonShares: 0,
      adhkarTaps: 0,
      adhkarCompletions: 0,
      motherAmens: 0,
    };

    const labelFormatter = new Intl.DateTimeFormat('ar-EG', {day: 'numeric', month: 'short'});

    for (let offset = days - 1; offset >= 0; offset -= 1) {
      const d = new Date(today);
      d.setDate(today.getDate() - offset);
      const dateKey = getDateKey(d);
      const bucket = store.dailyStats[dateKey]
        ? {...createEmptyDailyBucket(dateKey), ...store.dailyStats[dateKey]}
        : createEmptyDailyBucket(dateKey);

      const sermonsTotal =
        bucket.sermonReads + bucket.sermonLikes + bucket.sermonComments + bucket.sermonShares;
      const adhkarTotal = bucket.adhkarTaps + bucket.adhkarCompletions;

      totals.periodVisitors += bucket.visitors;
      totals.periodClicks += bucket.clicks;
      totals.sermonReads += bucket.sermonReads;
      totals.sermonLikes += bucket.sermonLikes;
      totals.sermonComments += bucket.sermonComments;
      totals.sermonShares += bucket.sermonShares;
      totals.adhkarTaps += bucket.adhkarTaps;
      totals.adhkarCompletions += bucket.adhkarCompletions;
      totals.motherAmens += bucket.motherAmens;
      totals.sermonsEngagement += sermonsTotal;
      totals.adhkarEngagement += adhkarTotal;

      dailySeries.push({
        date: dateKey,
        label: labelFormatter.format(d),
        visitors: bucket.visitors,
        clicks: bucket.clicks,
        sermonsTotal,
        adhkarTotal,
        sermonReads: bucket.sermonReads,
        sermonLikes: bucket.sermonLikes,
        sermonComments: bucket.sermonComments,
        sermonShares: bucket.sermonShares,
        adhkarTaps: bucket.adhkarTaps,
        adhkarCompletions: bucket.adhkarCompletions,
        motherAmens: bucket.motherAmens,
      });
    }

    // Reconcile category engagement from real post metrics
    const categoryMap = new Map<string, {category: string; count: number; engagement: number}>();
    for (const p of store.posts) {
      const trendSum = Array.isArray(p.listeningTrend)
        ? p.listeningTrend.reduce((acc, item) => acc + (item.listens || 0), 0)
        : 0;
      const postEng = (p.likes || 0) + (p.commentsCount || 0) + trendSum;
      const prev = categoryMap.get(p.category) || {category: p.category, count: 0, engagement: 0};
      prev.count += 1;
      prev.engagement += postEng;
      categoryMap.set(p.category, prev);
    }
    const sermonCategories = [...categoryMap.values()].sort(
      (a, b) => b.engagement - a.engagement || b.count - a.count,
    );

    const adhkarCategories = [
      ...ADHKAR_CATEGORIES.map((cat) => ({
        id: cat.id,
        label: cat.label,
        taps: store.adhkarCategoryStats[cat.id] || 0,
      })),
      {
        id: 'tasbeeh',
        label: 'المسبحة الإلكترونية الحرة',
        taps: store.adhkarCategoryStats.tasbeeh || 0,
      },
    ];

    const topPosts = [...store.posts]
      .map((p) => {
        const reads = Array.isArray(p.listeningTrend)
          ? p.listeningTrend.reduce((acc, item) => acc + (item.listens || 0), 0)
          : 0;
        return {
          id: p.id,
          title: p.title,
          category: p.category,
          reads,
          likes: p.likes || 0,
          commentsCount: p.commentsCount || 0,
        };
      })
      .sort((a, b) => b.reads + b.likes + b.commentsCount - (a.reads + a.likes + a.commentsCount))
      .slice(0, 5);

    const SECTION_LABELS: Array<[string, string]> = [
      ['home', 'الصفحة الرئيسية'],
      ['quran', 'المصحف الشريف'],
      ['adhkar', 'الأذكار والأدعية'],
      ['fatawa', 'الفتاوى'],
      ['library', 'المكتبة العلمية'],
      ['cards', 'البطاقات الدعوية'],
      ['quiz', 'الاختبار الدعوي'],
      ['wird', 'الورد اليومي'],
      ['mother-oasis', 'واحة وقصص الوالدة'],
      ['poetry', 'الشعر والطرائف'],
      ['archive', 'الأرشيف الشامل'],
      ['videos', 'المقاطع المرئية'],
      ['deaf-mute', 'قسم الصم والبكم'],
      ['reviews', 'آراء وتقييمات الزوار'],
      ['channels', 'منصات البث'],
      ['bookmarks', 'المحفوظات'],
      ['about-support', 'عن الموقع والدعم'],
    ];

    const sectionAnalytics = SECTION_LABELS.map(([id, label]) => {
      const entry = (store.sectionStats && store.sectionStats[id]) || {visits: 0, interactions: 0, shares: 0};
      return {
        id,
        label,
        visits: entry.visits || 0,
        interactions: entry.interactions || 0,
        shares: entry.shares || 0,
      };
    }).sort((a, b) => b.visits + b.interactions - (a.visits + a.interactions));

    const payload: AdminMonthlyAnalytics = {
      days,
      generatedAt: new Date().toISOString(),
      totals,
      dailySeries,
      sermonCategories,
      adhkarCategories,
      topPosts,
      sectionAnalytics,
    };

    res.json(payload);
  });

  // Primary Admin ONLY: Reset engagement counters while preserving cumulative ascending floors (4580 visitors / 8540 clicks)
  app.post('/api/admin/reset-counters', requirePrimaryAdmin, (_req, res) => {
    store.motherPrayersCount = 0;
    store.visitorsCount = Math.max(MIN_CUMULATIVE_VISITORS, store.visitorsCount);
    store.clicksCount = Math.max(MIN_CUMULATIVE_CLICKS, store.clicksCount);
    store.dailyStats = {};
    store.adhkarCategoryStats = {};
    store.cardEngagement = {};
    store.posts = store.posts.map((p) => ({
      ...p,
      likes: 0,
      commentsCount: 0,
      comments: [],
      isTrending: false,
      listeningTrend: createDefaultTrend(0),
    }));
    saveStore(store);
    res.json({
      posts: store.posts,
      motherPrayersCount: store.motherPrayersCount,
      visitorsCount: store.visitorsCount,
      clicksCount: store.clicksCount,
      registeredMembersCount: store.registeredMembersCount,
    });
  });

  // Primary Admin ONLY: Export & Import full site state JSON for cross-account portability
  app.get('/api/admin/export', requirePrimaryAdmin, (_req, res) => {
    res.json({
      posts: store.posts,
      fatawa: store.fatawa,
      poetryItems: store.poetryItems,
      permanentArchive: store.permanentArchive,
      motherOasisItems: store.motherOasisItems,
      deafMuteVideos: store.deafMuteVideos,
      customAdhkar: store.customAdhkar,
      customBooks: store.customBooks,
      sadaMaterials: store.sadaMaterials,
      aiDawahCards: store.aiDawahCards,
      dawahCardsMeta: buildDawahCardsMeta(),
      pendingApprovals: store.pendingApprovals,
      cardEngagement: store.cardEngagement,
      visitorReviews: store.visitorReviews,
      socialLinks: store.socialLinks,
      appIcons: store.appIcons,
      siteConfig: store.siteConfig,
      siteAppearance: store.siteAppearance,
      automationSettings: store.automationSettings,
      meetConfig: store.meetConfig,
      brandHandle: store.brandHandle,
      motherPrayersCount: store.motherPrayersCount,
      visitorsCount: store.visitorsCount,
      clicksCount: store.clicksCount,
      registeredMembersCount: store.registeredMembersCount,
      dailyStats: store.dailyStats,
      adhkarCategoryStats: store.adhkarCategoryStats,
    });
  });

  app.post('/api/admin/import', requirePrimaryAdmin, (req, res) => {
    const data = req.body as Partial<StoreState>;
    if (Array.isArray(data.posts)) store.posts = appendOnlyMergeById(data.posts, store.posts);
    if (Array.isArray(data.fatawa)) store.fatawa = appendOnlyMergeById(data.fatawa, store.fatawa);
    if (Array.isArray(data.poetryItems)) {
      store.poetryItems = appendOnlyMergeById(data.poetryItems, store.poetryItems);
    }
    if (Array.isArray(data.permanentArchive)) {
      store.permanentArchive = appendOnlyMergeById(data.permanentArchive, store.permanentArchive);
    }
    if (Array.isArray(data.motherOasisItems)) {
      store.motherOasisItems = appendOnlyMergeById(data.motherOasisItems, store.motherOasisItems);
    }
    if (Array.isArray(data.deafMuteVideos)) {
      store.deafMuteVideos = appendOnlyMergeById(data.deafMuteVideos, store.deafMuteVideos);
    }
    if (Array.isArray(data.customAdhkar)) {
      store.customAdhkar = appendOnlyMergeById(data.customAdhkar, store.customAdhkar);
    }
    if (Array.isArray(data.customBooks)) {
      store.customBooks = appendOnlyMergeById(data.customBooks, store.customBooks);
    }
    if (Array.isArray(data.sadaMaterials)) {
      store.sadaMaterials = appendOnlyMergeById(data.sadaMaterials, store.sadaMaterials);
    }
    if (Array.isArray(data.aiDawahCards)) {
      const conciseImported = data.aiDawahCards.filter(
        (c) => isConciseClassicCard(c) && (!c.createdAt || c.createdAt >= DAWAH_CARDS_RESET_EPOCH),
      );
      store.aiDawahCards = appendOnlyMergeById(conciseImported, getConciseAiDawahCards());
    }
    if (data.cardEngagement && typeof data.cardEngagement === 'object') {
      store.cardEngagement = {...store.cardEngagement, ...data.cardEngagement};
    }
    if (Array.isArray(data.visitorReviews)) {
      store.visitorReviews = appendOnlyMergeById(data.visitorReviews, store.visitorReviews);
    }
    if (Array.isArray(data.socialLinks)) store.socialLinks = data.socialLinks;
    if (data.appIcons) store.appIcons = {...DEFAULT_APP_ICONS, ...data.appIcons};
    if (data.siteConfig) store.siteConfig = {...DEFAULT_SITE_CONFIG, ...data.siteConfig};
    if (data.siteAppearance) store.siteAppearance = {...DEFAULT_SITE_APPEARANCE, ...data.siteAppearance};
    if (data.automationSettings) {
      store.automationSettings = {...DEFAULT_AUTOMATION_SETTINGS, ...data.automationSettings};
    }
    if (data.meetConfig) store.meetConfig = {...DEFAULT_MEET_CONFIG, ...data.meetConfig};
    if (typeof data.brandHandle === 'string' && data.brandHandle.trim()) {
      store.brandHandle = data.brandHandle.trim();
    }
    if (typeof data.visitorsCount === 'number') {
      store.visitorsCount = Math.max(MIN_CUMULATIVE_VISITORS, store.visitorsCount, data.visitorsCount);
    }
    if (typeof data.clicksCount === 'number') {
      store.clicksCount = Math.max(MIN_CUMULATIVE_CLICKS, store.clicksCount, data.clicksCount);
    }
    if (typeof data.registeredMembersCount === 'number') {
      store.registeredMembersCount = Math.max(
        store.registeredMembersCount,
        data.registeredMembersCount,
        Object.keys(store.visitorAccounts).length,
      );
    }
    if (data.dailyStats && typeof data.dailyStats === 'object') {
      store.dailyStats = data.dailyStats;
    }
    if (data.adhkarCategoryStats && typeof data.adhkarCategoryStats === 'object') {
      store.adhkarCategoryStats = data.adhkarCategoryStats;
    }
    saveStore(store);
    res.json({
      posts: store.posts,
      fatawa: store.fatawa,
      poetryItems: store.poetryItems,
      permanentArchive: store.permanentArchive,
      deafMuteVideos: store.deafMuteVideos,
      customAdhkar: store.customAdhkar,
      customBooks: store.customBooks,
      sadaMaterials: store.sadaMaterials,
      aiDawahCards: store.aiDawahCards,
      dawahCardsMeta: buildDawahCardsMeta(),
      cardEngagement: store.cardEngagement,
      socialLinks: store.socialLinks,
      appIcons: store.appIcons,
      siteConfig: store.siteConfig,
      siteAppearance: store.siteAppearance,
      brandHandle: store.brandHandle,
      visitorsCount: store.visitorsCount,
      clicksCount: store.clicksCount,
      registeredMembersCount: store.registeredMembersCount,
    });
  });

  const isProd = process.env.NODE_ENV === 'production';
  const httpServer = http.createServer(app);

  // Real-time WebSocket Live Support & Private Meet Invites (/ws/live-support)
  const wss = new WebSocketServer({noServer: true});
  const wsSessionRooms = new Map<string, Set<WebSocket>>();

  const broadcastSessionUpdate = (session: LiveSupportSession) => {
    const payload = JSON.stringify({type: 'session_update', session});
    const room = wsSessionRooms.get(session.id);
    if (room) {
      for (const client of room) {
        if (client.readyState === WebSocket.OPEN) client.send(payload);
      }
    }
    for (const adminSock of activeAdminSockets) {
      if (adminSock.readyState === WebSocket.OPEN) adminSock.send(payload);
    }
  };

  const upsertLiveSession = (opts: {
    sessionId: string;
    visitorName?: string;
    topic?: LiveSupportSession['topic'];
  }): LiveSupportSession => {
    const cleanId = opts.sessionId.replace(/[^\w-]/g, '').slice(0, 64) || `sess_${Date.now().toString(36)}`;
    const existing = store.liveSupportSessions.find((s) => s.id === cleanId);
    if (existing) return existing;
    const nowIso = new Date().toISOString();
    const created: LiveSupportSession = {
      id: cleanId,
      visitorName: (opts.visitorName || 'زائر كريم').trim().slice(0, 60),
      topic: opts.topic === 'deaf_mute' || opts.topic === 'interview' || opts.topic === 'ai_escalation' ? opts.topic : 'general',
      status: 'open',
      messages: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    store.liveSupportSessions = [created, ...store.liveSupportSessions].slice(0, 80);
    saveStore(store);
    return created;
  };

  wss.on('connection', (ws) => {
    let attachedRole: 'visitor' | 'admin' = 'visitor';
    let attachedSessionId = '';

    ws.on('message', (rawData) => {
      try {
        const pkt = JSON.parse(String(rawData)) as {
          type?: string;
          role?: string;
          token?: string;
          sessionId?: string;
          peerId?: string;
          requestedMode?: 'watch' | 'participate';
          action?: string;
          linkUrl?: string;
          linkTitle?: string;
          visitorName?: string;
          topic?: LiveSupportSession['topic'];
          senderRole?: 'visitor' | 'admin';
          senderName?: string;
          text?: string;
          meetUrl?: string;
        };

        if (pkt.type === 'join') {
          if (pkt.role === 'admin' && pkt.token) {
            const verified = verifyToken(pkt.token);
            if (verified) {
              attachedRole = 'admin';
              activeAdminSockets.add(ws);
              ws.send(JSON.stringify({type: 'sessions', sessions: store.liveSupportSessions}));
              ws.send(JSON.stringify({type: 'dm_room_state', room: buildDeafMuteRoomSnapshotForAdmin()}));
              return;
            }
          }
          if (pkt.sessionId) {
            const session = upsertLiveSession({
              sessionId: pkt.sessionId,
              visitorName: pkt.visitorName,
              topic: pkt.topic,
            });
            attachedSessionId = session.id;
            let room = wsSessionRooms.get(session.id);
            if (!room) {
              room = new Set();
              wsSessionRooms.set(session.id, room);
            }
            room.add(ws);
            ws.send(JSON.stringify({type: 'session_update', session}));
          }
          return;
        }

        if (pkt.type === 'dm_room_subscribe') {
          const cleanPeerId =
            (pkt.peerId || `dm_peer_${Date.now().toString(36)}`).replace(/[^\w-]/g, '').slice(0, 64);
          deafMuteRoomClients.set(ws, {peerId: cleanPeerId});
          broadcastDeafMuteRoom();
          return;
        }

        if (pkt.type === 'dm_room_request') {
          const cleanPeerId = (pkt.peerId || deafMuteRoomClients.get(ws)?.peerId || '')
            .replace(/[^\w-]/g, '')
            .slice(0, 64);
          if (!cleanPeerId) return;
          deafMuteRoomClients.set(ws, {peerId: cleanPeerId});
          const mode: 'watch' | 'participate' = pkt.requestedMode === 'watch' ? 'watch' : 'participate';
          const name = (pkt.visitorName || 'زائر كريم').trim().slice(0, 60) || 'زائر كريم';
          const nowIso = new Date().toISOString();
          const existing = store.deafMuteRoom.requests.find((r) => r.id === cleanPeerId);
          if (existing) {
            existing.name = name;
            existing.requestedMode = mode;
            if (existing.status === 'rejected' || existing.status === 'approved_viewer' || mode === 'participate') {
              existing.status = 'pending';
            }
            existing.updatedAt = nowIso;
          } else {
            const newReq: DeafMuteJoinRequest = {
              id: cleanPeerId,
              name,
              requestedMode: mode,
              status: 'pending',
              createdAt: nowIso,
              updatedAt: nowIso,
            };
            store.deafMuteRoom.requests = [newReq, ...store.deafMuteRoom.requests].slice(0, 120);
          }
          store.deafMuteRoom.updatedAt = nowIso;
          saveStore(store);
          broadcastDeafMuteRoom();
          void dispatchAdminTicketAlert(
            `طلب ${mode === 'watch' ? 'مشاهدة' : 'انضمام لمحادثة'} الصم والبكم من ${name}`,
            {kind: 'deaf_mute_room_request', peerId: cleanPeerId, mode},
          );
          return;
        }

        if (pkt.type === 'dm_room_message' && typeof pkt.text === 'string' && pkt.text.trim()) {
          const cleanPeerId = (pkt.peerId || deafMuteRoomClients.get(ws)?.peerId || '')
            .replace(/[^\w-]/g, '')
            .slice(0, 64);
          const isAdminSender = attachedRole === 'admin';
          const reqEntry = store.deafMuteRoom.requests.find((r) => r.id === cleanPeerId);
          if (!isAdminSender && (!reqEntry || reqEntry.status !== 'approved_participant')) {
            return;
          }
          const nowIso = new Date().toISOString();
          const msg: DeafMuteCommunityMessage = {
            id: `dm_msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
            senderId: isAdminSender ? 'supervisor' : cleanPeerId,
            senderName: isAdminSender
              ? (pkt.senderName && !/يونس|عبد\s*الكريم/.test(pkt.senderName)
                  ? pkt.senderName
                  : 'مسؤول قسم الصم والبكم'
                )
                  .trim()
                  .slice(0, 60)
              : reqEntry?.name || 'مشارك',
            senderRole: isAdminSender ? 'supervisor' : 'participant',
            text: pkt.text.trim().slice(0, 1500),
            createdAt: nowIso,
          };
          store.deafMuteRoom.messages = [...store.deafMuteRoom.messages.slice(-110), msg];
          store.deafMuteRoom.updatedAt = nowIso;
          saveStore(store);
          broadcastDeafMuteRoom();
          return;
        }

        if (pkt.type === 'dm_room_moderate' && attachedRole === 'admin') {
          const nowIso = new Date().toISOString();
          if (pkt.action === 'set_link' && typeof pkt.linkUrl === 'string') {
            const cleanUrl = pkt.linkUrl.trim().slice(0, 400);
            if (cleanUrl && !/^https:\/\//i.test(cleanUrl)) return;
            store.deafMuteRoom.publishedLinkUrl = cleanUrl;
            if (typeof pkt.linkTitle === 'string' && pkt.linkTitle.trim()) {
              store.deafMuteRoom.linkTitle = pkt.linkTitle.trim().slice(0, 120);
            }
          } else if (pkt.action === 'clear_link') {
            store.deafMuteRoom.publishedLinkUrl = '';
          } else if (pkt.action === 'clear_messages') {
            store.deafMuteRoom.messages = [];
          } else if (
            pkt.peerId &&
            (pkt.action === 'approve_participant' || pkt.action === 'approve_viewer' || pkt.action === 'reject')
          ) {
            const target = store.deafMuteRoom.requests.find((r) => r.id === pkt.peerId);
            if (target) {
              target.status =
                pkt.action === 'approve_participant'
                  ? 'approved_participant'
                  : pkt.action === 'approve_viewer'
                    ? 'approved_viewer'
                    : 'rejected';
              target.updatedAt = nowIso;
            }
          }
          store.deafMuteRoom.updatedAt = nowIso;
          saveStore(store);
          broadcastDeafMuteRoom();
          return;
        }

        if (pkt.type === 'message' && typeof pkt.text === 'string' && pkt.text.trim()) {
          const targetId = pkt.sessionId || attachedSessionId;
          if (!targetId) return;
          const isAdminSender = attachedRole === 'admin' && pkt.senderRole === 'admin';
          const session = upsertLiveSession({
            sessionId: targetId,
            visitorName: pkt.visitorName,
            topic: pkt.topic,
          });
          const msg: LiveSupportMessage = {
            id: `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
            senderRole: isAdminSender ? 'admin' : 'visitor',
            senderName: (pkt.senderName || (isAdminSender ? 'فريق الإشراف' : session.visitorName))
              .trim()
              .slice(0, 60),
            text: pkt.text.trim().slice(0, 2000),
            createdAt: new Date().toISOString(),
          };
          const updated: LiveSupportSession = {
            ...session,
            messages: [...session.messages.slice(-90), msg],
            updatedAt: msg.createdAt,
          };
          store.liveSupportSessions = [
            updated,
            ...store.liveSupportSessions.filter((s) => s.id !== updated.id),
          ].slice(0, 80);
          saveStore(store);
          broadcastSessionUpdate(updated);
          if (!isAdminSender) {
            void dispatchAdminTicketAlert(
              `رسالة دردشة حية من ${updated.visitorName}: ${msg.text.slice(0, 120)}`,
              {kind: 'live_chat', sessionId: updated.id, topic: updated.topic},
            );
          }
          return;
        }

        if (pkt.type === 'meet_invite' && attachedRole === 'admin' && pkt.sessionId && pkt.meetUrl) {
          const cleanUrl = pkt.meetUrl.trim();
          if (!cleanUrl.startsWith('https://')) return;
          const target = store.liveSupportSessions.find((s) => s.id === pkt.sessionId);
          if (!target) return;
          const updated: LiveSupportSession = {
            ...target,
            meetInviteUrl: cleanUrl.slice(0, 400),
            updatedAt: new Date().toISOString(),
          };
          store.liveSupportSessions = [
            updated,
            ...store.liveSupportSessions.filter((s) => s.id !== updated.id),
          ].slice(0, 80);
          saveStore(store);
          broadcastSessionUpdate(updated);
        }
      } catch {
        // Ignore malformed socket frames
      }
    });

    ws.on('close', () => {
      activeAdminSockets.delete(ws);
      if (attachedSessionId) {
        wsSessionRooms.get(attachedSessionId)?.delete(ws);
      }
      if (deafMuteRoomClients.has(ws)) {
        deafMuteRoomClients.delete(ws);
        broadcastDeafMuteRoom();
      }
    });
  });

  httpServer.on('upgrade', (req, socket, head) => {
    try {
      const url = new URL(req.url || '/', 'http://localhost');
      if (url.pathname !== '/ws/live-support') return;
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    } catch {
      socket.destroy();
    }
  });

  if (!isProd) {
    const {createServer: createViteServer} = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: {server: httpServer},
        ws: {server: httpServer},
        hmr: process.env.DISABLE_HMR === 'true' ? false : {server: httpServer},
        allowedHosts: true,
        watch: process.env.DISABLE_HMR === 'true' ? null : undefined,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(
      express.static(distDir, {
        setHeaders: (res, filePath) => {
          if (
            filePath.endsWith('index.html') ||
            filePath.endsWith('sw.js') ||
            filePath.endsWith('registerSW.js')
          ) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          }
        },
      }),
    );
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`Mawaedh & Ibar server listening on http://0.0.0.0:${port}`);
    const runDailyBackgroundCheck = () => {
      const todayKey = getDateKey();
      if (store.lastNafahatDate !== todayKey && process.env.GEMINI_API_KEY?.trim()) {
        void generateDailyNafahatWithAI({force: false}).catch(() => undefined);
      }
      if (store.lastDawahCardsAiDate !== todayKey && process.env.GEMINI_API_KEY?.trim()) {
        void generateDailyDawahCardsBatchWithAI({force: false, count: 5}).catch(() => undefined);
      }
      if (store.lastPoetryAiDate !== todayKey && process.env.GEMINI_API_KEY?.trim()) {
        void generatePoetryWithAI({force: false}).catch(() => undefined);
      }
      if (mediaFeedCache.cacheDate && mediaFeedCache.cacheDate !== todayKey) {
        mediaFeedCache.fetchedAt = 0;
        mediaFeedCache.cacheDate = '';
      }
      if (scholarlyCache.cacheDate && scholarlyCache.cacheDate !== todayKey) {
        scholarlyCache.fetchedAt = 0;
        scholarlyCache.cacheDate = '';
      }
      if (liveFatwaArchiveCache.cacheDate && liveFatwaArchiveCache.cacheDate !== todayKey) {
        liveFatwaArchiveCache.fetchedAt = 0;
        liveFatwaArchiveCache.cacheDate = '';
      }
    };
    runDailyBackgroundCheck();
    setInterval(runDailyBackgroundCheck, 30 * 60 * 1000);
  });
}

startServer().catch((err) => {
  console.error('Server failed to start:', err);
  process.exit(1);
});
