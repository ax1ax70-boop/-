import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LogIn,
  LogOut,
  Mail,
  Phone,
  ShieldCheck,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import {type FormEvent, useState} from 'react';
import type {VisitorProfile} from '../types';
import {cloudRecordPublicMember, cloudUpsertVisitorProfile} from '../utils/cloudSync';
import {saveLocalTelemetryFloors} from '../utils/telemetry';
import {useI18n} from '../utils/i18n';

const DIAL_COUNTRY_CODES = [
  {code: '+966', label: '🇸🇦 السعودية (+966)'},
  {code: '+971', label: '🇦🇪 الإمارات (+971)'},
  {code: '+965', label: '🇰🇼 الكويت (+965)'},
  {code: '+974', label: '🇶🇦 قطر (+974)'},
  {code: '+973', label: '🇧🇭 البحرين (+973)'},
  {code: '+968', label: '🇴🇲 عُمان (+968)'},
  {code: '+967', label: '🇾🇪 اليمن (+967)'},
  {code: '+20', label: '🇪🇬 مصر (+20)'},
  {code: '+962', label: '🇯🇴 الأردن (+962)'},
  {code: '+91', label: '🇮🇳 الهند / كيرلا (+91)'},
  {code: '+880', label: '🇧🇩 بنغلاديش (+880)'},
  {code: '+63', label: '🇵🇭 الفلبين (+63)'},
  {code: '+92', label: '🇵🇰 باكستان (+92)'},
  {code: '+62', label: '🇮🇩 إندونيسيا (+62)'},
  {code: '+977', label: '🇳🇵 نيبال (+977)'},
  {code: '+94', label: '🇱🇰 سريلانكا (+94)'},
  {code: '+90', label: '🇹🇷 تركيا (+90)'},
];

export const VISITOR_SESSION_TOKEN_KEY = 'mawaedh_visitor_session_token_v1';
const SAVED_IDENTIFIER_KEY = 'mawaedh_visitor_saved_id_v1';

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
  onSignedIn: (
    profile: VisitorProfile,
    options?: {
      sessionToken?: string;
      rememberMe?: boolean;
      visitorsCount?: number;
      clicksCount?: number;
      registeredMembersCount?: number;
    },
  ) => void;
  onSignOut: () => void;
  onNotify: (msg: string) => void;
}) {
  const {tr} = useI18n();
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Shared / Login state
  const [identifier, setIdentifier] = useState(() => {
    try {
      return window.localStorage.getItem(SAVED_IDENTIFIER_KEY) || '';
    } catch {
      return '';
    }
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Registration state
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+966');
  const [phoneLocal, setPhoneLocal] = useState('');

  const [busy, setBusy] = useState(false);
  const [authError, setAuthError] = useState('');

  if (!open) return null;

  const persistLoginIdentifier = (value: string) => {
    try {
      if (rememberMe && value) {
        window.localStorage.setItem(SAVED_IDENTIFIER_KEY, value);
      } else if (!rememberMe) {
        window.localStorage.removeItem(SAVED_IDENTIFIER_KEY);
      }
    } catch {
      // Ignore storage error
    }
  };

  const handleLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setAuthError('');

    const cleanId = identifier.trim();
    if (!cleanId) {
      const msg = 'يرجى إدخال اسم المستخدم أو البريد الإلكتروني أو رقم الجوال';
      setAuthError(msg);
      onNotify(msg);
      return;
    }
    if (!password) {
      const msg = 'يرجى إدخال كلمة المرور';
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
          mode: 'login',
          identifier: cleanId,
          password,
        }),
      });
      const data = (await res.json()) as {
        profile?: VisitorProfile;
        sessionToken?: string;
        visitorsCount?: number;
        clicksCount?: number;
        registeredMembersCount?: number;
        error?: string;
      };
      if (!res.ok || !data.profile) {
        const msg = data.error || 'تعذر تسجيل الدخول حالياً';
        setAuthError(msg);
        onNotify(msg);
        return;
      }
      persistLoginIdentifier(data.profile.username || data.profile.email || cleanId);
      saveLocalTelemetryFloors({
        visitorsCount: data.visitorsCount,
        clicksCount: data.clicksCount,
        registeredMembersCount: data.registeredMembersCount,
      });
      void cloudUpsertVisitorProfile(data.profile).catch(() => undefined);
      void cloudRecordPublicMember(data.profile, false).catch(() => undefined);
      onSignedIn(data.profile, {
        sessionToken: data.sessionToken,
        rememberMe,
        visitorsCount: data.visitorsCount,
        clicksCount: data.clicksCount,
        registeredMembersCount: data.registeredMembersCount,
      });
      onNotify(
        rememberMe
          ? `أهلاً بك ${data.profile.name}! تم تسجيل الدخول وحفظ جلستك تلقائياً.`
          : `أهلاً بك ${data.profile.name}! تم تسجيل الدخول بنجاح.`,
      );
      onClose();
    } catch {
      const msg = 'تعذر الاتصال بالخادم';
      setAuthError(msg);
      onNotify(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleRegisterSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setAuthError('');

    const cleanName = name.trim();
    const cleanUsername = username.trim().replace(/\s+/g, '_');
    const cleanEmail = email.trim().toLowerCase();
    const rawDigits = phoneLocal.replace(/[^\d]/g, '').replace(/^0+/, '');
    const fullPhone = `${countryCode}${rawDigits}`;
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail);

    if (!cleanName) {
      const msg = 'يرجى إدخال الاسم أو الكنية للتسجيل';
      setAuthError(msg);
      onNotify(msg);
      return;
    }
    if (!cleanUsername || cleanUsername.length < 3) {
      const msg = 'يرجى اختيار اسم مستخدم من ٣ أحرف على الأقل لحفظ الدخول';
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
    if (rawDigits.length < 7 || rawDigits.length > 12) {
      const msg = 'يرجى إدخال رقم جوال صحيح بعد مفتاح الدولة (مثال: 5XXXXXXXX)';
      setAuthError(msg);
      onNotify(msg);
      return;
    }
    if (password.length < 6) {
      const msg = 'يرجى إنشاء كلمة مرور من ٦ أحرف أو أرقام على الأقل';
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
          mode: 'register',
          provider: 'email',
          name: cleanName,
          username: cleanUsername,
          email: cleanEmail,
          whatsapp: fullPhone,
          password,
        }),
      });
      const data = (await res.json()) as {
        profile?: VisitorProfile;
        sessionToken?: string;
        visitorsCount?: number;
        clicksCount?: number;
        registeredMembersCount?: number;
        error?: string;
      };
      if (!res.ok || !data.profile) {
        const msg = data.error || 'تعذر إتمام التسجيل حالياً';
        setAuthError(msg);
        onNotify(msg);
        return;
      }
      persistLoginIdentifier(data.profile.username || cleanEmail);
      saveLocalTelemetryFloors({
        visitorsCount: data.visitorsCount,
        clicksCount: data.clicksCount,
        registeredMembersCount: data.registeredMembersCount,
      });
      void cloudUpsertVisitorProfile(data.profile).catch(() => undefined);
      void cloudRecordPublicMember(data.profile, true).catch(() => undefined);
      onSignedIn(data.profile, {
        sessionToken: data.sessionToken,
        rememberMe,
        visitorsCount: data.visitorsCount,
        clicksCount: data.clicksCount,
        registeredMembersCount: data.registeredMembersCount,
      });
      onNotify(`أهلاً بك ${data.profile.name}! تم حفظ بيانات دخولك بنجاح ويمكنك الدخول دون تكرار.`);
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
        className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-3xl bg-white dark:bg-[#223a32] border border-slate-200 dark:border-white/10 p-6 shadow-2xl space-y-5"
      >
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#006a46] text-white flex items-center justify-center shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#0e1d25] dark:text-white">
                {visitor
                  ? tr('حسابي', 'My Account')
                  : authMode === 'login'
                    ? tr('تسجيل الدخول', 'Sign In')
                    : tr('إنشاء حساب جديد', 'Create Account')}
              </h2>
              <p className="text-xs text-[#6e7a71] dark:text-slate-400">
                {tr(
                  'دخول محفوظ بالبريد الإلكتروني أو رقم الجوال أو اسم المستخدم',
                  'Saved sign-in with email, mobile, or username',
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={tr('إغلاق', 'Close')}
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
            <div className="rounded-2xl bg-[#f3f6f4] dark:bg-white/10 p-4 space-y-2">
              <p className="text-xs font-bold text-[#006a46] dark:text-[#6cdba6] flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                <span>تسجيل دخولك محفوظ تلقائياً على هذا الجهاز</span>
              </p>
              <p className="text-base font-extrabold text-[#0e1d25] dark:text-white">
                {visitor.name}
              </p>
              {visitor.username && (
                <p className="text-xs font-bold text-[#006a46] dark:text-[#6cdba6] flex items-center gap-1.5" dir="ltr">
                  <KeyRound className="w-3.5 h-3.5 shrink-0" />
                  <span>@{visitor.username}</span>
                </p>
              )}
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
          <div className="space-y-4">
            {/* Switch between Saved Login & New Registration */}
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-[#f3f6f4] dark:bg-[#1b3029]">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setAuthError('');
                }}
                className={`min-h-[40px] px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors ${
                  authMode === 'login'
                    ? 'bg-[#006a46] text-white shadow-xs'
                    : 'text-[#3e4a42] dark:text-slate-300 hover:bg-white/60 dark:hover:bg-white/5'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>تسجيل الدخول</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('register');
                  setAuthError('');
                }}
                className={`min-h-[40px] px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors ${
                  authMode === 'register'
                    ? 'bg-[#006a46] text-white shadow-xs'
                    : 'text-[#3e4a42] dark:text-slate-300 hover:bg-white/60 dark:hover:bg-white/5'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>تسجيل حساب جديد</span>
              </button>
            </div>

            {authMode === 'login' ? (
              <form method="post" onSubmit={handleLoginSubmit} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#3e4a42] dark:text-slate-300 block">
                    اسم المستخدم أو البريد الإلكتروني أو رقم الجوال <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    name="username"
                    autoComplete="username"
                    required
                    dir="ltr"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="username / email@domain.com / +9665XXXXXXXX"
                    className="w-full rounded-xl border border-slate-200 dark:border-white/15 bg-[#f8faf9] dark:bg-[#1b3029] px-3.5 py-2.5 text-sm text-left focus:outline-none focus:ring-2 focus:ring-[#006a46]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#3e4a42] dark:text-slate-300 block">
                    كلمة المرور <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      autoComplete="current-password"
                      required
                      dir="ltr"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-xl border border-slate-200 dark:border-white/15 bg-[#f8faf9] dark:bg-[#1b3029] pl-3.5 pr-10 py-2.5 text-sm text-left focus:outline-none focus:ring-2 focus:ring-[#006a46]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#006a46] p-1"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <label className="flex items-start gap-2.5 rounded-xl bg-[#eefaf3] dark:bg-[#1b3029] border border-[#006a46]/20 p-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-[#006a46] rounded"
                  />
                  <span className="text-xs font-bold text-[#0e1d25] dark:text-slate-200 leading-relaxed">
                    حفظ تسجيل الدخول تلقائياً (تذكر بياناتي بالبريد أو الجوال دون تكرار الدخول عند فتح الموقع)
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full min-h-[46px] rounded-xl bg-[#006a46] hover:bg-[#005235] disabled:opacity-60 text-white font-extrabold text-sm flex items-center justify-center gap-2 transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{busy ? 'جاري التحقق والدخول...' : 'دخول وحفظ الجلسة'}</span>
                </button>
              </form>
            ) : (
              <form method="post" onSubmit={handleRegisterSubmit} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#3e4a42] dark:text-slate-300 block">
                    الاسم أو الكنية <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    autoComplete="name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="مثال: أبو عبد الله أو الاسم الأول..."
                    className="w-full rounded-xl border border-slate-200 dark:border-white/15 bg-[#f8faf9] dark:bg-[#1b3029] px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#006a46]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#3e4a42] dark:text-slate-300 block">
                    اسم المستخدم (لحفظ الدخول السريع) <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    name="username"
                    autoComplete="username"
                    required
                    dir="ltr"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="abu_abdullah"
                    className="w-full rounded-xl border border-slate-200 dark:border-white/15 bg-[#f8faf9] dark:bg-[#1b3029] px-3.5 py-2.5 text-sm text-left focus:outline-none focus:ring-2 focus:ring-[#006a46]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#3e4a42] dark:text-slate-300 block">
                    البريد الإلكتروني (الإيميل) <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    required
                    dir="ltr"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@domain.com"
                    className="w-full rounded-xl border border-slate-200 dark:border-white/15 bg-[#f8faf9] dark:bg-[#1b3029] px-3.5 py-2.5 text-sm text-left focus:outline-none focus:ring-2 focus:ring-[#006a46]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#3e4a42] dark:text-slate-300 block">
                    رقم الجوال (يبدأ بمفتاح السعودية +966) <span className="text-rose-600">*</span>
                  </label>
                  <div dir="ltr" className="flex items-stretch gap-1.5">
                    <select
                      aria-label="مفتاح الدولة"
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                      className="rounded-xl border border-slate-200 dark:border-white/15 bg-[#eef7f3] dark:bg-[#28453b] px-2.5 py-2.5 text-xs font-extrabold text-[#006a46] dark:text-[#6cdba6] focus:outline-none focus:ring-2 focus:ring-[#006a46] max-w-[148px]"
                    >
                      {DIAL_COUNTRY_CODES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="tel"
                      name="tel"
                      autoComplete="tel-national"
                      required
                      dir="ltr"
                      value={phoneLocal}
                      onChange={(e) => setPhoneLocal(e.target.value.replace(/[^\d\s-]/g, ''))}
                      placeholder="5XXXXXXXX"
                      className="flex-1 min-w-0 rounded-xl border border-slate-200 dark:border-white/15 bg-[#f8faf9] dark:bg-[#1b3029] px-3.5 py-2.5 text-sm text-left focus:outline-none focus:ring-2 focus:ring-[#006a46]"
                    />
                  </div>
                  <p className="text-[11px] text-[#6e7a71] dark:text-slate-400">
                    الصيغة الكاملة:{' '}
                    <span dir="ltr" className="font-bold text-[#006a46] dark:text-[#6cdba6]">
                      {countryCode}
                      {phoneLocal.replace(/[^\d]/g, '').replace(/^0+/, '') || '5XXXXXXXX'}
                    </span>
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#3e4a42] dark:text-slate-300 block">
                    كلمة المرور (٦ أحرف أو أرقام على الأقل) <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      autoComplete="new-password"
                      required
                      minLength={6}
                      dir="ltr"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-xl border border-slate-200 dark:border-white/15 bg-[#f8faf9] dark:bg-[#1b3029] pl-3.5 pr-10 py-2.5 text-sm text-left focus:outline-none focus:ring-2 focus:ring-[#006a46]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#006a46] p-1"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <label className="flex items-start gap-2.5 rounded-xl bg-[#eefaf3] dark:bg-[#1b3029] border border-[#006a46]/20 p-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-[#006a46] rounded"
                  />
                  <span className="text-xs font-bold text-[#0e1d25] dark:text-slate-200 leading-relaxed flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#006a46] shrink-0" />
                    <span>حفظ بيانات الدخول تلقائياً لعدم تكرار تسجيل الدخول مستقبلاً</span>
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full min-h-[46px] rounded-xl bg-[#006a46] hover:bg-[#005235] disabled:opacity-60 text-white font-extrabold text-sm flex items-center justify-center gap-2 transition-colors"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>{busy ? 'جاري حفظ الحساب...' : 'تسجيل وحفظ بيانات الدخول'}</span>
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
