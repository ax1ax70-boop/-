import {useEffect, useMemo, useState} from 'react';
import {
  VERIFIED_QUIZ_BANK,
  getDailyQuizQuestions,
  getQuizRank,
} from '../data/dawahQuizData';
import type {
  DawahQuizAnswerRecord,
  DawahQuizQuestion,
  DawahQuizState,
  DawahQuizSubject,
  QuizLeaderboardEntry,
} from '../types';
import {
  cloudFetchQuizLeaderboardByCategory,
  cloudSaveQuizLeaderboardScore,
} from './cloudSync';
import {trackInteraction} from './telemetry';

const QUIZ_STORAGE_KEY = 'mawaedh_dawah_quiz_v1';
const QUIZ_PARTICIPANT_KEY = 'mawaedh_quiz_participant_id_v1';
const QUIZ_NICKNAME_KEY = 'mawaedh_quiz_nickname_v1';
const QUIZ_CATEGORY_BEST_KEY = 'mawaedh_quiz_category_best_v1';
const QUIZ_EVENT = 'mawaedh:dawah-quiz-changed';

export const DAILY_QUESTION_POINTS = 20;
export const DAILY_COMPLETION_BONUS = 20;
export const PRACTICE_QUESTION_POINTS = 10;

export interface CategoryBestStats {
  score: number;
  correctCount: number;
  totalQuestions: number;
  updatedAt: string;
}

export function getQuizTodayKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getYesterdayKey(todayKey: string): string {
  const [y, m, d] = todayKey.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() - 1);
  return getQuizTodayKey(dt);
}

export function getOrCreateQuizParticipantId(visitorId?: string): string {
  const cleanVisitor = visitorId?.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  if (cleanVisitor && cleanVisitor.length >= 3) return cleanVisitor;
  if (typeof window === 'undefined') return 'guest_quizzer';
  try {
    const existing = window.localStorage.getItem(QUIZ_PARTICIPANT_KEY);
    if (existing && existing.length >= 4) return existing;
    const generated = `qz_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    window.localStorage.setItem(QUIZ_PARTICIPANT_KEY, generated);
    return generated;
  } catch {
    return 'guest_quizzer';
  }
}

export function loadQuizNickname(fallbackName?: string): string {
  if (typeof window !== 'undefined') {
    try {
      const saved = window.localStorage.getItem(QUIZ_NICKNAME_KEY);
      if (saved && saved.trim()) return saved.trim().slice(0, 40);
    } catch {
      // Ignore storage restriction
    }
  }
  const cleanFallback = fallbackName?.trim().slice(0, 40);
  return cleanFallback || '';
}

export function saveQuizNickname(rawNickname: string): string {
  const cleaned = rawNickname.trim().slice(0, 40);
  if (typeof window !== 'undefined') {
    try {
      if (cleaned) window.localStorage.setItem(QUIZ_NICKNAME_KEY, cleaned);
      else window.localStorage.removeItem(QUIZ_NICKNAME_KEY);
    } catch {
      // Ignore storage restriction
    }
  }
  return cleaned;
}

export function loadCategoryBestScores(): Partial<Record<DawahQuizSubject, CategoryBestStats>> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(QUIZ_CATEGORY_BEST_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<Record<DawahQuizSubject, CategoryBestStats>>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveCategoryBestScore(
  category: DawahQuizSubject,
  score: number,
  correctCount: number,
  totalQuestions: number,
): Partial<Record<DawahQuizSubject, CategoryBestStats>> {
  const all = loadCategoryBestScores();
  const prev = all[category];
  const nextEntry: CategoryBestStats = {
    score: Math.max(prev?.score || 0, Math.max(0, Math.floor(score))),
    correctCount: Math.max(prev?.correctCount || 0, Math.max(0, Math.floor(correctCount))),
    totalQuestions: Math.max(prev?.totalQuestions || 1, Math.max(1, Math.floor(totalQuestions))),
    updatedAt: new Date().toISOString(),
  };
  const updated = {...all, [category]: nextEntry};
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(QUIZ_CATEGORY_BEST_KEY, JSON.stringify(updated));
    } catch {
      // Ignore
    }
  }
  return updated;
}

function getDefaultQuizState(today = getQuizTodayKey()): DawahQuizState {
  return {
    totalPoints: 0,
    totalCorrect: 0,
    totalAnswered: 0,
    streakDays: 0,
    lastCompletedDate: null,
    todayDate: today,
    todayAnswers: {},
    todayCompletionBonusClaimed: false,
    practicedQuestionIds: [],
  };
}

export function loadDawahQuizState(): DawahQuizState {
  const today = getQuizTodayKey();
  const defaults = getDefaultQuizState(today);
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = window.localStorage.getItem(QUIZ_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<DawahQuizState>;
    const sameDay = parsed.todayDate === today;
    const yesterday = getYesterdayKey(today);
    const activeStreak =
      parsed.lastCompletedDate === today || parsed.lastCompletedDate === yesterday
        ? Math.max(0, Number(parsed.streakDays) || 0)
        : 0;
    return {
      totalPoints: Math.max(0, Number(parsed.totalPoints) || 0),
      totalCorrect: Math.max(0, Number(parsed.totalCorrect) || 0),
      totalAnswered: Math.max(0, Number(parsed.totalAnswered) || 0),
      streakDays: activeStreak,
      lastCompletedDate: parsed.lastCompletedDate || null,
      todayDate: today,
      todayAnswers:
        sameDay && parsed.todayAnswers && typeof parsed.todayAnswers === 'object'
          ? parsed.todayAnswers
          : {},
      todayCompletionBonusClaimed: sameDay ? Boolean(parsed.todayCompletionBonusClaimed) : false,
      practicedQuestionIds:
        sameDay && Array.isArray(parsed.practicedQuestionIds)
          ? parsed.practicedQuestionIds.map(String)
          : [],
    };
  } catch {
    return defaults;
  }
}

export function saveDawahQuizState(next: DawahQuizState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(QUIZ_EVENT, {detail: next}));
  } catch {
    // Ignore storage quota errors
  }
}

export function mergeRemoteQuizState(remote?: DawahQuizState | null): DawahQuizState {
  const local = loadDawahQuizState();
  if (!remote || typeof remote !== 'object') return local;
  const today = getQuizTodayKey();
  const mergedTodayAnswers =
    remote.todayDate === today
      ? {...(remote.todayAnswers || {}), ...local.todayAnswers}
      : local.todayAnswers;
  const merged: DawahQuizState = {
    totalPoints: Math.max(local.totalPoints, Number(remote.totalPoints) || 0),
    totalCorrect: Math.max(local.totalCorrect, Number(remote.totalCorrect) || 0),
    totalAnswered: Math.max(local.totalAnswered, Number(remote.totalAnswered) || 0),
    streakDays: Math.max(local.streakDays, Number(remote.streakDays) || 0),
    lastCompletedDate:
      remote.lastCompletedDate && (!local.lastCompletedDate || remote.lastCompletedDate > local.lastCompletedDate)
        ? remote.lastCompletedDate
        : local.lastCompletedDate,
    todayDate: today,
    todayAnswers: mergedTodayAnswers,
    todayCompletionBonusClaimed:
      local.todayCompletionBonusClaimed ||
      (remote.todayDate === today && Boolean(remote.todayCompletionBonusClaimed)),
    practicedQuestionIds: [
      ...new Set([
        ...local.practicedQuestionIds,
        ...(remote.todayDate === today && Array.isArray(remote.practicedQuestionIds)
          ? remote.practicedQuestionIds
          : []),
      ]),
    ],
  };
  saveDawahQuizState(merged);
  return merged;
}

export function mergeAndSortLeaderboardEntries(
  cloudEntries: QuizLeaderboardEntry[],
  serverEntries: QuizLeaderboardEntry[],
  maxItems = 10,
): QuizLeaderboardEntry[] {
  const byId = new Map<string, QuizLeaderboardEntry>();
  for (const item of [...serverEntries, ...cloudEntries]) {
    if (!item?.id) continue;
    const prev = byId.get(item.id);
    if (!prev || item.score > prev.score || (item.score === prev.score && String(item.updatedAt || '') > String(prev.updatedAt || ''))) {
      byId.set(item.id, item);
    }
  }
  return [...byId.values()]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
      return String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt));
    })
    .slice(0, maxItems);
}

export async function publishQuizLeaderboardScore(params: {
  visitorId?: string;
  nickname: string;
  category: DawahQuizSubject;
  score: number;
  correctCount: number;
  totalQuestions: number;
  streakDays?: number;
  dateKey?: string;
}): Promise<QuizLeaderboardEntry[]> {
  const participantId = getOrCreateQuizParticipantId(params.visitorId);
  const safeNick = saveQuizNickname(params.nickname) || 'طالب علم';
  saveCategoryBestScore(params.category, params.score, params.correctCount, params.totalQuestions);

  const [cloudSaved, serverRes] = await Promise.all([
    cloudSaveQuizLeaderboardScore({
      participantId,
      nickname: safeNick,
      category: params.category,
      score: params.score,
      correctCount: params.correctCount,
      totalQuestions: params.totalQuestions,
      streakDays: params.streakDays,
      dateKey: params.dateKey,
    }),
    fetch('/api/dawah-quiz/leaderboard', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        participantId,
        id: `${participantId}_${params.category}`,
        nickname: safeNick,
        category: params.category,
        score: params.score,
        correctCount: params.correctCount,
        totalQuestions: params.totalQuestions,
        streakDays: params.streakDays,
        dateKey: params.dateKey,
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null) as Promise<{entry?: QuizLeaderboardEntry; entries?: QuizLeaderboardEntry[]} | null>,
  ]);

  const cloudTop = await cloudFetchQuizLeaderboardByCategory(params.category, 10);
  const serverEntries = Array.isArray(serverRes?.entries) ? serverRes.entries : [];
  const merged = mergeAndSortLeaderboardEntries(
    cloudSaved ? [cloudSaved, ...cloudTop] : cloudTop,
    serverEntries,
    10,
  );
  return merged;
}

export async function fetchCategoryQuizLeaderboard(
  category: DawahQuizSubject,
  maxItems = 10,
): Promise<QuizLeaderboardEntry[]> {
  const [cloudEntries, serverPayload] = await Promise.all([
    cloudFetchQuizLeaderboardByCategory(category, maxItems),
    fetch(`/api/dawah-quiz/leaderboard?category=${encodeURIComponent(category)}`, {
      cache: 'no-store',
    })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null) as Promise<{entries?: QuizLeaderboardEntry[]} | null>,
  ]);
  const serverEntries = Array.isArray(serverPayload?.entries) ? serverPayload.entries : [];
  return mergeAndSortLeaderboardEntries(cloudEntries, serverEntries, maxItems);
}

export function useDailyDawahQuiz(visitorId?: string) {
  const [state, setState] = useState<DawahQuizState>(() => loadDawahQuizState());
  const [aiExtraQuestions, setAiExtraQuestions] = useState<DawahQuizQuestion[]>([]);
  const [communityParticipants, setCommunityParticipants] = useState<number>(0);

  useEffect(() => {
    const handler = (ev: Event) => {
      const custom = ev as CustomEvent<DawahQuizState>;
      if (custom.detail) setState(custom.detail);
      else setState(loadDawahQuizState());
    };
    window.addEventListener(QUIZ_EVENT, handler);
    return () => window.removeEventListener(QUIZ_EVENT, handler);
  }, []);

  useEffect(() => {
    let active = true;
    void fetch('/api/dawah-quiz', {cache: 'no-store'})
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (
          data: {
            aiQuestions?: DawahQuizQuestion[];
            participantsToday?: number;
          } | null,
        ) => {
          if (!active || !data) return;
          if (Array.isArray(data.aiQuestions) && data.aiQuestions.length > 0) {
            setAiExtraQuestions(data.aiQuestions);
          }
          if (typeof data.participantsToday === 'number') {
            setCommunityParticipants(data.participantsToday);
          }
        },
      )
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const today = state.todayDate || getQuizTodayKey();
  const dailyQuestions = useMemo(
    () => getDailyQuizQuestions(today, aiExtraQuestions),
    [today, aiExtraQuestions],
  );
  const allQuestions = useMemo(() => {
    const map = new Map<string, DawahQuizQuestion>();
    for (const q of [...aiExtraQuestions, ...VERIFIED_QUIZ_BANK]) {
      if (!map.has(q.id)) map.set(q.id, q);
    }
    return [...map.values()];
  }, [aiExtraQuestions]);

  const answeredTodayCount = dailyQuestions.filter((q) => Boolean(state.todayAnswers[q.id])).length;
  const correctTodayCount = dailyQuestions.filter((q) => state.todayAnswers[q.id]?.isCorrect).length;
  const isDailyCompleted = dailyQuestions.length > 0 && answeredTodayCount >= dailyQuestions.length;
  const todayPointsEarned =
    dailyQuestions.reduce((sum, q) => sum + (state.todayAnswers[q.id]?.earnedPoints || 0), 0) +
    (state.todayCompletionBonusClaimed ? DAILY_COMPLETION_BONUS : 0);

  const rankInfo = useMemo(() => getQuizRank(state.totalPoints), [state.totalPoints]);

  const submitAnswer = (
    question: DawahQuizQuestion,
    selectedIndex: number,
    isDailyMode: boolean,
  ): {
    isCorrect: boolean;
    earnedPoints: number;
    bonusAwarded: number;
    alreadyAnswered: boolean;
    nextState: DawahQuizState;
  } => {
    const current = loadDawahQuizState();
    const todayKey = getQuizTodayKey();
    const isCorrect = selectedIndex === question.correctIndex;

    if (isDailyMode) {
      if (current.todayAnswers[question.id]) {
        return {
          isCorrect: current.todayAnswers[question.id].isCorrect,
          earnedPoints: 0,
          bonusAwarded: 0,
          alreadyAnswered: true,
          nextState: current,
        };
      }
      const earnedPoints = isCorrect ? question.points || DAILY_QUESTION_POINTS : 0;
      const answerRecord: DawahQuizAnswerRecord = {
        selectedIndex,
        isCorrect,
        earnedPoints,
        answeredAt: new Date().toISOString(),
      };
      const nextTodayAnswers = {
        ...current.todayAnswers,
        [question.id]: answerRecord,
      };
      const nowAllDone = dailyQuestions.every((q) => Boolean(nextTodayAnswers[q.id]));
      let bonusAwarded = 0;
      let nextStreak = current.streakDays;
      let nextCompletedDate = current.lastCompletedDate;
      let nextBonusClaimed = current.todayCompletionBonusClaimed;

      if (nowAllDone && !current.todayCompletionBonusClaimed) {
        bonusAwarded = DAILY_COMPLETION_BONUS;
        nextBonusClaimed = true;
        const yesterday = getYesterdayKey(todayKey);
        if (current.lastCompletedDate === yesterday) {
          nextStreak = Math.max(1, current.streakDays + 1);
        } else if (current.lastCompletedDate !== todayKey) {
          nextStreak = 1;
        }
        nextCompletedDate = todayKey;
      }

      const nextState: DawahQuizState = {
        ...current,
        todayDate: todayKey,
        totalPoints: current.totalPoints + earnedPoints + bonusAwarded,
        totalCorrect: current.totalCorrect + (isCorrect ? 1 : 0),
        totalAnswered: current.totalAnswered + 1,
        streakDays: nextStreak,
        lastCompletedDate: nextCompletedDate,
        todayAnswers: nextTodayAnswers,
        todayCompletionBonusClaimed: nextBonusClaimed,
      };
      saveDawahQuizState(nextState);
      setState(nextState);
      trackInteraction('click', 'dawah_quiz');

      void fetch('/api/dawah-quiz/submit', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          visitorId,
          questionId: question.id,
          subject: question.subject,
          isCorrect,
          earnedPoints: earnedPoints + bonusAwarded,
          quizProgress: nextState,
          dateKey: todayKey,
        }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: {participantsToday?: number} | null) => {
          if (d && typeof d.participantsToday === 'number') {
            setCommunityParticipants(d.participantsToday);
          }
        })
        .catch(() => undefined);

      return {isCorrect, earnedPoints, bonusAwarded, alreadyAnswered: false, nextState};
    }

    // Category / subject quiz round (awards +10 pts first time per question per day)
    const alreadyPracticedToday = current.practicedQuestionIds.includes(question.id);
    const earnedPoints = isCorrect && !alreadyPracticedToday ? PRACTICE_QUESTION_POINTS : 0;
    const nextState: DawahQuizState = {
      ...current,
      todayDate: todayKey,
      totalPoints: current.totalPoints + earnedPoints,
      totalCorrect: current.totalCorrect + (isCorrect && !alreadyPracticedToday ? 1 : 0),
      totalAnswered: current.totalAnswered + (alreadyPracticedToday ? 0 : 1),
      practicedQuestionIds: alreadyPracticedToday
        ? current.practicedQuestionIds
        : [...current.practicedQuestionIds, question.id],
    };
    saveDawahQuizState(nextState);
    setState(nextState);
    trackInteraction('click', 'dawah_quiz');

    if (earnedPoints > 0) {
      void fetch('/api/dawah-quiz/submit', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          visitorId,
          questionId: question.id,
          subject: question.subject,
          isCorrect,
          earnedPoints,
          quizProgress: nextState,
          dateKey: todayKey,
        }),
      }).catch(() => undefined);
    }

    return {isCorrect, earnedPoints, bonusAwarded: 0, alreadyAnswered: alreadyPracticedToday, nextState};
  };

  return {
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
  };
}
