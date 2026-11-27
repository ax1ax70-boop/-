import {
  Archive,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Compass,
  ExternalLink,
  Eye,
  Feather,
  Flower2,
  Globe,
  GraduationCap,
  HandHeart,
  Home as HomeIcon,
  Image as ImageIcon,
  LifeBuoy,
  Lock,
  LogOut,
  Megaphone,
  Menu,
  Monitor,
  Moon,
  RefreshCw,
  Search,
  Settings,
  Shield,
  Sparkles,
  Star,
  Sun,
  Sunrise,
  UserCheck,
  Users,
  Video,
  WifiOff,
  Wrench,
  X,
} from 'lucide-react';
import {lazy, Suspense, useCallback, useEffect, useRef, useState, type FormEvent} from 'react';
import type {AdminStudioTab} from './components/AdminStudioView';
import {AIChatWidget} from './components/AIChatWidget';
import {AppSettingsModal, type AppSettingsSection} from './components/AppSettingsModal';
import {BrandEmblem, resolveIcon} from './components/BrandEmblem';
import {CardShareModal} from './components/CardShareModal';
import {HomeView} from './components/HomeView';
import {LanguagePickerModal} from './components/LanguagePickerModal';
import {useOnlineStatus} from './components/PWAInstallButton';
import {SiteFooter} from './components/SiteFooter';
import {SplashScreen} from './components/SplashScreen';
import {VISITOR_SESSION_TOKEN_KEY, VisitorAuthModal} from './components/VisitorAuthModal';
import {
  INITIAL_DEAF_MUTE_VIDEOS,
  appendOnlyMergeById,
  mergeCloudAndLocalById,
} from './data/contentRepository';
import {DAWAH_CARDS_RESET_EPOCH, isConciseClassicCard} from './data/dawahCards';
import {exportAdhkarLifetimePayload} from './utils/adhkarStats';
import {
  cloudFetchVisitorProfile,
  cloudUpsertVisitorProfile,
  fetchAllCloudCollections,
  isTrustedAdminUser,
  observeFirebaseAdminAuth,
  subscribeCloudCollections,
} from './utils/cloudSync';
import {EXTERNAL_PORTAL_OPEN_EVENT, type ExternalPortalPayload} from './utils/externalPortal';
import {getLanguageMeta} from './data/uiTranslations';
import {useI18n} from './utils/i18n';
import {useLiveStats} from './utils/liveStats';
import {
  type AdhkarReminderSettings,
  checkAndTriggerScheduledReminders,
  computeNextScheduledDelayMs,
  loadReminderSettings,
  saveReminderSettings,
} from './utils/notifications';
import {
  DEFAULT_FONT_SIZE_PX,
  MAX_FONT_SIZE_PX,
  MIN_FONT_SIZE_PX,
  usePageColor,
  useReadingPrefs,
} from './utils/readingPrefs';
import {
  TELEMETRY_UPDATED_EVENT,
  mergeSectionStatsMonotonic,
  readLocalTelemetryFloors,
  saveLocalTelemetryFloors,
  sendPresenceHeartbeat,
  sendPresenceLeave,
  setCurrentTelemetrySection,
  trackInteraction,
  trackSectionVisit,
  trackVisitorSession,
  type TelemetryCountersPayload,
} from './utils/telemetry';
import {
  computeSolarWindow,
  loadSavedSolarCoords,
  requestDeviceSolarCoords,
  type SolarCoordinates,
} from './utils/solarTheme';
import {loadDawahQuizState, mergeRemoteQuizState} from './utils/quizStorage';
import {
  DEFAULT_APP_ICONS,
  DEFAULT_SITE_CONFIG,
  INITIAL_FATAWA,
  INITIAL_MOTHER_OASIS_ITEMS,
  INITIAL_POSTS,
  INITIAL_TELEGRAM_AUDIOS,
  INITIAL_TWITTER_QUOTES,
  INITIAL_YOUTUBE_VIDEOS,
} from './data/seed';
import type {
  AdminGesture,
  AdminMeetConfig,
  AdminPermission,
  AdminRole,
  AdminSectionScope,
  AppIcons,
  AutomationSettings,
  ClassicDawahCard,
  CustomAdhkarItem,
  CustomBookItem,
  DawahCardsMeta,
  DeafMuteVideoItem,
  FatwaItem,
  LibraryFilterType,
  MotherOasisItem,
  NafahatMeta,
  NavTab,
  PermanentArchiveItem,
  PoetryAnecdoteItem,
  Post,
  SadaMaterialItem,
  SavedArchiveFatwa,
  SectionStatsMap,
  SiteAppearanceConfig,
  SiteConfig,
  SocialLink,
  SuggestionItem,
  TelegramAudioItem,
  ThemeMode,
  TwitterQuoteItem,
  VisitorProfile,
  VisitorReviewItem,
  VolunteerItem,
  YouTubeVideoItem,
} from './types';
import {getPublicSiteUrl, loadSnapshot, saveSnapshot} from './utils/storage';

const AboutSupportShareView = lazy(() =>
  import('./components/AboutSupportShareView').then((m) => ({default: m.AboutSupportShareView})),
);
const AdhkarView = lazy(() =>
  import('./components/AdhkarView').then((m) => ({default: m.AdhkarView})),
);
const AdminStudioView = lazy(() =>
  import('./components/AdminStudioView').then((m) => ({default: m.AdminStudioView})),
);
const BookmarksView = lazy(() =>
  import('./components/BookmarksView').then((m) => ({default: m.BookmarksView})),
);
const ChannelsView = lazy(() =>
  import('./components/ChannelsView').then((m) => ({default: m.ChannelsView})),
);
const DailyDawahQuizCard = lazy(() =>
  import('./components/DailyDawahQuizCard').then((m) => ({default: m.DailyDawahQuizCard})),
);
const DailyWirdView = lazy(() =>
  import('./components/DailyWirdView').then((m) => ({default: m.DailyWirdView})),
);
const DawahCardsView = lazy(() =>
  import('./components/DawahCardsView').then((m) => ({default: m.DawahCardsView})),
);
const DeafMuteView = lazy(() =>
  import('./components/DeafMuteView').then((m) => ({default: m.DeafMuteView})),
);
const FatawaView = lazy(() =>
  import('./components/FatawaView').then((m) => ({default: m.FatawaView})),
);
const LibraryView = lazy(() =>
  import('./components/LibraryView').then((m) => ({default: m.LibraryView})),
);
const MotherOasisView = lazy(() =>
  import('./components/MotherOasisView').then((m) => ({default: m.MotherOasisView})),
);
const PoetryOasisView = lazy(() =>
  import('./components/PoetryOasisView').then((m) => ({default: m.PoetryOasisView})),
);
const PostDetailView = lazy(() =>
  import('./components/PostDetailView').then((m) => ({default: m.PostDetailView})),
);
const QuranView = lazy(() =>
  import('./components/QuranView').then((m) => ({default: m.QuranView})),
);
const ReviewsView = lazy(() =>
  import('./components/ReviewsView').then((m) => ({default: m.ReviewsView})),
);

const BOOKMARKS_KEY = 'mawaedh_bookmarks_v1';
const FATWA_BOOKMARKS_KEY = 'mawaedh_fatwa_bookmarks_v1';
const ARCHIVE_FATWA_BOOKMARKS_KEY = 'mawaedh_archive_fatwa_bookmarks_v1';
const LIKES_KEY = 'mawaedh_likes_v1';
const THEME_KEY = 'mawaedh_theme_v1';
const AMEN_KEY = 'mawaedh_amen_v1';
const MEDIA_CACHE_KEY = 'mawaedh_media_feeds_v1';
const SPLASH_SEEN_KEY = 'mawaedh_seen_splash';
const VISITOR_PROFILE_KEY = 'mawaedh_visitor_profile_v1';
const ADMIN_SESSION_KEY = 'mawaedh_admin_session_v1';

const DEFAULT_SITE_APPEARANCE: SiteAppearanceConfig = {
  backgroundPreset: 'default',
  brightness: 100,
  announcementEnabled: false,
  announcementText: '',
  announcementUrl: '',
  maintenanceMode: false,
};

const DEFAULT_AUTOMATION_SETTINGS: AutomationSettings = {
  autoPostWebhookUrl: '',
  enabledPlatforms: {facebook: true, whatsapp: true, x: true},
  adminNotifyWebhookUrl: '',
  telegramBotToken: '',
  telegramChatId: '',
  emailJsServiceId: '',
  emailJsTemplateId: '',
  emailJsPublicKey: '',
};

function loadStoredAdminSession(): {
  token: string;
  username: string;
  role: AdminRole;
  assignedSection?: AdminSectionScope;
  permissions?: AdminPermission[];
  isFounder?: boolean;
} | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(ADMIN_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      token?: string;
      username?: string;
      role?: AdminRole;
      assignedSection?: AdminSectionScope;
      permissions?: AdminPermission[];
      isFounder?: boolean;
    };
    if (parsed.token && parsed.username) {
      return {
        token: parsed.token,
        username: parsed.username,
        role:
          parsed.role === 'admin'
            ? 'admin'
            : parsed.role === 'supervisor'
              ? 'supervisor'
              : 'editor',
        assignedSection: parsed.assignedSection || 'all',
        permissions: Array.isArray(parsed.permissions) ? parsed.permissions : undefined,
        isFounder: Boolean(parsed.isFounder || parsed.username === 'moalwbri'),
      };
    }
    return null;
  } catch {
    return null;
  }
}

interface CachedMediaFeeds {
  youtubeVideos: YouTubeVideoItem[];
  telegramAudios: TelegramAudioItem[];
  twitterQuotes: TwitterQuoteItem[];
}

function loadCachedMediaFeeds(): CachedMediaFeeds {
  if (typeof window === 'undefined') {
    return {
      youtubeVideos: INITIAL_YOUTUBE_VIDEOS,
      telegramAudios: INITIAL_TELEGRAM_AUDIOS,
      twitterQuotes: INITIAL_TWITTER_QUOTES,
    };
  }
  try {
    const raw = window.localStorage.getItem(MEDIA_CACHE_KEY);
    if (!raw) {
      return {
        youtubeVideos: INITIAL_YOUTUBE_VIDEOS,
        telegramAudios: INITIAL_TELEGRAM_AUDIOS,
        twitterQuotes: INITIAL_TWITTER_QUOTES,
      };
    }
    const parsed = JSON.parse(raw) as Partial<CachedMediaFeeds>;
    return {
      youtubeVideos:
        Array.isArray(parsed.youtubeVideos) && parsed.youtubeVideos.length > 0
          ? parsed.youtubeVideos
          : INITIAL_YOUTUBE_VIDEOS,
      telegramAudios:
        Array.isArray(parsed.telegramAudios) && parsed.telegramAudios.length > 0
          ? parsed.telegramAudios
          : INITIAL_TELEGRAM_AUDIOS,
      twitterQuotes:
        Array.isArray(parsed.twitterQuotes) && parsed.twitterQuotes.length > 0
          ? parsed.twitterQuotes.map((q) =>
              q.handle === '@ax1ax70' || q.url.includes('twitter.com/ax1ax70') || q.url.includes('x.com/ax1ax70')
                ? {...q, handle: '@ax1ax71', url: 'https://x.com/ax1ax71'}
                : q,
            )
          : INITIAL_TWITTER_QUOTES,
    };
  } catch {
    return {
      youtubeVideos: INITIAL_YOUTUBE_VIDEOS,
      telegramAudios: INITIAL_TELEGRAM_AUDIOS,
      twitterQuotes: INITIAL_TWITTER_QUOTES,
    };
  }
}

function getInitialPostId(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const p = params.get('post')?.trim();
  return p || null;
}

function getInitialStoryId(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const s = params.get('story')?.trim();
  return s || null;
}

function getInitialQuranPage(): number | undefined {
  if (typeof window === 'undefined') return undefined;
  const raw = new URLSearchParams(window.location.search).get('page')?.trim();
  const parsed = raw ? Number(raw) : NaN;
  if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 604) return Math.floor(parsed);
  return undefined;
}

function getInitialDhikrId(): string | null {
  if (typeof window === 'undefined') return null;
  const d = new URLSearchParams(window.location.search).get('dhikr')?.trim();
  return d || null;
}

function getInitialPoetryItemId(): string | null {
  if (typeof window === 'undefined') return null;
  const item = new URLSearchParams(window.location.search).get('item')?.trim();
  return item || null;
}

function getInitialTab(): NavTab {
  if (typeof window === 'undefined') return 'splash';
  const params = new URLSearchParams(window.location.search);
  const tabParam = params.get('tab');
  const postParam = params.get('post')?.trim();
  if (tabParam === 'post-detail' && postParam) {
    return 'post-detail';
  }
  if (tabParam === 'hisn') {
    return 'adhkar';
  }
  if (tabParam === 'about' || tabParam === 'support' || tabParam === 'about-support') {
    return 'about-support';
  }
  if (
    tabParam === 'home' ||
    tabParam === 'quran' ||
    tabParam === 'wird' ||
    tabParam === 'quiz' ||
    tabParam === 'fatawa' ||
    tabParam === 'adhkar' ||
    tabParam === 'library' ||
    tabParam === 'cards' ||
    tabParam === 'mother-oasis' ||
    tabParam === 'poetry' ||
    tabParam === 'archive' ||
    tabParam === 'reviews' ||
    tabParam === 'videos' ||
    tabParam === 'deaf-mute' ||
    tabParam === 'channels' ||
    tabParam === 'bookmarks'
  ) {
    return tabParam;
  }
  if (postParam) {
    return 'post-detail';
  }
  try {
    if (window.sessionStorage.getItem(SPLASH_SEEN_KEY) === '1') {
      return 'home';
    }
  } catch {
    // Ignore
  }
  return 'splash';
}

export default function App() {
  const {langMeta, isEn, setLang, tr, formatNumber} = useI18n();
  const {activeFontSizePx, stepFontSize} = useReadingPrefs();
  const {pageColor, pageColorOption} = usePageColor();
  const {recordView} = useLiveStats();
  const [initialSnapshot] = useState(() => loadSnapshot());
  const [initialMedia] = useState(() => loadCachedMediaFeeds());
  const [storedAdmin] = useState(() => loadStoredAdminSession());
  const isOnline = useOnlineStatus();

  const [activeTab, setActiveTab] = useState<NavTab>(() => getInitialTab());
  const [prevTab, setPrevTab] = useState<NavTab>('home');
  const [tabHistory, setTabHistory] = useState<NavTab[]>([]);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(() => getInitialPostId());
  const [quranInitialPage, setQuranInitialPage] = useState<number | undefined>(() => getInitialQuranPage());
  const [libraryInitialFilter, setLibraryInitialFilter] = useState<LibraryFilterType>('all');

  const [posts, setPosts] = useState<Post[]>(() => initialSnapshot.posts);
  const [fatawa, setFatawa] = useState<FatwaItem[]>(() => initialSnapshot.fatawa);
  const [siteConfig, setSiteConfig] = useState<SiteConfig>(() => initialSnapshot.siteConfig);
  const [isOfflineMode, setIsOfflineMode] = useState(() => !isOnline);
  const [cachedAt, setCachedAt] = useState(() => initialSnapshot.cachedAt);
  const [isSyncing, setIsSyncing] = useState(false);
  const [visitorsCount, setVisitorsCount] = useState(() =>
    Math.max(4580, initialSnapshot.visitorsCount ?? 4580, readLocalTelemetryFloors().visitorsCount),
  );
  const [onlineVisitorsCount, setOnlineVisitorsCount] = useState(() =>
    Math.max(initialSnapshot.onlineVisitorsCount ?? 1, 1),
  );
  const [clicksCount, setClicksCount] = useState(() =>
    Math.max(8540, initialSnapshot.clicksCount ?? 8540, readLocalTelemetryFloors().clicksCount),
  );
  const [registeredMembersCount, setRegisteredMembersCount] = useState(() =>
    Math.max(initialSnapshot.registeredMembersCount ?? 0, readLocalTelemetryFloors().registeredMembersCount),
  );
  const [sectionStats, setSectionStats] = useState<SectionStatsMap>(() =>
    mergeSectionStatsMonotonic(initialSnapshot.sectionStats, readLocalTelemetryFloors().sectionStats),
  );
  const [nafahatMeta, setNafahatMeta] = useState<NafahatMeta | undefined>(() => initialSnapshot.nafahatMeta);
  const [dawahCardsMeta, setDawahCardsMeta] = useState<DawahCardsMeta | undefined>(() => initialSnapshot.dawahCardsMeta);

  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(BOOKMARKS_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });

  const [bookmarkedFatwaIds, setBookmarkedFatwaIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(FATWA_BOOKMARKS_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });

  const [savedArchiveFatawa, setSavedArchiveFatawa] = useState<SavedArchiveFatwa[]>(() => {
    try {
      const raw = localStorage.getItem(ARCHIVE_FATWA_BOOKMARKS_KEY);
      return raw ? (JSON.parse(raw) as SavedArchiveFatwa[]) : [];
    } catch {
      return [];
    }
  });

  const [likedIds, setLikedIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(LIKES_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });

  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    try {
      const raw = localStorage.getItem(THEME_KEY);
      return raw === 'light' || raw === 'dark' || raw === 'system' || raw === 'solar' ? raw : 'light';
    } catch {
      return 'light';
    }
  });

  const [systemPrefersDark, setSystemPrefersDark] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const [solarCoords, setSolarCoords] = useState<SolarCoordinates | null>(() => loadSavedSolarCoords());
  const [solarLocating, setSolarLocating] = useState(false);
  const [solarTick, setSolarTick] = useState(0);

  void solarTick;
  const solarWindow = computeSolarWindow(solarCoords, new Date(), isEn);

  const isDark =
    themeMode === 'dark' ||
    (themeMode === 'system' && systemPrefersDark) ||
    (themeMode === 'solar' && solarWindow.isNight);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);
  const [shareModalPost, setShareModalPost] = useState<Post | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [settingsInitialSection, setSettingsInitialSection] = useState<AppSettingsSection>('settings');
  const openSettingsModal = (section: AppSettingsSection = 'settings') => {
    setSettingsInitialSection(section);
    setSettingsModalOpen(true);
  };
  const [adhkarInitialSection, setAdhkarInitialSection] = useState<'adhkar' | 'hisn'>(() => {
    if (typeof window === 'undefined') return 'adhkar';
    const tabParam = new URLSearchParams(window.location.search).get('tab');
    return tabParam === 'hisn' ? 'hisn' : 'adhkar';
  });
  const [reminderSettings, setReminderSettings] = useState<AdhkarReminderSettings>(() =>
    loadReminderSettings(),
  );
  const [highlightedDhikrId, setHighlightedDhikrId] = useState<string | null>(() =>
    getInitialDhikrId(),
  );

  const [motherPrayersCount, setMotherPrayersCount] = useState(() => initialSnapshot.motherPrayersCount);
  const [hasSaidAmen, setHasSaidAmen] = useState(() => {
    try {
      return localStorage.getItem(AMEN_KEY) === '1';
    } catch {
      return false;
    }
  });

  const [youtubeVideos, setYoutubeVideos] = useState<YouTubeVideoItem[]>(() => initialMedia.youtubeVideos);
  const [telegramAudios, setTelegramAudios] = useState<TelegramAudioItem[]>(() => initialMedia.telegramAudios);
  const [twitterQuotes, setTwitterQuotes] = useState<TwitterQuoteItem[]>(() => initialMedia.twitterQuotes);
  const [isRefreshingFeeds, setIsRefreshingFeeds] = useState(false);

  // Hidden Role-Based Admin / Editor Auth State (completely hidden from general visitors)
  // Persistent Admin Session: stays active across reloads until manual logout
  const [gesture, setGesture] = useState<AdminGesture>(() => initialSnapshot.gesture);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [verifyingLogin, setVerifyingLogin] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(() => storedAdmin?.token || null);
  const [adminRole, setAdminRole] = useState<AdminRole>(() => storedAdmin?.role || 'editor');
  const [adminUsername, setAdminUsername] = useState(() => storedAdmin?.username || '');
  const [assignedSection, setAssignedSection] = useState<AdminSectionScope>(
    () => storedAdmin?.assignedSection || 'all',
  );
  const [adminPermissions, setAdminPermissions] = useState<AdminPermission[]>(
    () => storedAdmin?.permissions || [],
  );
  const [isFounder, setIsFounder] = useState<boolean>(
    () => Boolean(storedAdmin?.isFounder || storedAdmin?.username === 'moalwbri'),
  );
  const [adminInitialTab, setAdminInitialTab] = useState<AdminStudioTab>('studio');
  const [editingPostForAdmin, setEditingPostForAdmin] = useState<Post | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [volunteers, setVolunteers] = useState<VolunteerItem[]>([]);
  const [automationSettings, setAutomationSettings] = useState<AutomationSettings>(DEFAULT_AUTOMATION_SETTINGS);
  const [siteAppearance, setSiteAppearance] = useState<SiteAppearanceConfig>(
    () => initialSnapshot.siteAppearance || DEFAULT_SITE_APPEARANCE,
  );
  const [poetryItems, setPoetryItems] = useState<PoetryAnecdoteItem[]>(
    () => initialSnapshot.poetryItems || [],
  );
  const [permanentArchive, setPermanentArchive] = useState<PermanentArchiveItem[]>(
    () => initialSnapshot.permanentArchive || [],
  );
  const [visitorReviews, setVisitorReviews] = useState<VisitorReviewItem[]>(
    () => initialSnapshot.visitorReviews || [],
  );
  const [motherOasisItems, setMotherOasisItems] = useState<MotherOasisItem[]>(
    () => initialSnapshot.motherOasisItems || [],
  );
  const [deafMuteVideos, setDeafMuteVideos] = useState<DeafMuteVideoItem[]>(
    () => initialSnapshot.deafMuteVideos || INITIAL_DEAF_MUTE_VIDEOS,
  );
  const [customAdhkar, setCustomAdhkar] = useState<CustomAdhkarItem[]>(
    () => initialSnapshot.customAdhkar || [],
  );
  const [customBooks, setCustomBooks] = useState<CustomBookItem[]>(
    () => initialSnapshot.customBooks || [],
  );
  const [sadaMaterials, setSadaMaterials] = useState<SadaMaterialItem[]>(
    () => initialSnapshot.sadaMaterials || [],
  );
  const filterConciseDawahCards = useCallback(
    (cards: ClassicDawahCard[]) =>
      cards.filter(
        (c) => isConciseClassicCard(c) && (!c.createdAt || c.createdAt >= DAWAH_CARDS_RESET_EPOCH),
      ),
    [],
  );

  const [aiDawahCards, setAiDawahCards] = useState<ClassicDawahCard[]>(() =>
    filterConciseDawahCards(initialSnapshot.aiDawahCards || []),
  );
  const [cardEngagement, setCardEngagement] = useState<Record<string, number>>(
    () => initialSnapshot.cardEngagement || {},
  );
  const [meetConfig, setMeetConfig] = useState<AdminMeetConfig>({
    visibility: 'hidden_admin_only',
    activeRoomUrl: '',
  });
  const [isFirebaseAdmin, setIsFirebaseAdmin] = useState(false);
  const [aboutSubTab, setAboutSubTab] = useState<'about' | 'support' | 'share' | 'disclaimer'>(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('tab') === 'support') {
      return 'support';
    }
    return 'about';
  });
  const [externalPortal, setExternalPortal] = useState<ExternalPortalPayload | null>(null);
  const [visitorProfile, setVisitorProfile] = useState<VisitorProfile | null>(() => {
    try {
      const raw =
        window.localStorage.getItem(VISITOR_PROFILE_KEY) ||
        window.sessionStorage.getItem(VISITOR_PROFILE_KEY);
      return raw ? (JSON.parse(raw) as VisitorProfile) : null;
    } catch {
      return null;
    }
  });
  const [visitorAuthModalOpen, setVisitorAuthModalOpen] = useState(false);
  const [languageModalOpen, setLanguageModalOpen] = useState(false);

  const [brandHandle, setBrandHandle] = useState(() => initialSnapshot.brandHandle);
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>(() => initialSnapshot.socialLinks);
  const [appIcons, setAppIcons] = useState<AppIcons>(() => initialSnapshot.appIcons);

  const longPressTimerRef = useRef<number | null>(null);
  const tapTrackerRef = useRef<{count: number; lastTs: number}>({count: 0, lastTs: 0});
  const prevOnlineRef = useRef(isOnline);
  const dailyNafahatSyncedRef = useRef(false);
  const lastClickTrackedAtRef = useRef(0);

  const finishSplash = useCallback(() => {
    try {
      window.sessionStorage.setItem(SPLASH_SEEN_KEY, '1');
    } catch {
      // Ignore
    }
    setActiveTab('home');
  }, []);

  // Auto-restore persistent saved visitor login session on startup
  useEffect(() => {
    let savedToken = '';
    try {
      savedToken =
        window.localStorage.getItem(VISITOR_SESSION_TOKEN_KEY) ||
        window.sessionStorage.getItem(VISITOR_SESSION_TOKEN_KEY) ||
        '';
    } catch {
      savedToken = '';
    }
    if (!savedToken) return;
    void fetch('/api/visitor/session', {
      headers: {Authorization: `Bearer ${savedToken}`},
      cache: 'no-store',
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: {profile?: VisitorProfile} | null) => {
        if (!data?.profile) return;
        setVisitorProfile(data.profile);
        if (data.profile.quizProgress) {
          mergeRemoteQuizState(data.profile.quizProgress);
        }
        try {
          if (window.localStorage.getItem(VISITOR_SESSION_TOKEN_KEY)) {
            window.localStorage.setItem(VISITOR_PROFILE_KEY, JSON.stringify(data.profile));
          } else {
            window.sessionStorage.setItem(VISITOR_PROFILE_KEY, JSON.stringify(data.profile));
          }
        } catch {
          // ignore
        }
      })
      .catch(() => undefined);
  }, []);

  // System dark mode listener
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemPrefersDark(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Solar sunrise/sunset automatic re-evaluation timer
  useEffect(() => {
    if (themeMode !== 'solar') return;
    const timeoutId = window.setTimeout(
      () => setSolarTick((t) => t + 1),
      Math.min(solarWindow.nextTransitionMs + 1000, 2_147_483_000),
    );
    const intervalId = window.setInterval(() => setSolarTick((t) => t + 1), 60_000);
    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [themeMode, solarWindow.nextTransitionMs]);

  // Apply dark class to <html>
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) root.classList.add('dark');
    else root.classList.remove('dark');
    try {
      localStorage.setItem(THEME_KEY, themeMode);
    } catch {
      // Ignore
    }
  }, [isDark, themeMode]);

  useEffect(() => {
    try {
      localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarkedIds));
    } catch {
      // Ignore
    }
  }, [bookmarkedIds]);

  useEffect(() => {
    try {
      localStorage.setItem(FATWA_BOOKMARKS_KEY, JSON.stringify(bookmarkedFatwaIds));
    } catch {
      // Ignore
    }
  }, [bookmarkedFatwaIds]);

  useEffect(() => {
    try {
      localStorage.setItem(ARCHIVE_FATWA_BOOKMARKS_KEY, JSON.stringify(savedArchiveFatawa));
    } catch {
      // Ignore
    }
  }, [savedArchiveFatawa]);

  useEffect(() => {
    try {
      localStorage.setItem(LIKES_KEY, JSON.stringify(likedIds));
    } catch {
      // Ignore
    }
  }, [likedIds]);

  const notify = useCallback((msg: string) => {
    setToastMsg(msg);
  }, []);

  useEffect(() => {
    if (!toastMsg) return;
    const t = window.setTimeout(() => setToastMsg(null), 3400);
    return () => window.clearTimeout(t);
  }, [toastMsg]);

  const updateReminderSettings = useCallback((next: AdhkarReminderSettings) => {
    setReminderSettings(next);
    saveReminderSettings(next);
  }, []);

  useEffect(() => {
    const openTargetedAdhkar = (dhikrId?: string) => {
      setAdhkarInitialSection('adhkar');
      if (dhikrId) {
        setHighlightedDhikrId(dhikrId);
      }
      setActiveTab('adhkar');
    };

    const runCheck = () => {
      void checkAndTriggerScheduledReminders({
        settings: reminderSettings,
        isEn,
        appName: isEn ? 'Mawaedh & Ibar' : siteConfig.appName,
        onUpdateSettings: updateReminderSettings,
        onOpenAdhkar: openTargetedAdhkar,
        onInAppNotify: notify,
      });
    };

    runCheck();
    const intervalId = window.setInterval(runCheck, 30_000);
    const nextDelayMs = computeNextScheduledDelayMs(reminderSettings);
    const exactTimerId =
      nextDelayMs !== null
        ? window.setTimeout(() => {
            runCheck();
          }, nextDelayMs)
        : null;
    const onVisibility = () => {
      if (document.visibilityState === 'visible') runCheck();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(intervalId);
      if (exactTimerId !== null) window.clearTimeout(exactTimerId);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [reminderSettings, isEn, siteConfig.appName, updateReminderSettings, notify]);

  // Intercept external <a> clicks + custom portal events so visitors always keep a return/home bar
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onOpenPortal = (e: Event) => {
      const ce = e as CustomEvent<ExternalPortalPayload>;
      if (ce.detail?.url) {
        setExternalPortal(ce.detail);
      }
    };
    const onCaptureAnchorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      if (
        anchor.hasAttribute('download') ||
        anchor.dataset.directExternal === 'true' ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }
      const rawHref = anchor.getAttribute('href') || '';
      if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:')) {
        return;
      }
      try {
        const parsed = new URL(anchor.href, window.location.href);
        if (parsed.origin === window.location.origin) return;
        const lower = parsed.href.toLowerCase();
        if (
          lower.includes('wa.me/') ||
          lower.includes('api.whatsapp.com/') ||
          lower.includes('x.com/intent/') ||
          lower.includes('twitter.com/intent/')
        ) {
          return;
        }
        e.preventDefault();
        setExternalPortal({
          url: parsed.href,
          title: anchor.textContent?.trim() || parsed.hostname,
        });
      } catch {
        // Ignore invalid URLs
      }
    };
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      const nextTab = getInitialTab();
      const postParam = params.get('post')?.trim() || null;
      setSelectedPostId(postParam);
      if (nextTab !== 'splash') {
        setActiveTab(nextTab);
      }
    };
    window.addEventListener(EXTERNAL_PORTAL_OPEN_EVENT, onOpenPortal);
    document.addEventListener('click', onCaptureAnchorClick, true);
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener(EXTERNAL_PORTAL_OPEN_EVENT, onOpenPortal);
      document.removeEventListener('click', onCaptureAnchorClick, true);
      window.removeEventListener('popstate', onPopState);
    };
  }, []);

  // Keep browser URL live-updated on navigation and deep-link post opens
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (activeTab === 'splash' || activeTab === 'admin-studio') return;
    try {
      const url = new URL(window.location.href);
      const currentUrlTab = url.searchParams.get('tab');
      const currentUrlPost = url.searchParams.get('post');
      url.searchParams.set('tab', activeTab);
      if (activeTab === 'post-detail' && selectedPostId) {
        url.searchParams.set('post', selectedPostId);
      } else {
        url.searchParams.delete('post');
      }
      if (currentUrlTab !== activeTab || (activeTab === 'post-detail' && currentUrlPost !== selectedPostId)) {
        window.history.pushState({tab: activeTab}, '', `${url.pathname}${url.search}${url.hash}`);
      } else {
        window.history.replaceState({tab: activeTab}, '', `${url.pathname}${url.search}${url.hash}`);
      }
    } catch {
      // Ignore history restriction
    }
  }, [activeTab, selectedPostId]);

  // Register unique browser session visit once and track interactive UI clicks
  useEffect(() => {
    let active = true;
    const applyPresencePayload = (res: TelemetryCountersPayload | null) => {
      if (!active || !res) return;
      saveLocalTelemetryFloors({
        visitorsCount: res.visitorsCount,
        clicksCount: res.clicksCount,
        registeredMembersCount: res.registeredMembersCount,
        sectionStats: res.sectionStats,
      });
      if (typeof res.visitorsCount === 'number') {
        const nextVal = res.visitorsCount;
        setVisitorsCount((prev) => Math.max(prev, 4580, nextVal));
      }
      if (typeof res.clicksCount === 'number') {
        const nextClicks = res.clicksCount;
        setClicksCount((prev) => Math.max(prev, 8540, nextClicks));
      }
      if (typeof res.registeredMembersCount === 'number') {
        const nextMembers = res.registeredMembersCount;
        setRegisteredMembersCount((prev) => Math.max(prev, nextMembers));
      }
      if (res.sectionStats) {
        const incomingSec = res.sectionStats;
        setSectionStats((prev) => mergeSectionStatsMonotonic(prev, incomingSec));
      }
      if (typeof res.onlineVisitorsCount === 'number') {
        setOnlineVisitorsCount(Math.max(1, res.onlineVisitorsCount));
      }
    };

    void trackVisitorSession().then(applyPresencePayload);

    const pulseId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void sendPresenceHeartbeat().then(applyPresencePayload);
      }
    }, 30_000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void sendPresenceHeartbeat().then(applyPresencePayload);
      }
    };

    const handlePageHide = () => {
      sendPresenceLeave();
    };

    const handleGlobalClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (!target.closest('button, a, [role="button"]')) return;
      const now = Date.now();
      if (now - lastClickTrackedAtRef.current < 1200) return;
      lastClickTrackedAtRef.current = now;
      setClicksCount((c) => c + 1);
      const updatedSections = trackInteraction('click');
      if (updatedSections) {
        setSectionStats((prev) => mergeSectionStatsMonotonic(prev, updatedSections));
      }
    };

    const handleTelemetryUpdated = (event: Event) => {
      const detail = (event as CustomEvent<SectionStatsMap>).detail;
      if (detail && typeof detail === 'object') {
        setSectionStats((prev) => mergeSectionStatsMonotonic(prev, detail));
      }
    };

    document.addEventListener('click', handleGlobalClick, {passive: true});
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener(TELEMETRY_UPDATED_EVENT, handleTelemetryUpdated);
    return () => {
      active = false;
      window.clearInterval(pulseId);
      document.removeEventListener('click', handleGlobalClick);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener(TELEMETRY_UPDATED_EVENT, handleTelemetryUpdated);
    };
  }, []);

  // Track cumulative per-section visits cleanly whenever a user enters a section
  const lastTrackedSectionRef = useRef<string>('');
  useEffect(() => {
    if (activeTab === 'splash' || activeTab === 'admin-studio') return;
    const normalizedSection =
      activeTab === 'about' || activeTab === 'support' ? 'about-support' : activeTab;
    setCurrentTelemetrySection(normalizedSection);
    if (lastTrackedSectionRef.current === normalizedSection) return;
    lastTrackedSectionRef.current = normalizedSection;
    void trackSectionVisit(normalizedSection).then((nextStats) => {
      if (nextStats) {
        setSectionStats((prev) => mergeSectionStatsMonotonic(prev, nextStats));
      }
    });
  }, [activeTab]);

  useEffect(() => {
    saveSnapshot({
      posts,
      fatawa,
      socialLinks,
      appIcons,
      siteConfig,
      brandHandle,
      motherPrayersCount,
      visitorsCount,
      onlineVisitorsCount,
      clicksCount,
      registeredMembersCount,
      nafahatMeta,
      dawahCardsMeta,
      poetryItems,
      permanentArchive,
      motherOasisItems,
      deafMuteVideos,
      customAdhkar,
      customBooks,
      sadaMaterials,
      aiDawahCards,
      cardEngagement,
      sectionStats,
      visitorReviews,
      siteAppearance,
      gesture,
      cachedAt,
    });
  }, [
    posts,
    fatawa,
    socialLinks,
    appIcons,
    siteConfig,
    brandHandle,
    motherPrayersCount,
    visitorsCount,
    onlineVisitorsCount,
    clicksCount,
    registeredMembersCount,
    nafahatMeta,
    dawahCardsMeta,
    poetryItems,
    permanentArchive,
    motherOasisItems,
    deafMuteVideos,
    customAdhkar,
    customBooks,
    sadaMaterials,
    aiDawahCards,
    cardEngagement,
    sectionStats,
    visitorReviews,
    siteAppearance,
    gesture,
    cachedAt,
  ]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        MEDIA_CACHE_KEY,
        JSON.stringify({youtubeVideos, telegramAudios, twitterQuotes}),
      );
    } catch {
      // Ignore storage quota
    }
  }, [youtubeVideos, telegramAudios, twitterQuotes]);

  const getLocalDateKey = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const lastSyncDayRef = useRef<string>(getLocalDateKey());

  const syncDailyNafahatIfNeeded = useCallback(async (meta?: NafahatMeta) => {
    if (dailyNafahatSyncedRef.current) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    const todayKey = getLocalDateKey();
    if (meta?.lastUpdatedDate === todayKey) {
      dailyNafahatSyncedRef.current = true;
      return;
    }
    dailyNafahatSyncedRef.current = true;
    try {
      const res = await fetch('/api/nafahat/daily-sync', {method: 'POST'});
      if (!res.ok) return;
      const data = (await res.json()) as {
        updated?: boolean;
        siteConfig?: SiteConfig;
        post?: Post;
        posts?: Post[];
        nafahatMeta?: NafahatMeta;
        aiDawahCards?: ClassicDawahCard[];
        dawahCardsMeta?: DawahCardsMeta;
      };
      if (data.siteConfig) {
        setSiteConfig({...DEFAULT_SITE_CONFIG, ...data.siteConfig});
      }
      if (Array.isArray(data.posts) && data.posts.length > 0) {
        setPosts(data.posts);
      } else if (data.post) {
        setPosts((prev) => [data.post!, ...prev.filter((p) => p.id !== data.post!.id)]);
      }
      if (data.nafahatMeta) {
        setNafahatMeta(data.nafahatMeta);
      }
      if (Array.isArray(data.aiDawahCards) && data.aiDawahCards.length > 0) {
        setAiDawahCards((prev) =>
          filterConciseDawahCards(
            mergeCloudAndLocalById(data.aiDawahCards!, filterConciseDawahCards(prev), []),
          ),
        );
      }
      if (data.dawahCardsMeta) {
        setDawahCardsMeta(data.dawahCardsMeta);
      }
    } catch {
      // Keep cached/default Nafahat silently offline or if unavailable
    }
  }, []);

  const syncBootstrap = useCallback(
    async (opts?: {showFeedback?: boolean}) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setIsOfflineMode(true);
        if (opts?.showFeedback) notify('لا يوجد اتصال بالإنترنت — التصفح يعمل من النسخة المحفوظة محلياً');
        return;
      }
      setIsSyncing(true);
      try {
        const res = await fetch('/api/bootstrap', {
          cache: 'no-store',
          headers: authToken ? {Authorization: `Bearer ${authToken}`} : undefined,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as {
          posts?: Post[];
          fatawa?: FatwaItem[];
          gesture?: AdminGesture;
          motherPrayersCount?: number;
          visitorsCount?: number;
          onlineVisitorsCount?: number;
          clicksCount?: number;
          registeredMembersCount?: number;
          nafahatMeta?: NafahatMeta;
          dawahCardsMeta?: DawahCardsMeta;
          poetryItems?: PoetryAnecdoteItem[];
          permanentArchive?: PermanentArchiveItem[];
          motherOasisItems?: MotherOasisItem[];
          deafMuteVideos?: DeafMuteVideoItem[];
          customAdhkar?: CustomAdhkarItem[];
          customBooks?: CustomBookItem[];
          sadaMaterials?: SadaMaterialItem[];
          aiDawahCards?: ClassicDawahCard[];
          cardEngagement?: Record<string, number>;
          sectionStats?: SectionStatsMap;
          meetConfig?: AdminMeetConfig;
          visitorReviews?: VisitorReviewItem[];
          siteAppearance?: SiteAppearanceConfig;
          brandHandle?: string;
          socialLinks?: SocialLink[];
          appIcons?: AppIcons;
          siteConfig?: SiteConfig;
        };
        if (Array.isArray(data.posts)) {
          setPosts((prev) => mergeCloudAndLocalById(data.posts!, prev, INITIAL_POSTS));
        }
        if (Array.isArray(data.fatawa)) {
          setFatawa((prev) => mergeCloudAndLocalById(data.fatawa!, prev, INITIAL_FATAWA));
        }
        if (data.gesture) setGesture(data.gesture);
        if (typeof data.motherPrayersCount === 'number') setMotherPrayersCount(data.motherPrayersCount);
        saveLocalTelemetryFloors({
          visitorsCount: data.visitorsCount,
          clicksCount: data.clicksCount,
          registeredMembersCount: data.registeredMembersCount,
          sectionStats: data.sectionStats,
        });
        if (typeof data.visitorsCount === 'number') {
          const nextVal = data.visitorsCount;
          setVisitorsCount((prev) => Math.max(prev, 4580, nextVal));
        }
        if (typeof data.onlineVisitorsCount === 'number') {
          setOnlineVisitorsCount(Math.max(1, data.onlineVisitorsCount));
        }
        if (typeof data.clicksCount === 'number') {
          const nextClicks = data.clicksCount;
          setClicksCount((prev) => Math.max(prev, 8540, nextClicks));
        }
        if (typeof data.registeredMembersCount === 'number') {
          const nextMembers = data.registeredMembersCount;
          setRegisteredMembersCount((prev) => Math.max(prev, nextMembers));
        }
        if (data.sectionStats) {
          const incomingSec = data.sectionStats;
          setSectionStats((prev) => mergeSectionStatsMonotonic(prev, incomingSec));
        }
        if (data.nafahatMeta) setNafahatMeta(data.nafahatMeta);
        if (data.dawahCardsMeta) setDawahCardsMeta(data.dawahCardsMeta);
        if (Array.isArray(data.poetryItems)) {
          setPoetryItems((prev) => appendOnlyMergeById(data.poetryItems!, prev));
        }
        if (Array.isArray(data.permanentArchive)) setPermanentArchive(data.permanentArchive);
        if (Array.isArray(data.motherOasisItems)) {
          setMotherOasisItems((prev) =>
            mergeCloudAndLocalById(data.motherOasisItems!, prev, INITIAL_MOTHER_OASIS_ITEMS),
          );
        }
        if (Array.isArray(data.deafMuteVideos)) {
          setDeafMuteVideos((prev) =>
            mergeCloudAndLocalById(data.deafMuteVideos!, prev, INITIAL_DEAF_MUTE_VIDEOS),
          );
        }
        if (Array.isArray(data.customAdhkar)) {
          setCustomAdhkar((prev) => mergeCloudAndLocalById(data.customAdhkar!, prev, []));
        }
        if (Array.isArray(data.customBooks)) {
          setCustomBooks((prev) => mergeCloudAndLocalById(data.customBooks!, prev, []));
        }
        if (Array.isArray(data.sadaMaterials)) {
          setSadaMaterials((prev) => mergeCloudAndLocalById(data.sadaMaterials!, prev, []));
        }
        if (Array.isArray(data.aiDawahCards)) {
          setAiDawahCards((prev) =>
            filterConciseDawahCards(
              mergeCloudAndLocalById(data.aiDawahCards!, filterConciseDawahCards(prev), []),
            ),
          );
        }
        if (data.cardEngagement && typeof data.cardEngagement === 'object') {
          setCardEngagement((prev) => {
            const merged = {...prev};
            for (const [k, v] of Object.entries(data.cardEngagement!)) {
              const count = Number(v) || 0;
              if (count > (merged[k] || 0)) merged[k] = count;
            }
            return merged;
          });
        }
        if (data.meetConfig) setMeetConfig(data.meetConfig);
        if (Array.isArray(data.visitorReviews)) {
          setVisitorReviews((prev) => mergeCloudAndLocalById(data.visitorReviews!, prev, []));
        }
        if (data.siteAppearance) setSiteAppearance({...DEFAULT_SITE_APPEARANCE, ...data.siteAppearance});
        if (typeof data.brandHandle === 'string' && data.brandHandle.trim()) setBrandHandle(data.brandHandle);
        if (Array.isArray(data.socialLinks)) setSocialLinks(data.socialLinks);
        if (data.appIcons) setAppIcons({...DEFAULT_APP_ICONS, ...data.appIcons});
        if (data.siteConfig) setSiteConfig({...DEFAULT_SITE_CONFIG, ...data.siteConfig, supportEmail: ''});
        setCachedAt(new Date().toISOString());
        setIsOfflineMode(false);
        if (opts?.showFeedback) notify('تم الاتصال بالإنترنت وتحديث المحتوى بنجاح');
        void syncDailyNafahatIfNeeded(data.nafahatMeta);
      } catch {
        setIsOfflineMode(true);
        if (opts?.showFeedback) notify('تعذر الاتصال بالخادم — تستمر القراءة بدون إنترنت من النسخة المحفوظة');
      } finally {
        setIsSyncing(false);
      }
    },
    [authToken, notify, syncDailyNafahatIfNeeded],
  );

  useEffect(() => {
    void syncBootstrap();
  }, [syncBootstrap]);

  // Real-time Firebase Firestore Cloud Persistence (cross-device & reinstall safe, append-only)
  useEffect(() => {
    const unsubAuth = observeFirebaseAdminAuth((user) => {
      setIsFirebaseAdmin(isTrustedAdminUser(user));
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    let active = true;
    void fetchAllCloudCollections(isFirebaseAdmin)
      .then((cloud) => {
        if (!active) return;
        if (cloud.posts.length > 0) {
          setPosts((prev) => mergeCloudAndLocalById(cloud.posts, prev, INITIAL_POSTS));
        }
        if (cloud.fatawa.length > 0) {
          setFatawa((prev) => mergeCloudAndLocalById(cloud.fatawa, prev, INITIAL_FATAWA));
        }
        if (cloud.motherOasisItems.length > 0) {
          setMotherOasisItems((prev) =>
            mergeCloudAndLocalById(cloud.motherOasisItems, prev, INITIAL_MOTHER_OASIS_ITEMS),
          );
        }
        if (cloud.poetryItems.length > 0) {
          setPoetryItems((prev) => appendOnlyMergeById(cloud.poetryItems, prev));
        }
        if (cloud.deafMuteVideos.length > 0) {
          setDeafMuteVideos((prev) =>
            mergeCloudAndLocalById(cloud.deafMuteVideos, prev, INITIAL_DEAF_MUTE_VIDEOS),
          );
        }
        if (cloud.customAdhkar.length > 0) {
          setCustomAdhkar((prev) => mergeCloudAndLocalById(cloud.customAdhkar, prev, []));
        }
        if (cloud.customBooks.length > 0) {
          setCustomBooks((prev) => mergeCloudAndLocalById(cloud.customBooks, prev, []));
        }
        if (cloud.sadaMaterials.length > 0) {
          setSadaMaterials((prev) => mergeCloudAndLocalById(cloud.sadaMaterials, prev, []));
        }
        if (cloud.aiDawahCards.length > 0) {
          setAiDawahCards((prev) =>
            filterConciseDawahCards(
              mergeCloudAndLocalById(cloud.aiDawahCards, filterConciseDawahCards(prev), []),
            ),
          );
        }
        if (cloud.visitorReviews.length > 0) {
          setVisitorReviews((prev) => mergeCloudAndLocalById(cloud.visitorReviews, prev, []));
        }
      })
      .catch(() => undefined);

    const unsubCloud = subscribeCloudCollections(isFirebaseAdmin, {
      onPosts: (items) => {
        if (items.length > 0) setPosts((prev) => mergeCloudAndLocalById(items, prev, INITIAL_POSTS));
      },
      onFatawa: (items) => {
        if (items.length > 0) setFatawa((prev) => mergeCloudAndLocalById(items, prev, INITIAL_FATAWA));
      },
      onMotherOasis: (items) => {
        if (items.length > 0) {
          setMotherOasisItems((prev) =>
            mergeCloudAndLocalById(items, prev, INITIAL_MOTHER_OASIS_ITEMS),
          );
        }
      },
      onDeafMuteVideos: (items) => {
        if (items.length > 0) {
          setDeafMuteVideos((prev) =>
            mergeCloudAndLocalById(items, prev, INITIAL_DEAF_MUTE_VIDEOS),
          );
        }
      },
      onCustomAdhkar: (items) => {
        if (items.length > 0) setCustomAdhkar((prev) => mergeCloudAndLocalById(items, prev, []));
      },
      onCustomBooks: (items) => {
        if (items.length > 0) setCustomBooks((prev) => mergeCloudAndLocalById(items, prev, []));
      },
      onSadaMaterials: (items) => {
        if (items.length > 0) setSadaMaterials((prev) => mergeCloudAndLocalById(items, prev, []));
      },
      onAiDawahCards: (items) => {
        if (items.length > 0) {
          setAiDawahCards((prev) =>
            filterConciseDawahCards(mergeCloudAndLocalById(items, filterConciseDawahCards(prev), [])),
          );
        }
      },
      onReviews: (items) => {
        if (items.length > 0) setVisitorReviews((prev) => mergeCloudAndLocalById(items, prev, []));
      },
    });

    return () => {
      active = false;
      unsubCloud();
    };
  }, [isFirebaseAdmin]);

  // Verify persisted Admin session on startup & restore messages/settings (never auto-expires)
  useEffect(() => {
    if (!authToken) return;
    let active = true;
    void fetch('/api/admin/session', {
      headers: {Authorization: `Bearer ${authToken}`},
      cache: 'no-store',
    })
      .then(async (res) => {
        if (!active) return;
        if (res.status === 401) {
          setAuthToken(null);
          setAdminPermissions([]);
          setIsFounder(false);
          try {
            window.localStorage.removeItem(ADMIN_SESSION_KEY);
          } catch {
            // ignore
          }
          return;
        }
        if (!res.ok) return;
        const data = (await res.json()) as {
          username?: string;
          role?: AdminRole;
          assignedSection?: AdminSectionScope;
          permissions?: AdminPermission[];
          isFounder?: boolean;
          suggestions?: SuggestionItem[];
          volunteers?: VolunteerItem[];
          automationSettings?: AutomationSettings;
          siteAppearance?: SiteAppearanceConfig;
          meetConfig?: AdminMeetConfig;
        };
        if (data.username) setAdminUsername(data.username);
        if (data.role) setAdminRole(data.role);
        if (data.assignedSection) setAssignedSection(data.assignedSection);
        if (Array.isArray(data.permissions)) setAdminPermissions(data.permissions);
        if (typeof data.isFounder === 'boolean') {
          setIsFounder(data.isFounder);
        } else if (data.username === 'moalwbri') {
          setIsFounder(true);
        }
        if (Array.isArray(data.suggestions)) setSuggestions(data.suggestions);
        if (Array.isArray(data.volunteers)) setVolunteers(data.volunteers);
        if (data.automationSettings) setAutomationSettings(data.automationSettings);
        if (data.siteAppearance) setSiteAppearance({...DEFAULT_SITE_APPEARANCE, ...data.siteAppearance});
        if (data.meetConfig) setMeetConfig(data.meetConfig);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [authToken]);

  // Sync visitor saved bookmarks/likes when signed in (both backend & Firestore cloud)
  useEffect(() => {
    if (!visitorProfile?.id) return;
    const enrichedProfile: VisitorProfile = {
      ...visitorProfile,
      bookmarkedPostIds: bookmarkedIds,
      bookmarkedFatwaIds,
      likedPostIds: likedIds,
    };
    try {
      window.localStorage.setItem(VISITOR_PROFILE_KEY, JSON.stringify(enrichedProfile));
    } catch {
      // ignore
    }
    void fetch('/api/visitor/sync', {
      method: 'PUT',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        visitorId: visitorProfile.id,
        bookmarkedPostIds: bookmarkedIds,
        bookmarkedFatwaIds,
        likedPostIds: likedIds,
        adhkarLifetime: exportAdhkarLifetimePayload(),
        quizProgress: loadDawahQuizState(),
      }),
    }).catch(() => undefined);
    void cloudUpsertVisitorProfile(enrichedProfile).catch(() => undefined);
  }, [visitorProfile, bookmarkedIds, bookmarkedFatwaIds, likedIds]);

  const refreshArchive = useCallback(() => {
    void fetch('/api/archive', {cache: 'no-store'})
      .then((res) => (res.ok ? res.json() : null))
      .then((data: {permanentArchive?: PermanentArchiveItem[]} | null) => {
        if (data && Array.isArray(data.permanentArchive)) {
          setPermanentArchive(data.permanentArchive);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const wasOnline = prevOnlineRef.current;
    prevOnlineRef.current = isOnline;
    if (!isOnline && wasOnline) {
      setIsOfflineMode(true);
      notify('أنت تتصفح الآن بدون إنترنت — المواعظ والمصحف والأذكار والأدعية الجامعة تعمل كاملة');
    } else if (isOnline && !wasOnline) {
      void syncBootstrap({showFeedback: true});
    }
  }, [isOnline, notify, syncBootstrap]);

  const syncMediaFeeds = useCallback(
    async (opts?: {forceRefresh?: boolean; showFeedback?: boolean}) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        if (opts?.showFeedback) notify('لا يوجد اتصال — يتم عرض المرئيات والصوتيات المحفوظة محلياً');
        return;
      }
      setIsRefreshingFeeds(true);
      try {
        const res = await fetch(`/api/feeds/media${opts?.forceRefresh ? '?refresh=1' : ''}`, {
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as {
          youtubeVideos?: YouTubeVideoItem[];
          telegramAudios?: TelegramAudioItem[];
          twitterQuotes?: TwitterQuoteItem[];
        };
        if (Array.isArray(data.youtubeVideos) && data.youtubeVideos.length > 0) {
          setYoutubeVideos(data.youtubeVideos);
        }
        if (Array.isArray(data.telegramAudios) && data.telegramAudios.length > 0) {
          setTelegramAudios(data.telegramAudios);
        }
        if (Array.isArray(data.twitterQuotes) && data.twitterQuotes.length > 0) {
          setTwitterQuotes(data.twitterQuotes);
        }
        if (opts?.showFeedback) {
          notify('تم تحديث فيديوهات اليوتيوب وصوتيات تيليجرام ومنصة إكس (X) بنجاح');
        }
      } catch {
        if (opts?.showFeedback) {
          notify('تعذر تحديث القنوات حالياً — تستمر المواد المحفوظة بالعمل');
        }
      } finally {
        setIsRefreshingFeeds(false);
      }
    },
    [notify],
  );

  useEffect(() => {
    void syncMediaFeeds();
  }, [syncMediaFeeds]);

  // Auto-sync all daily contents when the calendar day rolls over while app is open or resumed
  useEffect(() => {
    const checkDayRollover = () => {
      if (document.visibilityState !== 'visible') return;
      const currentDay = getLocalDateKey();
      if (currentDay !== lastSyncDayRef.current) {
        lastSyncDayRef.current = currentDay;
        dailyNafahatSyncedRef.current = false;
        void syncBootstrap();
        void syncMediaFeeds({forceRefresh: true});
      }
    };
    document.addEventListener('visibilitychange', checkDayRollover);
    window.addEventListener('focus', checkDayRollover);
    return () => {
      document.removeEventListener('visibilitychange', checkDayRollover);
      window.removeEventListener('focus', checkDayRollover);
    };
  }, [syncBootstrap, syncMediaFeeds]);

  const navigateTo = (
    tab: NavTab,
    opts?: {
      skipHistory?: boolean;
      libraryFilter?: LibraryFilterType;
      aboutSub?: 'about' | 'support' | 'share' | 'disclaimer';
    },
  ) => {
    setMoreSheetOpen(false);
    recordView();
    if (!opts?.skipHistory && activeTab !== 'splash' && activeTab !== tab) {
      setPrevTab(activeTab);
      setTabHistory((prev) => [...prev.slice(-14), activeTab]);
    }
    if (opts?.libraryFilter) {
      setLibraryInitialFilter(opts.libraryFilter);
    }
    if (tab === 'hisn') {
      setAdhkarInitialSection('hisn');
      setActiveTab('adhkar');
    } else if (tab === 'about' || tab === 'about-support') {
      setAboutSubTab(opts?.aboutSub || 'about');
      setActiveTab('about-support');
    } else if (tab === 'support') {
      setAboutSubTab(opts?.aboutSub || 'support');
      setActiveTab('about-support');
    } else {
      if (tab === 'adhkar') setAdhkarInitialSection('adhkar');
      setActiveTab(tab);
    }
    window.scrollTo({top: 0, behavior: 'smooth'});
  };

  const navigateBack = () => {
    if (tabHistory.length > 0) {
      const target = tabHistory[tabHistory.length - 1];
      setTabHistory((prev) => prev.slice(0, -1));
      navigateTo(target, {skipHistory: true});
      return;
    }
    if (prevTab && prevTab !== activeTab && prevTab !== 'splash') {
      navigateTo(prevTab, {skipHistory: true});
      return;
    }
    navigateTo('home', {skipHistory: true});
  };

  const handleCardEngaged = useCallback((id: string, nextCount: number) => {
    setCardEngagement((prev) => ({
      ...prev,
      [id]: Math.max(prev[id] || 0, nextCount),
    }));
  }, []);

  const openPostDetail = (postId: string) => {
    if (activeTab !== 'post-detail') {
      setPrevTab(activeTab);
      setTabHistory((prev) => [...prev.slice(-14), activeTab]);
    }
    setSelectedPostId(postId);
    setActiveTab('post-detail');
    window.scrollTo({top: 0, behavior: 'smooth'});
    recordView();
    trackInteraction('sermon_read');
  };

  const toggleBookmark = (postId: string) => {
    setBookmarkedIds((prev) => {
      const exists = prev.includes(postId);
      notify(
        exists
          ? tr('تمت إزالة الموعظة من المحفوظات', 'Sermon removed from bookmarks')
          : tr('تم حفظ الموعظة في خزانتك الخاصة', 'Sermon saved to bookmarks'),
      );
      return exists ? prev.filter((x) => x !== postId) : [postId, ...prev];
    });
  };

  const toggleFatwaBookmark = (fatwaId: string) => {
    setBookmarkedFatwaIds((prev) => {
      const exists = prev.includes(fatwaId);
      notify(
        exists
          ? tr('تم إلغاء حفظ الفتوى من المفضلة والمحفوظات', 'Fatwa removed from favorites & bookmarks')
          : tr('تم تمييز الفتوى كمفضلة وحفظها في قسم المحفوظات', 'Fatwa marked as favorite & saved to Bookmarks'),
      );
      return exists ? prev.filter((x) => x !== fatwaId) : [fatwaId, ...prev];
    });
  };

  const toggleArchiveFatwaBookmark = (item: SavedArchiveFatwa) => {
    setSavedArchiveFatawa((prev) => {
      const exists = prev.some((x) => x.id === item.id);
      notify(
        exists
          ? tr('تم إلغاء حفظ الفتوى من المفضلة والمحفوظات', 'Fatwa removed from favorites & bookmarks')
          : tr('تم تمييز الفتوى كمفضلة وحفظها في قسم المحفوظات', 'Fatwa marked as favorite & saved to Bookmarks'),
      );
      return exists ? prev.filter((x) => x.id !== item.id) : [item, ...prev];
    });
  };

  const toggleLike = async (postId: string) => {
    const alreadyLiked = likedIds.includes(postId);
    const nextLiked = !alreadyLiked;
    setLikedIds((prev) => (nextLiked ? [...prev, postId] : prev.filter((x) => x !== postId)));
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? {...p, likes: Math.max(0, p.likes + (nextLiked ? 1 : -1))} : p)),
    );
    try {
      const res = await fetch(`/api/posts/${postId}/like`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({liked: nextLiked}),
      });
      if (res.ok) {
        const data = (await res.json()) as {post?: Post};
        if (data.post) {
          setPosts((prev) => prev.map((p) => (p.id === postId ? data.post! : p)));
        }
      }
    } catch {
      // Offline optimistic state kept
    }
  };

  const handleAddComment = async (postId: string, author: string, text: string) => {
    try {
      const headers: Record<string, string> = {'Content-Type': 'application/json'};
      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
      }
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          author,
          text,
          visitorId: visitorProfile?.id,
        }),
      });
      const data = (await res.json()) as {post?: Post; error?: string};
      if (!res.ok || !data.post) {
        if (res.status === 401) {
          setVisitorAuthModalOpen(true);
        }
        notify(data.error || 'التعليق متاح لمن سجل الدخول فقط — يرجى تسجيل الدخول أولاً');
        return;
      }
      setPosts((prev) => prev.map((p) => (p.id === postId ? data.post! : p)));
      notify('تمت إضافة تعليقك بنجاح، جزاك الله خيراً');
    } catch {
      notify('تعذر إرسال التعليق أثناء عدم الاتصال بالإنترنت');
    }
  };

  const sayAmen = async () => {
    if (hasSaidAmen) return;
    setHasSaidAmen(true);
    setMotherPrayersCount((c) => c + 1);
    try {
      localStorage.setItem(AMEN_KEY, '1');
    } catch {
      // Ignore
    }
    notify('آمين، تقبل الله دعاءك وحفظ والدتك ووالدينا أجمعين');
    try {
      const res = await fetch('/api/prayers/mother/amen', {method: 'POST'});
      if (res.ok) {
        const data = (await res.json()) as {count?: number};
        if (typeof data.count === 'number') setMotherPrayersCount(data.count);
      }
    } catch {
      // Keep optimistic increment
    }
  };

  const copySadaMessage = async (post: Post) => {
    const shareLink =
      post.shareUrl ||
      (post.id === 'daily_wisdom_featured'
        ? getPublicSiteUrl('/?tab=home')
        : getPublicSiteUrl(`/?post=${encodeURIComponent(post.id)}`));
    const cleanBody = post.body.replace(/\s+/g, ' ').trim();
    const isLong = cleanBody.length > 550;
    const excerptPart = isLong ? `${cleanBody.slice(0, 420).trim()}...` : post.body;
    const formatted = isLong
      ? `✨ *${post.title}*\n\n${excerptPart}\n\n📲 لتكملة القصة أو الحديث عبر الباركود أو الرابط:\n${shareLink}\n— ${post.author} · ${siteConfig.appName}`
      : `✨ *${post.title}*\n\n${post.body}\n\n— ${post.author}\n\n📚 خدمة صدى الخير الدعوية · ${siteConfig.appName} (${brandHandle})\n🌐 رابط الموقع: ${shareLink}\n📲 تيليجرام: https://t.me/ax1ax70${post.youtubeUrl ? `\n🎬 يوتيوب: ${post.youtubeUrl}` : ''}`;

    try {
      await navigator.clipboard.writeText(formatted);
      notify(
        isLong
          ? tr('تم نسخ المختصر مع رابط استكمال الموعظة للمشاركة', 'Short teaser & continuation link copied')
          : tr(
              'تم نسخ النفحة مع رابط الموقع، جاهزة للمشاركة في الواتساب وتيليجرام',
              'Reflection & site link copied cleanly for WhatsApp and Telegram',
            ),
      );
    } catch {
      if (navigator.share) {
        try {
          await navigator.share({title: post.title, text: formatted, url: shareLink});
        } catch {
          notify(tr('تم تجهيز الرسالة للنشر', 'Message ready to share'));
        }
      } else {
        notify(tr('تم تجهيز الرسالة للنشر', 'Message ready to share'));
      }
    }

    trackInteraction('sermon_share');
    if (post.id !== 'daily_wisdom_featured') {
      void fetch(`/api/posts/${post.id}/play`, {method: 'POST'})
        .then(async (res) => {
          if (!res.ok) return;
          const data = (await res.json()) as {post?: Post};
          if (data.post) {
            setPosts((prev) => prev.map((p) => (p.id === post.id ? data.post! : p)));
          }
        })
        .catch(() => undefined);
    }
  };

  const shareAppLink = async () => {
    const shareUrl =
      activeTab === 'splash' || activeTab === 'admin-studio'
        ? getPublicSiteUrl('/?tab=home')
        : getPublicSiteUrl(`${window.location.pathname}${window.location.search || '/?tab=home'}`.replace('//', '/'));
    const shareData = {
      title: siteConfig.appName,
      text: `${siteConfig.appName} (مواعظ، مصحف، الأذكار والأدعية الجامعة، فتاوى وأذكار)\n🌐 ${shareUrl}`,
      url: shareUrl,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        trackInteraction('sermon_share', 'app_share');
        return;
      } catch {
        // Fallback to clipboard copy
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      trackInteraction('sermon_share', 'app_share');
      notify('تم نسخ رابط المنصة العام — يمكنك إرساله مباشرة للوالدة والجميع');
    } catch {
      notify('انسخ الرابط من المتصفح لمشاركته مباشرة');
    }
  };

  // Hidden Admin/Editor Gesture Handlers (zero buttons visible to visitors)
  const triggerAdminEntry = () => {
    setLoginUsername('');
    setLoginPassword('');
    setLoginError('');
    setLoginModalOpen(true);
  };

  const brandHoldTriggeredRef = useRef(false);

  const handleBrandPointerDown = () => {
    brandHoldTriggeredRef.current = false;
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
    }
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTimerRef.current = null;
      brandHoldTriggeredRef.current = true;
      tapTrackerRef.current = {count: 0, lastTs: 0};
      triggerAdminEntry();
    }, 5000);
  };

  const handleBrandPointerEnd = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleBrandTap = () => {
    handleBrandPointerEnd();
    if (brandHoldTriggeredRef.current) {
      brandHoldTriggeredRef.current = false;
      return;
    }
    const now = Date.now();
    if (now - tapTrackerRef.current.lastTs > 2500) {
      tapTrackerRef.current = {count: 1, lastTs: now};
    } else {
      tapTrackerRef.current = {count: tapTrackerRef.current.count + 1, lastTs: now};
    }
    if (tapTrackerRef.current.count >= 5) {
      tapTrackerRef.current = {count: 0, lastTs: 0};
      triggerAdminEntry();
    }
  };

  const submitAdminLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!loginUsername.trim() || !loginPassword.trim()) {
      setLoginError('أدخل اسم المستخدم وكلمة المرور');
      return;
    }
    setVerifyingLogin(true);
    setLoginError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          username: loginUsername.trim(),
          password: loginPassword.trim(),
        }),
      });
      if (!res.ok) {
        setLoginError('اسم المستخدم أو كلمة المرور غير صحيحة');
        return;
      }
      const data = (await res.json()) as {
        token: string;
        username: string;
        role: AdminRole;
        assignedSection?: AdminSectionScope;
        permissions?: AdminPermission[];
        isFounder?: boolean;
        suggestions?: SuggestionItem[];
        volunteers?: VolunteerItem[];
        automationSettings?: AutomationSettings;
        siteAppearance?: SiteAppearanceConfig;
        meetConfig?: AdminMeetConfig;
      };
      setAuthToken(data.token);
      setAdminUsername(data.username);
      setAdminRole(data.role);
      const scope = data.assignedSection || 'all';
      setAssignedSection(scope);
      const nextPerms = Array.isArray(data.permissions) ? data.permissions : [];
      const nextIsFounder = Boolean(data.isFounder || data.username === 'moalwbri');
      setAdminPermissions(nextPerms);
      setIsFounder(nextIsFounder);
      setSuggestions(data.suggestions || []);
      setVolunteers(data.volunteers || []);
      if (data.automationSettings) setAutomationSettings(data.automationSettings);
      if (data.siteAppearance) setSiteAppearance({...DEFAULT_SITE_APPEARANCE, ...data.siteAppearance});
      if (data.meetConfig) setMeetConfig(data.meetConfig);
      try {
        window.localStorage.setItem(
          ADMIN_SESSION_KEY,
          JSON.stringify({
            token: data.token,
            username: data.username,
            role: data.role,
            assignedSection: scope,
            permissions: nextPerms,
            isFounder: nextIsFounder,
          }),
        );
      } catch {
        // ignore
      }
      setLoginModalOpen(false);
      setAdminInitialTab('studio');
      setActiveTab('admin-studio');
    } catch {
      setLoginError('تعذر الاتصال بالخادم، تأكد من توفر الإنترنت');
    } finally {
      setVerifyingLogin(false);
    }
  };

  const logoutAdmin = () => {
    setAuthToken(null);
    setAdminPermissions([]);
    setIsFounder(false);
    setEditingPostForAdmin(null);
    try {
      window.localStorage.removeItem(ADMIN_SESSION_KEY);
    } catch {
      // ignore
    }
    navigateTo('home');
    notify('تم تسجيل خروج المشرف بنجاح');
  };

  const handleAdminAutoPost = async (postId: string) => {
    if (!authToken) return;
    try {
      const res = await fetch('/api/admin/auto-post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({postId}),
      });
      const data = (await res.json()) as {ok?: boolean; error?: string; platforms?: string[]};
      if (!res.ok) {
        notify(data.error || 'تعذر النشر الآلي للموعظة');
        return;
      }
      notify(`تم إرسال الموعظة آلياً (${(data.platforms || []).join(' · ') || 'Webhook'})`);
    } catch {
      notify('تعذر الاتصال بخادم النشر الآلي');
    }
  };

  const handleAdminToggleHidePost = async (postId: string) => {
    if (!authToken) return;
    try {
      const res = await fetch(`/api/admin/posts/${postId}/visibility`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({}),
      });
      const data = (await res.json()) as {
        post?: Post;
        requiresApproval?: boolean;
        message?: string;
        error?: string;
      };
      if (res.status === 202 || data.requiresApproval) {
        notify(data.message || 'تم إرسال طلب تغيير الظهور إلى المسؤول الأول للموافقة.');
        return;
      }
      if (!res.ok) {
        notify(data.error || 'تعذر تغيير حالة إخفاء الموعظة');
        return;
      }
      if (data.post) {
        setPosts((prev) => prev.map((p) => (p.id === postId ? data.post! : p)));
        notify(data.post.hidden ? 'تم إخفاء الموعظة عن الزوار' : 'تم إظهار الموعظة للزوار');
      }
    } catch {
      notify('تعذر الاتصال بالخادم');
    }
  };

  const handleAdminDeletePost = async (postId: string) => {
    if (!authToken) return;
    try {
      const res = await fetch(`/api/posts/${postId}`, {
        method: 'DELETE',
        headers: {Authorization: `Bearer ${authToken}`},
      });
      const data = (await res.json()) as {requiresApproval?: boolean; message?: string; error?: string};
      if (res.status === 202 || data.requiresApproval) {
        notify(data.message || 'تم إرسال طلب الحذف إلى المسؤول الأول للموافقة.');
        return;
      }
      if (!res.ok) {
        notify(data.error || 'تعذر حذف الموعظة');
        return;
      }
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      if (selectedPostId === postId) {
        setSelectedPostId(null);
        navigateTo('home');
      }
      notify('تم حذف الموعظة بنجاح');
    } catch {
      notify('تعذر الاتصال بالخادم');
    }
  };

  const handleAdminEditPost = (post: Post) => {
    setEditingPostForAdmin(post);
    setAdminInitialTab('studio');
    setActiveTab('admin-studio');
    window.scrollTo({top: 0, behavior: 'smooth'});
  };

  const handleAdminUpdateComment = async (postId: string, commentId: string, text: string) => {
    if (!authToken) return;
    const res = await fetch(`/api/admin/posts/${postId}/comments/${commentId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({text}),
    });
    if (res.ok) {
      const data = (await res.json()) as {post?: Post};
      if (data.post) setPosts((prev) => prev.map((p) => (p.id === postId ? data.post! : p)));
      notify('تم تعديل التعليق بنجاح');
    }
  };

  const handleAdminToggleHideComment = async (postId: string, commentId: string) => {
    if (!authToken) return;
    const res = await fetch(`/api/admin/posts/${postId}/comments/${commentId}/visibility`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({}),
    });
    if (res.ok) {
      const data = (await res.json()) as {post?: Post};
      if (data.post) setPosts((prev) => prev.map((p) => (p.id === postId ? data.post! : p)));
      notify('تم تحديث حالة ظهور التعليق');
    }
  };

  const handleAdminDeleteComment = async (postId: string, commentId: string) => {
    if (!authToken) return;
    const res = await fetch(`/api/admin/posts/${postId}/comments/${commentId}`, {
      method: 'DELETE',
      headers: {Authorization: `Bearer ${authToken}`},
    });
    if (res.ok) {
      const data = (await res.json()) as {post?: Post};
      if (data.post) setPosts((prev) => prev.map((p) => (p.id === postId ? data.post! : p)));
      notify('تم حذف التعليق');
    }
  };

  const handleSaveAppearance = async (next: SiteAppearanceConfig) => {
    if (!authToken) return;
    const res = await fetch('/api/admin/appearance', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(next),
    });
    if (!res.ok) {
      notify('تعذر حفظ إعدادات المظهر والصيانة');
      return;
    }
    const data = (await res.json()) as {siteAppearance?: SiteAppearanceConfig};
    if (data.siteAppearance) {
      setSiteAppearance({...DEFAULT_SITE_APPEARANCE, ...data.siteAppearance});
    }
    notify('تم حفظ إعدادات المظهر والسطوع والتنبيه العام');
  };

  const handleSaveAutomation = async (next: AutomationSettings) => {
    if (!authToken) return;
    const res = await fetch('/api/admin/automation', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(next),
    });
    if (!res.ok) {
      notify('تعذر حفظ إعدادات البوت والإشعارات الصامتة');
      return;
    }
    const data = (await res.json()) as {automationSettings?: AutomationSettings};
    if (data.automationSettings) {
      setAutomationSettings(data.automationSettings);
    }
    notify('تم حفظ إعدادات النشر الآلي والتنبيه الصامت للمشرف');
  };

  const handleSaveSiteConfig = async (nextConfig: SiteConfig) => {
    if (!authToken) return;
    const res = await fetch('/api/admin/site-config', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(nextConfig),
    });
    if (!res.ok) {
      notify('تعذر حفظ تعديلات الصفحة');
      return;
    }
    const data = (await res.json()) as {siteConfig: SiteConfig};
    setSiteConfig({...DEFAULT_SITE_CONFIG, ...data.siteConfig});
    notify('تم حفظ تعديلات الصفحة والأزرار والمسميات على نفس الرابط العام');
  };

  const handleUpdateSettings = async (
    nextGesture: AdminGesture,
    targetUsername?: string,
    newPassword?: string,
  ) => {
    if (!authToken) return;
    const res = await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({gesture: nextGesture, targetUsername, newPassword}),
    });
    if (res.ok) {
      setGesture(nextGesture);
    }
  };

  const handleSaveCustomization = async (payload: {
    brandHandle: string;
    socialLinks: SocialLink[];
    appIcons: AppIcons;
  }) => {
    if (!authToken) return;
    const res = await fetch('/api/admin/customization', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      notify('تعذر حفظ التعديلات حالياً');
      return;
    }
    const data = (await res.json()) as {
      brandHandle: string;
      socialLinks: SocialLink[];
      appIcons: AppIcons;
    };
    setBrandHandle(data.brandHandle);
    setSocialLinks(data.socialLinks);
    setAppIcons({...DEFAULT_APP_ICONS, ...data.appIcons});
    notify('تم حفظ الروابط والأيقونات المخصصة بنجاح في التطبيق');
  };

  const handleAdminRefreshNafahat = async (): Promise<{ok: boolean; message: string}> => {
    if (!authToken) {
      return {ok: false, message: 'يلزم تسجيل الدخول كمسؤول أو محرر'};
    }
    try {
      const res = await fetch('/api/admin/nafahat/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
      });
      const data = (await res.json()) as {
        error?: string;
        siteConfig?: SiteConfig;
        post?: Post;
        posts?: Post[];
        nafahatMeta?: NafahatMeta;
      };
      if (!res.ok) {
        return {
          ok: false,
          message: data.error || 'تعذر توليد نفحة جديدة بالذكاء الاصطناعي حالياً',
        };
      }
      if (data.siteConfig) {
        setSiteConfig({...DEFAULT_SITE_CONFIG, ...data.siteConfig});
      }
      if (Array.isArray(data.posts) && data.posts.length > 0) {
        setPosts(data.posts);
      } else if (data.post) {
        setPosts((prev) => [data.post!, ...prev.filter((p) => p.id !== data.post!.id)]);
      }
      if (data.nafahatMeta) {
        setNafahatMeta(data.nafahatMeta);
      }
      return {
        ok: true,
        message: 'تم تحديث «نفحات متجددة» والمواعظ والقصص بالذكاء الاصطناعي بنجاح ونشرها في الصفحة الرئيسية',
      };
    } catch {
      return {
        ok: false,
        message: 'تعذر الاتصال بالخادم لتحديث النفحات بالذكاء الاصطناعي',
      };
    }
  };

  const handleAdminRefreshDawahCardsWithResult = async (): Promise<{ok: boolean; message: string}> => {
    if (!authToken) {
      return {ok: false, message: 'يلزم تسجيل الدخول كمسؤول أو مشرف'};
    }
    try {
      const res = await fetch('/api/admin/dawah-cards/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({count: 6}),
      });
      const data = (await res.json()) as {
        error?: string;
        added?: ClassicDawahCard[];
        aiDawahCards?: ClassicDawahCard[];
        dawahCardsMeta?: DawahCardsMeta;
      };
      if (!res.ok) {
        return {
          ok: false,
          message: data.error || 'تعذر تجديد البطاقات الدعوية والأحاديث بالذكاء الاصطناعي حالياً',
        };
      }
      if (Array.isArray(data.aiDawahCards)) {
        setAiDawahCards(filterConciseDawahCards(data.aiDawahCards));
      }
      if (data.dawahCardsMeta) {
        setDawahCardsMeta(data.dawahCardsMeta);
      }
      const addedLen = Array.isArray(data.added) ? data.added.length : 0;
      return {
        ok: true,
        message:
          addedLen > 0
            ? `تم توليد ${addedLen} بطاقات وأحاديث صحيحة جديدة غير مكررة ونشرها لجميع الزوار`
            : 'تم التحقق من البطاقات الدعوية وهي محدثة ومتنوعة دون تكرار',
      };
    } catch {
      return {
        ok: false,
        message: 'تعذر الاتصال بالخادم لتحديث البطاقات الدعوية',
      };
    }
  };

  const handleAdminRefreshDawahCards = async (): Promise<void> => {
    const result = await handleAdminRefreshDawahCardsWithResult();
    notify(result.message);
  };

  const selectedPost = posts.find((p) => p.id === selectedPostId) || null;

  useEffect(() => {
    if (activeTab === 'post-detail' && !selectedPost && !isSyncing) {
      setActiveTab('home');
      setSelectedPostId(null);
    }
  }, [activeTab, selectedPost, isSyncing]);

  if (activeTab === 'splash') {
    return <SplashScreen onFinish={finishSplash} />;
  }

  type MainHubId = 'hub_quran' | 'hub_knowledge' | 'hub_quiz' | 'hub_media' | 'hub_support';

  interface HubSubItem {
    key: string;
    tab: NavTab;
    label: string;
    Icon: ReturnType<typeof resolveIcon>;
    libraryFilter?: LibraryFilterType;
    aboutSub?: 'about' | 'support' | 'share' | 'disclaimer';
  }

  interface MainHubDef {
    id: MainHubId;
    label: string;
    shortLabel: string;
    defaultTab: NavTab;
    Icon: ReturnType<typeof resolveIcon>;
    subItems: HubSubItem[];
  }

  const mainHubs: MainHubDef[] = [
    {
      id: 'hub_quran',
      label: tr('المصحف', 'The Noble Quran'),
      shortLabel: tr('المصحف', 'Quran'),
      defaultTab: 'quran',
      Icon: resolveIcon(appIcons.quran, 'bookOpen'),
      subItems: [
        {
          key: 'sub_quran',
          tab: 'quran',
          label: tr('المصحف الشريف الشامل', 'Noble Quran (Tafsir & Search)'),
          Icon: resolveIcon(appIcons.quran, 'bookOpen'),
        },
        {
          key: 'sub_wird',
          tab: 'wird',
          label: tr('الورد اليومي التفاعلي', 'Daily Wird & Faith Tasks'),
          Icon: Sparkles,
        },
      ],
    },
    {
      id: 'hub_knowledge',
      label: tr('الأذكار والمواعظ والمكتبات العلمية والدعوية', 'Adhkar, Sermons & Libraries'),
      shortLabel: tr('الأذكار والمكتبات', 'Adhkar & Library'),
      defaultTab: 'adhkar',
      Icon: BookOpen,
      subItems: [
        {
          key: 'sub_adhkar',
          tab: 'adhkar',
          label: tr('الأذكار والأدعية الجامعة', 'Comprehensive Adhkar & Duas'),
          Icon: resolveIcon(appIcons.adhkar, 'sun'),
        },
        {
          key: 'sub_archive',
          tab: 'archive',
          label: tr('الأرشيف الشامل الدائم', 'Permanent Archive'),
          Icon: Archive,
        },
        {
          key: 'sub_hajouri',
          tab: 'library',
          label: tr('مكتبة الشيخ يحيى الحجوري', 'Sh. Yahya Al-Hajouri Library'),
          Icon: BookOpen,
          libraryFilter: 'hajouri',
        },
        {
          key: 'sub_imams',
          tab: 'library',
          label: tr('مكتبة الأئمة الكبار', 'Senior Imams Library'),
          Icon: BookOpen,
          libraryFilter: 'imams',
        },
        {
          key: 'sub_sada',
          tab: 'library',
          label: tr('خدمة صدى الخير الدعوية', 'Sada Al-Khair Service'),
          Icon: Sparkles,
          libraryFilter: 'sada',
        },
        {
          key: 'sub_fatawa',
          tab: 'fatawa',
          label: tr(siteConfig.navFatawa, 'Fatawa'),
          Icon: resolveIcon(appIcons.fatawa, 'scale'),
        },
        {
          key: 'sub_bookmarks',
          tab: 'bookmarks',
          label: tr('المحفوظات والمفضلة', 'Bookmarks & Saved'),
          Icon: resolveIcon(appIcons.bookmarks, 'bookmark'),
        },
      ],
    },
    {
      id: 'hub_quiz',
      label: tr('الاختبار الدعوي اليومي', 'Daily Dawah Quiz'),
      shortLabel: tr('الاختبار', 'Quiz'),
      defaultTab: 'quiz',
      Icon: GraduationCap,
      subItems: [
        {
          key: 'sub_quiz',
          tab: 'quiz',
          label: tr('الاختبار الدعوي ولوحة المتصدرين', 'Dawah Quiz & Leaderboard'),
          Icon: GraduationCap,
        },
      ],
    },
    {
      id: 'hub_media',
      label: tr('البطاقات والواحات والمرئيات', 'Cards, Oases & Media'),
      shortLabel: tr('البطاقات والمرئيات', 'Cards & Media'),
      defaultTab: 'cards',
      Icon: Compass,
      subItems: [
        {
          key: 'sub_cards',
          tab: 'cards',
          label: tr('البطاقات الدعوية الكلاسيكية', 'Classic Dawah Cards'),
          Icon: ImageIcon,
        },
        {
          key: 'sub_mother',
          tab: 'mother-oasis',
          label: tr('واحة الداعية الفاضلة أمي', "Mother's Oasis"),
          Icon: Flower2,
        },
        {
          key: 'sub_deaf',
          tab: 'deaf-mute',
          label: tr('قسم الصم والبكم', 'Deaf & Mute Section'),
          Icon: HandHeart,
        },
        {
          key: 'sub_poetry',
          tab: 'poetry',
          label: tr('واحة الشعر والطرائف', 'Poetry & Anecdotes'),
          Icon: Feather,
        },
        {
          key: 'sub_channels',
          tab: 'channels',
          label: tr('الصوتيات ومشغل تيليجرام', 'Audio & Telegram Player'),
          Icon: resolveIcon(appIcons.channels, 'share2'),
        },
        {
          key: 'sub_videos',
          tab: 'videos',
          label: tr('المرئيات', 'Videos'),
          Icon: Video,
        },
      ],
    },
    {
      id: 'hub_support',
      label: tr('الدعم والتواصل وعن الموقع', 'Support, Contact & About'),
      shortLabel: tr('الدعم وعن الموقع', 'Support & About'),
      defaultTab: 'about-support',
      Icon: LifeBuoy,
      subItems: [
        {
          key: 'sub_tickets',
          tab: 'support',
          label: tr('سجل ومتابعة الطلبات', 'Requests & Tracking'),
          Icon: LifeBuoy,
          aboutSub: 'support',
        },
        {
          key: 'sub_reviews',
          tab: 'reviews',
          label: tr('آراء وتقييمات الزوار', 'Visitor Reviews'),
          Icon: Star,
        },
        {
          key: 'sub_about',
          tab: 'about',
          label: tr('من نحن ومشاركة التطبيق', 'About & Share App'),
          Icon: resolveIcon(appIcons.about, 'info'),
          aboutSub: 'about',
        },
        {
          key: 'sub_disclaimer',
          tab: 'about-support',
          label: tr('التنويه العلمي وحقوق 2027', 'Disclaimer & 2027 Rights'),
          Icon: Shield,
          aboutSub: 'disclaimer',
        },
      ],
    },
  ];

  const activeHubId: MainHubId =
    activeTab === 'quran' || activeTab === 'wird'
      ? 'hub_quran'
      : activeTab === 'quiz'
        ? 'hub_quiz'
        : activeTab === 'cards' ||
            activeTab === 'mother-oasis' ||
            activeTab === 'deaf-mute' ||
            activeTab === 'poetry' ||
            activeTab === 'videos' ||
            activeTab === 'channels'
          ? 'hub_media'
          : activeTab === 'about-support' ||
              activeTab === 'about' ||
              activeTab === 'support' ||
              activeTab === 'reviews'
            ? 'hub_support'
            : 'hub_knowledge';

  const activeHub = mainHubs.find((h) => h.id === activeHubId) || mainHubs[1];

  const isSubItemCurrent = (sub: HubSubItem): boolean => {
    if (sub.tab === 'library') {
      return activeTab === 'library' && (!sub.libraryFilter || libraryInitialFilter === sub.libraryFilter);
    }
    if (sub.key === 'sub_tickets') {
      return (activeTab === 'about-support' || activeTab === 'support') && aboutSubTab === 'support';
    }
    if (sub.key === 'sub_about') {
      return (activeTab === 'about-support' || activeTab === 'about') && aboutSubTab === 'about';
    }
    if (sub.key === 'sub_disclaimer') {
      return activeTab === 'about-support' && aboutSubTab === 'disclaimer';
    }
    return activeTab === sub.tab;
  };

  const handleRequestSolarLocation = async () => {
    if (solarLocating) return;
    setSolarLocating(true);
    try {
      const coords = await requestDeviceSolarCoords();
      setSolarCoords(coords);
      setSolarTick((t) => t + 1);
      const win = computeSolarWindow(coords, new Date(), isEn);
      notify(
        tr(
          `تم تحديث موقعك — الشروق ${win.sunriseLabel} والغروب ${win.sunsetLabel}`,
          `Location updated — Sunrise ${win.sunriseLabel}, Sunset ${win.sunsetLabel}`,
        ),
      );
    } catch (err) {
      notify(
        err instanceof Error
          ? err.message
          : tr('تعذر تحديد الموقع الجغرافي حالياً', 'Could not determine location'),
      );
    } finally {
      setSolarLocating(false);
    }
  };

  const applyThemeMode = (mode: ThemeMode) => {
    setThemeMode(mode);
    if (mode === 'solar') {
      if (!solarCoords) {
        void handleRequestSolarLocation();
      }
      notify(
        tr(
          `تم تفعيل التبديل التلقائي حسب الشروق (${solarWindow.sunriseLabel}) والغروب (${solarWindow.sunsetLabel})`,
          `Auto theme enabled for Sunrise (${solarWindow.sunriseLabel}) & Sunset (${solarWindow.sunsetLabel})`,
        ),
      );
      return;
    }
    notify(
      mode === 'system'
        ? tr('تم تفعيل المظهر التلقائي حسب إعدادات نظام التشغيل', 'System theme mode enabled')
        : mode === 'light'
          ? tr('تم التبديل إلى الوضع النهاري', 'Switched to Light Mode')
          : tr('تم التبديل إلى الوضع الليلي', 'Switched to Dark Mode'),
    );
  };

  const cycleThemeMode = () => {
    applyThemeMode(
      themeMode === 'system'
        ? 'light'
        : themeMode === 'light'
          ? 'dark'
          : themeMode === 'dark'
            ? 'solar'
            : 'system',
    );
  };

  const handleToggleLanguage = () => {
    setLanguageModalOpen(true);
  };

  const displayAppName = tr(siteConfig.appName, 'Mawaedh & Ibar');

  const presetBgClass =
    pageColor !== 'default'
      ? pageColorOption.bgClass
      : siteAppearance.backgroundPreset === 'emerald_mist'
        ? 'bg-[#f2faf6] dark:bg-[#173329]'
        : siteAppearance.backgroundPreset === 'warm_parchment'
          ? 'bg-[#fbf7ef] dark:bg-[#2b241b]'
          : siteAppearance.backgroundPreset === 'sky_calm'
            ? 'bg-[#f3f9fd] dark:bg-[#192c3b]'
            : siteAppearance.backgroundPreset === 'deep_forest'
              ? 'bg-[#eef6f1] dark:bg-[#142b23]'
              : 'bg-[#FFFFFF] dark:bg-[#162822]';

  const handleOpenSettingsTab = (section: AppSettingsSection = 'settings') => {
    openSettingsModal(section);
  };

  const newTicketsCount =
    suggestions.filter((s) => (s.status || 'new') === 'new').length +
    volunteers.filter((v) => (v.status || 'new') === 'new').length;

  const safeBrightness =
    typeof siteAppearance.brightness === 'number' && Number.isFinite(siteAppearance.brightness)
      ? Math.min(120, Math.max(70, siteAppearance.brightness))
      : 100;

  return (
    <div
      style={safeBrightness !== 100 ? {filter: `brightness(${safeBrightness}%)`} : undefined}
      className={`min-h-[calc(100dvh-80px)] ${presetBgClass} text-[#0e1d25] dark:text-[#e3f3fe] flex flex-col lg:flex-row transition-colors`}
    >
      {/* Android WebView Top Safe Area Shield (40px) */}
      <div
        className={`fixed top-0 left-0 right-0 h-[40px] z-40 ${presetBgClass} pointer-events-none`}
        aria-hidden="true"
      />

      {/* Desktop Direction-Aware Sidebar (4 Main Hubs + Active Hub Quick Sub-Sections) */}
      <aside
        className={`hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:top-[40px] lg:bottom-[40px] z-40 bg-white dark:bg-[#1b3029] border-slate-200/80 dark:border-white/10 p-4 justify-between overflow-y-auto ${
          isEn ? 'lg:left-0 border-r' : 'lg:right-0 border-l'
        }`}
      >
        <div className="space-y-4">
          <button
            type="button"
            onPointerDown={handleBrandPointerDown}
            onPointerUp={handleBrandPointerEnd}
            onPointerLeave={handleBrandPointerEnd}
            onClick={() => {
              handleBrandTap();
              navigateTo('home');
            }}
            className="flex items-center gap-2.5 w-full text-start select-none px-1"
            title={displayAppName}
          >
            <BrandEmblem className="w-7 h-7 shrink-0" variant={appIcons.brandEmblem} />
            <span className="text-lg font-bold text-[#006a46] dark:text-[#6cdba6] whitespace-nowrap">
              {displayAppName}
            </span>
          </button>

          <nav className="space-y-2" aria-label={tr('الأقسام الرئيسية', 'Main Hubs Navigation')}>
            <button
              type="button"
              onClick={() => navigateTo('home')}
              className={`w-full min-h-[42px] px-3 py-2 rounded-xl text-[13px] font-extrabold flex items-center gap-2.5 transition-colors text-start ${
                activeTab === 'home'
                  ? 'bg-[#006a46] text-white shadow-xs'
                  : 'bg-[#f4faff] dark:bg-[#223a32] text-[#0e1d25] dark:text-slate-100 hover:bg-[#e2f5ec] dark:hover:bg-white/10'
              }`}
            >
              <HomeIcon className="w-4 h-4 shrink-0" />
              <span className="flex-1 leading-snug">{tr('الصفحة الرئيسية', siteConfig.navHome || 'الرئيسية')}</span>
            </button>

            {mainHubs.map((hub) => {
              const Icon = hub.Icon;
              const isHubCurrent = activeTab !== 'home' && activeHubId === hub.id;
              return (
                <div key={hub.id} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (hub.defaultTab === 'library') setLibraryInitialFilter('all');
                      navigateTo(hub.defaultTab);
                    }}
                    className={`w-full min-h-[42px] px-3 py-2 rounded-xl text-[13px] font-extrabold flex items-center gap-2.5 transition-colors text-start ${
                      isHubCurrent
                        ? 'bg-[#006a46] text-white shadow-xs'
                        : 'bg-[#f4faff] dark:bg-[#223a32] text-[#0e1d25] dark:text-slate-100 hover:bg-[#e2f5ec] dark:hover:bg-white/10'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="flex-1 leading-snug">{hub.label}</span>
                  </button>

                  {isHubCurrent && (
                    <div className="ps-3 space-y-1 border-s-2 border-[#006a46]/25 dark:border-[#6cdba6]/25">
                      {hub.subItems.map((sub) => {
                        const SubIcon = sub.Icon;
                        const current = isSubItemCurrent(sub);
                        return (
                          <button
                            key={sub.key}
                            type="button"
                            onClick={() =>
                              navigateTo(sub.tab, {
                                libraryFilter: sub.libraryFilter,
                                aboutSub: sub.aboutSub,
                              })
                            }
                            className={`w-full min-h-[34px] px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors text-start ${
                              current
                                ? 'bg-[#e2f5ec] dark:bg-emerald-950/60 text-[#006a46] dark:text-[#6cdba6] font-extrabold'
                                : 'text-[#3e4a42] dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
                            }`}
                          >
                            <SubIcon className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{sub.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        <div className="space-y-2.5 pt-4 border-t border-slate-200/80 dark:border-white/10">
          {/* Permanent Admin Return & Logout Box when authenticated */}
          {authToken && (
            <div className="rounded-xl bg-[#071510] text-white p-2.5 space-y-1.5 border border-emerald-800/50">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => navigateTo('admin-studio')}
                  className="text-xs font-extrabold text-emerald-300 hover:text-white flex items-center gap-1.5"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>{tr('لوحة المشرف', 'Admin Studio')}</span>
                </button>
                {newTicketsCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-md bg-amber-400 text-slate-950 text-[10px] font-extrabold">
                    {formatNumber(newTicketsCount)}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={logoutAdmin}
                className="w-full min-h-[34px] px-2.5 py-1 rounded-lg bg-rose-600/90 hover:bg-rose-600 text-white text-[11px] font-bold flex items-center justify-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>🚪 تسجيل خروج المشرف</span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('splash')}
            className="w-full min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-medium text-[#6e7a71] dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 flex items-center justify-between transition-colors"
          >
            <span>{tr('معاينة شاشة البداية', 'Welcome Screen')}</span>
            <Sparkles className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col min-h-[calc(100dvh-80px)] ${isEn ? 'lg:pl-64' : 'lg:pr-64'}`}>
        {/* Top Bar (Sticky) */}
        <header className="sticky top-[40px] z-30 h-14 bg-[#FFFFFF]/95 dark:bg-[#162822]/95 backdrop-blur-xl border-b border-slate-200/70 dark:border-white/10 px-3 sm:px-6 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onPointerDown={handleBrandPointerDown}
              onPointerUp={handleBrandPointerEnd}
              onPointerLeave={handleBrandPointerEnd}
              onClick={() => {
                handleBrandTap();
                navigateTo('home');
              }}
              className="lg:hidden flex items-center gap-1.5 select-none shrink-0"
            >
              <BrandEmblem className="w-6 h-6 shrink-0" variant={appIcons.brandEmblem} />
              <span className="text-sm sm:text-base font-bold text-[#006a46] dark:text-[#6cdba6] whitespace-nowrap">
                {displayAppName}
              </span>
            </button>

            <span className="hidden lg:inline text-sm font-bold text-[#0e1d25] dark:text-white whitespace-nowrap truncate">
              {activeTab === 'home' && tr(siteConfig.navHome || 'الصفحة الرئيسية', 'Home')}
              {activeTab === 'quran' && tr('المصحف الشريف (يعمل بدون إنترنت)', 'Noble Quran (Offline Ready)')}
              {activeTab === 'wird' && tr('الورد اليومي من القرآن الكريم', 'Daily Quran Wird')}
              {activeTab === 'quiz' && tr('الاختبار الدعوي اليومي ولوحة المتصدرين', 'Daily Dawah Quiz & Leaderboard')}
              {activeTab === 'hisn' && tr('الأذكار والأدعية الجامعة', 'Comprehensive Adhkar & Duas')}
              {activeTab === 'fatawa' &&
                tr(`${siteConfig.fatawaTitle} · الشيخ يحيى الحجوري وكبار العلماء`, 'Scholars Fatawa · Global Archive')}
              {activeTab === 'adhkar' &&
                tr('الأذكار والأدعية الجامعة', 'Comprehensive Adhkar & Duas')}
              {activeTab === 'library' && tr(siteConfig.sadaTitle, 'Sada Al-Khair & Scholarly Portals')}
              {activeTab === 'cards' && tr('البطاقات الدعوية الكلاسيكية', 'Classic Dawah Cards')}
              {activeTab === 'mother-oasis' && tr('واحة وقصص الوالدة: أم محمد', "Mother's Stories Oasis")}
              {activeTab === 'poetry' && tr('واحة الشعر والطرائف', 'Poetry & Anecdotes Oasis')}
              {activeTab === 'archive' && tr('الأرشيف الشامل الدائم', 'Permanent AI Archive')}
              {activeTab === 'videos' && tr('المقاطع المرئية والدعوية', 'Video Library')}
              {activeTab === 'deaf-mute' && tr('واحة الصم والبكم · بإشراف إدارة القسم', 'Deaf & Mute Oasis')}
              {activeTab === 'reviews' && tr('آراء الزوار وتقييمهم', 'Visitor Reviews')}
              {activeTab === 'channels' && tr(siteConfig.channelsTitle, 'Official Channels & Community')}
              {activeTab === 'bookmarks' && tr(`${siteConfig.navBookmarks} والمفضلة`, 'Saved & Bookmarks')}
              {(activeTab === 'about-support' || activeTab === 'about' || activeTab === 'support') &&
                tr('عن الموقع والدعم والمشاركة', 'About, Support & Share')}
              {activeTab === 'post-detail' && tr('تفاصيل الموعظة', 'Reflection Details')}
              {activeTab === 'admin-studio' &&
                (adminRole === 'admin'
                  ? tr('لوحة المدير والمسؤول الأول', 'Manager & Primary Admin Studio')
                  : tr('لوحة المشرف ومحرر المحتوى', 'Supervisor & Editor Studio'))}
            </span>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {searchOpen && (
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (activeTab !== 'home') setActiveTab('home');
                }}
                placeholder={tr('ابحث في المواعظ...', 'Search sermons...')}
                className="w-24 sm:w-44 min-h-[36px] px-2.5 rounded-xl bg-white dark:bg-[#223a32] border border-slate-200 dark:border-white/10 text-xs focus:outline-none focus:border-[#006a46]"
              />
            )}

            {/* Global Manual Font Size Controls (Visible on Mobile & Desktop): A+ | px | A- */}
            <div
              role="group"
              aria-label="التحكم اليدوي بحجم الخط"
              className="flex items-center gap-0.5 rounded-xl bg-[#eef7f3] dark:bg-[#28453b] border border-emerald-700/15 p-0.5"
            >
              <button
                type="button"
                onClick={() => {
                  stepFontSize('up');
                  notify(`تم تكبير خط التطبيق (${Math.min(MAX_FONT_SIZE_PX, activeFontSizePx + 2)}px)`);
                }}
                title="تكبير خط التطبيق (A+)"
                className="min-h-[28px] px-1.5 sm:px-2 rounded-lg text-[11px] font-extrabold text-[#006a46] dark:text-[#6cdba6] hover:bg-white dark:hover:bg-white/10"
              >
                A+
              </button>
              <button
                type="button"
                onClick={() => openSettingsModal('settings')}
                title="تعديل حجم الخط يدوياً من الإعدادات"
                className={`min-h-[28px] px-1.5 sm:px-2 rounded-lg text-[10px] sm:text-[11px] font-extrabold tabular-nums ${
                  activeFontSizePx === DEFAULT_FONT_SIZE_PX
                    ? 'bg-[#006a46] text-white'
                    : 'bg-amber-100 dark:bg-amber-950/60 text-[#7c5800] dark:text-[#ffdea8]'
                }`}
              >
                {activeFontSizePx}px
              </button>
              <button
                type="button"
                onClick={() => {
                  stepFontSize('down');
                  notify(`تم تصغير خط التطبيق (${Math.max(MIN_FONT_SIZE_PX, activeFontSizePx - 2)}px)`);
                }}
                title="تصغير خط التطبيق (A-)"
                className="min-h-[28px] px-1.5 sm:px-2 rounded-lg text-[11px] font-extrabold text-[#006a46] dark:text-[#6cdba6] hover:bg-white dark:hover:bg-white/10"
              >
                A-
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                if (searchOpen && searchQuery) setSearchQuery('');
                setSearchOpen((v) => !v);
              }}
              aria-label={tr('بحث', 'Search')}
              className="min-w-[34px] min-h-[34px] rounded-full hover:bg-[#e8f6ff] dark:hover:bg-white/10 flex items-center justify-center transition-colors"
            >
              {searchOpen ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
            </button>

            {/* Permanent Reminder & Display Settings Button in Top Header */}
            <button
              type="button"
              onClick={() => handleOpenSettingsTab('settings')}
              aria-label="المنبّه الدعوي والإعدادات"
              title="المنبّه الدعوي والإعدادات"
              className="relative min-h-[36px] px-2.5 rounded-xl bg-[#fffbf2] hover:bg-[#ffdea8]/80 dark:bg-[#1a2921] dark:hover:bg-[#23382d] border border-[#f2be5e]/45 text-[#7c5800] dark:text-[#ffdea8] text-xs font-extrabold flex items-center gap-1.5 whitespace-nowrap transition-colors"
            >
              <Settings className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden xl:inline">{tr('المنبّه الدعوي والإعدادات', 'Reminder & Settings')}</span>
              {reminderSettings.enabled && (
                <span className="w-2 h-2 rounded-full bg-[#008559] shrink-0" aria-hidden="true" />
              )}
            </button>

            {/* Registration / Sign-In Button in Top Header (تسجيل / دخول) */}
            <button
              type="button"
              onClick={() => setVisitorAuthModalOpen(true)}
              aria-label={visitorProfile ? visitorProfile.name : tr('تسجيل / دخول', 'Register / Sign In')}
              title={visitorProfile ? visitorProfile.name : tr('تسجيل / دخول', 'Register / Sign In')}
              className="min-h-[36px] px-2.5 rounded-xl bg-[#eefaf3] hover:bg-[#d8efe5] dark:bg-[#28453b] border border-[#006a46]/25 text-[#006a46] dark:text-[#6cdba6] text-xs font-extrabold flex items-center gap-1.5 whitespace-nowrap transition-colors max-w-[140px]"
            >
              <UserCheck className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                {visitorProfile ? visitorProfile.name : tr('تسجيل', 'Register')}
              </span>
            </button>

            {authToken && activeTab !== 'admin-studio' && (
              <button
                type="button"
                onClick={() => navigateTo('admin-studio')}
                title="العودة للوحة المشرف"
                className="min-h-[36px] px-2.5 rounded-xl bg-[#071510] text-emerald-300 hover:text-white text-xs font-extrabold flex items-center gap-1.5 whitespace-nowrap"
              >
                <Shield className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">{tr('لوحة المشرف', 'Studio')}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setLanguageModalOpen(true)}
              aria-label={tr('تغيير لغة الموقع', 'Switch Site Language')}
              title={tr('تغيير لغة الموقع', 'Switch Site Language')}
              className="min-h-[36px] px-2.5 rounded-xl bg-[#eef7f3] hover:bg-[#d8efe5] dark:bg-[#28453b] border border-emerald-700/15 text-[#006a46] dark:text-[#6cdba6] text-xs font-extrabold flex items-center gap-1 whitespace-nowrap transition-colors"
            >
              <Globe className="w-3.5 h-3.5 shrink-0" />
              <span>{langMeta.shortCode}</span>
            </button>

            {(isOfflineMode || !isOnline) && (
              <button
                type="button"
                onClick={() => void syncBootstrap({showFeedback: true})}
                title={tr('وضع التصفح بدون إنترنت — اضغط للتحديث عند عودة الشبكة', 'Offline mode — tap to sync')}
                className="min-h-[34px] px-2 py-1 rounded-xl bg-[#ffdea8] text-[#271900] text-xs font-bold flex items-center gap-1 whitespace-nowrap"
              >
                <WifiOff className="w-3.5 h-3.5" />
                {isSyncing && <RefreshCw className="w-3 h-3 animate-spin" />}
              </button>
            )}

            <button
              type="button"
              onClick={cycleThemeMode}
              aria-label={tr('تبديل المظهر', 'Cycle theme')}
              title={
                themeMode === 'system'
                  ? tr('المظهر: تلقائي النظام', 'Theme: System')
                  : themeMode === 'light'
                    ? tr('المظهر: نهاري', 'Theme: Light')
                    : themeMode === 'dark'
                      ? tr('المظهر: ليلي', 'Theme: Dark')
                      : tr('المظهر: حسب الشروق والغروب', 'Theme: Sunrise & Sunset')
              }
              className="flex min-w-[34px] min-h-[34px] rounded-full hover:bg-[#e8f6ff] dark:hover:bg-white/10 items-center justify-center transition-colors"
            >
              {themeMode === 'system' ? (
                <Monitor className="w-4 h-4" />
              ) : themeMode === 'light' ? (
                <Sun className="w-4 h-4" />
              ) : themeMode === 'dark' ? (
                <Moon className="w-4 h-4" />
              ) : (
                <Sunrise className="w-4 h-4" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setMoreSheetOpen(true)}
              aria-label={tr('تصفح الأقسام من اليمين', 'Open Right Sections Menu')}
              className="lg:hidden min-w-[36px] min-h-[36px] rounded-full hover:bg-[#e8f6ff] dark:hover:bg-white/10 flex items-center justify-center transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* 4 Main Hubs Navigation Bar + Sub-Sections Quick Strip + Instant Back (hidden on Home to avoid duplicating Sections Gateway) */}
        {activeTab !== 'admin-studio' && activeTab !== 'home' && (
          <nav
            dir={isEn ? 'ltr' : 'rtl'}
            aria-label={tr('الأقسام الأربعة الرئيسية والأقسام الفرعية', '4 Main Hubs & Sub-sections')}
            className="sticky top-[96px] z-25 bg-white/95 dark:bg-[#1b3029]/95 backdrop-blur-md border-b border-slate-200/70 dark:border-white/10 px-2.5 sm:px-6 py-2 space-y-1.5"
          >
            {/* Row 1: Instant Back Button + Home + 4 Main Hubs */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={navigateBack}
                className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#ffdea8] hover:bg-[#ffd083] text-[#271900] text-xs font-extrabold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors shadow-2xs"
              >
                <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                <span>{tr('رجوع فوري', 'Back')}</span>
              </button>

              <button
                type="button"
                onClick={() => navigateTo('home')}
                className="min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors bg-[#f4faff] dark:bg-[#223a32] text-[#0e1d25] dark:text-slate-100 border border-slate-200/70 dark:border-white/15 hover:bg-[#e2f5ec] dark:hover:bg-white/10"
              >
                <HomeIcon className="w-3.5 h-3.5 shrink-0" />
                <span>{isEn ? 'Home' : 'الرئيسية'}</span>
              </button>

              {mainHubs.map((hub) => {
                const Icon = hub.Icon;
                const isHubCurrent = activeHubId === hub.id;
                return (
                  <button
                    key={hub.id}
                    type="button"
                    onClick={() => {
                      if (hub.defaultTab === 'library') setLibraryInitialFilter('all');
                      navigateTo(hub.defaultTab);
                    }}
                    className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                      isHubCurrent
                        ? 'bg-[#006a46] text-white shadow-xs'
                        : 'bg-[#f4faff] dark:bg-[#223a32] text-[#0e1d25] dark:text-slate-100 border border-slate-200/70 dark:border-white/15 hover:bg-[#e2f5ec] dark:hover:bg-white/10'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="sm:hidden">{hub.shortLabel}</span>
                    <span className="hidden sm:inline">{hub.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Row 2: Active Hub Sub-Sections Quick Access */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
              {activeHub.subItems.map((sub) => {
                const SubIcon = sub.Icon;
                const isCurrent = isSubItemCurrent(sub);
                return (
                  <button
                    key={sub.key}
                    type="button"
                    onClick={() =>
                      navigateTo(sub.tab, {
                        libraryFilter: sub.libraryFilter,
                        aboutSub: sub.aboutSub,
                      })
                    }
                    className={`min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                      isCurrent
                        ? 'bg-[#e2f5ec] dark:bg-emerald-950/70 text-[#006a46] dark:text-[#6cdba6] border border-[#006a46]/30'
                        : 'bg-slate-50 dark:bg-[#223a32] text-[#3e4a42] dark:text-slate-300 border border-slate-200/70 dark:border-white/10 hover:bg-[#e8f6ff] dark:hover:bg-white/10'
                    }`}
                  >
                    <SubIcon className="w-3 h-3 shrink-0" />
                    <span>{sub.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>
        )}

        {/* Global Top Announcement Banner (Admin Controlled) */}
        {siteAppearance.announcementEnabled && siteAppearance.announcementText && (
          <div className="bg-[#006a46] text-white px-4 py-2 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 text-center">
            <Megaphone className="w-4 h-4 text-amber-300 shrink-0" />
            <span>{siteAppearance.announcementText}</span>
            {siteAppearance.announcementUrl && (
              <a
                href={siteAppearance.announcementUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-amber-200 hover:text-white shrink-0"
              >
                عرض التفاصيل
              </a>
            )}
          </div>
        )}

        {/* Scrollable Content */}
        <main
          className={`flex-1 ${
            activeTab === 'home'
              ? 'px-3 sm:px-5 lg:px-6 pt-3 pb-20 lg:pb-4'
              : 'px-4 sm:px-6 lg:px-8 pt-6 pb-32 lg:pb-12'
          }`}
        >
          <div className="max-w-6xl mx-auto">
            {siteAppearance.maintenanceMode && !authToken ? (
              <section className="max-w-xl mx-auto my-12 rounded-3xl bg-white dark:bg-[#223a32] border border-amber-500/30 p-8 text-center space-y-4 shadow-md">
                <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 flex items-center justify-center mx-auto">
                  <Wrench className="w-7 h-7" />
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-[#0e1d25] dark:text-white">
                  الموقع في وضع الصيانة والتطوير
                </h1>
                <p className="text-sm text-[#3e4a42] dark:text-slate-300 leading-relaxed">
                  يجري حالياً تحديث المكتبة العلمية والمحتوى الدعوي لتحسين التجربة. سنعود قريباً بإذن الله.
                </p>
                <button
                  type="button"
                  onClick={triggerAdminEntry}
                  className="text-xs font-bold text-[#6e7a71] hover:text-[#006a46] underline"
                >
                  دخول المشرفين
                </button>
              </section>
            ) : (
              <>
                {activeTab === 'home' && (
                  <HomeView
                    appIcons={appIcons}
                    siteConfig={siteConfig}
                    searchQuery={searchQuery}
                    nafahatMeta={nafahatMeta}
                    sectionStats={sectionStats}
                    onCopySada={(post) => void copySadaMessage(post)}
                    onShareCard={setShareModalPost}
                    onNavigateTab={(tab) => navigateTo(tab)}
                    onNavigateLibrary={(filter) => {
                      setLibraryInitialFilter(filter);
                      navigateTo('library');
                    }}
                    onNavigateFatawa={() => navigateTo('fatawa')}
                    onNavigateAdhkar={() => {
                      setAdhkarInitialSection('adhkar');
                      navigateTo('adhkar');
                    }}
                    onNotify={notify}
                  />
                )}

                <Suspense
                  fallback={
                    <div className="rounded-3xl bg-white dark:bg-[#223a32] border border-slate-200/70 dark:border-white/10 p-10 text-center space-y-2 shadow-xs">
                      <RefreshCw className="w-6 h-6 animate-spin text-[#006a46] dark:text-[#6cdba6] mx-auto" />
                      <p className="text-sm font-bold text-[#006a46] dark:text-[#6cdba6]">
                        {tr('جاري فتح القسم...', 'Loading section...')}
                      </p>
                    </div>
                  }
                >
                {activeTab === 'quran' && (
                  <QuranView
                    initialPage={quranInitialPage}
                    onShareCard={setShareModalPost}
                    onNotify={notify}
                  />
                )}

                {activeTab === 'wird' && (
                  <DailyWirdView
                    onOpenQuranAtPage={(page) => {
                      setQuranInitialPage(page);
                      navigateTo('quran');
                    }}
                    onNotify={notify}
                  />
                )}

                {activeTab === 'quiz' && (
                  <DailyDawahQuizCard
                    visitorId={visitorProfile?.id}
                    visitorName={visitorProfile?.name}
                    onNotify={notify}
                  />
                )}

                {activeTab === 'fatawa' && (
                  <FatawaView
                    fatawa={fatawa}
                    siteConfig={siteConfig}
                    bookmarkedFatwaIds={bookmarkedFatwaIds}
                    savedArchiveFatawa={savedArchiveFatawa}
                    onToggleFatwaBookmark={toggleFatwaBookmark}
                    onToggleArchiveFatwaBookmark={toggleArchiveFatwaBookmark}
                    onNavigateBookmarks={() => navigateTo('bookmarks')}
                    onShareCard={setShareModalPost}
                    onNotify={notify}
                  />
                )}

                {activeTab === 'adhkar' && (
                  <AdhkarView
                    siteConfig={siteConfig}
                    initialSection={adhkarInitialSection}
                    highlightedDhikrId={highlightedDhikrId}
                    motherPrayerText={siteConfig.motherPrayerText}
                    motherPrayersCount={motherPrayersCount}
                    hasSaidAmen={hasSaidAmen}
                    customAdhkar={customAdhkar}
                    onSayAmen={() => void sayAmen()}
                    reminderSettings={reminderSettings}
                    onChangeReminderSettings={updateReminderSettings}
                    onOpenSettings={() => handleOpenSettingsTab('settings')}
                    onOpenWeeklyActivity={() => handleOpenSettingsTab('weekly-activity')}
                    onShareCard={setShareModalPost}
                    onNotify={notify}
                  />
                )}

                {activeTab === 'library' && (
                  <LibraryView
                    posts={posts}
                    youtubeVideos={youtubeVideos}
                    telegramAudios={telegramAudios}
                    siteConfig={siteConfig}
                    bookmarkedIds={bookmarkedIds}
                    initialFilter={libraryInitialFilter}
                    isAdmin={Boolean(authToken)}
                    customBooks={customBooks}
                    sadaMaterials={sadaMaterials}
                    isRefreshingFeeds={isRefreshingFeeds}
                    onRefreshFeeds={() => void syncMediaFeeds({forceRefresh: true, showFeedback: true})}
                    onCopySada={(post) => void copySadaMessage(post)}
                    onOpenPost={openPostDetail}
                    onShareCard={setShareModalPost}
                    onToggleBookmark={toggleBookmark}
                    onNotify={notify}
                  />
                )}

                {activeTab === 'cards' && (
                  <DawahCardsView
                    aiCards={aiDawahCards}
                    dawahCardsMeta={dawahCardsMeta}
                    cardEngagement={cardEngagement}
                    onAiCardsChange={setAiDawahCards}
                    onDawahCardsMetaChange={setDawahCardsMeta}
                    onCardEngaged={handleCardEngaged}
                    visitorId={visitorProfile?.id}
                    isAdmin={Boolean(authToken)}
                    onAdminRefreshAiCards={handleAdminRefreshDawahCards}
                    onNotify={notify}
                  />
                )}

                {activeTab === 'mother-oasis' && (
                  <MotherOasisView
                    items={motherOasisItems}
                    motherPrayersCount={motherPrayersCount}
                    hasPrayedForMother={hasSaidAmen}
                    onAmenMother={() => void sayAmen()}
                    onNavigate={navigateTo}
                    onShareCard={setShareModalPost}
                    highlightedStoryId={getInitialStoryId()}
                  />
                )}

                {activeTab === 'poetry' && (
                  <PoetryOasisView
                    poetryItems={poetryItems}
                    permanentArchive={permanentArchive}
                    initialMode="all"
                    highlightedItemId={getInitialPoetryItemId()}
                    onPoetryUpdated={setPoetryItems}
                    onArchiveUpdated={refreshArchive}
                    onShareCard={setShareModalPost}
                    onNotify={notify}
                  />
                )}

                {activeTab === 'archive' && (
                  <PoetryOasisView
                    poetryItems={poetryItems}
                    permanentArchive={permanentArchive}
                    initialMode="permanent_archive"
                    highlightedItemId={getInitialPoetryItemId()}
                    onPoetryUpdated={setPoetryItems}
                    onArchiveUpdated={refreshArchive}
                    onShareCard={setShareModalPost}
                    onNotify={notify}
                  />
                )}

                {activeTab === 'videos' && (
                  <section className="max-w-2xl mx-auto my-8 rounded-3xl border border-emerald-800/15 dark:border-white/10 bg-gradient-to-br from-[#f2fbf7] to-[#fffaf0] dark:from-[#0c211a] dark:to-[#17150e] p-8 sm:p-10 text-center space-y-5 shadow-sm">
                    <div className="w-16 h-16 rounded-2xl bg-[#006a46] text-white flex items-center justify-center mx-auto shadow-sm">
                      <Video className="w-8 h-8" />
                    </div>
                    <div className="space-y-2">
                      <span className="inline-block text-xs font-extrabold text-[#006a46] dark:text-[#6cdba6] bg-[#e2f5ec] dark:bg-emerald-950/60 px-3 py-1 rounded-lg">
                        مكتبة المرئيات العلمية والدعوية
                      </span>
                      <h1 className="text-xl sm:text-2xl font-extrabold text-[#0e1d25] dark:text-white leading-relaxed">
                        قريباً بإذن الله.. يجري تجهيز مكتبة المرئيات العلمية والدعوية
                      </h1>
                      <p className="text-sm text-[#3e4a42] dark:text-slate-300 leading-relaxed max-w-lg mx-auto">
                        نعمل على تنظيم وانتقاء الدروس والخطب والمقاطع المؤثرة لصفوة العلماء والدعاة مع جودة عرض عالية وتصنيف موضوعي ميسّر.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => navigateTo('library')}
                        className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#006a46] hover:bg-[#005235] text-white text-sm font-bold"
                      >
                        تصفح المكتبة والمؤلفات الآن
                      </button>
                      <button
                        type="button"
                        onClick={() => navigateTo('home')}
                        className="min-h-[44px] px-5 py-2.5 rounded-xl bg-white dark:bg-[#1b3029] border border-slate-200 dark:border-white/10 text-sm font-bold text-[#0e1d25] dark:text-white"
                      >
                        العودة للبوابة الرئيسية
                      </button>
                    </div>
                  </section>
                )}

                {activeTab === 'deaf-mute' && (
                  <DeafMuteView
                    videos={deafMuteVideos}
                    meetConfig={meetConfig}
                    isAdmin={Boolean(authToken)}
                    authToken={authToken}
                    onVideosChange={setDeafMuteVideos}
                    onAdminQuickAdd={() => {
                      setAdminInitialTab('deaf-mute');
                      setActiveTab('admin-studio');
                    }}
                    onNavigate={navigateTo}
                    onNotify={notify}
                  />
                )}

                {activeTab === 'reviews' && (
                  <ReviewsView
                    reviews={visitorReviews}
                    isAdmin={Boolean(authToken)}
                    authToken={authToken}
                    onReviewsChange={setVisitorReviews}
                    onNotify={notify}
                  />
                )}

                {activeTab === 'channels' && (
                  <ChannelsView
                    socialLinks={socialLinks}
                    siteConfig={siteConfig}
                    onOpenAdminLinks={
                      authToken && adminRole === 'admin'
                        ? () => {
                            setAdminInitialTab('links-icons');
                            setActiveTab('admin-studio');
                          }
                        : undefined
                    }
                    onNotify={notify}
                  />
                )}

                {activeTab === 'bookmarks' && (
                  <BookmarksView
                    posts={posts}
                    fatawa={fatawa}
                    siteConfig={siteConfig}
                    bookmarkedIds={bookmarkedIds}
                    bookmarkedFatwaIds={bookmarkedFatwaIds}
                    savedArchiveFatawa={savedArchiveFatawa}
                    onToggleBookmark={toggleBookmark}
                    onToggleFatwaBookmark={toggleFatwaBookmark}
                    onToggleArchiveFatwaBookmark={toggleArchiveFatwaBookmark}
                    onOpenPost={openPostDetail}
                    onCopySada={(post) => void copySadaMessage(post)}
                    onShareCard={setShareModalPost}
                    onBrowseHome={() => navigateTo('home')}
                    onBrowseFatawa={() => navigateTo('fatawa')}
                    onNotify={notify}
                  />
                )}

                {(activeTab === 'about-support' || activeTab === 'about' || activeTab === 'support') && (
                  <AboutSupportShareView
                    siteConfig={siteConfig}
                    visitor={visitorProfile}
                    visitorsCount={visitorsCount}
                    onlineVisitorsCount={onlineVisitorsCount}
                    clicksCount={clicksCount}
                    registeredMembersCount={registeredMembersCount}
                    sectionStats={sectionStats}
                    initialSubTab={aboutSubTab}
                    onShareAppLink={() => void shareAppLink()}
                    onOpenAdminShield={() => (authToken ? navigateTo('admin-studio') : triggerAdminEntry())}
                    onMessageSubmitted={() => {
                      if (authToken) {
                        fetch('/api/admin/messages', {
                          headers: {Authorization: `Bearer ${authToken}`},
                        })
                          .then((res) => (res.ok ? res.json() : null))
                          .then((data: {suggestions?: SuggestionItem[]; volunteers?: VolunteerItem[]} | null) => {
                            if (data) {
                              setSuggestions(data.suggestions || []);
                              setVolunteers(data.volunteers || []);
                            }
                          })
                          .catch(() => undefined);
                      }
                    }}
                    onNotify={notify}
                  />
                )}

                {activeTab === 'post-detail' && selectedPost && (
                  <PostDetailView
                    post={selectedPost}
                    siteConfig={siteConfig}
                    isBookmarked={bookmarkedIds.includes(selectedPost.id)}
                    isLiked={likedIds.includes(selectedPost.id)}
                    isAdmin={Boolean(authToken)}
                    visitorProfile={visitorProfile}
                    onRequireVisitorAuth={() => setVisitorAuthModalOpen(true)}
                    onBack={() => navigateTo(prevTab || 'home')}
                    onToggleBookmark={toggleBookmark}
                    onToggleLike={(id) => void toggleLike(id)}
                    onAddComment={handleAddComment}
                    onCopySada={(post) => void copySadaMessage(post)}
                    onShareCard={setShareModalPost}
                    onAdminEditPost={handleAdminEditPost}
                    onAdminToggleHidePost={(id) => void handleAdminToggleHidePost(id)}
                    onAdminDeletePost={(id) => void handleAdminDeletePost(id)}
                    onAdminAutoPost={(id) => void handleAdminAutoPost(id)}
                    onAdminUpdateComment={handleAdminUpdateComment}
                    onAdminToggleHideComment={handleAdminToggleHideComment}
                    onAdminDeleteComment={handleAdminDeleteComment}
                    onNotify={notify}
                  />
                )}

                {activeTab === 'admin-studio' && authToken && (
                  <AdminStudioView
                    authToken={authToken}
                    adminRole={adminRole}
                    adminUsername={adminUsername}
                    assignedSection={assignedSection}
                    adminPermissions={adminPermissions}
                    isFounder={isFounder}
                    posts={posts}
                    fatawa={fatawa}
                    suggestions={suggestions}
                    volunteers={volunteers}
                    currentGesture={gesture}
                    initialTab={adminInitialTab}
                    initialEditPost={editingPostForAdmin}
                    brandHandle={brandHandle}
                    socialLinks={socialLinks}
                    appIcons={appIcons}
                    siteConfig={siteConfig}
                    siteAppearance={siteAppearance}
                    automationSettings={automationSettings}
                    nafahatMeta={nafahatMeta}
                    visitorsCount={visitorsCount}
                    onlineVisitorsCount={onlineVisitorsCount}
                    clicksCount={clicksCount}
                    registeredMembersCount={registeredMembersCount}
                    dawahCardsMeta={dawahCardsMeta}
                    onPublishPost={(newPost) => setPosts((prev) => [newPost, ...prev])}
                    onUpdatePost={(updatedPost) => {
                      setPosts((prev) => prev.map((p) => (p.id === updatedPost.id ? updatedPost : p)));
                      setEditingPostForAdmin(null);
                    }}
                    onDeletePost={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))}
                    onToggleHidePost={(id) => void handleAdminToggleHidePost(id)}
                    onTriggerAutoPost={(id) => void handleAdminAutoPost(id)}
                    onUpdateComment={handleAdminUpdateComment}
                    onToggleHideComment={handleAdminToggleHideComment}
                    onDeleteComment={handleAdminDeleteComment}
                    onAddFatwa={(newFatwa) => setFatawa((prev) => [newFatwa, ...prev])}
                    onDeleteFatwa={(id) => setFatawa((prev) => prev.filter((f) => f.id !== id))}
                    onSaveSiteConfig={handleSaveSiteConfig}
                    onSaveAppearance={handleSaveAppearance}
                    onSaveAutomation={handleSaveAutomation}
                    onUpdateSettings={handleUpdateSettings}
                    onSaveCustomization={handleSaveCustomization}
                    onRefreshNafahatAI={handleAdminRefreshNafahat}
                    onRefreshDawahCardsAI={handleAdminRefreshDawahCardsWithResult}
                    onResetCounters={(resetPosts, nextMotherCount, nextVisitors, nextClicks) => {
                      setPosts(resetPosts);
                      setMotherPrayersCount(nextMotherCount);
                      if (typeof nextVisitors === 'number') {
                        setVisitorsCount((prev) => Math.max(prev, 4580, nextVisitors));
                      }
                      if (typeof nextClicks === 'number') {
                        setClicksCount((prev) => Math.max(prev, 8540, nextClicks));
                      }
                      setLikedIds([]);
                      setHasSaidAmen(false);
                      try {
                        localStorage.removeItem(AMEN_KEY);
                      } catch {
                        // Ignore
                      }
                    }}
                    onImportState={(payload) => {
                      if (Array.isArray(payload.posts)) setPosts(payload.posts);
                      if (Array.isArray(payload.fatawa)) setFatawa(payload.fatawa);
                      if (Array.isArray(payload.poetryItems)) setPoetryItems(payload.poetryItems);
                      if (Array.isArray(payload.aiDawahCards)) setAiDawahCards(payload.aiDawahCards);
                      if (payload.dawahCardsMeta) setDawahCardsMeta(payload.dawahCardsMeta);
                      if (typeof payload.visitorsCount === 'number') {
                        setVisitorsCount((prev) => Math.max(prev, 4580, payload.visitorsCount!));
                      }
                      if (typeof payload.clicksCount === 'number') {
                        setClicksCount((prev) => Math.max(prev, 8540, payload.clicksCount!));
                      }
                      if (typeof payload.registeredMembersCount === 'number') {
                        setRegisteredMembersCount((prev) => Math.max(prev, payload.registeredMembersCount!));
                      }
                      if (Array.isArray(payload.socialLinks)) setSocialLinks(payload.socialLinks);
                      if (payload.appIcons) setAppIcons({...DEFAULT_APP_ICONS, ...payload.appIcons});
                      if (payload.siteConfig) setSiteConfig({...DEFAULT_SITE_CONFIG, ...payload.siteConfig});
                      if (payload.siteAppearance) {
                        setSiteAppearance({...DEFAULT_SITE_APPEARANCE, ...payload.siteAppearance});
                      }
                      if (payload.brandHandle) setBrandHandle(payload.brandHandle);
                    }}
                    onUpdateMessages={(nextSuggestions, nextVolunteers) => {
                      setSuggestions(nextSuggestions);
                      setVolunteers(nextVolunteers);
                    }}
                    motherOasisItems={motherOasisItems}
                    onMotherOasisChange={setMotherOasisItems}
                    deafMuteVideos={deafMuteVideos}
                    onDeafMuteVideosChange={setDeafMuteVideos}
                    customAdhkar={customAdhkar}
                    onCustomAdhkarChange={setCustomAdhkar}
                    customBooks={customBooks}
                    onCustomBooksChange={setCustomBooks}
                    sadaMaterials={sadaMaterials}
                    onSadaMaterialsChange={setSadaMaterials}
                    aiDawahCards={aiDawahCards}
                    onAiDawahCardsChange={setAiDawahCards}
                    onDawahCardsMetaChange={setDawahCardsMeta}
                    poetryItems={poetryItems}
                    onPoetryItemsChange={setPoetryItems}
                    meetConfig={meetConfig}
                    onMeetConfigChange={setMeetConfig}
                    onPreviewSite={() => navigateTo('home')}
                    onExitAdmin={logoutAdmin}
                    onNotify={notify}
                  />
                )}
                </Suspense>
              </>
            )}

            {/* Compact Footer with Broadcast Channels (WhatsApp, Telegram, X) & Online Stats */}
            {activeTab !== 'admin-studio' && (
              <SiteFooter
                socialLinks={socialLinks}
                visitorsCount={visitorsCount}
                clicksCount={clicksCount}
                onlineVisitorsCount={onlineVisitorsCount}
                onNavigateChannels={() => navigateTo('channels')}
                onAdminTrigger={() => (authToken ? navigateTo('admin-studio') : triggerAdminEntry())}
              />
            )}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Tab Bar (Main Hubs + 40px Android Bottom Safe Area) */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 pb-safe bg-[#FFFFFF]/95 dark:bg-[#1b3029]/95 backdrop-blur-xl border-t border-slate-200/80 dark:border-white/10"
        aria-label={tr('الأقسام الرئيسية', 'Main Hubs Bottom Navigation')}
      >
        <div className="h-16 grid grid-cols-6 items-center px-1">
          <button
            type="button"
            onClick={() => navigateTo('home')}
            className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
              activeTab === 'home' ? 'text-[#006a46] dark:text-[#6cdba6] font-extrabold' : 'text-[#3e4a42] dark:text-slate-300'
            }`}
          >
            <HomeIcon className="w-5 h-5" />
            <span className="text-[10px] whitespace-nowrap truncate max-w-[56px]">
              {isEn ? 'Home' : 'الرئيسية'}
            </span>
          </button>
          {mainHubs.map((hub) => {
            const Icon = hub.Icon;
            const isCurrent = activeTab !== 'home' && activeHubId === hub.id;
            return (
              <button
                key={hub.id}
                type="button"
                onClick={() => {
                  if (hub.defaultTab === 'library') setLibraryInitialFilter('all');
                  navigateTo(hub.defaultTab);
                }}
                className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
                  isCurrent ? 'text-[#006a46] dark:text-[#6cdba6] font-extrabold' : 'text-[#3e4a42] dark:text-slate-300'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] whitespace-nowrap truncate max-w-[56px]">{hub.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Mobile Right-Side Sections Drawer (slides from right edge in RTL) */}
      {moreSheetOpen && (
        <div
          dir={isEn ? 'ltr' : 'rtl'}
          className="lg:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex justify-start pt-[40px] pb-[40px]"
          onClick={() => setMoreSheetOpen(false)}
        >
          <div
            className="w-[88vw] max-w-sm h-full rounded-e-3xl bg-white dark:bg-[#223a32] p-5 pb-12 space-y-4 shadow-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200/70 dark:border-white/10 pb-3">
              <h3 className="text-base font-bold text-[#006a46] dark:text-[#6cdba6]">
                {tr('الأقسام الرئيسية والإعدادات', 'Main Hubs & Settings')}
              </h3>
              <button
                type="button"
                onClick={() => setMoreSheetOpen(false)}
                aria-label={tr('إغلاق', 'Close')}
                className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Main Hubs & Quick Sub-Sections in Mobile Drawer */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => navigateTo('home')}
                  className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-2xl text-xs font-extrabold flex items-center gap-2 transition-colors ${
                    activeTab === 'home'
                      ? 'bg-[#006a46] text-white'
                      : 'bg-[#f4faff] dark:bg-[#223a32] text-[#006a46] dark:text-[#6cdba6] border border-slate-200/60 dark:border-white/15'
                  }`}
                >
                  <HomeIcon className="w-4 h-4 shrink-0" />
                  <span>{tr('الصفحة الرئيسية', 'Home')}</span>
                </button>
                {mainHubs.map((hub) => {
                  const HubIcon = hub.Icon;
                  return (
                    <div
                      key={hub.id}
                      className="rounded-2xl bg-[#f4faff] dark:bg-[#28453b] p-3 space-y-2 border border-slate-200/60 dark:border-white/10"
                    >
                      <button
                        type="button"
                        onClick={() => navigateTo(hub.defaultTab)}
                        className="w-full flex items-center gap-2 text-xs font-extrabold text-[#006a46] dark:text-[#6cdba6] text-start"
                      >
                        <HubIcon className="w-4 h-4 shrink-0" />
                        <span>{hub.label}</span>
                      </button>
                      <div className="grid grid-cols-2 gap-1.5">
                        {hub.subItems.map((sub) => {
                          const SubIcon = sub.Icon;
                          return (
                            <button
                              key={sub.key}
                              type="button"
                              onClick={() =>
                                navigateTo(sub.tab, {
                                  libraryFilter: sub.libraryFilter,
                                  aboutSub: sub.aboutSub,
                                })
                              }
                              className={`min-h-[38px] px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 text-start ${
                                isSubItemCurrent(sub)
                                  ? 'bg-[#006a46] text-white'
                                  : 'bg-white dark:bg-[#1b3029] text-[#0e1d25] dark:text-slate-200'
                              }`}
                            >
                              <SubIcon className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{sub.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {authToken && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => navigateTo('admin-studio')}
                    className="min-h-[44px] px-3 rounded-2xl bg-[#071510] text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <Shield className="w-4 h-4" />
                    <span>لوحة المشرف</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMoreSheetOpen(false);
                      logoutAdmin();
                    }}
                    className="min-h-[44px] px-3 rounded-2xl bg-rose-600 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>🚪 خروج المشرف</span>
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setMoreSheetOpen(false);
                  setActiveTab('splash');
                }}
                className="w-full min-h-[44px] px-4 py-2 rounded-2xl bg-[#e8f6ff] dark:bg-[#28453b] text-xs font-semibold flex items-center gap-2.5"
              >
                <Sparkles className="w-4 h-4 text-[#7c5800] dark:text-[#f2be5e]" />
                <span>{tr('معاينة شاشة البداية', 'Show Welcome Screen')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Admin/Editor Username+Password Modal */}
      {loginModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4 pt-[40px] pb-[40px]"
          onClick={() => setLoginModalOpen(false)}
        >
          <form
            onSubmit={(e) => void submitAdminLogin(e)}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#223a32] p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-full bg-[#006a46]/10 text-[#006a46] dark:text-[#6cdba6] flex items-center justify-center">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">{tr('بوابة المشرفين والمدراء', 'Supervisors & Managers Portal')}</h3>
                  <p className="text-xs text-[#6e7a71] dark:text-slate-400">
                    {tr('تسجيل دخول المشرف أو المدير (مخفي عن الزوار)', 'Sign in as Supervisor or Manager')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLoginModalOpen(false)}
                className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                autoFocus
                autoComplete="username"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder={tr('اسم المستخدم', 'Username')}
                className="w-full min-h-[46px] rounded-xl bg-[#e8f6ff] dark:bg-[#28453b] px-4 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#006a46]"
              />
              <input
                type="password"
                autoComplete="current-password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder={tr('كلمة المرور', 'Password')}
                className="w-full min-h-[46px] rounded-xl bg-[#e8f6ff] dark:bg-[#28453b] px-4 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#006a46]"
              />
            </div>

            {loginError && <p className="text-xs text-[#ba1a1a] font-semibold text-center">{loginError}</p>}

            <button
              type="submit"
              disabled={verifyingLogin}
              className="w-full min-h-[48px] rounded-xl bg-[#006a46] hover:bg-[#005235] disabled:opacity-60 text-white font-bold text-sm transition-colors"
            >
              {verifyingLogin ? tr('جاري التحقق...', 'Verifying...') : tr('دخول للوحة التحكم', 'Sign In')}
            </button>
          </form>
        </div>
      )}

      {/* Optional Quick Visitor Account Modal */}
      <VisitorAuthModal
        open={visitorAuthModalOpen}
        visitor={visitorProfile}
        onClose={() => setVisitorAuthModalOpen(false)}
        onSignedIn={(profile, opts) => {
          setVisitorProfile(profile);
          if (opts) {
            saveLocalTelemetryFloors({
              visitorsCount: opts.visitorsCount,
              clicksCount: opts.clicksCount,
              registeredMembersCount: opts.registeredMembersCount,
            });
            if (typeof opts.visitorsCount === 'number') {
              setVisitorsCount((prev) => Math.max(prev, 4580, opts.visitorsCount!));
            }
            if (typeof opts.clicksCount === 'number') {
              setClicksCount((prev) => Math.max(prev, 8540, opts.clicksCount!));
            }
            if (typeof opts.registeredMembersCount === 'number') {
              setRegisteredMembersCount((prev) => Math.max(prev, opts.registeredMembersCount!));
            }
          }
          if (Array.isArray(profile.bookmarkedPostIds) && profile.bookmarkedPostIds.length > 0) {
            setBookmarkedIds((prev) => Array.from(new Set([...prev, ...profile.bookmarkedPostIds!])));
          }
          if (Array.isArray(profile.bookmarkedFatwaIds) && profile.bookmarkedFatwaIds.length > 0) {
            setBookmarkedFatwaIds((prev) => Array.from(new Set([...prev, ...profile.bookmarkedFatwaIds!])));
          }
          if (Array.isArray(profile.likedPostIds) && profile.likedPostIds.length > 0) {
            setLikedIds((prev) => Array.from(new Set([...prev, ...profile.likedPostIds!])));
          }
          if (profile.quizProgress) {
            mergeRemoteQuizState(profile.quizProgress);
          }
          void cloudFetchVisitorProfile().then((cloudProf) => {
            if (!cloudProf) return;
            if (Array.isArray(cloudProf.bookmarkedPostIds) && cloudProf.bookmarkedPostIds.length > 0) {
              setBookmarkedIds((prev) => Array.from(new Set([...prev, ...cloudProf.bookmarkedPostIds!])));
            }
            if (Array.isArray(cloudProf.bookmarkedFatwaIds) && cloudProf.bookmarkedFatwaIds.length > 0) {
              setBookmarkedFatwaIds((prev) => Array.from(new Set([...prev, ...cloudProf.bookmarkedFatwaIds!])));
            }
            if (Array.isArray(cloudProf.likedPostIds) && cloudProf.likedPostIds.length > 0) {
              setLikedIds((prev) => Array.from(new Set([...prev, ...cloudProf.likedPostIds!])));
            }
          });
          const persist = opts?.rememberMe !== false;
          try {
            if (persist) {
              window.localStorage.setItem(VISITOR_PROFILE_KEY, JSON.stringify(profile));
              if (opts?.sessionToken) {
                window.localStorage.setItem(VISITOR_SESSION_TOKEN_KEY, opts.sessionToken);
              }
              window.sessionStorage.removeItem(VISITOR_PROFILE_KEY);
              window.sessionStorage.removeItem(VISITOR_SESSION_TOKEN_KEY);
            } else {
              window.sessionStorage.setItem(VISITOR_PROFILE_KEY, JSON.stringify(profile));
              if (opts?.sessionToken) {
                window.sessionStorage.setItem(VISITOR_SESSION_TOKEN_KEY, opts.sessionToken);
              }
              window.localStorage.removeItem(VISITOR_PROFILE_KEY);
              window.localStorage.removeItem(VISITOR_SESSION_TOKEN_KEY);
            }
          } catch {
            // ignore
          }
        }}
        onSignOut={() => {
          setVisitorProfile(null);
          try {
            window.localStorage.removeItem(VISITOR_PROFILE_KEY);
            window.localStorage.removeItem(VISITOR_SESSION_TOKEN_KEY);
            window.sessionStorage.removeItem(VISITOR_PROFILE_KEY);
            window.sessionStorage.removeItem(VISITOR_SESSION_TOKEN_KEY);
          } catch {
            // ignore
          }
        }}
        onNotify={notify}
      />

      {/* Multi-Language Site Picker Modal */}
      <LanguagePickerModal
        open={languageModalOpen}
        onClose={() => setLanguageModalOpen(false)}
        onSelect={(code) => {
          setLang(code);
          const meta = getLanguageMeta(code);
          notify(`تم تغيير لغة الموقع إلى: ${meta.nativeName} (${meta.arabicLabel})`);
        }}
      />

      {/* Grounded In-App AI Assistant Chatbot & Direct Admin Inbox Submission */}
      <AIChatWidget
        siteConfig={siteConfig}
        activeTab={activeTab}
        customBooks={customBooks}
        onMessageSubmitted={() => {
          if (authToken) {
            fetch('/api/admin/messages', {
              headers: {Authorization: `Bearer ${authToken}`},
            })
              .then((res) => (res.ok ? res.json() : null))
              .then((data: {suggestions?: SuggestionItem[]; volunteers?: VolunteerItem[]} | null) => {
                if (data) {
                  setSuggestions(data.suggestions || []);
                  setVolunteers(data.volunteers || []);
                }
              })
              .catch(() => undefined);
          }
        }}
        onNotify={notify}
      />

      {/* App Settings, Local Adhkar Notifications & Weekly Activity Modal */}
      <AppSettingsModal
        open={settingsModalOpen}
        initialSection={settingsInitialSection}
        onClose={() => setSettingsModalOpen(false)}
        appName={displayAppName}
        customAdhkar={customAdhkar}
        reminderSettings={reminderSettings}
        onChangeReminderSettings={updateReminderSettings}
        themeMode={themeMode}
        onChangeThemeMode={applyThemeMode}
        solarWindow={solarWindow}
        onRequestSolarLocation={handleRequestSolarLocation}
        solarLocating={solarLocating}
        onToggleLanguage={handleToggleLanguage}
        onOpenAdhkar={(dhikrId) => {
          setAdhkarInitialSection('adhkar');
          if (dhikrId) {
            setHighlightedDhikrId(dhikrId);
          }
          navigateTo('adhkar');
        }}
        onNotify={notify}
      />

      {/* Shareable PNG Card Modal */}
      <CardShareModal
        post={shareModalPost}
        brandHandle={brandHandle}
        onClose={() => setShareModalPost(null)}
        onNotify={notify}
      />

      {/* In-App External Site Portal Overlay with Permanent Return & Home Navigation */}
      {externalPortal && (
        <div className="fixed inset-0 z-50 pt-[40px] pb-[40px] bg-white dark:bg-[#162822] flex flex-col">
          <div className="bg-[#006a46] text-white px-3 sm:px-5 py-2.5 flex flex-wrap items-center justify-between gap-2 shadow-md">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setExternalPortal(null)}
                className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-white text-[#006a46] hover:bg-emerald-50 text-xs sm:text-sm font-extrabold flex items-center gap-1.5 shadow-xs"
              >
                <ArrowRight className="w-4 h-4 shrink-0" />
                <span>العودة إلى الموقع</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setExternalPortal(null);
                  navigateTo('home');
                }}
                className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#ffdea8] hover:bg-[#ffc968] text-[#271900] text-xs sm:text-sm font-extrabold flex items-center gap-1.5 shadow-xs"
              >
                <HomeIcon className="w-4 h-4 shrink-0" />
                <span>عودة للرئيسية</span>
              </button>
            </div>

            <div className="flex items-center gap-2 min-w-0 max-w-full">
              <span className="text-xs font-bold text-emerald-100 truncate max-w-[200px] sm:max-w-[320px]">
                {externalPortal.title || externalPortal.url}
              </span>
              <a
                href={externalPortal.url}
                target="_blank"
                rel="noopener noreferrer"
                data-direct-external="true"
                className="min-h-[36px] px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold flex items-center gap-1.5 shrink-0"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>فتح في المتصفح</span>
              </a>
            </div>
          </div>

          <div className="bg-[#fffbf2] dark:bg-[#28453b] border-b border-amber-500/25 px-4 py-1.5 text-[11px] sm:text-xs font-semibold text-[#7c5800] dark:text-[#ffdea8] flex flex-wrap items-center justify-between gap-2">
            <span>
              أنت الآن تتصفح موقعاً خارجياً داخل منصة مواعظ وعبر — يمكنك الضغط على «عودة للرئيسية» في أي لحظة. إذا منع الموقع الخارجي العرض المدمج، اضغط «فتح في المتصفح».
            </span>
          </div>

          <iframe
            src={externalPortal.url}
            title={externalPortal.title || 'موقع خارجي'}
            className="flex-1 w-full border-0 bg-white"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          />
        </div>
      )}

      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-[116px] lg:bottom-14 left-4 right-4 max-w-md mx-auto z-50 rounded-2xl bg-[#23323b] dark:bg-[#27443a] text-white px-4 py-3 shadow-xl flex items-center gap-2.5">
          <CheckCircle2 className="w-5 h-5 text-[#6cdba6] shrink-0" />
          <span className="text-xs sm:text-sm font-medium flex-1">{toastMsg}</span>
        </div>
      )}
    </div>
  );
}
