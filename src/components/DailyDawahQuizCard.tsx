import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  BookOpenCheck,
  CheckCircle2,
  Flame,
  GraduationCap,
  HelpCircle,
  HeartHandshake,
  Layers,
  Play,
  RotateCcw,
  Scale,
  ScrollText,
  Share2,
  ShieldCheck,
  Trophy,
  UserCheck,
  XCircle,
} from 'lucide-react';
import {useEffect, useMemo, useState} from 'react';
import {DAWAH_QUIZ_SUBJECTS} from '../data/dawahQuizData';
import type {DawahQuizQuestion, DawahQuizSubject} from '../types';
import {useI18n} from '../utils/i18n';
import {
  DAILY_COMPLETION_BONUS,
  DAILY_QUESTION_POINTS,
  PRACTICE_QUESTION_POINTS,
  getQuizTodayKey,
  loadCategoryBestScores,
  loadQuizNickname,
  publishQuizLeaderboardScore,
  saveCategoryBestScore,
  saveQuizNickname,
  useDailyDawahQuiz,
  type CategoryBestStats,
} from '../utils/quizStorage';
import {resolveFontFamilyCss, useReadingPrefs} from '../utils/readingPrefs';
import {getPublicSiteUrl} from '../utils/storage';
import {trackInteraction} from '../utils/telemetry';
import {QuizLeaderboard} from './QuizLeaderboard';

const OPTION_LETTERS_AR = ['أ', 'ب', 'ج', 'د'];
const OPTION_LETTERS_EN = ['A', 'B', 'C', 'D'];

type QuizStage = 'setup' | 'active' | 'results';

interface CategoryChoiceMeta {
  id: DawahQuizSubject;
  labelAr: string;
  labelEn: string;
  descAr: string;
  descEn: string;
  Icon: typeof ShieldCheck;
}

const SUBJECT_ICON_MAP: Record<DawahQuizSubject, typeof ShieldCheck> = {
  all: Layers,
  aqeedah: ShieldCheck,
  quran: BookOpen,
  hadith_seerah: ScrollText,
  fiqh: Scale,
  akhlaq: HeartHandshake,
};

export function DailyDawahQuizCard({
  visitorId,
  visitorName,
  onNotify,
}: {
  visitorId?: string;
  visitorName?: string;
  onNotify: (msg: string) => void;
}) {
  const {isEn, tr, formatNumber} = useI18n();
  const {prefs: readingPrefs} = useReadingPrefs();
  const readingFontCss = resolveFontFamilyCss(readingPrefs.fontFamily);
  const DirectionalArrow = isEn ? ArrowRight : ArrowLeft;

  const {
    state,
    dailyQuestions,
    allQuestions,
    answeredTodayCount,
    correctTodayCount,
    isDailyCompleted,
    todayPointsEarned,
    rankInfo,
    communityParticipants,
    submitAnswer,
  } = useDailyDawahQuiz(visitorId);

  const [stage, setStage] = useState<QuizStage>('setup');
  const [topicFilter, setTopicFilter] = useState<DawahQuizSubject>('all');
  const [selectedCategory, setSelectedCategory] = useState<DawahQuizSubject>('all');
  const [nickname, setNickname] = useState<string>(() => loadQuizNickname(visitorName));
  const [categoryBestMap, setCategoryBestMap] = useState<
    Partial<Record<DawahQuizSubject, CategoryBestStats>>
  >(() => loadCategoryBestScores());

  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [categoryAnswers, setCategoryAnswers] = useState<
    Record<string, {selectedIndex: number; isCorrect: boolean; earnedPoints: number}>
  >({});
  const [leaderboardRefreshSignal, setLeaderboardRefreshSignal] = useState<number>(0);

  useEffect(() => {
    const saved = loadQuizNickname(visitorName);
    if (saved && !nickname) {
      setNickname(saved);
    }
  }, [visitorName, nickname]);

  const categoryOptions: CategoryChoiceMeta[] = useMemo(
    () => [
      {
        id: 'all',
        labelAr: 'الاختبار اليومي المتنوع',
        labelEn: 'Daily Mixed Challenge',
        descAr: '٥ أسئلة يومية شاملة من جميع الأقسام الشرعية + مكافأة الإتمام',
        descEn: '5 balanced daily questions across all Islamic subjects + completion bonus',
        Icon: SUBJECT_ICON_MAP.all,
      },
      ...DAWAH_QUIZ_SUBJECTS.map((subj) => ({
        id: subj.id as DawahQuizSubject,
        labelAr: subj.labelAr,
        labelEn: subj.labelEn,
        descAr: subj.descAr,
        descEn: subj.descEn,
        Icon: SUBJECT_ICON_MAP[subj.id] || BookOpenCheck,
      })),
    ],
    [],
  );

  const visibleCategoryOptions = useMemo(
    () =>
      topicFilter === 'all'
        ? categoryOptions
        : categoryOptions.filter((cat) => cat.id === topicFilter),
    [categoryOptions, topicFilter],
  );

  const activeCategoryMeta =
    categoryOptions.find((c) => c.id === selectedCategory) || categoryOptions[0];

  const activeQuestions: DawahQuizQuestion[] = useMemo(() => {
    if (selectedCategory === 'all') return dailyQuestions;
    return allQuestions.filter((q) => q.subject === selectedCategory);
  }, [selectedCategory, dailyQuestions, allQuestions]);

  const isDailyRound = selectedCategory === 'all';
  const safeIdx =
    activeQuestions.length > 0 ? Math.min(activeIndex, activeQuestions.length - 1) : 0;
  const currentQuestion = activeQuestions[safeIdx];
  const currentQuestionSubjectMeta = currentQuestion
    ? DAWAH_QUIZ_SUBJECTS.find((s) => s.id === currentQuestion.subject)
    : undefined;

  const existingAnswer = currentQuestion
    ? isDailyRound
      ? state.todayAnswers[currentQuestion.id]
      : categoryAnswers[currentQuestion.id]
    : undefined;

  const roundCorrectCount = isDailyRound
    ? correctTodayCount
    : activeQuestions.filter((q) => categoryAnswers[q.id]?.isCorrect).length;

  const roundAnsweredCount = isDailyRound
    ? answeredTodayCount
    : activeQuestions.filter((q) => Boolean(categoryAnswers[q.id])).length;

  const roundPointsEarned = isDailyRound
    ? todayPointsEarned
    : activeQuestions.reduce(
        (sum, q) =>
          sum +
          (categoryAnswers[q.id]?.isCorrect ? PRACTICE_QUESTION_POINTS : 0),
        0,
      );

  const syncResultsToLeaderboard = (
    category: DawahQuizSubject,
    score: number,
    correctCount: number,
    totalQuestions: number,
    streak: number,
  ) => {
    const cleanNick = saveQuizNickname(nickname || visitorName || 'طالب علم') || 'طالب علم';
    const nextBest = saveCategoryBestScore(category, score, correctCount, totalQuestions);
    setCategoryBestMap(nextBest);

    void publishQuizLeaderboardScore({
      visitorId,
      nickname: cleanNick,
      category,
      score,
      correctCount,
      totalQuestions,
      streakDays: streak,
      dateKey: getQuizTodayKey(),
    }).then(() => {
      setLeaderboardRefreshSignal((n) => n + 1);
    });
  };

  const handleStartQuiz = (catOverride?: DawahQuizSubject) => {
    const targetCat = catOverride || selectedCategory;
    if (catOverride) setSelectedCategory(catOverride);
    if (nickname.trim()) {
      saveQuizNickname(nickname.trim());
    }

    if (targetCat === 'all') {
      if (isDailyCompleted) {
        setStage('results');
        syncResultsToLeaderboard(
          'all',
          todayPointsEarned,
          correctTodayCount,
          dailyQuestions.length || 5,
          state.streakDays,
        );
        return;
      }
      const firstUnanswered = dailyQuestions.findIndex((q) => !state.todayAnswers[q.id]);
      setActiveIndex(firstUnanswered >= 0 ? firstUnanswered : 0);
    } else {
      setCategoryAnswers({});
      setActiveIndex(0);
    }
    setStage('active');
  };

  const handleFinishRound = (
    overrideScore?: number,
    overrideCorrect?: number,
    overrideStreak?: number,
  ) => {
    const finalScore = overrideScore ?? roundPointsEarned;
    const finalCorrect = overrideCorrect ?? roundCorrectCount;
    const finalTotal = activeQuestions.length || 1;
    const finalStreak = overrideStreak ?? state.streakDays;
    setStage('results');
    syncResultsToLeaderboard(
      selectedCategory,
      finalScore,
      finalCorrect,
      finalTotal,
      finalStreak,
    );
  };

  const handleSelectOption = (optionIndex: number) => {
    if (!currentQuestion || existingAnswer) return;
    if (isDailyRound) {
      const result = submitAnswer(currentQuestion, optionIndex, true);
      if (!result.alreadyAnswered) {
        if (result.bonusAwarded > 0) {
          const finalDailyScore =
            dailyQuestions.reduce(
              (sum, q) => sum + (result.nextState.todayAnswers[q.id]?.earnedPoints || 0),
              0,
            ) + (result.nextState.todayCompletionBonusClaimed ? DAILY_COMPLETION_BONUS : 0);
          const finalDailyCorrect = dailyQuestions.filter(
            (q) => result.nextState.todayAnswers[q.id]?.isCorrect,
          ).length;
          onNotify(
            tr(
              `أحسنت! أتممت اختبار اليوم ونلت +${formatNumber(result.earnedPoints + result.bonusAwarded)} نقطة (شاملة مكافأة الإتمام) — اضغط «عرض النتيجة ولوحة المتصدرين»`,
              `Well done! Daily quiz completed: +${result.earnedPoints + result.bonusAwarded} pts — click View Results & Leaderboard`,
            ),
          );
          syncResultsToLeaderboard(
            'all',
            finalDailyScore,
            finalDailyCorrect,
            dailyQuestions.length || 5,
            result.nextState.streakDays,
          );
        } else if (result.isCorrect) {
          onNotify(
            tr(
              `إجابة صحيحة! أُضيفت +${formatNumber(result.earnedPoints)} نقطة إلى رصيدك`,
              `Correct! +${result.earnedPoints} points added to your score`,
            ),
          );
        } else {
          onNotify(
            tr(
              'إجابة غير صحيحة — تم توضيح الإجابة الصحيحة والدليل أدناه',
              'Incorrect answer — see the verified explanation below',
            ),
          );
        }
      }
    } else {
      const result = submitAnswer(currentQuestion, optionIndex, false);
      setCategoryAnswers((prev) => ({
        ...prev,
        [currentQuestion.id]: {
          selectedIndex: optionIndex,
          isCorrect: result.isCorrect,
          earnedPoints: result.isCorrect ? PRACTICE_QUESTION_POINTS : 0,
        },
      }));
      if (result.isCorrect) {
        onNotify(
          result.earnedPoints > 0
            ? tr(
                `إجابة صحيحة! +${formatNumber(result.earnedPoints)} نقاط للقسم`,
                `Correct! +${result.earnedPoints} category points`,
              )
            : tr('إجابة صحيحة! أحسنت', 'Correct answer!'),
        );
      } else {
        onNotify(
          tr(
            'حاول في السؤال التالي — راجع الفائدة الشرعية أدناه',
            'Review the scholarly explanation below before continuing',
          ),
        );
      }
    }
  };

  const handleNext = () => {
    if (safeIdx + 1 < activeQuestions.length) {
      setActiveIndex(safeIdx + 1);
      return;
    }

    if (isDailyRound && !isDailyCompleted) {
      const nextUnanswered = dailyQuestions.findIndex((q) => !state.todayAnswers[q.id]);
      if (nextUnanswered >= 0) {
        setActiveIndex(nextUnanswered);
        return;
      }
    }

    handleFinishRound();
  };

  const handleShareScore = async () => {
    const siteUrl = getPublicSiteUrl('/?tab=quiz');
    const rankLabel = isEn ? rankInfo.titleEn : rankInfo.titleAr;
    const catLabel = isEn ? activeCategoryMeta.labelEn : activeCategoryMeta.labelAr;
    const text = isEn
      ? `Daily Dawah Quiz (${catLabel}): ${roundCorrectCount}/${activeQuestions.length} · Round Score: ${roundPointsEarned} pts · Total: ${state.totalPoints} pts (${rankLabel})\nTest your Islamic knowledge: ${siteUrl}`
      : `الاختبار الدعوي (${catLabel}) · موقع مواعظ وعبر\nالنتيجة: ${formatNumber(roundCorrectCount)} من ${formatNumber(activeQuestions.length)}\nنقاط الجولة: ${formatNumber(roundPointsEarned)} نقطة\nمجموع نقاطي الكلي: ${formatNumber(state.totalPoints)} نقطة (${rankLabel})\n\nاختر قسمك واختبر معلوماتك الشرعية:\n${siteUrl}`;

    let copied = false;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      // Clipboard fallback handled below
    }
    if (navigator.share) {
      try {
        await navigator.share({
          title: tr('الاختبار الدعوي اليومي · مواعظ وعبر', 'Daily Dawah Quiz'),
          text,
          url: siteUrl,
        });
        trackInteraction('sermon_share', 'quiz', 'quiz');
        if (copied) onNotify(tr('تمت مشاركة نتيجتك بنجاح', 'Score shared successfully'));
        return;
      } catch {
        // User dismissed native share sheet
      }
    }
    if (copied) {
      trackInteraction('sermon_share', 'quiz', 'quiz');
    }
    onNotify(
      copied
        ? tr('تم نسخ نتيجتك للمشاركة', 'Your quiz score has been copied')
        : tr('تعذر نسخ النتيجة تلقائياً', 'Could not copy score automatically'),
    );
  };

  const options = currentQuestion
    ? isEn
      ? currentQuestion.optionsEn
      : currentQuestion.optionsAr
    : [];
  const letters = isEn ? OPTION_LETTERS_EN : OPTION_LETTERS_AR;

  const accuracyRoundPct =
    activeQuestions.length > 0
      ? Math.round((roundCorrectCount / activeQuestions.length) * 100)
      : 0;

  return (
    <section
      id="home-daily-quiz"
      aria-label={tr('الاختبار الدعوي اليومي', 'Daily Dawah Quiz')}
      className="scroll-mt-28 rounded-2xl bg-white dark:bg-[#223a32] border border-slate-200/80 dark:border-white/10 p-5 sm:p-6 shadow-xs space-y-5"
    >
      {/* Header Row: Title + Compact Tabular Scoreboard */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-200/70 dark:border-white/10">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#006a46] text-white flex items-center justify-center shrink-0">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div className="space-y-0.5 min-w-0">
            <h2 className="text-base sm:text-lg font-extrabold text-[#0e1d25] dark:text-white leading-snug">
              {tr('الاختبار الدعوي اليومي', 'Daily Dawah Quiz')}
            </h2>
            <p className="text-xs text-[#6e7a71] dark:text-slate-400">
              {tr(
                'اختر القسم العلمي المفضل لديك قبل البدء ونافس في لوحة المتصدرين',
                'Choose your preferred Islamic category before starting and compete on the leaderboard',
              )}
            </p>
          </div>
        </div>

        {/* Clean Unboxed Tabular Stats */}
        <div className="grid grid-cols-3 gap-3 sm:gap-5 shrink-0">
          <div className="text-start">
            <span className="text-[11px] font-medium text-[#6e7a71] dark:text-slate-400 block">
              {tr('مجموع النقاط', 'Total Points')}
            </span>
            <span className="text-base sm:text-lg font-extrabold text-[#006a46] dark:text-[#6cdba6] tabular-nums flex items-center gap-1">
              <Trophy className="w-4 h-4 text-[#b45309] dark:text-[#ffc968] shrink-0" />
              <span>{formatNumber(state.totalPoints)}</span>
            </span>
          </div>

          <div className="text-start">
            <span className="text-[11px] font-medium text-[#6e7a71] dark:text-slate-400 block">
              {tr('سلسلة الأيام', 'Daily Streak')}
            </span>
            <span className="text-base sm:text-lg font-extrabold text-[#0e1d25] dark:text-white tabular-nums flex items-center gap-1">
              <Flame className="w-4 h-4 text-[#d97706] dark:text-[#ffc968] shrink-0" />
              <span>{tr(`${formatNumber(state.streakDays)} ي`, `${state.streakDays}d`)}</span>
            </span>
          </div>

          <div className="text-start">
            <span className="text-[11px] font-medium text-[#6e7a71] dark:text-slate-400 block">
              {tr('اختبار اليوم', "Today's Quiz")}
            </span>
            <span className="text-base sm:text-lg font-extrabold text-[#0e1d25] dark:text-white tabular-nums flex items-center gap-1">
              <Award className="w-4 h-4 text-[#006a46] dark:text-[#6cdba6] shrink-0" />
              <span>
                {formatNumber(answeredTodayCount)} / {formatNumber(dailyQuestions.length)}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Visual Progress Bar (Answered vs Remaining Questions) */}
      {(() => {
        const progressTotal =
          stage === 'setup' ? dailyQuestions.length || 5 : activeQuestions.length || 1;
        const progressAnswered = stage === 'setup' ? answeredTodayCount : roundAnsweredCount;
        const progressRemaining = Math.max(0, progressTotal - progressAnswered);
        const progressPct = Math.min(100, Math.round((progressAnswered / progressTotal) * 100));
        const progressItems = stage === 'setup' ? dailyQuestions : activeQuestions;

        return (
          <div className="rounded-xl bg-[#f8fafc] dark:bg-[#192d26] border border-slate-200/80 dark:border-white/10 p-3.5 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-2 font-bold text-[#0e1d25] dark:text-white">
                <span>
                  {stage === 'setup'
                    ? tr('تقدم اختبار اليوم:', "Today's Quiz Progress:")
                    : tr('تقدم الأسئلة:', 'Quiz Progress:')}
                </span>
                <span className="text-[#006a46] dark:text-[#6cdba6] tabular-nums">
                  {tr(
                    `أُجيب على ${formatNumber(progressAnswered)} من ${formatNumber(progressTotal)}`,
                    `${progressAnswered} of ${progressTotal} answered`,
                  )}
                </span>
                <span aria-hidden="true" className="text-slate-400">
                  ·
                </span>
                <span className="text-[#6e7a71] dark:text-slate-300 tabular-nums">
                  {progressRemaining === 0
                    ? tr('اكتمل الاختبار ✓', 'Completed ✓')
                    : tr(`المتبقي ${formatNumber(progressRemaining)}`, `${progressRemaining} remaining`)}
                </span>
              </div>

              <span className="text-xs font-extrabold text-[#006a46] dark:text-[#6cdba6] tabular-nums">
                {formatNumber(progressPct)}٪
              </span>
            </div>

            <div
              role="progressbar"
              aria-label={tr('شريط تقدم الاختبار الدعوي', 'Daily Dawah Quiz progress')}
              aria-valuenow={progressAnswered}
              aria-valuemin={0}
              aria-valuemax={progressTotal}
              className="w-full h-2.5 rounded-full bg-slate-200/80 dark:bg-white/10 overflow-hidden"
            >
              <div
                className="h-full rounded-full bg-[#006a46] dark:bg-[#6cdba6] transition-all duration-300"
                style={{width: `${progressPct}%`}}
              />
            </div>

            <div
              className="grid gap-1.5"
              style={{
                gridTemplateColumns: `repeat(${Math.min(Math.max(progressItems.length, 1), 12)}, minmax(0, 1fr))`,
              }}
            >
              {progressItems.slice(0, 12).map((q) => {
                const ans =
                  stage === 'setup' || isDailyRound
                    ? state.todayAnswers[q.id]
                    : categoryAnswers[q.id];
                return (
                  <span
                    key={`prog_${q.id}`}
                    className={`h-1.5 rounded-full transition-colors ${
                      ans
                        ? ans.isCorrect
                          ? 'bg-[#006a46] dark:bg-[#6cdba6]'
                          : 'bg-amber-500 dark:bg-amber-400'
                        : 'bg-slate-200 dark:bg-white/15'
                    }`}
                  />
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Rank Progress Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-2 text-[#3e4a42] dark:text-slate-300">
          <span className="font-bold text-[#0e1d25] dark:text-white">
            {tr('المرتبة الحالية:', 'Current Rank:')} {isEn ? rankInfo.titleEn : rankInfo.titleAr}
          </span>
          {rankInfo.nextPoints !== null && (
            <>
              <span aria-hidden="true" className="text-slate-400">
                ·
              </span>
              <span className="text-[#6e7a71] dark:text-slate-400 tabular-nums">
                {tr(
                  `المتبقي لـ «${rankInfo.nextTitleAr}»: ${formatNumber(Math.max(0, rankInfo.nextPoints - state.totalPoints))} نقطة`,
                  `${Math.max(0, rankInfo.nextPoints - state.totalPoints)} pts to ${rankInfo.nextTitleEn}`,
                )}
              </span>
            </>
          )}
        </div>

        <div className="w-full sm:w-44 h-2 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden shrink-0">
          <div
            className="h-full bg-[#006a46] dark:bg-[#6cdba6] rounded-full transition-all duration-200"
            style={{width: `${rankInfo.progressPct}%`}}
          />
        </div>
      </div>

      {/* STAGE 1: Pre-Start Category Selection */}
      {stage === 'setup' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-[#0e1d25] dark:text-white">
                {tr('١. اختر القسم قبل بدء الاختبار', '1. Choose a Category Before Starting')}
              </h3>
              <p className="text-xs text-[#6e7a71] dark:text-slate-400">
                {tr(
                  'حدد المسار الذي تود اختبار معرفتك فيه: العقيدة، الفقه، السيرة والحديث، القرآن، الأخلاق، أو التحدي اليومي الشامل',
                  'Pick Aqeedah, Fiqh, Seerah & Hadith, Quran, Character, or the Daily Mixed Challenge',
                )}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setStage('results')}
              className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#fff4de] dark:bg-[#2f2b16] text-[#8a5d00] dark:text-[#ffc968] text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Trophy className="w-3.5 h-3.5 shrink-0" />
              <span>{tr('لوحة المتصدرين', 'Leaderboard')}</span>
            </button>
          </div>

          {/* Interactive Category Filter Bar (All, Aqeedah, Quran, Seerah, Fiqh, Akhlaq) */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-[#3e4a42] dark:text-slate-300">
                {tr('تصفية حسب الموضوع:', 'Filter by topic:')}
              </span>
              {topicFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => {
                    setTopicFilter('all');
                    setSelectedCategory('all');
                  }}
                  className="text-xs font-bold text-[#006a46] dark:text-[#6cdba6] hover:underline whitespace-nowrap"
                >
                  {tr('عرض كل الأقسام', 'Show all topics')}
                </button>
              )}
            </div>

            <div
              role="group"
              aria-label={tr('تصفية أقسام الاختبار الدعوي', 'Filter Daily Dawah Quiz categories')}
              className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-[#162922] rounded-xl overflow-x-auto no-scrollbar"
            >
              {categoryOptions.map((cat) => {
                const isFiltered = topicFilter === cat.id;
                const count =
                  cat.id === 'all'
                    ? dailyQuestions.length
                    : allQuestions.filter((q) => q.subject === cat.id).length;
                const shortLabel =
                  cat.id === 'all'
                    ? tr('الكل (اليومي)', 'All Topics')
                    : isEn
                      ? cat.labelEn
                      : cat.labelAr;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    aria-pressed={isFiltered}
                    onClick={() => {
                      setTopicFilter(cat.id);
                      setSelectedCategory(cat.id);
                    }}
                    className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                      isFiltered
                        ? 'bg-white dark:bg-[#223a32] text-[#006a46] dark:text-[#6cdba6] shadow-xs'
                        : 'text-[#3e4a42] dark:text-slate-300 hover:text-[#0e1d25] dark:hover:text-white'
                    }`}
                  >
                    <span>{shortLabel}</span>
                    <span className="text-[11px] opacity-75 tabular-nums">
                      ({formatNumber(count)})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div
            className={`grid gap-3 ${
              visibleCategoryOptions.length === 1
                ? 'grid-cols-1'
                : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
            }`}
          >
            {visibleCategoryOptions.map((cat) => {
              const Icon = cat.Icon;
              const isSelected = selectedCategory === cat.id;
              const poolCount =
                cat.id === 'all'
                  ? dailyQuestions.length
                  : allQuestions.filter((q) => q.subject === cat.id).length;
              const best = categoryBestMap[cat.id];
              const dailyDoneHere = cat.id === 'all' && isDailyCompleted;

              return (
                <button
                  key={cat.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`rounded-2xl border p-4 text-start flex flex-col justify-between gap-3 transition-all ${
                    isSelected
                      ? 'bg-[#eefaf3] dark:bg-[#133126] border-[#006a46] dark:border-[#6cdba6] shadow-xs'
                      : 'bg-[#f8fafc] dark:bg-[#192d26] border-slate-200/80 dark:border-white/10 hover:border-[#006a46]/55'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-[#006a46] text-white'
                            : 'bg-white dark:bg-white/10 text-[#006a46] dark:text-[#6cdba6] border border-slate-200/70 dark:border-white/10'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-extrabold text-[#0e1d25] dark:text-white leading-snug">
                          {isEn ? cat.labelEn : cat.labelAr}
                        </h4>
                        <p className="text-[11px] text-[#6e7a71] dark:text-slate-400 mt-0.5 leading-relaxed line-clamp-2">
                          {isEn ? cat.descEn : cat.descAr}
                        </p>
                      </div>
                    </div>

                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 text-[#006a46] dark:text-[#6cdba6] shrink-0 mt-0.5" />
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/60 dark:border-white/10 text-[11px] font-semibold tabular-nums">
                    <span className="text-[#3e4a42] dark:text-slate-300">
                      {tr(`${formatNumber(poolCount)} أسئلة`, `${poolCount} questions`)}
                    </span>
                    {dailyDoneHere ? (
                      <span className="text-[#006a46] dark:text-[#6cdba6] font-bold">
                        {tr('مكتمل اليوم ✓', 'Done today ✓')}
                      </span>
                    ) : best ? (
                      <span className="text-[#9a6b00] dark:text-[#ffc968] font-bold">
                        {tr(
                          `أفضل نتيجة: ${formatNumber(best.score)} نقطة`,
                          `Best: ${best.score} pts`,
                        )}
                      </span>
                    ) : (
                      <span className="text-[#6e7a71] dark:text-slate-400">
                        {cat.id === 'all'
                          ? tr(`+${formatNumber(DAILY_QUESTION_POINTS)}/سؤال`, `+${DAILY_QUESTION_POINTS}/Q`)
                          : tr(`+${formatNumber(PRACTICE_QUESTION_POINTS)}/سؤال`, `+${PRACTICE_QUESTION_POINTS}/Q`)}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Nickname + Primary Start Quiz Action Bar */}
          <div className="rounded-xl bg-[#f8fafc] dark:bg-[#192d26] border border-slate-200/80 dark:border-white/10 p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <UserCheck className="w-4 h-4 text-[#006a46] dark:text-[#6cdba6] shrink-0" />
              <label htmlFor="quiz-setup-nickname" className="sr-only">
                {tr('الاسم المستعار للوحة المتصدرين', 'Leaderboard Nickname')}
              </label>
              <input
                id="quiz-setup-nickname"
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={40}
                placeholder={tr(
                  'اسمك المستعار للوحة المتصدرين (اختياري، مثال: أبو عبد الله)',
                  'Your leaderboard nickname (optional)',
                )}
                className="w-full bg-white dark:bg-[#223a32] border border-slate-200/80 dark:border-white/10 rounded-lg px-3 py-2 text-xs sm:text-sm font-semibold text-[#0e1d25] dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#006a46]"
              />
            </div>

            <button
              type="button"
              onClick={() => handleStartQuiz()}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#006a46] hover:bg-[#005235] text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              <Play className="w-4 h-4 shrink-0" />
              <span>
                {selectedCategory === 'all' && isDailyCompleted
                  ? tr('عرض نتيجة اليوم ولوحة المتصدرين', "View Today's Results & Leaderboard")
                  : tr(
                      `ابدأ اختبار: ${isEn ? activeCategoryMeta.labelEn : activeCategoryMeta.labelAr}`,
                      `Start ${activeCategoryMeta.labelEn}`,
                    )}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* STAGE 2: Active Quiz Questions */}
      {stage === 'active' && currentQuestion && (
        <div className="space-y-4">
          {/* Active Category Bar & Stepper */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#6e7a71] dark:text-slate-400">
              <button
                type="button"
                onClick={() => setStage('setup')}
                className="min-h-[32px] px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/10 hover:bg-slate-200/80 dark:hover:bg-white/15 text-[#0e1d25] dark:text-white font-bold flex items-center gap-1 transition-colors"
              >
                <DirectionalArrow className="w-3.5 h-3.5 rotate-180" />
                <span>{tr('تغيير القسم', 'Change Category')}</span>
              </button>
              <span className="font-extrabold text-[#006a46] dark:text-[#6cdba6]">
                {isEn ? activeCategoryMeta.labelEn : activeCategoryMeta.labelAr}
                {isDailyRound && currentQuestionSubjectMeta
                  ? ` · ${isEn ? currentQuestionSubjectMeta.labelEn : currentQuestionSubjectMeta.labelAr}`
                  : ''}
              </span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">
                {tr(
                  `سؤال ${formatNumber(safeIdx + 1)} من ${formatNumber(activeQuestions.length)}`,
                  `Question ${safeIdx + 1} of ${activeQuestions.length}`,
                )}
              </span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">
                {isDailyRound
                  ? tr(
                      `+${formatNumber(currentQuestion.points || DAILY_QUESTION_POINTS)} نقطة`,
                      `+${currentQuestion.points || DAILY_QUESTION_POINTS} pts`,
                    )
                  : tr(
                      `+${formatNumber(PRACTICE_QUESTION_POINTS)} نقاط`,
                      `+${PRACTICE_QUESTION_POINTS} pts`,
                    )}
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {activeQuestions.map((q, idx) => {
                const ans = isDailyRound ? state.todayAnswers[q.id] : categoryAnswers[q.id];
                const isCurrent = idx === safeIdx;
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setActiveIndex(idx)}
                    aria-label={tr(`السؤال ${idx + 1}`, `Question ${idx + 1}`)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold tabular-nums transition-colors flex items-center justify-center border ${
                      isCurrent
                        ? 'bg-[#006a46] text-white border-[#006a46]'
                        : ans
                          ? ans.isCorrect
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-[#006a46] dark:text-[#6cdba6] border-emerald-300 dark:border-emerald-700'
                            : 'bg-rose-50 dark:bg-rose-950/50 text-[#ba1a1a] dark:text-rose-300 border-rose-300 dark:border-rose-700'
                          : 'bg-slate-50 dark:bg-white/5 text-[#3e4a42] dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-[#006a46]'
                    }`}
                  >
                    {formatNumber(idx + 1)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Question Statement */}
          <div className="space-y-3">
            <h3
              dir={isEn ? 'ltr' : 'rtl'}
              className="text-base sm:text-lg font-extrabold text-[#0e1d25] dark:text-white leading-relaxed"
              style={{
                fontFamily: isEn ? undefined : readingFontCss,
                textWrap: 'balance',
              }}
            >
              {isEn ? currentQuestion.questionEn : currentQuestion.questionAr}
            </h3>

            {/* Options Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {options.map((optionText, optIdx) => {
                const isAnswered = Boolean(existingAnswer);
                const isSelected = existingAnswer?.selectedIndex === optIdx;
                const isRightOption = currentQuestion.correctIndex === optIdx;

                let stateClasses =
                  'bg-[#f8fafc] dark:bg-[#192d26] border-slate-200/90 dark:border-white/10 text-[#0e1d25] dark:text-slate-100 hover:border-[#006a46] hover:bg-[#f0f9f4] dark:hover:bg-[#1f3930]';
                if (isAnswered) {
                  if (isRightOption) {
                    stateClasses =
                      'bg-emerald-50 dark:bg-emerald-950/60 border-[#006a46] dark:border-[#6cdba6] text-[#064e3b] dark:text-emerald-100';
                  } else if (isSelected && !isRightOption) {
                    stateClasses =
                      'bg-rose-50 dark:bg-rose-950/50 border-rose-500 dark:border-rose-400 text-rose-900 dark:text-rose-100';
                  } else {
                    stateClasses =
                      'bg-slate-50/70 dark:bg-[#162721] border-slate-200/60 dark:border-white/5 text-[#6e7a71] dark:text-slate-400';
                  }
                }

                return (
                  <button
                    key={optIdx}
                    type="button"
                    disabled={isAnswered}
                    onClick={() => handleSelectOption(optIdx)}
                    className={`min-h-[50px] px-4 py-3 rounded-xl border text-start flex items-center justify-between gap-3 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#006a46] ${stateClasses}`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span className="w-6 h-6 rounded-md bg-white/90 dark:bg-white/10 border border-slate-200/80 dark:border-white/15 text-xs font-extrabold flex items-center justify-center shrink-0 mt-0.5">
                        {letters[optIdx] || optIdx + 1}
                      </span>
                      <span className="text-sm font-semibold leading-snug">{optionText}</span>
                    </div>

                    {isAnswered && isRightOption && (
                      <span className="flex items-center gap-1 text-[11px] font-extrabold text-[#006a46] dark:text-[#6cdba6] shrink-0 whitespace-nowrap">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>{tr('صحيح', 'Correct')}</span>
                      </span>
                    )}
                    {isAnswered && isSelected && !isRightOption && (
                      <span className="flex items-center gap-1 text-[11px] font-extrabold text-[#ba1a1a] dark:text-rose-300 shrink-0 whitespace-nowrap">
                        <XCircle className="w-4 h-4 shrink-0" />
                        <span>{tr('خطأ', 'Wrong')}</span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Educational Feedback & Next Action */}
          {existingAnswer && (
            <div className="rounded-xl bg-[#f8fafc] dark:bg-[#182c25] border border-slate-200/80 dark:border-white/10 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-extrabold">
                  {existingAnswer.isCorrect ? (
                    <span className="text-[#006a46] dark:text-[#6cdba6] flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>
                        {tr(
                          `أحسنت! إجابة موفقة (+${formatNumber(
                            isDailyRound
                              ? currentQuestion.points || DAILY_QUESTION_POINTS
                              : PRACTICE_QUESTION_POINTS,
                          )} نقطة)`,
                          `Correct answer! (+${
                            isDailyRound
                              ? currentQuestion.points || DAILY_QUESTION_POINTS
                              : PRACTICE_QUESTION_POINTS
                          } pts)`,
                        )}
                      </span>
                    </span>
                  ) : (
                    <span className="text-[#ba1a1a] dark:text-rose-300 flex items-center gap-1.5">
                      <HelpCircle className="w-4 h-4 shrink-0" />
                      <span>
                        {tr(
                          'الإجابة الصحيحة موضّحة أعلاه مع الفائدة الشرعية',
                          'Verified answer & explanation',
                        )}
                      </span>
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleNext}
                  className="min-h-[38px] px-4 py-1.5 rounded-xl bg-[#006a46] hover:bg-[#005235] text-white text-xs font-bold transition-colors whitespace-nowrap"
                >
                  {safeIdx + 1 < activeQuestions.length
                    ? tr('السؤال التالي', 'Next Question')
                    : tr('عرض النتيجة ولوحة المتصدرين', 'View Results & Leaderboard')}
                </button>
              </div>

              <p className="text-xs sm:text-sm text-[#3e4a42] dark:text-slate-200 leading-relaxed">
                {isEn ? currentQuestion.explanationEn : currentQuestion.explanationAr}
              </p>

              <p className="text-[11px] font-bold text-[#7c5800] dark:text-[#ffc968]">
                {tr('المصدر:', 'Source:')} {isEn ? currentQuestion.sourceEn : currentQuestion.sourceAr}
              </p>
            </div>
          )}

          {/* Early finish button if user answered at least 1 question in category mode */}
          {!isDailyRound && roundAnsweredCount > 0 && roundAnsweredCount < activeQuestions.length && (
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => handleFinishRound()}
                className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200/80 dark:hover:bg-white/15 text-[#0e1d25] dark:text-white text-xs font-bold transition-colors"
              >
                {tr('إنهاء وعرض النتيجة والمتصدرين', 'Finish & View Results')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* STAGE 3: Quiz Results + Quiz Leaderboard */}
      {stage === 'results' && (
        <div className="space-y-5">
          {/* Results Summary Card */}
          <div className="rounded-xl bg-[#f7fbf9] dark:bg-[#192d26] border border-slate-200/80 dark:border-white/10 p-5 sm:p-6 space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-[#006a46] dark:text-[#6cdba6] text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    {tr(
                      `نتيجة اختبار قسم: ${activeCategoryMeta.labelAr}`,
                      `Quiz Results · ${activeCategoryMeta.labelEn}`,
                    )}
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-extrabold text-[#0e1d25] dark:text-white tabular-nums">
                  {tr(
                    `أجبت إجابة صحيحة على ${formatNumber(roundCorrectCount)} من ${formatNumber(activeQuestions.length)} أسئلة (${formatNumber(accuracyRoundPct)}٪)`,
                    `You answered ${roundCorrectCount} of ${activeQuestions.length} correctly (${accuracyRoundPct}%)`,
                  )}
                </h3>
                <p className="text-xs sm:text-sm text-[#3e4a42] dark:text-slate-300 tabular-nums">
                  {tr(
                    `نقاط هذه الجولة: +${formatNumber(roundPointsEarned)} نقطة${
                      isDailyRound && state.todayCompletionBonusClaimed
                        ? ` (شاملة +${formatNumber(DAILY_COMPLETION_BONUS)} مكافأة الإتمام)`
                        : ''
                    }`,
                    `Round score: +${roundPointsEarned} pts${
                      isDailyRound && state.todayCompletionBonusClaimed
                        ? ` (includes +${DAILY_COMPLETION_BONUS} completion bonus)`
                        : ''
                    }`,
                  )}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => void handleShareScore()}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-[#006a46] hover:bg-[#005235] text-white text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <Share2 className="w-4 h-4 shrink-0" />
                  <span>{tr('مشاركة نتيجتي', 'Share Score')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveIndex(0);
                    setStage('active');
                  }}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-white dark:bg-[#223a32] border border-slate-200 dark:border-white/15 text-[#0e1d25] dark:text-white text-xs font-bold flex items-center gap-1.5 hover:border-[#006a46] transition-colors whitespace-nowrap"
                >
                  <BookOpenCheck className="w-4 h-4 shrink-0" />
                  <span>{tr('مراجعة الأسئلة', 'Review Questions')}</span>
                </button>

                {!isDailyRound && (
                  <button
                    type="button"
                    onClick={() => handleStartQuiz(selectedCategory)}
                    className="min-h-[40px] px-4 py-2 rounded-xl bg-white dark:bg-[#223a32] border border-slate-200 dark:border-white/15 text-[#0e1d25] dark:text-white text-xs font-bold flex items-center gap-1.5 hover:border-[#006a46] transition-colors whitespace-nowrap"
                  >
                    <RotateCcw className="w-4 h-4 shrink-0" />
                    <span>{tr('إعادة القسم', 'Retry Category')}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setStage('setup')}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-[#eefaf3] dark:bg-[#133126] text-[#006a46] dark:text-[#6cdba6] text-xs font-bold flex items-center gap-1.5 hover:bg-[#daf3e6] transition-colors whitespace-nowrap"
                >
                  <Layers className="w-4 h-4 shrink-0" />
                  <span>{tr('اختيار قسم آخر', 'Choose Another Category')}</span>
                </button>
              </div>
            </div>

            {/* Per-Question Compact Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-2 pt-2 border-t border-slate-200/70 dark:border-white/10">
              {activeQuestions.map((q, idx) => {
                const ans = isDailyRound ? state.todayAnswers[q.id] : categoryAnswers[q.id];
                const subj = DAWAH_QUIZ_SUBJECTS.find((s) => s.id === q.subject);
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => {
                      setActiveIndex(idx);
                      setStage('active');
                    }}
                    className="p-2.5 rounded-xl bg-white dark:bg-[#223a32] border border-slate-200/80 dark:border-white/10 hover:border-[#006a46] text-start space-y-1 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-1 text-[11px] font-bold">
                      <span className="text-[#6e7a71] dark:text-slate-400 tabular-nums">
                        #{formatNumber(idx + 1)}
                      </span>
                      {ans ? (
                        ans.isCorrect ? (
                          <span className="text-[#006a46] dark:text-[#6cdba6] flex items-center gap-0.5">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{tr('صحيح', 'Correct')}</span>
                          </span>
                        ) : (
                          <span className="text-[#ba1a1a] dark:text-rose-300 flex items-center gap-0.5">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>{tr('خطأ', 'Wrong')}</span>
                          </span>
                        )
                      ) : (
                        <span className="text-slate-400">{tr('لم يُجب', 'Skipped')}</span>
                      )}
                    </div>
                    <p className="text-xs font-bold text-[#0e1d25] dark:text-white truncate">
                      {subj ? (isEn ? subj.labelEn : subj.labelAr) : ''}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Firestore + Express Quiz Leaderboard displayed immediately after results */}
          <QuizLeaderboard
            initialCategory={selectedCategory}
            visitorId={visitorId}
            visitorName={nickname || visitorName}
            currentCategoryScore={roundPointsEarned}
            currentCategoryCorrect={roundCorrectCount}
            currentCategoryTotal={activeQuestions.length}
            streakDays={state.streakDays}
            refreshSignal={leaderboardRefreshSignal}
            onNicknameUpdated={(nextNick) => setNickname(nextNick)}
            onNotify={onNotify}
          />
        </div>
      )}

      {/* Quiet Community Footer Metadata */}
      {communityParticipants > 0 && (
        <div className="pt-3 border-t border-slate-200/70 dark:border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs text-[#6e7a71] dark:text-slate-400">
          <span className="tabular-nums">
            {tr(
              `مشاركات الاختبار اليوم في الموقع: ${formatNumber(communityParticipants)} مشاركة علمية`,
              `Today's community quiz submissions: ${communityParticipants}`,
            )}
          </span>
          <span className="tabular-nums">
            {tr(
              `دقة إجاباتك الكلية: ${
                state.totalAnswered > 0
                  ? formatNumber(Math.round((state.totalCorrect / state.totalAnswered) * 100))
                  : formatNumber(0)
              }٪`,
              `Overall accuracy: ${
                state.totalAnswered > 0
                  ? Math.round((state.totalCorrect / state.totalAnswered) * 100)
                  : 0
              }%`,
            )}
          </span>
        </div>
      )}
    </section>
  );
}
