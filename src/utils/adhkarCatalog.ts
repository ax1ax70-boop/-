import {ADHKAR_8_CHAPTERS, ADHKAR_ITEMS, HISN_ITEMS} from '../data/seed';
import type {CustomAdhkarItem} from '../types';

export type AdhkarChapterId = (typeof ADHKAR_8_CHAPTERS)[number]['id'];

export interface NormalizedDhikrCard {
  id: string;
  chapterId: AdhkarChapterId;
  title?: string;
  text: string;
  fadl?: string;
  targetCount: number;
  source: string;
}

export function buildAdhkarCatalog(customAdhkar: CustomAdhkarItem[] = []): NormalizedDhikrCard[] {
  const base: NormalizedDhikrCard[] = [];

  for (const item of ADHKAR_ITEMS) {
    let chapterId: AdhkarChapterId = 'ch1_morning_evening';
    if (item.category === 'morning' || item.category === 'evening') {
      chapterId = 'ch1_morning_evening';
    } else if (item.category === 'after_prayer') {
      chapterId = 'ch2_wudu_prayer';
    } else if (item.category === 'sleep') {
      chapterId = 'ch3_sleep_waking';
    } else if (item.category === 'general') {
      chapterId = 'ch7_istighfar_tasbeeh';
    } else if (item.category === 'prophetic_duas' || item.category === 'quran_duas') {
      chapterId = 'ch6_distress_ruqyah';
    } else if (item.category === 'family_muslims_duas') {
      chapterId = 'ch8_birr_wafaa';
    }
    base.push({
      id: `adh_${item.id}`,
      chapterId,
      title:
        item.category === 'morning'
          ? 'من أذكار الصباح'
          : item.category === 'evening'
            ? 'من أذكار المساء'
            : undefined,
      text: item.text,
      fadl: item.fadl,
      targetCount: item.targetCount,
      source: item.source,
    });
  }

  for (const h of HISN_ITEMS) {
    let chapterId: AdhkarChapterId = 'ch6_distress_ruqyah';
    if (h.chapter === 'mosque_prayer') chapterId = 'ch2_wudu_prayer';
    else if (h.chapter === 'waking_sleep') chapterId = 'ch3_sleep_waking';
    else if (h.chapter === 'travel_nature') chapterId = 'ch4_home_travel';
    else if (h.chapter === 'home_clothing') chapterId = 'ch5_food_clothing';
    else if (h.chapter === 'distress_debt' || h.chapter === 'ruqyah_illness') {
      chapterId = 'ch6_distress_ruqyah';
    }

    base.push({
      id: `his_${h.id}`,
      chapterId,
      title: h.title,
      text: h.text,
      fadl: h.fadl,
      targetCount: h.targetCount,
      source: h.source,
    });
  }

  const extra: NormalizedDhikrCard[] = (Array.isArray(customAdhkar) ? customAdhkar : []).map((c) => {
    const validCh = ADHKAR_8_CHAPTERS.some((ch) => ch.id === c.chapterId)
      ? (c.chapterId as AdhkarChapterId)
      : 'ch1_morning_evening';
    return {
      id: c.id,
      chapterId: validCh,
      title: c.title,
      text: c.text,
      fadl: c.fadl,
      targetCount: Math.max(1, c.targetCount || 1),
      source: c.source || 'إضافات المشرفين السحابية',
    };
  });

  return [...extra, ...base];
}

export function summarizeDhikrLabel(item: Pick<NormalizedDhikrCard, 'title' | 'text'>): string {
  const cleanText = item.text.replace(/\s+/g, ' ').trim();
  const snippet = cleanText.length > 52 ? `${cleanText.slice(0, 49).trim()}...` : cleanText;
  return item.title ? `${item.title} — ${snippet}` : snippet;
}
