import {
  APPROVED_DATASETS,
  INITIAL_DEAF_MUTE_VIDEOS,
  appendOnlyMergeById,
} from '../data/contentRepository';
import {
  DEFAULT_SNAPSHOT,
  INITIAL_FATAWA,
  INITIAL_MOTHER_OASIS_ITEMS,
  INITIAL_POSTS,
  INITIAL_SOCIAL_LINKS,
} from '../data/seed';
import {DAWAH_CARDS_RESET_EPOCH, isConciseClassicCard} from '../data/dawahCards';
import type {BootstrapSnapshot} from '../types';

const SNAPSHOT_KEY = 'mawaedh_snapshot_v4';
const DAWAH_CARDS_RESET_FLAG_KEY = 'mawaedh_dawah_cards_reset_v4';

export function loadSnapshot(): BootstrapSnapshot {
  if (typeof window === 'undefined') return DEFAULT_SNAPSHOT;
  try {
    let hasDawahResetFlag = false;
    try {
      window.localStorage.removeItem('mawaedh_snapshot_v2');
      window.localStorage.removeItem('mawaedh_snapshot_v3');
      hasDawahResetFlag = window.localStorage.getItem(DAWAH_CARDS_RESET_FLAG_KEY) === '1';
      if (!hasDawahResetFlag) {
        window.localStorage.setItem(DAWAH_CARDS_RESET_FLAG_KEY, '1');
      }
    } catch {
      // ignore storage quota/access issues
    }
    const raw = window.localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) {
      return {
        ...DEFAULT_SNAPSHOT,
        deafMuteVideos: INITIAL_DEAF_MUTE_VIDEOS,
        customAdhkar: [],
        customBooks: [],
      };
    }
    const parsed = JSON.parse(raw) as Partial<BootstrapSnapshot>;

    const posts = appendOnlyMergeById(parsed.posts, INITIAL_POSTS);
    const fatawa = appendOnlyMergeById(parsed.fatawa, INITIAL_FATAWA);
    const motherOasisItems = appendOnlyMergeById(
      parsed.motherOasisItems,
      INITIAL_MOTHER_OASIS_ITEMS,
    ).map((it) => ({
      ...it,
      signature:
        it.signature && !/إكرام|عبده علي/.test(it.signature)
          ? it.signature
          : 'بقلم الوالدة الفاضلة: أم محمد',
    }));
    const visitorReviews = appendOnlyMergeById(
      parsed.visitorReviews,
      APPROVED_DATASETS.visitorReviews,
    ).map((rev) => ({
      ...rev,
      name: rev.name === 'سليمان المكي' ? 'مستفيد من البطاقات' : rev.name,
    }));
    const deafMuteVideos = appendOnlyMergeById(
      parsed.deafMuteVideos,
      INITIAL_DEAF_MUTE_VIDEOS,
    ).map((vid) => ({
      ...vid,
      managerName:
        vid.managerName && !/يونس|عبد\s*الكريم/.test(vid.managerName)
          ? vid.managerName
          : 'إدارة قسم الصم والبكم',
    }));

    const socialLinks = (() => {
      if (!Array.isArray(parsed.socialLinks) || parsed.socialLinks.length === 0) {
        return DEFAULT_SNAPSHOT.socialLinks;
      }
      const list = parsed.socialLinks
        .filter((l) => l.id !== 'x_alt')
        .map((l) =>
          l.id === 'x' &&
          (l.handle === '@ax1ax70' ||
            l.url.includes('twitter.com/ax1ax70') ||
            l.url.includes('x.com/ax1ax70') ||
            l.name.includes('تويتر'))
            ? {
                ...l,
                name: 'منصة إكس (X) · الحساب الرسمي',
                handle: '@ax1ax71',
                description:
                  'حساب مواعظ وعبر الرسمي عبر منصة إكس (X) لنشر السلاسل والتغريدات الدعوية الموثقة والتأملات القرآنية.',
                url: 'https://x.com/ax1ax71',
              }
            : l.name.includes('تويتر')
              ? {...l, name: l.name.replace(/تويتر/g, 'منصة إكس (X)')}
              : l,
        );
      for (const seedLink of INITIAL_SOCIAL_LINKS) {
        if ((seedLink.id === 'sh_yahia' || seedLink.id === 'alilmia') && !list.some((x) => x.id === seedLink.id)) {
          list.push(seedLink);
        }
      }
      return list;
    })();

    return {
      posts,
      fatawa,
      socialLinks,
      appIcons: parsed.appIcons ? {...DEFAULT_SNAPSHOT.appIcons, ...parsed.appIcons} : DEFAULT_SNAPSHOT.appIcons,
      siteConfig: parsed.siteConfig
        ? {
            ...DEFAULT_SNAPSHOT.siteConfig,
            ...parsed.siteConfig,
            motherBadge:
              !parsed.siteConfig.motherBadge || parsed.siteConfig.motherBadge.includes('وقفة بر')
                ? DEFAULT_SNAPSHOT.siteConfig.motherBadge
                : parsed.siteConfig.motherBadge,
            navHisn:
              !parsed.siteConfig.navHisn || parsed.siteConfig.navHisn.includes('حصن')
                ? DEFAULT_SNAPSHOT.siteConfig.navHisn
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
                ? DEFAULT_SNAPSHOT.siteConfig.hisnTitle
                : parsed.siteConfig.hisnTitle,
            supportEmail: '',
          }
        : {...DEFAULT_SNAPSHOT.siteConfig, supportEmail: ''},
      brandHandle:
        typeof parsed.brandHandle === 'string' && parsed.brandHandle.trim()
          ? parsed.brandHandle
          : DEFAULT_SNAPSHOT.brandHandle,
      motherPrayersCount:
        typeof parsed.motherPrayersCount === 'number'
          ? parsed.motherPrayersCount
          : DEFAULT_SNAPSHOT.motherPrayersCount,
      visitorsCount:
        typeof parsed.visitorsCount === 'number'
          ? Math.max(4580, parsed.visitorsCount)
          : Math.max(4580, DEFAULT_SNAPSHOT.visitorsCount),
      clicksCount:
        typeof parsed.clicksCount === 'number'
          ? Math.max(8540, parsed.clicksCount)
          : Math.max(8540, DEFAULT_SNAPSHOT.clicksCount),
      registeredMembersCount:
        typeof parsed.registeredMembersCount === 'number'
          ? Math.max(0, parsed.registeredMembersCount)
          : 0,
      nafahatMeta: parsed.nafahatMeta,
      dawahCardsMeta: hasDawahResetFlag ? parsed.dawahCardsMeta : undefined,
      motherOasisItems,
      visitorReviews,
      deafMuteVideos,
      customAdhkar: Array.isArray(parsed.customAdhkar) ? parsed.customAdhkar : [],
      customBooks: Array.isArray(parsed.customBooks) ? parsed.customBooks : [],
      sadaMaterials: Array.isArray(parsed.sadaMaterials) ? parsed.sadaMaterials : [],
      aiDawahCards:
        hasDawahResetFlag && Array.isArray(parsed.aiDawahCards)
          ? parsed.aiDawahCards.filter(
              (c) => isConciseClassicCard(c) && (!c.createdAt || c.createdAt >= DAWAH_CARDS_RESET_EPOCH),
            )
          : [],
      cardEngagement:
        parsed.cardEngagement && typeof parsed.cardEngagement === 'object' ? parsed.cardEngagement : {},
      sectionStats:
        parsed.sectionStats && typeof parsed.sectionStats === 'object' ? parsed.sectionStats : {},
      gesture: parsed.gesture === 'multi_tap' ? 'multi_tap' : 'long_press',
      cachedAt: typeof parsed.cachedAt === 'string' ? parsed.cachedAt : DEFAULT_SNAPSHOT.cachedAt,
    };
  } catch {
    return {
      ...DEFAULT_SNAPSHOT,
      visitorsCount: Math.max(4580, DEFAULT_SNAPSHOT.visitorsCount),
      clicksCount: Math.max(8540, DEFAULT_SNAPSHOT.clicksCount),
      registeredMembersCount: 0,
      deafMuteVideos: INITIAL_DEAF_MUTE_VIDEOS,
      customAdhkar: [],
      customBooks: [],
      sadaMaterials: [],
      aiDawahCards: [],
      cardEngagement: {},
    };
  }
}

export function saveSnapshot(snapshot: BootstrapSnapshot): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore storage quota errors
  }
}

export const PUBLIC_PROJECT_URL = 'https://ax1ax71.ai.studio';

export function getPublicSiteUrl(pathSuffix = '/'): string {
  const normalized = pathSuffix.startsWith('/') ? pathSuffix : `/${pathSuffix}`;
  if (typeof window === 'undefined') {
    return `${PUBLIC_PROJECT_URL}${normalized}`;
  }
  const host = window.location.hostname;
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.startsWith('ais-dev-') ||
    host.startsWith('ais-pre-') ||
    host.endsWith('.run.app')
  ) {
    return `${PUBLIC_PROJECT_URL}${normalized}`;
  }
  return `${window.location.origin}${normalized}`;
}
