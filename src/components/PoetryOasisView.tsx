import {Archive, Copy, Heart, Loader2, Search, Sparkles} from 'lucide-react';
import {useEffect, useMemo, useState} from 'react';
import type {PermanentArchiveItem, PoetryAnecdoteItem, Post} from '../types';
import {useI18n} from '../utils/i18n';
import {resolveFontFamilyCss, resolveFontSizeSpec, useReadingPrefs} from '../utils/readingPrefs';
import {getPublicSiteUrl} from '../utils/storage';
import {trackInteraction} from '../utils/telemetry';
import {ComingSoonState} from './ComingSoonState';

type OasisTab = 'all' | 'islamic_poetry' | 'anecdote' | 'favorites' | 'permanent_archive';

const POETRY_FAV_KEY = 'mawaedh_poetry_favorites_v1';

export function PoetryOasisView({
  poetryItems,
  permanentArchive,
  initialMode = 'all',
  highlightedItemId,
  onPoetryUpdated,
  onArchiveUpdated,
  onShareCard,
  onNotify,
}: {
  poetryItems: PoetryAnecdoteItem[];
  permanentArchive: PermanentArchiveItem[];
  initialMode?: 'all' | 'permanent_archive';
  highlightedItemId?: string | null;
  onPoetryUpdated: (items: PoetryAnecdoteItem[]) => void;
  onArchiveUpdated: () => void;
  onShareCard?: (post: Post) => void;
  onNotify: (msg: string) => void;
}) {
  const {tr, formatNumber} = useI18n();
  const {prefs} = useReadingPrefs();
  const fontSpec = resolveFontSizeSpec(prefs.fontSize);

  const [tab, setTab] = useState<OasisTab>(initialMode === 'permanent_archive' ? 'permanent_archive' : 'all');
  const [query, setQuery] = useState('');
  const [generating, setGenerating] = useState(false);
  const [favIds, setFavIds] = useState<string[]>(() => {
    try {
      const raw = window.localStorage.getItem(POETRY_FAV_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    setTab(initialMode === 'permanent_archive' ? 'permanent_archive' : 'all');
  }, [initialMode]);

  useEffect(() => {
    if (!highlightedItemId) return;
    if (permanentArchive.some((a) => a.id === highlightedItemId)) {
      setTab('permanent_archive');
    } else {
      setTab('all');
    }
    const timer = setTimeout(() => {
      const el = document.getElementById(`poetry-item-${highlightedItemId}`);
      el?.scrollIntoView({behavior: 'smooth', block: 'center'});
    }, 180);
    return () => clearTimeout(timer);
  }, [highlightedItemId, permanentArchive]);

  useEffect(() => {
    void fetch('/api/poetry/daily-sync', {method: 'POST'})
      .then((res) => (res.ok ? res.json() : null))
      .then((data: {updated?: boolean; poetryItems?: PoetryAnecdoteItem[]} | null) => {
        if (data?.updated && Array.isArray(data.poetryItems)) {
          onPoetryUpdated(data.poetryItems);
          onArchiveUpdated();
        }
      })
      .catch(() => undefined);
  }, [onArchiveUpdated, onPoetryUpdated]);

  const toggleFav = (id: string) => {
    setFavIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev];
      try {
        window.localStorage.setItem(POETRY_FAV_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleGenerateNow = async (kind: 'anecdote' | 'islamic_poetry' = 'anecdote') => {
    if (generating) return;
    setGenerating(true);
    try {
      const res = await fetch('/api/poetry/generate', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({kind}),
      });
      const data = (await res.json()) as {
        error?: string;
        poetryItems?: PoetryAnecdoteItem[];
      };
      if (!res.ok || !Array.isArray(data.poetryItems)) {
        onNotify(data.error || 'تعذر توليد مادة أدبية جديدة حالياً');
        return;
      }
      onPoetryUpdated(data.poetryItems);
      onArchiveUpdated();
      onNotify('تم توليد مادة أدبية جديدة وحفظها تلقائياً في الأرشيف الشامل الدائم');
    } catch {
      onNotify('تعذر الاتصال بالخادم لتوليد الطرفة الجديدة');
    } finally {
      setGenerating(false);
    }
  };

  const q = query.trim().toLowerCase();

  const filteredPoetry = useMemo(() => {
    return poetryItems.filter((item) => {
      if (tab === 'islamic_poetry' && item.kind !== 'islamic_poetry') return false;
      if (tab === 'anecdote' && item.kind !== 'anecdote') return false;
      if (tab === 'favorites' && !favIds.includes(item.id)) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.author.toLowerCase().includes(q) ||
        item.body.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q)
      );
    });
  }, [poetryItems, tab, favIds, q]);

  const filteredArchive = useMemo(() => {
    return permanentArchive.filter((item) => {
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.body.toLowerCase().includes(q) ||
        item.author.toLowerCase().includes(q) ||
        item.publishedDate.toLowerCase().includes(q)
      );
    });
  }, [permanentArchive, q]);

  const handleCopy = async (id: string, title: string, body: string, author: string) => {
    const clean = body.replace(/\s+/g, ' ').trim();
    const itemUrl = getPublicSiteUrl(`/?tab=poetry&item=${encodeURIComponent(id)}`);
    const payload =
      clean.length > 140
        ? `${title}\n\n${clean.slice(0, 120).trim()}...\n\n📲 لقراءة الأبيات أو الطرفة كاملة:\n${itemUrl}\n— ${author} · موقع مواعظ وعبر`
        : `${title}\n\n${body}\n\n— ${author}\n🌐 ${itemUrl}`;
    try {
      await navigator.clipboard.writeText(payload);
      trackInteraction('sermon_share', 'poetry');
      onNotify(
        clean.length > 140
          ? tr('تم نسخ المختصر مع رابط استكمال النص', 'Short teaser & link copied')
          : tr('تم نسخ النص بنجاح', 'Copied cleanly'),
      );
    } catch {
      onNotify(tr('تعذر النسخ التلقائي', 'Unable to copy automatically'));
    }
  };

  const shareAsClassicCard = (
    id: string,
    title: string,
    body: string,
    author: string,
    categoryLabel: string,
  ) => {
    if (!onShareCard) return;
    onShareCard({
      id: `poetry_${id}`,
      title,
      excerpt: body,
      body,
      author,
      sourceLabel: categoryLabel,
      category: categoryLabel,
      mediaType: 'quote',
      cardTheme: 'emerald',
      likes: 0,
      commentsCount: 0,
      publishedAtLabel: categoryLabel,
      createdAt: new Date().toISOString(),
      shareUrl: getPublicSiteUrl(`/?tab=poetry&item=${encodeURIComponent(id)}`),
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#223a32] p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#0e1d25] dark:text-white">
              {tr('واحة الشعر والطرائف والأرشيف الشامل الدائم', 'Poetry & Anecdotes Oasis')}
            </h1>
            <p className="text-sm text-[#3e4a42] dark:text-slate-300 mt-1">
              شعر إسلامي رصين ونوادر العرب والبلغاء للترويح المباح دون محاذير شرعية · يتجدد يومياً ويُحفظ دائماً في الأرشيف
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={generating}
              onClick={() => handleGenerateNow('anecdote')}
              className="min-h-[44px] px-4 py-2.5 rounded-2xl bg-[#006a46] hover:bg-[#005235] disabled:opacity-60 text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition-colors"
            >
              {generating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span>توليد طُرفة جديدة الآن</span>
            </button>
          </div>
        </div>

        {/* Search & Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            {[
              {id: 'all' as const, label: 'الكل'},
              {id: 'islamic_poetry' as const, label: 'شعر إسلامي'},
              {id: 'anecdote' as const, label: 'نوادر وطرائف'},
              {id: 'favorites' as const, label: `المفضلة (${formatNumber(favIds.length)})`},
              {id: 'permanent_archive' as const, label: `الأرشيف الشامل الدائم (${formatNumber(permanentArchive.length)})`},
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors ${
                  tab === t.id
                    ? 'bg-[#006a46] text-white'
                    : 'bg-[#f3f6f4] dark:bg-white/10 text-[#0e1d25] dark:text-slate-200 hover:bg-[#e7efe9]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث في الأبيات أو النوادر..."
              className="w-full rounded-xl border border-slate-200 dark:border-white/15 bg-[#f8faf9] dark:bg-[#1b3029] pr-9 pl-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      {tab === 'permanent_archive' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-base font-extrabold text-[#0e1d25] dark:text-white flex items-center gap-2">
              <Archive className="w-5 h-5 text-[#006a46] dark:text-[#6cdba6]" />
              <span>سجل الأرشيف الشامل الدائم للمواد المولدة (محفوظ دون حذف)</span>
            </h2>
            <span className="text-xs text-[#6e7a71] dark:text-slate-400 tabular-nums">
              {formatNumber(filteredArchive.length)} مادة مؤرشفة
            </span>
          </div>
          {filteredArchive.length === 0 ? (
            <ComingSoonState
              badgeText="قريباً بإذن الله"
              title="الأرشيف الشامل بانتظار الإضافات الجديدة"
              description="سيظهر هنا تلقائياً كل محتوى يتم توليده يومياً أو إضافته عبر المشرفين بتاريخ نشره دون حذف القديم."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredArchive.map((arch) => (
                <article
                  id={`poetry-item-${arch.id}`}
                  key={arch.id}
                  className={`rounded-2xl border bg-white dark:bg-[#223a32] p-5 space-y-3 ${
                    highlightedItemId === arch.id
                      ? 'border-[#006a46] ring-2 ring-[#006a46]/30'
                      : 'border-slate-200/80 dark:border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs text-[#6e7a71] dark:text-slate-400">
                    <span className="font-bold text-[#006a46] dark:text-[#6cdba6]">{arch.sourceLabel}</span>
                    <span className="tabular-nums">{arch.publishedDate}</span>
                  </div>
                  <h3 className="text-base font-extrabold text-[#0e1d25] dark:text-white">{arch.title}</h3>
                  <p
                    dir="rtl"
                    style={{fontFamily: resolveFontFamilyCss(prefs.fontFamily)}}
                    className={`${fontSpec.bodyClass} text-[#28352e] dark:text-slate-200 whitespace-pre-line`}
                  >
                    {arch.body}
                  </p>
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-white/10 text-xs">
                    <span className="font-semibold text-[#6e7a71] dark:text-slate-400">{arch.author}</span>
                    <div className="flex items-center gap-2">
                      {onShareCard && (
                        <button
                          type="button"
                          onClick={() =>
                            shareAsClassicCard(arch.id, arch.title, arch.body, arch.author, 'طرائف وعبر')
                          }
                          className="px-2.5 py-1.5 rounded-lg bg-[#fffbf2] dark:bg-white/10 text-[#7c5800] dark:text-[#f2be5e] font-bold flex items-center gap-1"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>بطاقة + QR</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleCopy(arch.id, arch.title, arch.body, arch.author)}
                        className="text-[#006a46] dark:text-[#6cdba6] font-bold flex items-center gap-1 hover:underline"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>مشاركة مختصرة</span>
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      ) : filteredPoetry.length === 0 ? (
        <ComingSoonState
          badgeText="قريباً بإذن الله"
          title="لا توجد أبيات أو نوادر مطابقة حالياً"
          description="يمكنكم مسح كلمة البحث أو توليد طُرفة جديدة أو انتظار الإضافات الأدبية القادمة قريباً بإذن الله."
          actionLabel={query ? 'عرض الكل' : undefined}
          onAction={query ? () => setQuery('') : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredPoetry.map((item) => {
            const isFav = favIds.includes(item.id);
            const catLabel = item.kind === 'islamic_poetry' ? 'شعر إسلامي' : 'طرائف وعبر';
            return (
              <article
                id={`poetry-item-${item.id}`}
                key={item.id}
                className={`rounded-3xl border bg-white dark:bg-[#223a32] p-5 sm:p-6 shadow-sm flex flex-col justify-between space-y-4 ${
                  highlightedItemId === item.id
                    ? 'border-[#006a46] ring-2 ring-[#006a46]/30'
                    : 'border-slate-200/80 dark:border-white/10'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 text-xs text-[#6e7a71] dark:text-slate-400">
                    <span className="font-bold text-[#006a46] dark:text-[#6cdba6]">
                      {item.kind === 'islamic_poetry' ? 'شعر إسلامي' : 'نوادر وطرائف'}
                      {item.isAiGenerated ? ' · مجدد يومياً' : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleFav(item.id)}
                      aria-label="إضافة للمفضلة"
                      className={`p-1.5 rounded-lg transition-colors ${
                        isFav ? 'text-rose-600' : 'text-slate-400 hover:text-rose-500'
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
                    </button>
                  </div>

                  <h3 className="text-lg font-extrabold text-[#0e1d25] dark:text-white">{item.title}</h3>
                  <p
                    dir="rtl"
                    style={{fontFamily: resolveFontFamilyCss(prefs.fontFamily)}}
                    className={`${fontSpec.bodyClass} text-[#1d2a22] dark:text-slate-200 whitespace-pre-line`}
                  >
                    {item.body}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-white/10 text-xs">
                  <span className="font-semibold text-[#6e7a71] dark:text-slate-400">{item.author}</span>
                  <div className="flex items-center gap-2">
                    {onShareCard && (
                      <button
                        type="button"
                        onClick={() => shareAsClassicCard(item.id, item.title, item.body, item.author, catLabel)}
                        className="px-3 py-1.5 rounded-lg bg-[#fffbf2] dark:bg-white/10 text-[#7c5800] dark:text-[#f2be5e] font-bold flex items-center gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>بطاقة + باركود</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleCopy(item.id, item.title, item.body, item.author)}
                      className="px-3 py-1.5 rounded-lg bg-[#f3f6f4] dark:bg-white/10 text-[#0e1d25] dark:text-white font-bold flex items-center gap-1.5"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>مشاركة مختصرة</span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
