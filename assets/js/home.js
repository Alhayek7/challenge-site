/* ===== صفحة الطلبة (الرئيسية) ===== */
(function () {
  let S = { ann: [], limit: 20, settings: null, participants: [], subs: [], rowsAll: [], rowsMem: [], mRank: new Map(), info: null, scope: 'all' };
  let firstRender = true;

  /* ---------- روابط وإعدادات من config.js ---------- */
  $('#igLink').href = CFG.INSTAGRAM_PAGE;
  $('#igFoot').href = CFG.INSTAGRAM_PAGE;
  $('#heroLead').textContent = CFG.HERO_LEAD;
  $('#orgName').textContent = CFG.ORG_SHORT || CFG.ORG_NAME;
  $('#orgTitle').textContent = CFG.ORG_NAME; $('#orgAbout').textContent = CFG.ORG_ABOUT;
  $('#footOrg').textContent = `برنامج ${CFG.PROGRAM_NAME} · مبادرة ${CFG.ORG_NAME}`;
  $('#footNote').textContent = CFG.FOOTER_NOTE;
  if (!CFG.ALLOW_SELF_SUBMIT) $('#openSubmit').classList.add('hide');
  if (/^\d{8,15}$/.test(String(CFG.WHATSAPP_CONTACT))) {
    const a = $('#fabWa'); a.href = 'https://wa.me/' + CFG.WHATSAPP_CONTACT; a.classList.remove('hide');
  }
  $('#burger').onclick = () => $('#links').classList.toggle('open');
  $$('#links a').forEach(a => a.addEventListener('click', () => $('#links').classList.remove('open')));
  $$('[data-share]').forEach(b => b.onclick = shareSite);

  /* ---------- أقسام ثابتة من الإعدادات ---------- */
  $('#stepsBox').innerHTML = CFG.STEPS.map((s, i) =>
    `<div class="card step tilt"><div class="n">${i + 1}</div><h3>${esc(s.t)}</h3><p>${esc(s.d)}</p></div>`).join('');
  $('#critBox').innerHTML = CFG.CRITERIA.map(c =>
    `<div class="card crit tilt"><div class="ci">${esc(c.i)}</div><h3>${esc(c.t)}</h3><p>${esc(c.d)}</p></div>`).join('');
  $('#faqBox').innerHTML = CFG.FAQ.map(f =>
    `<details class="card faq"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('');
  if (!CFG.STEPS.length) $('#how').classList.add('hide');
  if (!CFG.CRITERIA.length) $('#criteria').classList.add('hide');
  if (!CFG.FAQ.length) $('#faq').classList.add('hide');

  const BADGE_DEFS = [['🌱', 'بداية', 'أول ريلز معتمد'], ['⭐', '7 أيام', 'أنجزت 7 أيام'], ['🚀', 'نصف الطريق', 'أنجزت نصف أيام التحدي'], ['🔥', 'مشتعل', '5 أيام متتالية فأكثر'], ['🏆', 'بطل التحدي', 'أنجزت التحدي كاملًا']];
  $('#legend').innerHTML = BADGE_DEFS.map(b => `<div class="card bl tilt"><div class="bi">${b[0]}</div><div><b>${b[1]}</b><small>${b[2]}</small></div></div>`).join('');

  /* ---------- مشهد الهيرو ثلاثي الأبعاد (يتبع الفأرة/الإمالة) ---------- */
  (function () {
    const st = $('#stage'); if (!st || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const set = (x, y) => { st.style.setProperty('--mx', x.toFixed(3)); st.style.setProperty('--my', y.toFixed(3)); st.style.setProperty('--sry', (x * 10).toFixed(2) + 'deg'); st.style.setProperty('--srx', (-y * 8).toFixed(2) + 'deg'); };
    window.addEventListener('pointermove', e => set((e.clientX / innerWidth - .5) * 2, (e.clientY / innerHeight - .5) * 2), { passive: true });
    window.addEventListener('pointerleave', () => set(0, 0));
  })();

  /* ---------- تحميل البيانات ---------- */
  async function load() {
    if (!sb) { Object.assign(S, demoData()); $('#demoBar').textContent = 'وضع المعاينة (بيانات تجريبية): ' + demoReason; $('#demoBar').classList.remove('hide'); return; }
    const [{ data: settings, error: e1 }, participants, subs] = await Promise.all([
      sb.from('settings').select('*').eq('id', 1).single(),
      fetchAll(() => sb.from('participants').select('id,full_name,instagram,specialty,photo_url,is_member,country_code,city,created_at').eq('status', 'approved').order('created_at')),
      fetchAll(() => sb.from('submissions').select('id,participant_id,day_number,reel_url').eq('status', 'approved').order('id'))
    ]);
    if (e1) throw e1;
    S.settings = settings; S.participants = participants; S.subs = subs;
    try {   // الإعلانات اختيارية: إن لم يُشغَّل مخطط v4 لا ينكسر الموقع
      const { data, error } = await sb.from('announcements').select('id,body,link,pinned').eq('active', true).order('pinned', { ascending: false }).order('id', { ascending: false }).limit(12);
      S.ann = error ? [] : (data || []);
    } catch { S.ann = []; }
  }

  function render() {
    S.info = challengeInfo(S.settings);
    S.rowsAll = computeRows(S.participants, S.subs, S.info);
    S.rowsMem = computeRows(S.participants.filter(p => p.is_member), S.subs, S.info);
    S.mRank = new Map(S.rowsMem.map(r => [r.p.id, r.rank]));
    renderHero(); renderStats(); renderToday(); renderCommunity(); renderFilters(); renderPodium(); renderWinners(); renderTicker(); renderRows(); renderBars(); renderPrizes();
    enableTilt(); firstRender = false;
  }
  const curRows = () => S.scope === 'members' ? S.rowsMem : S.rowsAll;

  function renderHero() {
    const i = S.info; let t = '';
    if (i.state === 'running') t = `اليوم ${i.currentDay} من ${i.total} · متبقي ${i.daysLeft} يومًا`;
    else if (i.state === 'upcoming') t = `يبدأ التحدي بعد ${i.daysToStart} يومًا`;
    else if (i.state === 'ended') t = 'انتهى التحدي · شكرًا لكل المشاركين';
    else t = 'سيُعلَن موعد البداية قريبًا';
    $('#statePill').textContent = t;
    $('#heroDays').textContent = i.total;
    document.title = `${S.settings.title} | ${CFG.PROGRAM_NAME}`;
    countUp($('#chipReels'), S.subs.length); countUp($('#chipPeople'), S.participants.length);
    $('#chipPrize').textContent = `${S.settings.prize_amount} × ${S.settings.winners_count}`;
    const cd = Math.min(Math.max(i.currentDay, 0), i.total);
    $('#discNum').textContent = i.state === 'running' ? cd : (i.state === 'ended' ? '✓' : '–');
    $('#discSub').textContent = i.state === 'running' ? `من ${i.total}` : (i.state === 'upcoming' ? 'قريبًا' : '');
    setTimeout(() => $('#ringArc').style.strokeDashoffset = 276.46 * (1 - (i.total ? cd / i.total : 0)), 150);
  }

  /* شريط الأخبار: إعلانات الإدارة + حقائق تلقائية */
  function renderTicker() {
    const items = S.ann.map(a => a.link && isHttps(a.link) ? `<a href="${esc(a.link)}" target="_blank" rel="noopener">${esc(a.body)}</a>` : esc(a.body));
    const i = S.info, R = S.rowsAll;
    if (i.state === 'running' && R.length) {
      const today = R.filter(r => r.days.has(i.currentDay)).length;
      if (today) items.push(`🎬 ${today} من ${R.length} أنجزوا ريلز اليوم`);
      const top = R.find(r => r.done > 0); if (top) items.push(`👑 المتصدر الآن: ${esc(top.p.full_name)} بـ ${top.done} يومًا`);
      const st = [...R].sort((a, b) => b.streak - a.streak)[0]; if (st && st.streak >= 3) items.push(`🔥 أطول سلسلة: ${esc(st.p.full_name)} (${st.streak} أيام متتالية)`);
    }
    S.participants.slice(-3).reverse().forEach(p => items.push(`👋 انضم حديثًا ${esc(p.full_name)}${p.country_code ? ' ' + flag(p.country_code) : ''}`));
    const box = $('#tickerBox');
    if (!items.length) { box.classList.add('hide'); return; }
    box.classList.remove('hide');
    const one = items.map(t => `<span>${t}</span>`).join('');
    const reps = Math.max(1, Math.ceil(6 / items.length));
    const half = one.repeat(reps);
    $('#ticker').innerHTML = `<div style="display:flex">${half}</div><div style="display:flex" aria-hidden="true">${half}</div>`;
    $('#ticker').style.setProperty('--tk', Math.max(25, items.length * reps * 7) + 's');
  }

  /* الفائزون (يظهر عندما تعلنه الإدارة) */
  function renderWinners() {
    const sec = $('#winnersSec');
    const rows = S.rowsMem.filter(r => r.done > 0).slice(0, S.settings.winners_count || 5);
    if (!S.settings.winners_published || !rows.length) { sec.classList.add('hide'); return; }
    sec.classList.remove('hide');
    $('#winSub').textContent = `مبروك لأبطال ${CFG.PROGRAM_NAME}! ${S.settings.prize_amount} + ${S.settings.prize_extra}`;
    $('#winGrid').innerHTML = rows.map((r, k) => `<div class="w-it tilt" data-id="${esc(r.p.id)}"><div class="wn">${['🥇', '🥈', '🥉'][k] || '🏅'}</div>${avatarHTML(r.p)}<b>${esc(r.p.full_name)}</b><small>${r.done} يومًا · ${r.streak}🔥</small></div>`).join('');
    $$('.w-it', sec).forEach(el => el.onclick = () => openDetail(el.dataset.id));
    if (!sessionStorage.getItem('sn_won')) { try { sessionStorage.setItem('sn_won', '1'); } catch { } setTimeout(confetti, 600); }
  }

  function renderStats() {
    const i = S.info, P = S.participants;
    const members = P.filter(p => p.is_member).length;
    const countries = new Set(P.map(p => p.country_code).filter(Boolean)).size;
    const reels = S.subs.length;
    const expected = P.length * Math.min(Math.max(i.currentDay, 0), i.total);
    const rate = expected ? Math.min(100, Math.round(reels / expected * 100)) : 0;
    const bestStreak = S.rowsAll.reduce((m, r) => Math.max(m, r.streak), 0);
    const cards = [
      ['👥', P.length, 'مشارك'],
      ['🎓', members, CFG.MEMBER_LABEL],
      ['🌍', P.length - members, CFG.OPEN_LABEL],
      ['🗺️', countries, 'دولة'],
      ['🎬', reels, 'ريلز معتمد'],
      ['📅', Math.min(Math.max(i.currentDay, 0), i.total), `يوم من ${i.total}`],
      ['⚡', rate, 'نسبة الالتزام %'],
      ['🔥', bestStreak, 'أطول سلسلة متتالية']
    ];
    $('#stats').innerHTML = cards.map(c => `<div class="card stat tilt"><div class="ic">${c[0]}</div><div><b data-n="${c[1]}">0</b><span>${esc(c[2])}</span></div></div>`).join('');
    $$('#stats b').forEach(b => countUp(b, +b.dataset.n));
  }

  /* شريط: من نشر اليوم */
  function renderToday() {
    const sec = $('#todaySec'), i = S.info;
    if (!CFG.SHOW_TODAY_STRIP || i.state !== 'running' || !S.rowsAll.length) { sec.classList.add('hide'); return; }
    sec.classList.remove('hide');
    const posted = S.rowsAll.filter(r => r.days.has(i.currentDay));
    $('#todayCount').textContent = `${posted.length} من ${S.rowsAll.length}`;
    let h = posted.slice(0, 20).map(r => `<span class="tav" title="${esc(r.p.full_name)}" data-id="${esc(r.p.id)}">${avatarHTML(r.p)}</span>`).join('');
    if (posted.length > 20) h += `<span class="tmore">+${posted.length - 20}</span>`;
    if (!posted.length) h = '<span class="muted">لم ينشر أحد بعد، كن أول من يفعل اليوم! 🚀</span>';
    const box = $('#todayAvatars'); box.innerHTML = h;
    $$('.tav', box).forEach(el => el.onclick = () => openDetail(el.dataset.id));
  }

  /* مجتمع التحدي: نسبة الأعضاء/المفتوحين + شرائح الدول */
  function renderCommunity() {
    const sec = $('#community'), P = S.participants;
    if (!P.length) { sec.classList.add('hide'); return; }
    sec.classList.remove('hide');
    const m = P.filter(p => p.is_member).length, o = P.length - m;
    const pm = Math.round(m / P.length * 100);
    $('#splitBar').innerHTML = `<i class="sm" style="width:${m / P.length * 100}%"></i><i class="so" style="width:${o / P.length * 100}%"></i>`;
    $('#splitLeg').innerHTML = `<span><i class="dot sm"></i>🎓 ${esc(CFG.MEMBER_LABEL)}: <b>${m}</b> (${pm}%)</span><span><i class="dot so"></i>🌍 ${esc(CFG.OPEN_LABEL)}: <b>${o}</b> (${100 - pm}%)</span>`;
    const cnt = new Map();
    P.forEach(p => { if (p.country_code) cnt.set(p.country_code, (cnt.get(p.country_code) || 0) + 1); });
    const arr = [...cnt.entries()].sort((a, b) => b[1] - a[1] || countryName(a[0]).localeCompare(countryName(b[0]), 'ar'));
    const cur = $('#ctry').value;
    $('#countryChips').innerHTML = arr.map(([c, n]) =>
      `<button type="button" class="cchip ${c === cur ? 'on' : ''}" data-c="${c}" aria-pressed="${c === cur}">${flag(c)} ${esc(countryName(c))} <b>${n}</b></button>`).join('')
      || '<span class="muted">ستظهر الدول هنا مع أول مشارك.</span>';
    $$('#countryChips .cchip').forEach(b => b.onclick = () => {
      const sel = $('#ctry'); sel.value = sel.value === b.dataset.c ? '' : b.dataset.c;
      renderCommunity(); renderRows();
      $('#board').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  /* قوائم التصفية (التخصص والدولة) */
  function renderFilters() {
    const P = S.participants;
    const sel = $('#spec'), cur = sel.value;
    const specs = [...new Set(P.map(p => p.specialty))].sort((a, b) => a.localeCompare(b, 'ar'));
    sel.innerHTML = '<option value="">كل التخصصات</option>' + specs.map(s => `<option>${esc(s)}</option>`).join('');
    sel.value = specs.includes(cur) ? cur : '';
    const cs = $('#ctry'), cc = cs.value;
    const codes = [...new Set(P.map(p => p.country_code).filter(Boolean))].sort((a, b) => countryName(a).localeCompare(countryName(b), 'ar'));
    cs.innerHTML = '<option value="">كل الدول</option>' + codes.map(c => `<option value="${c}">${flag(c)} ${esc(countryName(c))}</option>`).join('');
    cs.value = codes.includes(cc) ? cc : '';
  }

  function renderPodium() {
    const top = curRows().filter(r => r.done > 0).slice(0, 3);
    const box = $('#podium');
    $('#podiumSub').textContent = S.scope === 'members'
      ? `متصدّرو أعضاء ${CFG.PROGRAM_NAME} في المنافسة على الجوائز.`
      : 'المتصدّرون الآن من الجميع، والمنافسة مفتوحة حتى آخر يوم.';
    if (top.length < 1) { box.innerHTML = '<div class="empty card" style="grid-column:1/-1">ستظهر منصة التتويج مع أول ريلز معتمد. كن الأول! 🚀</div>'; return; }
    const order = [top[1], top[0], top[2]].map((r, idx) => r ? { r, cls: ['p2', 'p1', 'p3'][idx], n: [2, 1, 3][idx] } : null);
    box.innerHTML = order.map(o => !o ? '<div></div>' : `
      <div class="pod ${o.cls}" data-id="${esc(o.r.p.id)}" style="cursor:pointer">
        <div class="who">${o.n === 1 ? '<div class="crown">👑</div>' : ''}${avatarHTML(o.r.p)}
          <h3>${esc(o.r.p.full_name)}</h3><small>${o.r.p.country_code ? flag(o.r.p.country_code) + ' ' : ''}${esc(o.r.p.specialty)}</small></div>
        <div class="block"><div>${o.n}<em>${o.r.done} يوم</em></div></div>
      </div>`).join('');
    $$('.pod[data-id]', box).forEach(el => el.onclick = () => openDetail(el.dataset.id));
  }

  function renderRows() {
    const q = $('#q').value.trim().toLowerCase(), sp = $('#spec').value, ct = $('#ctry').value;
    const all = curRows();
    let list = all.filter(r => (!sp || r.p.specialty === sp) && (!ct || r.p.country_code === ct) &&
      (!q || r.p.full_name.toLowerCase().includes(q) || r.p.instagram.toLowerCase().includes(q)));
    const sort = $('#sortF').value;
    if (sort === 'streak') list = [...list].sort((a, b) => b.streak - a.streak || a.rank - b.rank);
    else if (sort === 'today') list = [...list].filter(r => r.days.has(S.info.currentDay));
    else if (sort === 'new') list = [...list].sort((a, b) => String(b.p.created_at || '').localeCompare(String(a.p.created_at || '')));
    const total = list.length; list = list.slice(0, S.limit);
    const more = $('#moreBtn'); more.hidden = total <= S.limit; more.textContent = `عرض المزيد (${total - S.limit})`;
    const box = $('#rows');
    const sn = $('#scopeNote');
    if (S.scope === 'members') {
      sn.innerHTML = `🎓 ${esc(S.settings.prize_scope_text || '')} الفائزون: أول <b>${S.settings.winners_count}</b> من الأعضاء.`; sn.classList.remove('hide');
    } else sn.classList.add('hide');

    if (!all.length) {
      box.innerHTML = S.scope === 'members'
        ? '<div class="card empty">لا يوجد أعضاء مسجّلون بعد.</div>'
        : '<div class="card empty">لا يوجد مشاركون بعد. <a href="register.html" style="color:var(--blue);font-weight:800">كن أول المسجلين</a></div>';
      return;
    }
    if (!list.length) { box.innerHTML = '<div class="card empty">لا نتائج مطابقة.</div>'; return; }
    const W = S.settings.winners_count || 5; let html = ''; let shownLine = false;
    const filtered = !!(q || sp || ct);
    list.forEach((r, i) => {
      const win = r.p.is_member && (S.mRank.get(r.p.id) || 99) <= W && r.done > 0;
      /* ✏️ نص الخط الفاصل بعد المراكز المتقدمة (يظهر في ترتيب الأعضاء) */
      if (!shownLine && S.scope === 'members' && !filtered && r.rank === W + 1 && all[W - 1]?.done > 0) { html += '<div class="divider">حدّ المراكز المتقدمة حاليًا</div>'; shownLine = true; }
      const bd = badgesFor(r, S.info.total).map(b => `<span>${b.i} ${b.t}</span>`).join('');
      html += `<div class="card row tilt ${win ? 'win' : ''}" data-id="${esc(r.p.id)}" style="animation-delay:${Math.min(i, 12) * 40}ms">
        <div class="rank">${r.rank <= 3 && r.done > 0 ? ['🥇', '🥈', '🥉'][r.rank - 1] : r.rank}</div>
        ${avatarHTML(r.p)}
        <div class="pn"><b>${esc(r.p.full_name)}</b><small>${esc(r.p.specialty)}${placeText(r.p) ? ' · ' + esc(placeText(r.p)) : ''}</small>
          <div class="bdg">${memberBadgeHTML(r.p)}${win ? '<span class="prize-tag">🏅 ضمن مراكز الجوائز</span>' : ''}${bd}</div></div>
        <div class="pg"><div class="prog"><i style="width:${firstRender ? 0 : r.pct}%" data-w="${r.pct}"></i></div>
          <div class="prog-l"><span>${motivation(r, S.info)}</span><span>${r.pct}%</span></div></div>
        <div class="num d"><b>${r.done}</b><small>يوم منجز</small></div>
        <div class="num s"><b>${r.streak}🔥</b><small>متتالية</small></div>
      </div>`;
    });
    box.innerHTML = html;
    requestAnimationFrame(() => requestAnimationFrame(() => $$('.prog i', box).forEach(i => i.style.width = i.dataset.w + '%')));
    $$('.row', box).forEach(el => el.onclick = () => openDetail(el.dataset.id));
    enableTilt(box);
  }

  function renderBars() {
    const i = S.info, per = new Array(i.total + 1).fill(0);
    S.subs.forEach(s => { if (s.day_number <= i.total) per[s.day_number]++; });
    const max = Math.max(1, ...per);
    let h = '';
    for (let d = 1; d <= i.total; d++) {
      const cls = d === i.currentDay ? 'today' : (d > i.currentDay ? 'future' : '');
      const hh = d > i.currentDay ? 4 : Math.max(3, per[d] / max * 100);
      h += `<div class="bar ${cls}" data-t="اليوم ${d}: ${per[d]} ريلز"><i style="height:${hh}%"></i><small>${d}</small></div>`;
    }
    $('#bars').innerHTML = h;
  }

  function renderPrizes() {
    const s = S.settings;
    $('#prizeAmt').textContent = s.prize_amount;
    $('#prizeExtra').textContent = s.prize_extra;
    $('#prizeSub').textContent = `جوائز الأفضل في التحدي لـ ${s.winners_count} فائزين.`;
    $('#prizeScope').textContent = s.prize_scope_text || '';
    $('#prizeScope').classList.toggle('hide', !s.prize_scope_text);
  }

  /* ===== نافذة تفاصيل المشارك ===== */
  function openDetail(id) {
    const r = S.rowsAll.find(x => x.p.id === id); if (!r) return;
    const i = S.info; let grid = '';
    for (let d = 1; d <= i.total; d++) {
      const url = r.days.get(d), ok = r.days.has(d);
      const cls = ok ? 'ok' : (d < i.currentDay ? 'miss' : '');
      const inner = ok && url && isHttps(url) ? `<a href="${esc(url)}" target="_blank" rel="noopener" title="افتح الريلز">${d}</a>` : d;
      grid += `<div class="day ${cls} ${d === i.currentDay ? 'cur' : ''}">${inner}</div>`;
    }
    const bd = badgesFor(r, i.total).map(b => `<span>${b.i} ${b.t}</span>`).join('');
    const needDays = Math.ceil(i.total * CFG.CERT_MIN_PERCENT / 100);
    const eligible = CFG.CERT_ENABLED && r.done >= needDays && r.done > 0;
    const certBlock = !CFG.CERT_ENABLED ? '' : eligible
      ? `<button class="btn gold sm" id="certBtn" style="margin-top:12px">🎓 شهادة الإنجاز</button>`
      : `<p class="cert-hint">🎓 تُستخرج شهادة الإنجاز عند إتمام ${needDays} يومًا من ${i.total}. المتبقي لك: ${Math.max(0, needDays - r.done)}.</p>`;
    openModal(`
      <div class="sheet-h">${avatarHTML(r.p)}
        <div><h3 style="color:var(--navy);font-weight:900">${esc(r.p.full_name)}</h3>
        <small style="color:var(--mut)">${esc(r.p.specialty)} · <a href="https://instagram.com/${encodeURIComponent(r.p.instagram)}" target="_blank" rel="noopener" style="color:var(--blue);font-weight:800">@${esc(r.p.instagram)}</a></small>
        ${placeText(r.p) ? `<small style="display:block;color:var(--mut)">${esc(placeText(r.p))}</small>` : ''}</div>
        <button class="x" data-close aria-label="إغلاق">✕</button></div>
      <div style="margin-bottom:8px">${memberBadgeHTML(r.p)}</div>
      <div class="mini"><div><b>#${r.rank}</b><small>الترتيب العام</small></div><div><b>${r.done}/${i.total}</b><small>أيام منجزة</small></div><div><b>${r.streak}🔥</b><small>سلسلة حالية</small></div></div>
      <div class="bdg" style="margin-bottom:8px">${bd}</div>
      <p style="color:var(--blue);font-weight:800;margin:8px 0">${motivation(r, i)}</p>
      <div class="daygrid">${grid}</div>
      <p style="color:var(--mut);font-size:.85rem;margin-top:10px">الأزرق: منجز · الأحمر الفاتح: فائت · الإطار الذهبي: اليوم. اضغط على يوم منجز لمشاهدة الريلز.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <button class="btn ghost sm" id="shareMe" style="margin-top:12px">📤 شارك هذا الإنجاز</button>${certBlock}
      </div>`);
    $('#shareMe').onclick = () => {
      const text = `${r.p.full_name} أنجز ${r.done} يومًا من ${i.total} في تحدي ${CFG.PROGRAM_NAME} 🔥`;
      if (navigator.share) navigator.share({ text, url: siteUrl() }).catch(() => { });
      else window.open('https://wa.me/?text=' + encodeURIComponent(text + '\n' + siteUrl()), '_blank', 'noopener');
    };
    const cb = $('#certBtn'); if (cb) cb.onclick = () => openCertificate(r);
  }

  /* ===== شهادة الإنجاز ===== */
  async function openCertificate(r) {
    openModal('<div class="empty">جارٍ تجهيز الشهادة…</div>');
    try {
      const { dataUrl } = await Certificate.make({
        name: r.p.full_name, done: r.done, total: S.info.total, isMember: !!r.p.is_member,
        countryName: r.p.country_code ? countryName(r.p.country_code) : '', city: r.p.city || '',
        program: CFG.PROGRAM_NAME, memberLabel: CFG.MEMBER_LABEL, openLabel: CFG.OPEN_LABEL,
        signer: CFG.CERT_SIGNER || CFG.PROGRAM_NAME, url: siteUrl().replace(/^https?:\/\//, '')
      });
      $('#modal .sheet').classList.add('wide');
      $('#modal .sheet').innerHTML = `
        <div class="sheet-h"><h3 style="color:var(--navy);font-weight:900">🎓 شهادة الإنجاز</h3><button class="x" data-close aria-label="إغلاق">✕</button></div>
        <img class="cert-img" src="${dataUrl}" alt="شهادة إنجاز ${esc(r.p.full_name)}">
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px">
          <button class="btn gold" id="dlCert">⬇ تحميل الشهادة (PNG)</button>
          <button class="btn ghost" id="shCert">📤 شارك</button>
        </div>
        <p style="color:var(--mut);font-size:.85rem;margin-top:10px">يمكنك نشر الشهادة على حسابك ووسم @${esc(CFG.OFFICIAL_HANDLE)}.</p>`;
      $('#dlCert').onclick = () => Certificate.download(dataUrl, `certificate-${r.p.instagram}.png`);
      $('#shCert').onclick = () => {
        const text = `أتممت ${r.done} يومًا من تحدي ${CFG.PROGRAM_NAME} 🎓🔥`;
        if (navigator.share) navigator.share({ text, url: siteUrl() }).catch(() => { });
        else window.open('https://wa.me/?text=' + encodeURIComponent(text + '\n' + siteUrl()), '_blank', 'noopener');
      };
    } catch (e) { console.error(e); closeModal(); toast('تعذّر تجهيز الشهادة، حاول مجددًا', 'err'); }
  }

  /* ===== نافذة إرسال ريلز ===== */
  function openSubmit() {
    const i = S.info, w = submitWindow(i);
    if (!w) { toast(i.state === 'upcoming' ? 'لم يبدأ التحدي بعد' : (i.state === 'ended' ? 'انتهى التحدي' : 'لم يُحدَّد موعد البداية بعد'), 'err'); return; }
    if (!sb) { toast('وضع المعاينة: الإرسال يعمل بعد ربط Supabase', 'err'); return; }
    const last = store.get('sn_pid');
    const opts = [...S.participants].sort((a, b) => a.full_name.localeCompare(b.full_name, 'ar'))
      .map(p => `<option value="${esc(p.id)}" ${p.id === last ? 'selected' : ''}>${esc(p.full_name)}</option>`).join('');
    let days = ''; for (let d = w.top; d >= w.low; d--) days += `<option value="${d}">اليوم ${d}${d === w.cur ? ' (اليوم)' : ''}</option>`;
    openModal(`
      <div class="sheet-h"><h3 style="color:var(--navy);font-weight:900">🎬 أرسل ريلز اليوم</h3><button class="x" data-close aria-label="إغلاق">✕</button></div>
      <form class="form" id="subForm">
        <div class="field"><label>اسمك</label><select class="select" name="pid" required><option value="">اختر اسمك…</option>${opts}</select></div>
        <div class="field"><label>حسابك على إنستغرام (للتأكيد)</label><input class="input" name="ig" dir="ltr" placeholder="username" required autocomplete="off"></div>
        <div class="two"><div class="field"><label>اليوم</label><select class="select" name="day">${days}</select></div>
        <div class="field"><label>رابط الريلز</label><input class="input" name="url" dir="ltr" type="url" placeholder="https://instagram.com/reel/…" required></div></div>
        <div class="note">تأكد من تفعيل Collaboration مع حساب @${esc(CFG.OFFICIAL_HANDLE)}. سيظهر الريلز في ترتيبك بعد اعتماد الإدارة له.</div>
        <button class="btn" type="submit">إرسال للاعتماد</button>
      </form>`);
    $('#subForm').onsubmit = async e => {
      e.preventDefault(); const f = new FormData(e.target), btn = e.target.querySelector('button[type=submit]');
      const p = S.participants.find(x => x.id === f.get('pid'));
      if (!p || cleanHandle(f.get('ig')).toLowerCase() !== p.instagram.toLowerCase()) return toast('اسم حساب إنستغرام لا يطابق المسجّل', 'err');
      const url = String(f.get('url')).trim(); if (!isHttps(url)) return toast('الرابط يجب أن يبدأ بـ https://', 'err');
      btn.disabled = true;
      const { error } = await sb.from('submissions').insert({ participant_id: p.id, day_number: +f.get('day'), reel_url: url, status: 'pending' });
      btn.disabled = false;
      if (error) return toast(serverMsg(error, 'تعذّر الإرسال، حاول لاحقًا'), 'err');
      store.set('sn_pid', p.id);
      closeModal(); confetti(); toast('تم الإرسال! بانتظار اعتماد الإدارة ✅');
    };
  }

  /* ===== نوافذ ===== */
  function openModal(html) {
    closeModal();
    const m = document.createElement('div'); m.className = 'modal'; m.id = 'modal';
    m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
    m.innerHTML = `<div class="sheet">${html}</div>`;
    m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-close]')) closeModal(); });
    document.body.appendChild(m);
  }
  function closeModal() { $('#modal')?.remove(); }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  /* ===== أحداث الواجهة ===== */
  $('#openSubmit').onclick = openSubmit;
  $('#q').oninput = () => { S.limit = 20; renderRows(); }; $('#spec').onchange = () => { S.limit = 20; renderRows(); }; $('#sortF').onchange = () => { S.limit = 20; renderRows(); };
  $('#moreBtn').onclick = () => { S.limit += 20; renderRows(); };
  $('#ctry').onchange = () => { renderCommunity(); renderRows(); };
  $('#scopeTabs').onclick = e => {
    const b = e.target.closest('.seg-b'); if (!b) return;
    S.scope = b.dataset.scope;
    $$('#scopeTabs .seg-b').forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-selected', on); });
    renderPodium(); renderRows();
  };

  async function boot() {
    try { await load(); render(); }
    catch (e) { console.error(e); $('#statePill').textContent = 'تعذّر تحميل البيانات'; const bar = $('#demoBar'); bar.textContent = 'تفاصيل فنية: ' + [e && e.code, e && e.message, e && e.details, e && e.hint].filter(Boolean).join(' | '); bar.classList.remove('hide'); toast('تعذّر تحميل البيانات، تحقق من إعداد Supabase', 'err'); return; }
    if (sb && CFG.AUTO_REFRESH_SECONDS > 0) {
      setInterval(async () => {
        if (document.hidden || $('#modal')) return;
        try { await load(); const q = $('#q').value; render(); $('#q').value = q; renderRows(); } catch { }
      }, Math.max(15, CFG.AUTO_REFRESH_SECONDS) * 1000);
    }
  }
  boot();
})();
