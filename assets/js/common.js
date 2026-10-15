/* ===== أدوات مشتركة بين كل الصفحات ===== */
/* لا تحتاج تعديل هذا الملف. الإعدادات في config.js */

// قيم احتياطية حتى لا ينكسر الموقع لو حُذف مفتاح من config.js
const CFG = Object.assign({
  ADMIN_EMAIL_DOMAIN: 'example.com', PROGRAM_NAME: '', ORG_NAME: '', ORG_SHORT: '', ORG_ABOUT: '', FOOTER_NOTE: '',
  INSTAGRAM_PAGE: '#', OFFICIAL_HANDLE: '', WHATSAPP_CONTACT: '', GROUP_LINK: '', SITE_URL: '',
  TIMEZONE: 'Asia/Gaza', REMINDER_HEADER: '', REMINDER_FOOTER: '', HERO_LEAD: '', SHARE_TEXT: '', STEPS: [], CRITERIA: [], FAQ: [],
  ALLOW_SELF_SUBMIT: true, SHOW_TODAY_STRIP: true, AUTO_REFRESH_SECONDS: 45,
  MEMBER_LABEL: 'عضو البرنامج', OPEN_LABEL: 'مشارك مفتوح', MEMBER_CODE_HINT: '',
  HIDE_COUNTRIES: [], CERT_ENABLED: true, CERT_MIN_PERCENT: 80, CERT_SIGNER: ''
}, window.APP_CONFIG || {});

const configured = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY &&
  !String(CFG.SUPABASE_URL).includes('YOUR_') && !String(CFG.SUPABASE_ANON_KEY).includes('YOUR_'));
const sb = configured && window.supabase
  ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY)
  : null;
/* سبب وضع المعاينة (يظهر في الشريط العلوي لتسهيل التشخيص) */
const demoReason = sb ? '' : (!configured ? 'لم تُعدَّل قيمتا SUPABASE_URL وSUPABASE_ANON_KEY في assets/js/config.js (ما زالتا YOUR_…).'
  : 'ملف مكتبة Supabase لم يُحمَّل: تأكد من رفع المجلد assets/js/vendor كاملًا إلى GitHub.');

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function cleanHandle(s) {
  return String(s || '').trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').split(/[/?#]/)[0].trim();
}
function isHttps(u) { try { return new URL(u).protocol === 'https:'; } catch { return false; } }
function initials(name) {
  const p = String(name || '?').trim().split(/\s+/);
  return (p[0]?.[0] || '?') + (p[1]?.[0] || '');
}
/* الصورة الشخصية. إن تعذّر تحميلها تظهر الأحرف الأولى (انظر fixBrokenAvatars) */
function avatarHTML(p, cls = '') {
  const ini = `<b>${esc(initials(p.full_name))}</b>`;
  if (p.photo_url && isHttps(p.photo_url)) {
    return `<span class="avatar ${cls}"><img src="${esc(p.photo_url)}" alt="${esc(p.full_name)}" loading="lazy" data-ini="${esc(initials(p.full_name))}"></span>`;
  }
  return `<span class="avatar ${cls}">${ini}</span>`;
}
/* استبدال الصور المكسورة بالأحرف الأولى (الأخطاء لا تنتشر، لذا نستمع في مرحلة الالتقاط) */
document.addEventListener('error', e => {
  const im = e.target;
  if (im && im.tagName === 'IMG' && im.dataset && im.dataset.ini !== undefined && im.parentNode) {
    const b = document.createElement('b'); b.textContent = im.dataset.ini; im.replaceWith(b);
  }
}, true);

/* ===== الدول =====
   الرموز بصيغة ISO (حرفان). الأسماء بالعربية تأتي من المتصفح نفسه (Intl.DisplayNames).
   ✏️ لإخفاء دولة من قائمة التسجيل ضع رمزها في HIDE_COUNTRIES داخل config.js */
const ARAB_COUNTRIES = ['PS', 'EG', 'JO', 'SA', 'AE', 'QA', 'KW', 'BH', 'OM', 'YE', 'IQ', 'SY', 'LB', 'LY', 'TN', 'DZ', 'MA', 'SD', 'SO', 'DJ', 'KM', 'MR'];
const OTHER_COUNTRIES = ('AD AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BI BJ BL BM BN BO BQ BR BS BT BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DK DM DO EC EE EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IM IN IO IR IS IT JE JM JP KE KG KH KI KN KP KR KY KZ LA LC LI LK LR LS LT LU LV MC MD ME MF MG MH MK ML MM MN MO MP MQ MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ PA PE PF PG PH PK PL PM PN PR PT PW PY RE RO RS RU RW SB SC SE SG SH SI SJ SK SL SM SN SR SS ST SV SX SZ TC TD TG TH TJ TK TL TM TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VG VI VN VU WF WS YT ZA ZM ZW').split(' ');
let _regionNames = null;
function countryName(code) {
  if (!code) return '';
  if (code === 'XX') return 'أخرى';
  try { _regionNames = _regionNames || new Intl.DisplayNames(['ar'], { type: 'region' }); return _regionNames.of(code) || code; }
  catch { return code; }
}
function flag(code) {
  if (!code || !/^[A-Z]{2}$/.test(code) || code === 'XX') return '🌐';
  return String.fromCodePoint(...[...code].map(c => 127397 + c.charCodeAt(0)));
}
/* خيارات قائمة الدول (مجموعتان: الدول العربية ثم باقي العالم) */
function countryOptionsHTML(selected = '') {
  const hide = new Set((CFG.HIDE_COUNTRIES || []).map(String));
  const opt = c => `<option value="${c}" ${c === selected ? 'selected' : ''}>${flag(c)} ${esc(countryName(c))}</option>`;
  const others = OTHER_COUNTRIES.filter(c => !hide.has(c)).sort((a, b) => countryName(a).localeCompare(countryName(b), 'ar'));
  return `<option value="">اختر الدولة…</option>
    <optgroup label="الدول العربية">${ARAB_COUNTRIES.filter(c => !hide.has(c)).map(opt).join('')}</optgroup>
    <optgroup label="باقي دول العالم">${others.map(opt).join('')}${hide.has('XX') ? '' : opt('XX')}</optgroup>`;
}
/* الدولة المقترحة من لغة المتصفح (مثل ar-PS → PS) */
function guessCountry() {
  try {
    const m = String(navigator.language || '').match(/-([A-Za-z]{2})$/);
    const c = m && m[1].toUpperCase();
    if (c && (ARAB_COUNTRIES.includes(c) || OTHER_COUNTRIES.includes(c))) return c;
  } catch { }
  return '';
}
function memberBadgeHTML(p) {
  return p.is_member ? `<span class="mb member">🎓 ${esc(CFG.MEMBER_LABEL)}</span>` : `<span class="mb open">🌍 ${esc(CFG.OPEN_LABEL)}</span>`;
}
function placeText(p) {
  const bits = [];
  if (p.country_code) bits.push(`${flag(p.country_code)} ${countryName(p.country_code)}`);
  if (p.city) bits.push(p.city);
  return bits.join(' · ');
}

/* رسائل أخطاء دالة التسجيل في الخادم */
function regError(code) {
  return ({
    registration_closed: 'التسجيل مغلق حاليًا.',
    too_many_pending: 'ازدحام مؤقت في الطلبات، حاول بعد قليل.',
    invalid_data: 'بعض البيانات غير صحيحة، راجع الحقول وحاول مجددًا.',
    invalid_code: 'رقم العضوية غير صحيح. تأكد منه، أو سجّل كمشارك مفتوح.',
    code_used: 'رقم العضوية هذا مستخدم مسبقًا. إن كان رقمك فتواصل مع الإدارة.',
    too_many_attempts: 'محاولات خاطئة كثيرة. انتظر 10 دقائق ثم حاول مجددًا.',
    duplicate: 'هذا الحساب مسجّل مسبقًا في التحدي.'
  })[code] || 'تعذّر إرسال الطلب، حاول مرة أخرى.';
}

/* تخزين محلي آمن (قد يتعطل في بعض المتصفحات) */
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { } }
};

function toast(msg, type = 'ok') {
  let box = $('#toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 3600);
}

/* نسخ نص إلى الحافظة */
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    try {
      const ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok;
    } catch { return false; }
  }
}

/* مشاركة الموقع (قائمة المشاركة في الجوال، أو واتساب في الحاسوب) */
function siteUrl() { return CFG.SITE_URL || (location.origin + location.pathname.replace(/[^/]*$/, '')); }
function shareSite() {
  const text = CFG.SHARE_TEXT || document.title, url = siteUrl();
  if (navigator.share) navigator.share({ text, url }).catch(() => { });
  else window.open('https://wa.me/?text=' + encodeURIComponent(text + '\n' + url), '_blank', 'noopener');
}

/* قراءة كل الصفوف مع تجاوز حد 1000 صف */
async function fetchAll(build) {
  let all = [], from = 0; const size = 1000;
  for (;;) {
    const { data, error } = await build().range(from, from + size - 1);
    if (error) throw error;
    all = all.concat(data);
    if (data.length < size) break;
    from += size;
  }
  return all;
}

/* رسالة خطأ مفهومة من أخطاء قواعد الخادم (schema.sql) */
function serverMsg(error, fallback) {
  const m = String(error?.message || '');
  if (error?.code === '23505') return 'سبق تسجيل هذا اليوم أو هذا الحساب';
  if (m.includes('registration_closed')) return 'التسجيل مغلق حاليًا';
  if (m.includes('too_many_pending')) return 'ازدحام في الطلبات، حاول لاحقًا';
  if (m.includes('challenge_not_started')) return 'لم يبدأ التحدي بعد';
  if (m.includes('challenge_ended')) return 'انتهى التحدي';
  if (m.includes('day_not_open')) return 'هذا اليوم غير متاح للإرسال (اليوم الحالي أو آخر 6 أيام فقط)';
  if (m.includes('reel_url_required')) return 'رابط الريلز مطلوب';
  return fallback;
}

/* ===== حساب أيام التحدي (بتوقيت TIMEZONE وليس توقيت جهاز المستخدم) ===== */
function parseLocalDate(s) {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function todayStr() {
  try { return new Date().toLocaleDateString('en-CA', { timeZone: CFG.TIMEZONE }); }
  catch {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
function challengeInfo(settings) {
  const total = settings.total_days || 30;
  const start = parseLocalDate(settings.start_date);
  const today = parseLocalDate(todayStr());
  if (!start) return { total, currentDay: 0, rawDay: 0, state: 'unset', daysToStart: null, daysLeft: null };
  const diff = Math.round((today - start) / 86400000);
  const currentDay = diff + 1;
  if (currentDay < 1) return { total, currentDay, rawDay: currentDay, state: 'upcoming', daysToStart: -diff, daysLeft: null };
  if (currentDay > total) return { total, currentDay: total + 1, rawDay: currentDay, state: 'ended', daysToStart: null, daysLeft: 0 };
  return { total, currentDay, rawDay: currentDay, state: 'running', daysToStart: null, daysLeft: total - currentDay };
}
/* الأيام المسموح إرسالها الآن (تطابق قواعد الخادم في schema.sql):
   اليوم الحالي وآخر 6 أيام، ومهلة 3 أيام بعد انتهاء التحدي. تُرجع null إن كان الإرسال مغلقًا. */
function submitWindow(info) {
  if (info.state === 'unset' || info.state === 'upcoming') return null;
  if (info.rawDay > info.total + 3) return null;
  const top = Math.min(info.rawDay, info.total), low = Math.max(1, info.rawDay - 6);
  return low <= top ? { top, low, cur: info.rawDay } : null;
}

/* ===== الترتيب والإحصاءات =====
   الترتيب: الأيام المنجزة ← السلسلة الحالية ← أطول سلسلة ← الاسم  */
function computeRows(participants, subs, info) {
  const byP = new Map();
  for (const s of subs) {
    if (!byP.has(s.participant_id)) byP.set(s.participant_id, new Map());
    byP.get(s.participant_id).set(s.day_number, s.reel_url || null);
  }
  const cap = Math.min(Math.max(info.currentDay, 0), info.total);
  const rows = participants.map(p => {
    const days = byP.get(p.id) || new Map();
    const done = [...days.keys()].filter(d => d <= info.total).length;
    let d = cap; if (d > 0 && !days.has(d) && info.state === 'running') d -= 1;
    let streak = 0; while (d >= 1 && days.has(d)) { streak++; d--; }
    let best = 0, run = 0;
    for (let i = 1; i <= info.total; i++) { if (days.has(i)) { run++; best = Math.max(best, run); } else run = 0; }
    const past = info.state === 'running' ? info.currentDay - 1 : (info.state === 'ended' ? info.total : 0);
    let missed = 0; for (let i = 1; i <= past; i++) if (!days.has(i)) missed++;
    const lastDay = done ? Math.max(...days.keys()) : 0;
    return { p, days, done, streak, best, missed, lastDay, pct: Math.round(done / info.total * 100) };
  });
  rows.sort((a, b) => b.done - a.done || b.streak - a.streak || b.best - a.best || a.p.full_name.localeCompare(b.p.full_name, 'ar'));
  rows.forEach((r, i) => r.rank = i + 1);
  return rows;
}
/* الشارات ✏️ يمكنك تعديل الأرقام والنصوص */
function badgesFor(r, total) {
  const b = [];
  if (r.done >= 1) b.push({ i: '🌱', t: 'بداية' });
  if (r.done >= 7) b.push({ i: '⭐', t: '7 أيام' });
  if (r.done >= Math.ceil(total / 2)) b.push({ i: '🚀', t: 'نصف الطريق' });
  if (r.streak >= 5) b.push({ i: '🔥', t: 'مشتعل' });
  if (r.done >= total) b.push({ i: '🏆', t: 'بطل التحدي' });
  return b;
}
/* الجمل التحفيزية ✏️ */
function motivation(r, info) {
  if (info.state === 'upcoming') return 'استعد، التحدي على الأبواب!';
  if (r.done === 0) return 'ابدأ اليوم، أول ريلز هو الأصعب!';
  if (r.done >= info.total) return 'أنجزت التحدي كاملًا، أنت بطل!';
  if (r.streak >= 5) return `سلسلة ${r.streak} أيام متتالية، لا تكسرها!`;
  if (r.missed === 0) return 'التزام كامل حتى الآن، واصل!';
  return 'كل يوم جديد فرصة للعودة، انشر ريلز اليوم!';
}

/* ===== حركة: عدّاد أرقام ===== */
function countUp(el, to, ms = 900) {
  const from = 0, t0 = performance.now();
  const step = t => {
    const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3);
    el.textContent = Math.round(from + (to - from) * e);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ===== حركة: إمالة ثلاثية الأبعاد للبطاقات ===== */
function enableTilt(root = document) {
  if (matchMedia('(hover: none)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  $$('.tilt', root).forEach(el => {
    if (el.dataset.tilt) return; el.dataset.tilt = '1';
    el.addEventListener('mousemove', e => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      el.style.setProperty('--ry', (x * 10).toFixed(2) + 'deg');
      el.style.setProperty('--rx', (-y * 10).toFixed(2) + 'deg');
    });
    el.addEventListener('mouseleave', () => { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); });
  });
}

/* ===== حركة: قصاصات احتفال ===== */
function confetti(n = 110) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = document.createElement('canvas');
  c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:400';
  document.body.appendChild(c);
  const W = c.width = innerWidth, H = c.height = innerHeight, x = c.getContext('2d');
  const cols = ['#1558d6', '#4aa3ff', '#f5b942', '#16b364', '#0a2463', '#ffd16b'];
  const ps = Array.from({ length: n }, () => ({
    x: W / 2 + (Math.random() - .5) * 160, y: H * .62, vx: (Math.random() - .5) * 15, vy: -Math.random() * 16 - 6,
    s: Math.random() * 8 + 5, r: Math.random() * 6, vr: (Math.random() - .5) * .4, c: cols[Math.random() * cols.length | 0]
  }));
  let t = 0;
  (function f() {
    x.clearRect(0, 0, W, H);
    ps.forEach(p => { p.vy += .45; p.x += p.vx; p.y += p.vy; p.r += p.vr; x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * .6); x.restore(); });
    if (++t < 120) requestAnimationFrame(f); else c.remove();
  })();
}

/* ===== بيانات تجريبية لوضع المعاينة (تظهر فقط إن لم تربط Supabase) ===== */
function demoData() {
  const names = ['سارة أحمد', 'محمد خليل', 'ليان عوض', 'يوسف النجار', 'هبة صالح', 'أحمد زيدان', 'رنا الحلو', 'عمر شاهين', 'دعاء مطر', 'خالد أبو عيشة', 'إسراء الكرد', 'مصطفى بكر'];
  const spec = ['مصمم جرافيك', 'مونتير', 'مبرمج', 'مصور', 'كاتب محتوى', 'مسوّق رقمي'];
  const start = parseLocalDate(todayStr()); start.setDate(start.getDate() - 11);
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const settings = { id: 1, title: 'تحدي الـ 30 يومًا', start_date: iso(start), total_days: 30, prize_amount: '100$', winners_count: 5, prize_extra: 'عضوية استوديو النقاء: ساعات استخدام مجانية', prize_scope_text: 'الجوائز مخصصة لأعضاء برنامج صناع الأثر الرقمي، والمشاركة مفتوحة للجميع من كل مكان.', registration_open: true, winners_published: false };
  let seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const places = [['PS', 'غزة'], ['PS', 'رام الله'], ['EG', 'القاهرة'], ['JO', 'عمّان'], ['PS', 'خانيونس'], ['SA', 'الرياض'], ['TR', 'إسطنبول'], ['DE', 'برلين'], ['PS', 'غزة'], ['MY', 'كوالالمبور'], ['PS', 'دير البلح'], ['GB', 'لندن']];
  const participants = names.map((n, i) => ({ id: 'd' + i, full_name: n, instagram: 'user' + i, specialty: spec[i % spec.length], photo_url: null, status: 'approved', is_member: i % 3 !== 2, country_code: places[i][0], city: places[i][1], created_at: new Date(Date.now() - (names.length - i) * 36e5).toISOString() }));
  const subs = [];
  participants.forEach((p, i) => { const reliab = 1 - i * 0.055; for (let d = 1; d <= 12; d++) if (rnd() < reliab) subs.push({ participant_id: p.id, day_number: d, reel_url: 'https://instagram.com/reel/demo' + d }); });
  return { settings, participants, subs, ann: [{ id: 1, body: 'مرحبًا بك في وضع المعاينة، هذه إعلانات تجريبية يديرها المشرف', pinned: true }] };
}
