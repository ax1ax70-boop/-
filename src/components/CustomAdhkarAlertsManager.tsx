import {Bell, BellRing, Clock, Plus, Search, Trash2} from 'lucide-react';
import {useMemo, useState} from 'react';
import {ADHKAR_8_CHAPTERS} from '../data/seed';
import type {CustomAdhkarItem} from '../types';
import {
  type AdhkarChapterId,
  buildAdhkarCatalog,
  summarizeDhikrLabel,
} from '../utils/adhkarCatalog';
import {useI18n} from '../utils/i18n';
import {
  type AdhkarReminderSettings,
  type CustomDhikrAlertRule,
  isNotificationSupported,
  requestNotificationPermission,
  triggerCustomDhikrNotificationNow,
} from '../utils/notifications';

export function CustomAdhkarAlertsManager({
  appName,
  customAdhkar = [],
  reminderSettings,
  onChangeReminderSettings,
  onOpenAdhkar,
  onPermissionUpdated,
  onNotify,
}: {
  appName: string;
  customAdhkar?: CustomAdhkarItem[];
  reminderSettings: AdhkarReminderSettings;
  onChangeReminderSettings: (next: AdhkarReminderSettings) => void;
  onOpenAdhkar: (dhikrId?: string) => void;
  onPermissionUpdated?: (perm: NotificationPermission | 'unsupported') => void;
  onNotify: (msg: string) => void;
}) {
  const {isEn, tr, formatNumber} = useI18n();
  const catalog = useMemo(() => buildAdhkarCatalog(customAdhkar), [customAdhkar]);

  const [chapterFilter, setChapterFilter] = useState<'all' | AdhkarChapterId>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDhikrId, setSelectedDhikrId] = useState<string>(() => catalog[0]?.id || '');
  const [customTime, setCustomTime] = useState('09:00');
  const [testingRuleId, setTestingRuleId] = useState<string | null>(null);

  const filteredCatalog = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return catalog.filter((item) => {
      if (chapterFilter !== 'all' && item.chapterId !== chapterFilter) return false;
      if (!q) return true;
      return (
        item.text.toLowerCase().includes(q) ||
        (item.title || '').toLowerCase().includes(q) ||
        item.source.toLowerCase().includes(q)
      );
    });
  }, [catalog, chapterFilter, searchTerm]);

  const activeSelection = useMemo(() => {
    return (
      filteredCatalog.find((item) => item.id === selectedDhikrId) ||
      filteredCatalog[0] ||
      catalog[0] ||
      null
    );
  }, [filteredCatalog, selectedDhikrId, catalog]);

  const handleAddCustomAlert = async () => {
    if (!activeSelection) return;
    const cleanTime = /^\d{2}:\d{2}$/.test(customTime) ? customTime : '09:00';

    if (isNotificationSupported() && window.Notification.permission === 'default') {
      const perm = await requestNotificationPermission();
      onPermissionUpdated?.(perm);
    }

    const existingIdx = (reminderSettings.customAlerts || []).findIndex(
      (r) => r.dhikrId === activeSelection.id && r.time === cleanTime,
    );

    const chapterMeta = ADHKAR_8_CHAPTERS.find((c) => c.id === activeSelection.chapterId);
    const titleLabel = activeSelection.title || chapterMeta?.label || tr('ذكر مخصص', 'Custom Dhikr');

    let nextAlerts: CustomDhikrAlertRule[];
    if (existingIdx >= 0) {
      nextAlerts = reminderSettings.customAlerts.map((rule, idx) =>
        idx === existingIdx ? {...rule, enabled: true, lastNotifiedDate: ''} : rule,
      );
    } else {
      const newRule: CustomDhikrAlertRule = {
        id: `dhikr_alert_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        dhikrId: activeSelection.id,
        dhikrTitle: titleLabel,
        dhikrText: activeSelection.text,
        dhikrSource: activeSelection.source,
        time: cleanTime,
        enabled: true,
        lastNotifiedDate: '',
      };
      nextAlerts = [newRule, ...(reminderSettings.customAlerts || [])];
    }

    onChangeReminderSettings({
      ...reminderSettings,
      enabled: true,
      customAlerts: nextAlerts,
    });

    onNotify(
      tr(
        `تمت جدولة تنبيه محلي للذكر الساعة ${cleanTime}`,
        `Local alert scheduled for ${cleanTime}`,
      ),
    );
  };

  const handleToggleRule = async (ruleId: string) => {
    const target = (reminderSettings.customAlerts || []).find((r) => r.id === ruleId);
    if (!target) return;
    const nextEnabled = !target.enabled;
    if (nextEnabled && isNotificationSupported() && window.Notification.permission === 'default') {
      const perm = await requestNotificationPermission();
      onPermissionUpdated?.(perm);
    }
    const nextAlerts = (reminderSettings.customAlerts || []).map((r) =>
      r.id === ruleId ? {...r, enabled: nextEnabled} : r,
    );
    onChangeReminderSettings({
      ...reminderSettings,
      enabled: nextEnabled ? true : reminderSettings.enabled,
      customAlerts: nextAlerts,
    });
  };

  const handleChangeRuleTime = (ruleId: string, nextTime: string) => {
    const cleanTime = /^\d{2}:\d{2}$/.test(nextTime) ? nextTime : '09:00';
    const nextAlerts = (reminderSettings.customAlerts || []).map((r) =>
      r.id === ruleId ? {...r, time: cleanTime, lastNotifiedDate: ''} : r,
    );
    onChangeReminderSettings({
      ...reminderSettings,
      customAlerts: nextAlerts,
    });
  };

  const handleDeleteRule = (ruleId: string) => {
    const nextAlerts = (reminderSettings.customAlerts || []).filter((r) => r.id !== ruleId);
    onChangeReminderSettings({
      ...reminderSettings,
      customAlerts: nextAlerts,
    });
    onNotify(tr('تم حذف التنبيه المخصص', 'Custom alert removed'));
  };

  const handleTestRule = async (rule: CustomDhikrAlertRule) => {
    setTestingRuleId(rule.id);
    try {
      if (isNotificationSupported() && window.Notification.permission === 'default') {
        const perm = await requestNotificationPermission();
        onPermissionUpdated?.(perm);
      }
      await triggerCustomDhikrNotificationNow({
        rule,
        isEn,
        appName,
        onOpenAdhkar,
        onInAppNotify: onNotify,
      });
    } finally {
      setTestingRuleId(null);
    }
  };

  const customAlerts = reminderSettings.customAlerts || [];
  const activeCount = customAlerts.filter((a) => a.enabled).length;

  return (
    <div dir={isEn ? 'ltr' : 'rtl'} className="pt-3 border-t border-slate-200/80 dark:border-white/10 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5">
          <h4 className="text-xs sm:text-sm font-extrabold text-[#0e1d25] dark:text-white flex items-center gap-1.5">
            <BellRing className="w-4 h-4 text-[#006a46] dark:text-[#6cdba6] shrink-0" />
            <span>{tr('تنبيهات أذكار مخصصة (جدولة محلية في المتصفح)', 'Custom Per-Dhikr Scheduled Alerts')}</span>
          </h4>
          <p className="text-[11px] text-[#6e7a71] dark:text-slate-400">
            {tr(
              'اختر أذكاراً محددة وحدد أوقاتها ليتم تنبيهك بها يومياً ومحلياً عبر متصفحك.',
              'Select specific Adhkar and schedule custom daily local browser alerts.',
            )}
          </p>
        </div>
        <span className="text-[11px] font-bold text-[#006a46] dark:text-[#6cdba6] tabular-nums">
          {tr(`المجدول النشط: ${formatNumber(activeCount)}`, `Active: ${activeCount}`)}
        </span>
      </div>

      {/* Picker Form: Filter + Dhikr Select + Custom Time + Add Button */}
      <div className="space-y-2.5 bg-white/85 dark:bg-[#1d332b] rounded-xl p-3 border border-slate-200/70 dark:border-white/10">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#6e7a71] absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={tr('ابحث عن ذكر أو دعاء...', 'Search Adhkar...')}
              className="w-full min-h-[40px] ps-8 pe-3 rounded-lg bg-[#f4faff] dark:bg-[#223a32] border border-slate-200 dark:border-white/10 text-xs text-[#0e1d25] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#006a46]/40"
            />
          </div>

          <select
            aria-label={tr('تصفية حسب الباب', 'Filter by chapter')}
            value={chapterFilter}
            onChange={(e) => setChapterFilter(e.target.value as 'all' | AdhkarChapterId)}
            className="w-full min-h-[40px] px-3 rounded-lg bg-[#f4faff] dark:bg-[#223a32] border border-slate-200 dark:border-white/10 text-xs font-bold text-[#0e1d25] dark:text-white focus:outline-none"
          >
            <option value="all">{tr('كل أبواب الأذكار والأدعية', 'All Adhkar Chapters')}</option>
            {ADHKAR_8_CHAPTERS.map((ch) => (
              <option key={ch.id} value={ch.id}>
                {ch.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 items-center">
          <select
            aria-label={tr('اختر الذكر المراد جدولته', 'Choose Dhikr to schedule')}
            value={activeSelection?.id || ''}
            onChange={(e) => setSelectedDhikrId(e.target.value)}
            className="w-full min-h-[42px] px-3 rounded-lg bg-[#f4faff] dark:bg-[#223a32] border border-slate-200 dark:border-white/10 text-xs font-semibold text-[#0e1d25] dark:text-white focus:outline-none"
          >
            {filteredCatalog.length === 0 ? (
              <option value="">{tr('لا توجد أذكار مطابقة للبحث', 'No matching Adhkar')}</option>
            ) : (
              filteredCatalog.map((item) => (
                <option key={item.id} value={item.id}>
                  {summarizeDhikrLabel(item)}
                </option>
              ))
            )}
          </select>

          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-[#006389] dark:text-[#80cfff] shrink-0" />
            <input
              type="time"
              aria-label={tr('وقت التنبيه المخصص', 'Custom alert time')}
              value={customTime}
              onChange={(e) => setCustomTime(e.target.value || '09:00')}
              dir="ltr"
              className="min-h-[42px] px-2.5 rounded-lg bg-[#f4faff] dark:bg-[#223a32] border border-slate-200 dark:border-white/10 text-xs sm:text-sm font-bold text-[#0e1d25] dark:text-white tabular-nums"
            />
          </div>

          <button
            type="button"
            disabled={!activeSelection}
            onClick={() => void handleAddCustomAlert()}
            className="min-h-[42px] px-4 py-2 rounded-lg bg-[#006a46] hover:bg-[#00583a] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-colors disabled:opacity-50"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>{tr('جدولة تنبيه', 'Schedule Alert')}</span>
          </button>
        </div>

        {activeSelection && (
          <p dir="rtl" className="text-[11px] text-[#3e4a42] dark:text-slate-300 leading-relaxed line-clamp-2 pt-0.5">
            <span className="font-bold text-[#006a46] dark:text-[#6cdba6]">{tr('المعاينة: ', 'Preview: ')}</span>
            {activeSelection.text}
          </p>
        )}
      </div>

      {/* Scheduled Custom Rules List */}
      {customAlerts.length === 0 ? (
        <p className="text-[11px] text-[#6e7a71] dark:text-slate-400 text-center py-2">
          {tr(
            'لم تُضف أذكاراً مخصصة بعد؛ اختر ذكراً أعلاه وحدد الوقت المناسب لك.',
            'No custom Adhkar alerts added yet. Choose any Dhikr above and pick a time.',
          )}
        </p>
      ) : (
        <div className="divide-y divide-slate-200/70 dark:divide-white/10 border-t border-slate-200/70 dark:border-white/10">
          {customAlerts.map((rule) => (
            <div
              key={rule.id}
              className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
            >
              <button
                type="button"
                onClick={() => onOpenAdhkar(rule.dhikrId)}
                className="min-w-0 flex-1 text-start space-y-0.5 hover:opacity-85 transition-opacity"
              >
                <p className="text-xs font-extrabold text-[#0e1d25] dark:text-white truncate">
                  {rule.dhikrTitle}
                </p>
                <p dir="rtl" className="text-[11px] text-[#3e4a42] dark:text-slate-300 line-clamp-1">
                  {rule.dhikrText}
                </p>
                {rule.dhikrSource && (
                  <p className="text-[10px] text-[#6e7a71] dark:text-slate-400 truncate">
                    {rule.dhikrSource}
                    {rule.lastNotifiedDate ? ` · ${tr('نُبّه اليوم', 'Notified today')}` : ''}
                  </p>
                )}
              </button>

              <div className="flex items-center gap-1.5 shrink-0">
                <input
                  type="time"
                  aria-label={tr(`وقت تنبيه ${rule.dhikrTitle}`, `Time for ${rule.dhikrTitle}`)}
                  value={rule.time}
                  onChange={(e) => handleChangeRuleTime(rule.id, e.target.value)}
                  dir="ltr"
                  className="min-h-[38px] px-2 rounded-lg bg-white dark:bg-[#1d332b] border border-slate-200 dark:border-white/15 text-xs font-bold text-[#0e1d25] dark:text-white tabular-nums"
                />

                <button
                  type="button"
                  role="switch"
                  aria-checked={rule.enabled}
                  onClick={() => void handleToggleRule(rule.id)}
                  className={`min-h-[38px] px-2.5 rounded-lg text-[11px] font-bold whitespace-nowrap shrink-0 transition-colors ${
                    rule.enabled
                      ? 'bg-[#006a46] text-white'
                      : 'bg-white dark:bg-[#1d332b] border border-slate-200 dark:border-white/15 text-[#6e7a71] dark:text-slate-400'
                  }`}
                >
                  {rule.enabled ? tr('مفعّل', 'On') : tr('متوقف', 'Off')}
                </button>

                <button
                  type="button"
                  disabled={testingRuleId === rule.id}
                  onClick={() => void handleTestRule(rule)}
                  aria-label={tr('تجربة التنبيه الآن', 'Test alert now')}
                  title={tr('تجربة التنبيه الآن', 'Test alert now')}
                  className="min-w-[38px] min-h-[38px] rounded-lg bg-[#fffbf2] dark:bg-[#1d332b] border border-[#f2be5e]/45 text-[#7c5800] dark:text-[#f2be5e] flex items-center justify-center hover:bg-[#ffdea8]/50 transition-colors disabled:opacity-50"
                >
                  <Bell className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => handleDeleteRule(rule.id)}
                  aria-label={tr('حذف التنبيه', 'Delete alert')}
                  title={tr('حذف التنبيه', 'Delete alert')}
                  className="min-w-[38px] min-h-[38px] rounded-lg bg-white dark:bg-[#1d332b] border border-slate-200 dark:border-white/15 text-[#ba1a1a] hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
