import {
  Award,
  CheckCircle2,
  Flame,
  Medal,
  RefreshCw,
  Trophy,
  UserCheck,
} from 'lucide-react';
import {useCallback, useEffect, useState, type FormEvent} from 'react';
import {DAWAH_QUIZ_SUBJECTS} from '../data/dawahQuizData';
import type {DawahQuizSubject, QuizLeaderboardEntry} from '../types';
import {useI18n} from '../utils/i18n';
import {
  fetchCategoryQuizLeaderboard,
  getOrCreateQuizParticipantId,
  getQuizTodayKey,
  loadQuizNickname,
  publishQuizLeaderboardScore,
} from '../utils/quizStorage';

const LEADERBOARD_CATEGORIES: Array<{
  id: DawahQuizSubject;
  labelAr: string;
  labelEn: string;
}> = [
  {id: 'all', labelAr: 'الاختبار اليومي', labelEn: 'Daily Mixed'},
  ...DAWAH_QUIZ_SUBJECTS.map((s) => ({
    id: s.id as DawahQuizSubject,
    labelAr: s.labelAr,
    labelEn: s.labelEn,
  })),
];

function buildExpectedEntryId(participantId: string, category: DawahQuizSubject): string {
  const cleaned = `${participantId}_${category}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 110);
  return cleaned.length >= 2 ? cleaned : `qlb_${category}`;
}

export function QuizLeaderboard({
  initialCategory = 'all',
  visitorId,
  visitorName,
  currentCategoryScore,
  currentCategoryCorrect,
  currentCategoryTotal,
  streakDays = 0,
  refreshSignal = 0,
  onNicknameUpdated,
  onNotify,
}: {
  initialCategory?: DawahQuizSubject;
  visitorId?: string;
  visitorName?: string;
  currentCategoryScore?: number;
  currentCategoryCorrect?: number;
  currentCategoryTotal?: number;
  streakDays?: number;
  refreshSignal?: number;
  onNicknameUpdated?: (nextNickname: string) => void;
  onNotify?: (msg: string) => void;
}) {
  const {isEn, tr, formatNumber} = useI18n();
  const [selectedCategory, setSelectedCategory] = useState<DawahQuizSubject>(initialCategory);
  const [entries, setEntries] = useState<QuizLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [savingNick, setSavingNick] = useState<boolean>(false);
  const [nicknameInput, setNicknameInput] = useState<string>(() =>
    loadQuizNickname(visitorName),
  );

  const participantId = getOrCreateQuizParticipantId(visitorId);
  const myEntryId = buildExpectedEntryId(participantId, selectedCategory);

  useEffect(() => {
    setSelectedCategory(initialCategory);
  }, [initialCategory]);

  useEffect(() => {
    const saved = loadQuizNickname(visitorName);
    if (saved) setNicknameInput(saved);
  }, [visitorName]);

  const loadEntries = useCallback(async (cat: DawahQuizSubject) => {
    setLoading(true);
    try {
      const list = await fetchCategoryQuizLeaderboard(cat, 10);
      setEntries(list);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEntries(selectedCategory);
  }, [selectedCategory, refreshSignal, loadEntries]);

  const handleSaveNickname = async (e: FormEvent) => {
    e.preventDefault();
    const cleaned = nicknameInput.trim().slice(0, 40);
    if (cleaned.length < 2) {
      onNotify?.(
        tr(
          'يرجى كتابة اسم مستعار من حرفين على الأقل',
          'Please enter a nickname of at least 2 characters',
        ),
      );
      return;
    }

    setSavingNick(true);
    try {
      const targetCat = initialCategory;
      const existingMyRow = entries.find((item) => item.id === myEntryId);
      const scoreToPublish = Math.max(
        existingMyRow?.score || 0,
        targetCat === selectedCategory ? currentCategoryScore || 0 : 0,
      );
      const correctToPublish = Math.max(
        existingMyRow?.correctCount || 0,
        targetCat === selectedCategory ? currentCategoryCorrect || 0 : 0,
      );
      const totalToPublish = Math.max(
        existingMyRow?.totalQuestions || 1,
        targetCat === selectedCategory ? currentCategoryTotal || 1 : 1,
      );

      const updatedList = await publishQuizLeaderboardScore({
        visitorId,
        nickname: cleaned,
        category: selectedCategory,
        score: scoreToPublish,
        correctCount: correctToPublish,
        totalQuestions: totalToPublish,
        streakDays,
        dateKey: getQuizTodayKey(),
      });

      setEntries(updatedList);
      onNicknameUpdated?.(cleaned);
      onNotify?.(
        tr(
          'تم حفظ اسمك المستعار وتحديث لوحة المتصدرين بنجاح',
          'Nickname saved and leaderboard updated',
        ),
      );
    } catch {
      onNotify?.(
        tr(
          'تعذر تحديث لوحة المتصدرين حالياً، تم الحفظ محلياً',
          'Could not sync leaderboard right now; saved locally',
        ),
      );
    } finally {
      setSavingNick(false);
    }
  };

  const activeCategoryMeta = LEADERBOARD_CATEGORIES.find((c) => c.id === selectedCategory);

  return (
    <div
      id="quiz-leaderboard"
      className="rounded-2xl bg-white dark:bg-[#223a32] border border-slate-200/80 dark:border-white/10 p-4 sm:p-5 space-y-4"
    >
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/70 dark:border-white/10">
        <div className="flex items-start gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#fff4de] dark:bg-[#2f2b16] text-[#9a6b00] dark:text-[#ffc968] flex items-center justify-center shrink-0">
            <Trophy className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm sm:text-base font-extrabold text-[#0e1d25] dark:text-white">
              {tr('لوحة متصدري الاختبار الدعوي', 'Quiz Leaderboard')}
            </h4>
            <p className="text-[11px] text-[#6e7a71] dark:text-slate-400">
              {tr(
                `أعلى المشاركين في قسم: ${activeCategoryMeta?.labelAr || 'الاختبار اليومي'}`,
                `Top performers in: ${activeCategoryMeta?.labelEn || 'Daily Mixed'}`,
              )}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void loadEntries(selectedCategory)}
          disabled={loading}
          className="min-h-[34px] px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200/80 dark:hover:bg-white/15 text-[#0e1d25] dark:text-white text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto transition-colors whitespace-nowrap"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{tr('تحديث الترتيب', 'Refresh')}</span>
        </button>
      </div>

      {/* Category Filter Tabs */}
      <div
        role="tablist"
        aria-label={tr('تصفية لوحة المتصدرين حسب القسم', 'Filter leaderboard by category')}
        className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5"
      >
        {LEADERBOARD_CATEGORIES.map((cat) => {
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setSelectedCategory(cat.id)}
              className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-colors border ${
                isActive
                  ? 'bg-[#006a46] text-white border-[#006a46]'
                  : 'bg-[#f8fafc] dark:bg-[#192d26] text-[#3e4a42] dark:text-slate-300 border-slate-200/80 dark:border-white/10 hover:border-[#006a46]/60'
              }`}
            >
              {isEn ? cat.labelEn : cat.labelAr}
            </button>
          );
        })}
      </div>

      {/* Inline Nickname Form for Publishing / Updating Public Alias */}
      <form
        onSubmit={(e) => void handleSaveNickname(e)}
        className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 rounded-xl bg-[#f8fafc] dark:bg-[#192d26] border border-slate-200/80 dark:border-white/10 p-2.5"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <UserCheck className="w-4 h-4 text-[#006a46] dark:text-[#6cdba6] shrink-0" />
          <input
            type="text"
            value={nicknameInput}
            onChange={(e) => setNicknameInput(e.target.value)}
            maxLength={40}
            placeholder={tr(
              'اكتب اسمك المستعار للظهور في لوحة المتصدرين...',
              'Enter your display nickname for the leaderboard...',
            )}
            className="w-full bg-transparent text-xs sm:text-sm font-semibold text-[#0e1d25] dark:text-white placeholder:text-slate-400 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={savingNick}
          className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-[#006a46] hover:bg-[#005235] disabled:opacity-60 text-white text-xs font-bold whitespace-nowrap transition-colors shrink-0"
        >
          {savingNick
            ? tr('جارٍ الحفظ...', 'Saving...')
            : tr('تثبيت الاسم والنتيجة', 'Save Nickname & Score')}
        </button>
      </form>

      {/* Leaderboard List */}
      {loading ? (
        <div className="space-y-2 py-2">
          {[1, 2, 3].map((row) => (
            <div
              key={row}
              className="h-12 rounded-xl bg-slate-100/80 dark:bg-white/5 animate-pulse"
            />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-xl bg-[#f8fafc] dark:bg-[#192d26] border border-dashed border-slate-200 dark:border-white/15 p-6 text-center space-y-1.5">
          <Award className="w-6 h-6 text-[#006a46] dark:text-[#6cdba6] mx-auto" />
          <p className="text-xs sm:text-sm font-bold text-[#0e1d25] dark:text-white">
            {tr(
              'لا توجد نتائج مسجلة في هذا القسم بعد — كن أول المتصدرين!',
              'No scores recorded in this category yet — be the first on the board!',
            )}
          </p>
          <p className="text-[11px] text-[#6e7a71] dark:text-slate-400">
            {tr(
              'أجب عن أسئلة القسم ثم ثبّت اسمك المستعار أعلاه لتسجيل نتيجتك في السحابة',
              'Complete a round and save your nickname above to appear here',
            )}
          </p>
        </div>
      ) : (
        <ol className="space-y-2">
          {entries.map((entry, idx) => {
            const rank = idx + 1;
            const isCurrentUser = entry.id === myEntryId;
            const accuracyPct =
              entry.totalQuestions > 0
                ? Math.min(100, Math.round((entry.correctCount / entry.totalQuestions) * 100))
                : 0;

            return (
              <li
                key={entry.id}
                className={`rounded-xl border px-3.5 py-2.5 flex items-center justify-between gap-3 transition-colors ${
                  isCurrentUser
                    ? 'bg-[#eefaf3] dark:bg-[#133126] border-[#006a46]/50 dark:border-[#6cdba6]/50'
                    : 'bg-[#f8fafc] dark:bg-[#192d26] border-slate-200/80 dark:border-white/10'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-extrabold tabular-nums shrink-0 ${
                      rank === 1
                        ? 'bg-[#ffc968] text-[#271900]'
                        : rank === 2
                          ? 'bg-slate-200 dark:bg-slate-600 text-[#0e1d25] dark:text-white'
                          : rank === 3
                            ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200'
                            : 'bg-white dark:bg-white/10 text-[#6e7a71] dark:text-slate-300 border border-slate-200/70 dark:border-white/10'
                    }`}
                  >
                    {rank <= 3 ? (
                      <Medal className="w-4 h-4" />
                    ) : (
                      <span>#{formatNumber(rank)}</span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs sm:text-sm font-extrabold text-[#0e1d25] dark:text-white truncate">
                        {entry.nickname}
                      </span>
                      {isCurrentUser && (
                        <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-[#006a46] dark:text-[#6cdba6]">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{tr('(أنت)', '(You)')}</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-[#6e7a71] dark:text-slate-400 tabular-nums">
                      <span>
                        {tr(
                          `${formatNumber(entry.correctCount)}/${formatNumber(entry.totalQuestions)} (${formatNumber(accuracyPct)}٪)`,
                          `${entry.correctCount}/${entry.totalQuestions} (${accuracyPct}%)`,
                        )}
                      </span>
                      {typeof entry.streakDays === 'number' && entry.streakDays > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-0.5 text-[#b45309] dark:text-[#ffc968]">
                            <Flame className="w-3 h-3" />
                            <span>
                              {tr(`${formatNumber(entry.streakDays)} ي`, `${entry.streakDays}d`)}
                            </span>
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-end shrink-0">
                  <span className="text-sm sm:text-base font-extrabold text-[#006a46] dark:text-[#6cdba6] tabular-nums block">
                    {formatNumber(entry.score)}
                  </span>
                  <span className="text-[10px] font-semibold text-[#6e7a71] dark:text-slate-400 block">
                    {tr('نقطة', 'pts')}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
