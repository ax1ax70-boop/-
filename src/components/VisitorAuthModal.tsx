import {AlertCircle, LogOut, Mail, Phone, ShieldCheck, UserCheck, Users, X} from 'lucide-react';
import {type FormEvent, useCallback, useEffect, useState} from 'react';
import type {VisitorProfile} from '../types';
import {cloudUpsertVisitorProfile} from '../utils/cloudSync';

interface PublicMemberName {
  id: string;
  name: string;
  createdAt: string;
  lastLoginAt?: string;
}

export function VisitorAuthModal({
  open,
  visitor,
  onClose,
  onSignedIn,
  onSignOut,
  onNotify,
}: {
  open: boolean;
  visitor: VisitorProfile | null;
  onClose: () => void;
  onSignedIn: (profile: VisitorProfile) => void;
  onSignOut: () => void;
  onNotify: (msg: string) => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [busy, setBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [members, setMembers] = useState<PublicMemberName[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const loadMemberNames = useCallback(async () => {
    setLoadingMembers(true);
    try {
      const res = await fetch('/api/visitors/names', {cache: 'no-store'});
      if (res.ok) {
        const data = (await res.json()) as {members?: PublicMemberName[]};
        setMembers(Array.isArray(data.members) ? data.members : []);
      }
    } catch {
      // Ignore offline error
    } finally {
      setLoadingMembers(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void loadMemberNames();
    }
  }, [open, loadMemberNames]);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setAuthError('');

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = whatsapp.trim();
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail);
    const phoneDigits = cleanPhone.replace(/[^\d]/g, '');

    if (!cleanName) {
      const msg = 'يرجى إدخال الاسم الكامل للتسجيل';
      setAuthError(msg);
      onNotify(msg);
      return;
    }
    if (!emailOk) {
      const msg = 'يرجى إدخال بريد إلكتروني صحيح للتسجيل';
      setAuthError(msg);
      onNotify(msg);
      return;
    }
    if (phoneDigits.length < 7) {
      const msg = 'يرجى إدخال رقم جوال صحيح (٧ أرقام على الأقل) للتسجيل';
      setAuthError(msg);
      onNotify(msg);
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/visitor/auth', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          provider: 'email',
          name: cleanName,
          email: cleanEmail,
          whatsapp: cleanPhone,
        }),
      });
      const data = (await res.json()) as {profile?: VisitorProfile; error?: string};
      if (!res.ok || !data.profile) {
        const msg = data.error || 'تعذر إتمام التسجيل حالياً';
        setAuthError(msg);
        onNotify(msg);
        return;
      }
      void cloudUpsertVisitorProfile(data.profile).catch(() => undefined);
      onSignedIn(data.profile);
      void loadMemberNames();
      onNotify(`أهلاً بك ${data.profile.name}! تم التسجيل والدخول بنجاح ويمكنك الآن التعليق.`);
      onClose();
    } catch {
      const msg = 'تعذر الاتصال بالخادم';
      setAuthError(msg);
      onNotify(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-3xl bg-white dark:bg-[#0c211a] border border-slate-200 dark:border-white/10 p-6 shadow-2xl space-y-5"
      >
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#006a46] text-white flex items-center justify-center shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#0e1d25] dark:text-white">
                {visitor ? 'بيانات التسجيل' : 'تسجيل / دخول'}
              </h2>
              <p className="text-xs text-[#6e7a71] dark:text-slate-400">
                يجب التسجيل بالاسم الكامل والبريد الإلكتروني ورقم الجوال للمشاركة والتعليق
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="w-9 h-9 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 flex items-center justify-center shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {authError && (
          <div className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 px-3.5 py-2.5 text-xs font-bold text-rose-800 dark:text-rose-200 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{authError}</span>
          </div>
        )}

        {visitor ? (
          <div className="space-y-4">
            <div className="rounded-2xl bg-[#f3f6f4] dark:bg-white/10 p-4 space-y-1.5">
              <p className="text-xs font-bold text-[#006a46] dark:text-[#6cdba6] flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                <span>تم التسجيل والدخول بنجاح</span>
              </p>
              <p className="text-base font-extrabold text-[#0e1d25] dark:text-white">
                {visitor.name}
              </p>
              {visitor.email && (
                <p className="text-xs text-[#6e7a71] dark:text-slate-300 flex items-center gap-1.5" dir="ltr">
                  <Mail className="w-3.5 h-3.5 shrink-0" />
                  <span>{visitor.email}</span>
                </p>
              )}
              {visitor.whatsapp && (
                <p className="text-xs text-[#6e7a71] dark:text-slate-300 flex items-center gap-1.5" dir="ltr">
                  <Phone className="w-3.5 h-3.5 shrink-0" />
                  <span>{visitor.whatsapp}</span>
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                onSignOut();
                onClose();
              }}
              className="w-full min-h-[44px] rounded-xl bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-200 font-bold text-sm flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#3e4a42] dark:text-slate-300 block">
                الاسم الكامل <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="اكتب اسمك الكامل..."
                className="w-full rounded-xl border border-slate-200 dark:border-white/15 bg-[#f8faf9] dark:bg-[#081712] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#006a46]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#3e4a42] dark:text-slate-300 block">
                البريد الإلكتروني (الإيميل) <span className="text-rose-600">*</span>
              </label>
              <input
                type="email"
                required
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@domain.com"
                className="w-full rounded-xl border border-slate-200 dark:border-white/15 bg-[#f8faf9] dark:bg-[#081712] px-3.5 py-2.5 text-sm text-left focus:outline-none focus:ring-2 focus:ring-[#006a46]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#3e4a42] dark:text-slate-300 block">
                رقم الجوال <span className="text-rose-600">*</span>
              </label>
              <input
                type="tel"
                required
                dir="ltr"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="+9677XXXXXXXX"
                className="w-full rounded-xl border border-slate-200 dark:border-white/15 bg-[#f8faf9] dark:bg-[#081712] px-3.5 py-2.5 text-sm text-left focus:outline-none focus:ring-2 focus:ring-[#006a46]"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full min-h-[46px] rounded-xl bg-[#006a46] hover:bg-[#005235] disabled:opacity-60 text-white font-extrabold text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <UserCheck className="w-4 h-4" />
              <span>{busy ? 'جاري التسجيل...' : 'تسجيل / دخول'}</span>
            </button>
          </form>
        )}

        {/* Privacy-safe Public List of Registered Names Only */}
        <div className="pt-3 border-t border-slate-200/70 dark:border-white/10 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-extrabold text-[#0e1d25] dark:text-white flex items-center gap-1.5">
              <Users className="w-4 h-4 text-[#006a46] dark:text-[#6cdba6]" />
              <span>قائمة المسجلين ({members.length.toLocaleString('ar-EG')})</span>
            </h3>
            <span className="text-[11px] text-[#6e7a71] dark:text-slate-400">
              الأسماء فقط — بيانات التواصل محمية
            </span>
          </div>

          {loadingMembers ? (
            <p className="text-xs text-[#6e7a71] dark:text-slate-400">جاري تحميل قائمة المسجلين...</p>
          ) : members.length === 0 ? (
            <p className="text-xs text-[#6e7a71] dark:text-slate-400">
              كن أول المسجلين بالبريد الإلكتروني ورقم الجوال.
            </p>
          ) : (
            <div className="max-h-36 overflow-y-auto grid grid-cols-2 gap-1.5 pr-0.5">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="rounded-xl bg-[#f4faf7] dark:bg-[#112921] border border-slate-200/70 dark:border-white/10 px-3 py-1.5 flex items-center gap-1.5 text-xs font-bold text-[#0e1d25] dark:text-slate-200"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#008559] shrink-0" />
                  <span className="truncate">{m.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
