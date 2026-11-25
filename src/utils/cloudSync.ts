import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  OperationType,
  auth,
  db,
  facebookProvider,
  googleProvider,
  handleFirestoreError,
} from '../firebase';
import type {
  ClassicDawahCard,
  CustomAdhkarItem,
  CustomBookItem,
  DeafMuteVideoItem,
  FatwaItem,
  MotherOasisItem,
  PoetryAnecdoteItem,
  Post,
  SadaMaterialItem,
  SiteConfig,
  VisitorProfile,
  VisitorReviewItem,
} from '../types';

export const TRUSTED_ADMIN_EMAILS = ['rawayiealeilm@gmail.com', 'ax1ax70@gmail.com'];

export function isTrustedAdminUser(user: User | null): boolean {
  if (!user || !user.email || !user.emailVerified) return false;
  return TRUSTED_ADMIN_EMAILS.includes(user.email.toLowerCase());
}

export async function signInAdminWithGoogle(): Promise<User> {
  const res = await signInWithPopup(auth, googleProvider);
  if (!isTrustedAdminUser(res.user)) {
    await signOut(auth).catch(() => undefined);
    throw new Error('البريد الإلكتروني غير مخوّل لصلاحيات المشرف السحابي.');
  }
  return res.user;
}

export async function signOutFirebaseAdmin(): Promise<void> {
  await signOut(auth);
}

export function observeFirebaseAdminAuth(callback: (user: User | null) => void): Unsubscribe {
  return onAuthStateChanged(auth, callback);
}

export function formatFirebaseAuthErrorAr(err: unknown): string {
  const code =
    err && typeof err === 'object' && 'code' in err ? String((err as {code: unknown}).code) : '';
  if (code.includes('popup-blocked')) {
    return 'المتصفح منع نافذة تسجيل الدخول المنبثقة — يرجى السماح بالنوافذ المنبثقة لهذا الموقع والمحاولة مجدداً.';
  }
  if (code.includes('popup-closed-by-user') || code.includes('cancelled-popup-request')) {
    return 'تم إغلاق نافذة تسجيل الدخول قبل إتمام العملية.';
  }
  if (code.includes('account-exists-with-different-credential')) {
    return 'هذا البريد مسجّل مسبقاً عبر مزوّد دخول آخر — يرجى تسجيل الدخول بالمزوّد الأول الذي استخدمته.';
  }
  if (code.includes('operation-not-allowed')) {
    return 'مزوّد تسجيل الدخول هذا غير مفعّل بعد في إعدادات Firebase Auth (يمكنك استخدام الدخول بالاسم والبريد أو Google).';
  }
  if (code.includes('unauthorized-domain')) {
    return 'النطاق الحالي غير مضاف إلى النطاقات المصرح بها في مشروع Firebase.';
  }
  if (err instanceof Error && err.message) return err.message;
  return 'تعذر إتمام تسجيل الدخول عبر السحابة حالياً.';
}

export async function signInVisitorWithGoogle(): Promise<User> {
  const res = await signInWithPopup(auth, googleProvider);
  return res.user;
}

export async function signInVisitorWithFacebook(): Promise<User> {
  const res = await signInWithPopup(auth, facebookProvider);
  return res.user;
}

function sanitizeDocId(raw: string, fallbackPrefix: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 110);
  if (cleaned.length >= 2) return cleaned;
  return `${fallbackPrefix}_${Date.now().toString(36)}`;
}

function omitUndefined<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

function isoFromFirestore(val: unknown, fallback = new Date().toISOString()): string {
  if (typeof val === 'string' && val.trim()) return val;
  if (val && typeof val === 'object' && 'toDate' in val && typeof (val as {toDate: () => Date}).toDate === 'function') {
    try {
      return (val as {toDate: () => Date}).toDate().toISOString();
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export interface CloudCollectionsPayload {
  posts: Post[];
  fatawa: FatwaItem[];
  motherOasisItems: MotherOasisItem[];
  poetryItems: PoetryAnecdoteItem[];
  deafMuteVideos: DeafMuteVideoItem[];
  customAdhkar: CustomAdhkarItem[];
  customBooks: CustomBookItem[];
  sadaMaterials: SadaMaterialItem[];
  aiDawahCards: ClassicDawahCard[];
  visitorReviews: VisitorReviewItem[];
  siteSettingsPatch?: Partial<SiteConfig> & {maintenanceMode?: boolean};
}

function mapDocToPost(data: Record<string, unknown>, id: string): Post {
  return {
    id: String(data.id || id),
    title: String(data.title || ''),
    excerpt: String(data.excerpt || ''),
    body: String(data.body || ''),
    author: String(data.author || 'مواعظ وعبر'),
    sourceLabel: String(data.sourceLabel || 'سحابة مواعظ وعبر'),
    category: String(data.category || 'إيمانيات'),
    mediaType:
      data.mediaType === 'sada' || data.mediaType === 'video' || data.mediaType === 'audio'
        ? data.mediaType
        : 'quote',
    cardTheme:
      data.cardTheme === 'azure' || data.cardTheme === 'gold' || data.cardTheme === 'midnight'
        ? data.cardTheme
        : 'emerald',
    youtubeUrl: typeof data.youtubeUrl === 'string' ? data.youtubeUrl : undefined,
    publishedAtLabel: String(data.publishedAtLabel || 'تحديث سحابي'),
    likes: typeof data.likes === 'number' ? data.likes : 0,
    commentsCount: typeof data.commentsCount === 'number' ? data.commentsCount : 0,
    comments: [],
    hidden: Boolean(data.hidden),
    createdAt: isoFromFirestore(data.createdAt),
  };
}

function mapDocToFatwa(data: Record<string, unknown>, id: string): FatwaItem {
  const rawScholar = String(data.scholarId || 'hajouri');
  const scholarId: FatwaItem['scholarId'] =
    rawScholar === 'wadaei' ||
    rawScholar === 'binbaz' ||
    rawScholar === 'uthaymeen' ||
    rawScholar === 'albani'
      ? rawScholar
      : 'hajouri';
  return {
    id: String(data.id || id),
    scholarId,
    scholarName: String(data.scholarName || ''),
    category: String(data.category || 'العقيدة'),
    question: String(data.question || ''),
    answer: String(data.answer || ''),
    source: String(data.source || ''),
    featured: scholarId === 'hajouri',
    createdAt: isoFromFirestore(data.createdAt),
  };
}

function mapDocToMotherOasis(data: Record<string, unknown>, id: string): MotherOasisItem {
  const ch = String(data.chapter || 'books');
  const chapter: MotherOasisItem['chapter'] =
    ch === 'lectures' || ch === 'stories' ? ch : 'books';
  return {
    id: String(data.id || id),
    chapter,
    title: String(data.title || ''),
    body: String(data.body || ''),
    signature: String(data.signature || 'بقلم الداعية الفاضلة أمي / الفقيرة إلى الله: أم محمد إكرام عبده علي'),
    createdAt: isoFromFirestore(data.createdAt),
  };
}

function mapDocToPoetry(data: Record<string, unknown>, id: string): PoetryAnecdoteItem {
  return {
    id: String(data.id || id),
    kind: data.kind === 'anecdote' ? 'anecdote' : 'islamic_poetry',
    title: String(data.title || ''),
    author: String(data.author || ''),
    summary: String(data.summary || ''),
    body: String(data.body || ''),
    sourceUrl: typeof data.sourceUrl === 'string' ? data.sourceUrl : undefined,
    createdAt: isoFromFirestore(data.createdAt),
  };
}

function mapDocToDeafMuteVideo(data: Record<string, unknown>, id: string): DeafMuteVideoItem {
  return {
    id: String(data.id || id),
    title: String(data.title || ''),
    description: String(data.description || ''),
    benefitText: typeof data.benefitText === 'string' ? data.benefitText : undefined,
    youtubeUrl: typeof data.youtubeUrl === 'string' ? data.youtubeUrl : undefined,
    status: data.status === 'published' ? 'published' : 'upcoming',
    category: String(data.category || 'دروس عامة'),
    managerName: String(data.managerName || 'المهندس يونس عبد الكريم'),
    createdAt: isoFromFirestore(data.createdAt),
  };
}

function mapDocToCustomAdhkar(data: Record<string, unknown>, id: string): CustomAdhkarItem {
  return {
    id: String(data.id || id),
    chapterId: String(data.chapterId || 'ch1_morning_evening'),
    title: typeof data.title === 'string' ? data.title : undefined,
    text: String(data.text || ''),
    fadl: typeof data.fadl === 'string' ? data.fadl : undefined,
    targetCount: typeof data.targetCount === 'number' && data.targetCount >= 1 ? data.targetCount : 1,
    source: String(data.source || 'الأذكار والأدعية الجامعة'),
    createdAt: isoFromFirestore(data.createdAt),
  };
}

function mapDocToCustomBook(data: Record<string, unknown>, id: string): CustomBookItem {
  const sec = String(data.section || 'hajouri');
  const section: CustomBookItem['section'] =
    sec === 'imams' || sec === 'students' ? sec : 'hajouri';
  return {
    id: String(data.id || id),
    section,
    title: String(data.title || ''),
    author: String(data.author || ''),
    category: String(data.category || 'كتب علمية'),
    summary: typeof data.summary === 'string' ? data.summary : undefined,
    pdfUrl: String(data.pdfUrl || 'coming_soon'),
    pages: typeof data.pages === 'number' ? data.pages : undefined,
    sizeLabel: typeof data.sizeLabel === 'string' ? data.sizeLabel : undefined,
    createdAt: isoFromFirestore(data.createdAt),
  };
}

function mapDocToVisitorReview(data: Record<string, unknown>, id: string): VisitorReviewItem {
  return {
    id: String(data.id || id),
    name: String(data.name || ''),
    rating: typeof data.rating === 'number' ? data.rating : 5,
    comment: String(data.comment || ''),
    role: typeof data.role === 'string' ? data.role : 'زائر الموقع',
    hidden: Boolean(data.hidden),
    createdAt: isoFromFirestore(data.createdAt),
  };
}

function mapDocToSadaMaterial(data: Record<string, unknown>, id: string): SadaMaterialItem {
  const rawType = String(data.contentType || 'article');
  const contentType: NonNullable<SadaMaterialItem['contentType']> =
    rawType === 'audio_link' || rawType === 'video_link' || rawType === 'fatwa' || rawType === 'poetry'
      ? rawType
      : 'article';
  const resolvedSpeaker = String(data.speakerName || data.scholarName || 'صدى الخير الدعوية');
  const resolvedSpeakerType: 'scholar' | 'poet' =
    data.speakerType === 'poet' || contentType === 'poetry' ? 'poet' : 'scholar';
  return {
    id: String(data.id || id),
    speakerType: resolvedSpeakerType,
    speakerName: resolvedSpeaker,
    scholarName: resolvedSpeaker,
    title: String(data.title || ''),
    category: String(data.category || 'مواد علمية ودعوية'),
    contentType,
    body: String(data.body || ''),
    externalUrl: typeof data.externalUrl === 'string' ? data.externalUrl : undefined,
    sourceLabel: typeof data.sourceLabel === 'string' ? data.sourceLabel : 'خدمة صدى الخير الدعوية',
    createdBy: typeof data.createdBy === 'string' ? data.createdBy : undefined,
    createdAt: isoFromFirestore(data.createdAt),
    updatedAt: data.updatedAt ? isoFromFirestore(data.updatedAt) : undefined,
  };
}

function mapDocToAiDawahCard(data: Record<string, unknown>, id: string): ClassicDawahCard {
  const rawLines = Array.isArray(data.lines) ? data.lines : [];
  const validColors = new Set(['#111827', '#1E3A8A', '#991B1B', '#065F46', '#B45309']);
  const lines = rawLines
    .map((l) => {
      if (!l || typeof l !== 'object') return null;
      const rec = l as {text?: unknown; color?: unknown};
      const color =
        typeof rec.color === 'string' && validColors.has(rec.color)
          ? (rec.color as ClassicDawahCard['lines'][number]['color'])
          : '#111827';
      return {text: String(rec.text || ''), color};
    })
    .filter((x): x is ClassicDawahCard['lines'][number] => Boolean(x && x.text));
  return {
    id: String(data.id || id),
    speakerLine: String(data.speakerLine || ''),
    lines,
    source: String(data.source || 'موقع مواعظ وعبر'),
    category: String(data.category || 'درر السلف'),
    isAiGenerated: Boolean(data.isAiGenerated ?? true),
    isTrending: Boolean(data.isTrending),
    engagementCount: typeof data.engagementCount === 'number' ? data.engagementCount : 0,
    createdAt: isoFromFirestore(data.createdAt),
  };
}

export async function fetchAllCloudCollections(isFirebaseAdmin = false): Promise<CloudCollectionsPayload> {
  const postsQuery = isFirebaseAdmin
    ? query(collection(db, 'site_posts'))
    : query(collection(db, 'site_posts'), where('hidden', '==', false));

  const reviewsQuery = isFirebaseAdmin
    ? query(collection(db, 'visitor_reviews'))
    : query(collection(db, 'visitor_reviews'), where('hidden', '==', false));

  const fatawaQuery = query(
    collection(db, 'site_fatawa'),
    where('scholarId', 'in', ['hajouri', 'wadaei', 'binbaz', 'uthaymeen', 'albani']),
  );

  const oasisQuery = query(
    collection(db, 'mother_oasis_items'),
    where('chapter', 'in', ['books', 'lectures', 'stories']),
  );

  const poetryQuery = query(
    collection(db, 'poetry_items'),
    where('kind', 'in', ['islamic_poetry', 'anecdote']),
  );

  const deafMuteQuery = query(
    collection(db, 'deaf_mute_videos'),
    where('status', 'in', ['published', 'upcoming']),
  );

  const customAdhkarQuery = query(
    collection(db, 'custom_adhkar'),
    where('targetCount', '>=', 1),
  );

  const customBooksQuery = query(
    collection(db, 'library_books'),
    where('section', 'in', ['hajouri', 'imams', 'students']),
  );

  const sadaMaterialsQuery = query(
    collection(db, 'sada_materials'),
    where('contentType', 'in', ['article', 'audio_link', 'video_link', 'fatwa', 'poetry']),
  );

  const aiCardsQuery = query(
    collection(db, 'ai_dawah_cards'),
    where('isAiGenerated', '==', true),
  );

  const [
    postsSnap,
    fatawaSnap,
    oasisSnap,
    poetrySnap,
    deafMuteSnap,
    adhkarSnap,
    booksSnap,
    sadaSnap,
    aiCardsSnap,
    reviewsSnap,
    settingsSnap,
  ] = await Promise.all([
    getDocs(postsQuery).catch(() => null),
    getDocs(fatawaQuery).catch(() => null),
    getDocs(oasisQuery).catch(() => null),
    getDocs(poetryQuery).catch(() => null),
    getDocs(deafMuteQuery).catch(() => null),
    getDocs(customAdhkarQuery).catch(() => null),
    getDocs(customBooksQuery).catch(() => null),
    getDocs(sadaMaterialsQuery).catch(() => null),
    getDocs(aiCardsQuery).catch(() => null),
    getDocs(reviewsQuery).catch(() => null),
    getDoc(doc(db, 'site_settings', 'main')).catch(() => null),
  ]);

  const siteSettingsPatch: Partial<SiteConfig> & {maintenanceMode?: boolean} = {};
  if (settingsSnap?.exists()) {
    const s = settingsSnap.data();
    if (typeof s.appName === 'string' && s.appName) siteSettingsPatch.appName = s.appName;
    if (typeof s.appTagline === 'string') siteSettingsPatch.appTagline = s.appTagline;
    if (typeof s.heroWisdomText === 'string' && s.heroWisdomText) {
      siteSettingsPatch.heroWisdomText = s.heroWisdomText;
    }
    if (typeof s.heroWisdomAuthor === 'string' && s.heroWisdomAuthor) {
      siteSettingsPatch.heroWisdomAuthor = s.heroWisdomAuthor;
    }
    if (typeof s.motherPrayerText === 'string' && s.motherPrayerText) {
      siteSettingsPatch.motherPrayerText = s.motherPrayerText;
    }
    if (typeof s.maintenanceMode === 'boolean') {
      siteSettingsPatch.maintenanceMode = s.maintenanceMode;
    }
  }

  return {
    posts: postsSnap ? postsSnap.docs.map((d) => mapDocToPost(d.data(), d.id)) : [],
    fatawa: fatawaSnap ? fatawaSnap.docs.map((d) => mapDocToFatwa(d.data(), d.id)) : [],
    motherOasisItems: oasisSnap ? oasisSnap.docs.map((d) => mapDocToMotherOasis(d.data(), d.id)) : [],
    poetryItems: poetrySnap ? poetrySnap.docs.map((d) => mapDocToPoetry(d.data(), d.id)) : [],
    deafMuteVideos: deafMuteSnap
      ? deafMuteSnap.docs.map((d) => mapDocToDeafMuteVideo(d.data(), d.id))
      : [],
    customAdhkar: adhkarSnap
      ? adhkarSnap.docs.map((d) => mapDocToCustomAdhkar(d.data(), d.id))
      : [],
    customBooks: booksSnap ? booksSnap.docs.map((d) => mapDocToCustomBook(d.data(), d.id)) : [],
    sadaMaterials: sadaSnap ? sadaSnap.docs.map((d) => mapDocToSadaMaterial(d.data(), d.id)) : [],
    aiDawahCards: aiCardsSnap ? aiCardsSnap.docs.map((d) => mapDocToAiDawahCard(d.data(), d.id)) : [],
    visitorReviews: reviewsSnap
      ? reviewsSnap.docs.map((d) => mapDocToVisitorReview(d.data(), d.id))
      : [],
    siteSettingsPatch:
      Object.keys(siteSettingsPatch).length > 0 ? siteSettingsPatch : undefined,
  };
}

export function subscribeCloudCollections(
  isFirebaseAdmin: boolean,
  handlers: {
    onPosts?: (items: Post[]) => void;
    onFatawa?: (items: FatwaItem[]) => void;
    onMotherOasis?: (items: MotherOasisItem[]) => void;
    onDeafMuteVideos?: (items: DeafMuteVideoItem[]) => void;
    onCustomAdhkar?: (items: CustomAdhkarItem[]) => void;
    onCustomBooks?: (items: CustomBookItem[]) => void;
    onSadaMaterials?: (items: SadaMaterialItem[]) => void;
    onAiDawahCards?: (items: ClassicDawahCard[]) => void;
    onReviews?: (items: VisitorReviewItem[]) => void;
  },
): Unsubscribe {
  const unsubs: Unsubscribe[] = [];

  if (handlers.onPosts) {
    const q = isFirebaseAdmin
      ? query(collection(db, 'site_posts'))
      : query(collection(db, 'site_posts'), where('hidden', '==', false));
    unsubs.push(
      onSnapshot(
        q,
        (snap) => handlers.onPosts?.(snap.docs.map((d) => mapDocToPost(d.data(), d.id))),
        () => undefined,
      ),
    );
  }

  if (handlers.onFatawa) {
    const q = query(
      collection(db, 'site_fatawa'),
      where('scholarId', 'in', ['hajouri', 'wadaei', 'binbaz', 'uthaymeen', 'albani']),
    );
    unsubs.push(
      onSnapshot(
        q,
        (snap) => handlers.onFatawa?.(snap.docs.map((d) => mapDocToFatwa(d.data(), d.id))),
        () => undefined,
      ),
    );
  }

  if (handlers.onMotherOasis) {
    const q = query(
      collection(db, 'mother_oasis_items'),
      where('chapter', 'in', ['books', 'lectures', 'stories']),
    );
    unsubs.push(
      onSnapshot(
        q,
        (snap) =>
          handlers.onMotherOasis?.(snap.docs.map((d) => mapDocToMotherOasis(d.data(), d.id))),
        () => undefined,
      ),
    );
  }

  if (handlers.onDeafMuteVideos) {
    const q = query(
      collection(db, 'deaf_mute_videos'),
      where('status', 'in', ['published', 'upcoming']),
    );
    unsubs.push(
      onSnapshot(
        q,
        (snap) =>
          handlers.onDeafMuteVideos?.(snap.docs.map((d) => mapDocToDeafMuteVideo(d.data(), d.id))),
        () => undefined,
      ),
    );
  }

  if (handlers.onCustomAdhkar) {
    const q = query(collection(db, 'custom_adhkar'), where('targetCount', '>=', 1));
    unsubs.push(
      onSnapshot(
        q,
        (snap) =>
          handlers.onCustomAdhkar?.(snap.docs.map((d) => mapDocToCustomAdhkar(d.data(), d.id))),
        () => undefined,
      ),
    );
  }

  if (handlers.onCustomBooks) {
    const q = query(
      collection(db, 'library_books'),
      where('section', 'in', ['hajouri', 'imams', 'students']),
    );
    unsubs.push(
      onSnapshot(
        q,
        (snap) =>
          handlers.onCustomBooks?.(snap.docs.map((d) => mapDocToCustomBook(d.data(), d.id))),
        () => undefined,
      ),
    );
  }

  if (handlers.onSadaMaterials) {
    const q = query(
      collection(db, 'sada_materials'),
      where('contentType', 'in', ['article', 'audio_link', 'video_link', 'fatwa', 'poetry']),
    );
    unsubs.push(
      onSnapshot(
        q,
        (snap) =>
          handlers.onSadaMaterials?.(snap.docs.map((d) => mapDocToSadaMaterial(d.data(), d.id))),
        () => undefined,
      ),
    );
  }

  if (handlers.onAiDawahCards) {
    const q = query(collection(db, 'ai_dawah_cards'), where('isAiGenerated', '==', true));
    unsubs.push(
      onSnapshot(
        q,
        (snap) =>
          handlers.onAiDawahCards?.(snap.docs.map((d) => mapDocToAiDawahCard(d.data(), d.id))),
        () => undefined,
      ),
    );
  }

  if (handlers.onReviews) {
    const q = isFirebaseAdmin
      ? query(collection(db, 'visitor_reviews'))
      : query(collection(db, 'visitor_reviews'), where('hidden', '==', false));
    unsubs.push(
      onSnapshot(
        q,
        (snap) =>
          handlers.onReviews?.(snap.docs.map((d) => mapDocToVisitorReview(d.data(), d.id))),
        () => undefined,
      ),
    );
  }

  return () => {
    for (const u of unsubs) u();
  };
}

export async function cloudUpsertPost(post: Post): Promise<void> {
  if (!isTrustedAdminUser(auth.currentUser)) return;
  const id = sanitizeDocId(post.id, 'post');
  const ref = doc(db, 'site_posts', id);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(
        ref,
        omitUndefined({
          id,
          title: post.title.slice(0, 260),
          excerpt: post.excerpt.slice(0, 1200),
          body: post.body.slice(0, 30000),
          author: post.author.slice(0, 160),
          sourceLabel: (post.sourceLabel || 'مواعظ وعبر').slice(0, 160),
          category: post.category.slice(0, 100),
          mediaType: post.mediaType,
          cardTheme: post.cardTheme,
          youtubeUrl: post.youtubeUrl ? post.youtubeUrl.slice(0, 400) : undefined,
          publishedAtLabel: (post.publishedAtLabel || 'اليوم').slice(0, 80),
          likes: Math.max(0, Math.floor(post.likes || 0)),
          commentsCount: Math.max(0, Math.floor(post.commentsCount || 0)),
          hidden: Boolean(post.hidden),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
      );
    } else {
      await updateDoc(
        ref,
        omitUndefined({
          title: post.title.slice(0, 260),
          excerpt: post.excerpt.slice(0, 1200),
          body: post.body.slice(0, 30000),
          author: post.author.slice(0, 160),
          sourceLabel: (post.sourceLabel || 'مواعظ وعبر').slice(0, 160),
          category: post.category.slice(0, 100),
          mediaType: post.mediaType,
          cardTheme: post.cardTheme,
          youtubeUrl: post.youtubeUrl ? post.youtubeUrl.slice(0, 400) : undefined,
          publishedAtLabel: (post.publishedAtLabel || 'اليوم').slice(0, 80),
          hidden: Boolean(post.hidden),
          updatedAt: serverTimestamp(),
        }),
      );
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `site_posts/${id}`);
  }
}

export async function cloudDeletePost(rawId: string): Promise<void> {
  if (!isTrustedAdminUser(auth.currentUser)) return;
  const id = sanitizeDocId(rawId, 'post');
  try {
    await deleteDoc(doc(db, 'site_posts', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `site_posts/${id}`);
  }
}

export async function cloudUpsertFatwa(fatwa: FatwaItem): Promise<void> {
  if (!isTrustedAdminUser(auth.currentUser)) return;
  const id = sanitizeDocId(fatwa.id, 'fatwa');
  const ref = doc(db, 'site_fatawa', id);
  try {
    const snap = await getDoc(ref);
    const base = {
      scholarId: fatwa.scholarId,
      scholarName: fatwa.scholarName.slice(0, 160),
      category: fatwa.category.slice(0, 100),
      question: fatwa.question.slice(0, 3000),
      answer: fatwa.answer.slice(0, 25000),
      source: fatwa.source.slice(0, 240),
    };
    if (!snap.exists()) {
      await setDoc(ref, {id, ...base, createdAt: serverTimestamp(), updatedAt: serverTimestamp()});
    } else {
      await updateDoc(ref, {...base, updatedAt: serverTimestamp()});
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `site_fatawa/${id}`);
  }
}

export async function cloudDeleteFatwa(rawId: string): Promise<void> {
  if (!isTrustedAdminUser(auth.currentUser)) return;
  const id = sanitizeDocId(rawId, 'fatwa');
  try {
    await deleteDoc(doc(db, 'site_fatawa', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `site_fatawa/${id}`);
  }
}

export async function cloudUpsertMotherOasis(item: MotherOasisItem): Promise<void> {
  if (!isTrustedAdminUser(auth.currentUser)) return;
  const id = sanitizeDocId(item.id, 'mo');
  const ref = doc(db, 'mother_oasis_items', id);
  try {
    const snap = await getDoc(ref);
    const base = {
      chapter: item.chapter,
      title: item.title.slice(0, 260),
      body: item.body.slice(0, 40000),
      signature: item.signature.slice(0, 220),
    };
    if (!snap.exists()) {
      await setDoc(ref, {id, ...base, createdAt: serverTimestamp(), updatedAt: serverTimestamp()});
    } else {
      await updateDoc(ref, {...base, updatedAt: serverTimestamp()});
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `mother_oasis_items/${id}`);
  }
}

export async function cloudDeleteMotherOasis(rawId: string): Promise<void> {
  if (!isTrustedAdminUser(auth.currentUser)) return;
  const id = sanitizeDocId(rawId, 'mo');
  try {
    await deleteDoc(doc(db, 'mother_oasis_items', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `mother_oasis_items/${id}`);
  }
}

export async function cloudUpsertDeafMuteVideo(item: DeafMuteVideoItem): Promise<void> {
  if (!isTrustedAdminUser(auth.currentUser)) return;
  const id = sanitizeDocId(item.id, 'dm');
  const ref = doc(db, 'deaf_mute_videos', id);
  try {
    const snap = await getDoc(ref);
    const base = omitUndefined({
      title: item.title.slice(0, 240),
      description: item.description.slice(0, 3000),
      benefitText: item.benefitText ? item.benefitText.slice(0, 4000) : undefined,
      youtubeUrl: item.youtubeUrl ? item.youtubeUrl.slice(0, 500) : undefined,
      status: item.status,
      category: item.category.slice(0, 100),
      managerName: (item.managerName || 'المهندس يونس عبد الكريم').slice(0, 140),
    });
    if (!snap.exists()) {
      await setDoc(ref, {id, ...base, createdAt: serverTimestamp(), updatedAt: serverTimestamp()});
    } else {
      await updateDoc(ref, {...base, updatedAt: serverTimestamp()});
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `deaf_mute_videos/${id}`);
  }
}

export async function cloudDeleteDeafMuteVideo(rawId: string): Promise<void> {
  if (!isTrustedAdminUser(auth.currentUser)) return;
  const id = sanitizeDocId(rawId, 'dm');
  try {
    await deleteDoc(doc(db, 'deaf_mute_videos', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `deaf_mute_videos/${id}`);
  }
}

export async function cloudUpsertCustomAdhkar(item: CustomAdhkarItem): Promise<void> {
  if (!isTrustedAdminUser(auth.currentUser)) return;
  const id = sanitizeDocId(item.id, 'dhikr');
  const ref = doc(db, 'custom_adhkar', id);
  try {
    const snap = await getDoc(ref);
    const base = omitUndefined({
      chapterId: item.chapterId.slice(0, 80),
      title: item.title ? item.title.slice(0, 200) : undefined,
      text: item.text.slice(0, 6000),
      fadl: item.fadl ? item.fadl.slice(0, 2000) : undefined,
      targetCount: Math.min(1000, Math.max(1, Math.floor(item.targetCount || 1))),
      source: item.source.slice(0, 240),
    });
    if (!snap.exists()) {
      await setDoc(ref, {id, ...base, createdAt: serverTimestamp(), updatedAt: serverTimestamp()});
    } else {
      await updateDoc(ref, {...base, updatedAt: serverTimestamp()});
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `custom_adhkar/${id}`);
  }
}

export async function cloudDeleteCustomAdhkar(rawId: string): Promise<void> {
  if (!isTrustedAdminUser(auth.currentUser)) return;
  const id = sanitizeDocId(rawId, 'dhikr');
  try {
    await deleteDoc(doc(db, 'custom_adhkar', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `custom_adhkar/${id}`);
  }
}

export async function cloudUpsertCustomBook(book: CustomBookItem): Promise<void> {
  if (!isTrustedAdminUser(auth.currentUser)) return;
  const id = sanitizeDocId(book.id, 'book');
  const ref = doc(db, 'library_books', id);
  try {
    const snap = await getDoc(ref);
    const base = omitUndefined({
      section: book.section,
      title: book.title.slice(0, 260),
      author: book.author.slice(0, 180),
      category: book.category.slice(0, 100),
      summary: book.summary ? book.summary.slice(0, 2500) : undefined,
      pdfUrl: (book.pdfUrl || 'coming_soon').slice(0, 600),
      pages: typeof book.pages === 'number' ? Math.max(0, Math.min(10000, Math.floor(book.pages))) : undefined,
      sizeLabel: book.sizeLabel ? book.sizeLabel.slice(0, 60) : undefined,
    });
    if (!snap.exists()) {
      await setDoc(ref, {id, ...base, createdAt: serverTimestamp(), updatedAt: serverTimestamp()});
    } else {
      await updateDoc(ref, {...base, updatedAt: serverTimestamp()});
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `library_books/${id}`);
  }
}

export async function cloudDeleteCustomBook(rawId: string): Promise<void> {
  if (!isTrustedAdminUser(auth.currentUser)) return;
  const id = sanitizeDocId(rawId, 'book');
  try {
    await deleteDoc(doc(db, 'library_books', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `library_books/${id}`);
  }
}

export async function cloudSaveSiteSettings(
  cfg: SiteConfig,
  brandHandle: string,
  maintenanceMode: boolean,
): Promise<void> {
  if (!isTrustedAdminUser(auth.currentUser)) return;
  const ref = doc(db, 'site_settings', 'main');
  try {
    await setDoc(ref, {
      appName: cfg.appName.slice(0, 120),
      appTagline: cfg.appTagline.slice(0, 260),
      brandHandle: brandHandle.slice(0, 80),
      heroWisdomText: cfg.heroWisdomText.slice(0, 2000),
      heroWisdomAuthor: cfg.heroWisdomAuthor.slice(0, 160),
      motherPrayerText: cfg.motherPrayerText.slice(0, 2000),
      maintenanceMode: Boolean(maintenanceMode),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'site_settings/main');
  }
}

export async function cloudCreateVisitorReview(review: VisitorReviewItem): Promise<void> {
  const id = sanitizeDocId(review.id, 'rev');
  const ref = doc(db, 'visitor_reviews', id);
  try {
    await setDoc(
      ref,
      omitUndefined({
        id,
        name: review.name.slice(0, 120),
        rating: Math.min(5, Math.max(1, Math.floor(review.rating))),
        comment: review.comment.slice(0, 2000),
        role: review.role ? review.role.slice(0, 120) : undefined,
        hidden: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  } catch {
    // Fallback cleanly if offline/unauthenticated network fails
  }
}

export async function cloudUpdateReviewVisibility(rawId: string, hidden: boolean): Promise<void> {
  if (!isTrustedAdminUser(auth.currentUser)) return;
  const id = sanitizeDocId(rawId, 'rev');
  try {
    await updateDoc(doc(db, 'visitor_reviews', id), {
      hidden: Boolean(hidden),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `visitor_reviews/${id}`);
  }
}

export async function cloudDeleteReview(rawId: string): Promise<void> {
  if (!isTrustedAdminUser(auth.currentUser)) return;
  const id = sanitizeDocId(rawId, 'rev');
  try {
    await deleteDoc(doc(db, 'visitor_reviews', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `visitor_reviews/${id}`);
  }
}

export async function cloudUpsertSadaMaterial(item: SadaMaterialItem): Promise<void> {
  if (!isTrustedAdminUser(auth.currentUser)) return;
  const id = sanitizeDocId(item.id, 'sada');
  const ref = doc(db, 'sada_materials', id);
  const resolvedSpeaker = (item.speakerName || item.scholarName || 'صدى الخير الدعوية').slice(0, 180);
  const resolvedContentType =
    item.contentType || (item.speakerType === 'poet' ? 'poetry' : item.externalUrl ? 'audio_link' : 'article');
  try {
    const snap = await getDoc(ref);
    const base = omitUndefined({
      scholarName: resolvedSpeaker,
      title: item.title.slice(0, 260),
      category: item.category.slice(0, 100),
      contentType: resolvedContentType,
      body: item.body.slice(0, 30000),
      externalUrl: item.externalUrl ? item.externalUrl.slice(0, 600) : undefined,
      sourceLabel: item.sourceLabel ? item.sourceLabel.slice(0, 180) : 'خدمة صدى الخير الدعوية',
    });
    if (!snap.exists()) {
      await setDoc(ref, {id, ...base, createdAt: serverTimestamp(), updatedAt: serverTimestamp()});
    } else {
      await updateDoc(ref, {...base, updatedAt: serverTimestamp()});
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `sada_materials/${id}`);
  }
}

export async function cloudDeleteSadaMaterial(rawId: string): Promise<void> {
  if (!isTrustedAdminUser(auth.currentUser)) return;
  const id = sanitizeDocId(rawId, 'sada');
  try {
    await deleteDoc(doc(db, 'sada_materials', id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `sada_materials/${id}`);
  }
}

export async function cloudUpsertAiDawahCard(card: ClassicDawahCard): Promise<void> {
  if (!isTrustedAdminUser(auth.currentUser)) return;
  const id = sanitizeDocId(card.id, 'card');
  const ref = doc(db, 'ai_dawah_cards', id);
  try {
    const snap = await getDoc(ref);
    const base = {
      speakerLine: card.speakerLine.slice(0, 220),
      lines: card.lines.slice(0, 6),
      source: card.source.slice(0, 220),
      category: card.category.slice(0, 100),
      isAiGenerated: true,
      isTrending: Boolean(card.isTrending),
      engagementCount: Math.max(0, Math.floor(card.engagementCount || 0)),
    };
    if (!snap.exists()) {
      await setDoc(ref, {id, ...base, createdAt: serverTimestamp(), updatedAt: serverTimestamp()});
    } else {
      await updateDoc(ref, {...base, updatedAt: serverTimestamp()});
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `ai_dawah_cards/${id}`);
  }
}

export async function cloudUpsertVisitorProfile(profile: VisitorProfile): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  const profileId = user.uid;
  const ref = doc(db, 'visitor_profiles', profileId);
  try {
    const snap = await getDoc(ref);
    const base = omitUndefined({
      id: profile.id,
      provider: profile.provider,
      name: profile.name.slice(0, 140),
      email: profile.email ? profile.email.slice(0, 180) : undefined,
      whatsapp: profile.whatsapp ? profile.whatsapp.slice(0, 40) : undefined,
      likedPostIds: Array.isArray(profile.likedPostIds) ? profile.likedPostIds.slice(0, 200) : [],
      bookmarkedPostIds: Array.isArray(profile.bookmarkedPostIds)
        ? profile.bookmarkedPostIds.slice(0, 200)
        : [],
      bookmarkedFatwaIds: Array.isArray(profile.bookmarkedFatwaIds)
        ? profile.bookmarkedFatwaIds.slice(0, 200)
        : [],
    });
    if (!snap.exists()) {
      await setDoc(ref, {
        ...base,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        ...base,
        updatedAt: serverTimestamp(),
      });
    }
  } catch {
    // Non-blocking fallback when offline
  }
}

export async function cloudFetchVisitorProfile(): Promise<VisitorProfile | null> {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    const snap = await getDoc(doc(db, 'visitor_profiles', user.uid));
    if (!snap.exists()) return null;
    const d = snap.data();
    const provider: VisitorProfile['provider'] =
      d.provider === 'google' || d.provider === 'facebook' ? d.provider : 'email';
    return {
      id: String(d.id || user.uid),
      firebaseUid: user.uid,
      provider,
      name: String(d.name || user.displayName || 'زائر'),
      email: typeof d.email === 'string' ? d.email : user.email || undefined,
      whatsapp: typeof d.whatsapp === 'string' ? d.whatsapp : undefined,
      likedPostIds: Array.isArray(d.likedPostIds) ? d.likedPostIds.map(String) : [],
      bookmarkedPostIds: Array.isArray(d.bookmarkedPostIds) ? d.bookmarkedPostIds.map(String) : [],
      bookmarkedFatwaIds: Array.isArray(d.bookmarkedFatwaIds)
        ? d.bookmarkedFatwaIds.map(String)
        : [],
      createdAt: isoFromFirestore(d.createdAt),
    };
  } catch {
    return null;
  }
}
