/* ===== صفحة الإدارة ===== */
(function () {
  let S = { ann: [], annOk: true, settings: null, parts: [], subs: [], codes: [], info: null, rows: [] };
  const key = (p, d) => p + ':' + d;
  const subMap = () => { const m = new Map(); S.subs.forEach(s => m.set(key(s.participant_id, s.day_number), s)); return m; };
  const approvedParts = () => S.parts.filter(p => p.status === 'approved');
  const pById = id => S.parts.find(p => p.id === id);
  const codeOfPart = id => S.codes.find(c => c.used_by === id);
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  const csvCell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  function downloadText(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  /* ---------- الدخول ---------- */
  if (!sb) $('#cfgWarn').classList.remove('hide');
  $('#eye').onclick = () => { const i = $('#lp'); i.type = i.type === 'password' ? 'text' : 'password'; };

  $('#loginForm').onsubmit = async e => {
    e.preventDefault(); const err = $('#loginErr'); err.classList.add('hide');
    if (!sb) { err.textContent = 'لم يتم ربط Supabase'; err.classList.remove('hide'); return; }
    const f = new FormData(e.target);
    const user = String(f.get('u')).trim().toLowerCase();
    const email = user.includes('@') ? user : `${user}@${CFG.ADMIN_EMAIL_DOMAIN}`;
    const btn = e.target.querySelector('button[type=submit]'); btn.disabled = true;
    const { error } = await sb.auth.signInWithPassword({ email, password: String(f.get('p')) });
    btn.disabled = false;
    if (error) { err.textContent = 'اسم المستخدم أو كلمة المرور غير صحيحة'; err.classList.remove('hide'); return; }
    await enter();
  };
  $('#logout').onclick = async () => { await sb.auth.signOut(); location.reload(); };
  $('#refresh').onclick = async () => {
    const b = $('#refresh'); b.disabled = true;
    try { await loadAll(); renderAll(); toast('تم تحديث البيانات ✅'); } catch { toast('تعذّر التحديث', 'err'); }
    b.disabled = false;
  };

  async function enter() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return;
    const { data: adm } = await sb.from('admins').select('user_id').eq('user_id', session.user.id).maybeSingle();
    if (!adm) {
      await sb.auth.signOut();
      const err = $('#loginErr'); err.textContent = 'هذا الحساب ليس مديرًا. أضِفه إلى جدول admins.'; err.classList.remove('hide'); return;
    }
    $('#loginView').classList.add('hide'); $('#appView').classList.remove('hide');
    $('#whoami').textContent = session.user.email || 'صناع الأثر الرقمي';
    try { await loadAll(); renderAll(); } catch (e) { console.error(e); toast('تعذّر تحميل البيانات', 'err'); }
  }

  async function loadAll() {
    const [{ data: settings, error }, parts, subs, codes] = await Promise.all([
      sb.from('settings').select('*').eq('id', 1).single(),
      fetchAll(() => sb.from('participants').select('*').order('created_at')),
      fetchAll(() => sb.from('submissions').select('*').order('id')),
      fetchAll(() => sb.from('member_codes').select('*').order('created_at', { ascending: false }).order('code'))
    ]);
    if (error) throw error;
    S.settings = settings; S.parts = parts; S.subs = subs; S.codes = codes;
    try { const r = await sb.from('announcements').select('*').order('pinned', { ascending: false }).order('id', { ascending: false }); S.annOk = !r.error; S.ann = r.error ? [] : r.data; }
    catch { S.annOk = false; S.ann = []; }
  }

  /* ---------- التبويبات ---------- */
  const TABS = ['grid', 'today', 'requests', 'people', 'codes', 'winners', 'ann', 'settings'];
  $('#tabs').onclick = e => {
    const b = e.target.closest('.tab'); if (!b) return;
    $$('.tab').forEach(t => t.classList.toggle('on', t === b));
    TABS.forEach(t => $('#t-' + t).classList.toggle('hide', t !== b.dataset.t));
  };

  function renderAll() {
    S.info = challengeInfo(S.settings);
    const ap = approvedParts(), apIds = new Set(ap.map(p => p.id));
    S.rows = computeRows(ap, S.subs.filter(s => s.status === 'approved' && apIds.has(s.participant_id)), S.info);
    renderStats(); renderDayPick(); renderGrid(); renderToday(); renderRequests(); renderPeople(); renderCodes(); renderWinners(); renderAnn(); fillSettings();
  }

  function renderStats() {
    const pendP = S.parts.filter(p => p.status === 'pending').length, pendS = S.subs.filter(s => s.status === 'pending').length;
    const i = S.info, ap = approvedParts();
    const st = i.state === 'running' ? `اليوم ${i.currentDay}/${i.total}` : i.state === 'upcoming' ? `بعد ${i.daysToStart} يوم` : i.state === 'ended' ? 'انتهى' : 'غير محدد';
    const cards = [
      ['👥', ap.length, 'مشارك معتمد'], ['🎓', ap.filter(p => p.is_member).length, 'عضو برنامج'],
      ['🎬', S.subs.filter(s => s.status === 'approved').length, 'ريلز معتمد'], ['📥', pendP + pendS, 'طلب بانتظارك'],
      ['🎟️', S.codes.filter(c => !c.used_by).length, 'كود عضوية متاح'], ['📅', st, 'حالة التحدي']
    ];
    $('#aStats').innerHTML = cards.map(c => `<div class="card stat"><div class="ic">${c[0]}</div><div><b style="font-size:${typeof c[1] === 'string' ? '1.3rem' : '2rem'}">${esc(c[1])}</b><span>${c[2]}</span></div></div>`).join('');
    const cnt = $('#cnt'); cnt.textContent = pendP + pendS; cnt.classList.toggle('hide', !(pendP + pendS));
  }

  function dayOptions(selected) {
    let h = ''; for (let d = 1; d <= S.info.total; d++) h += `<option value="${d}" ${d === selected ? 'selected' : ''}>اليوم ${d}${d === S.info.currentDay ? ' (اليوم)' : ''}</option>`;
    return h;
  }
  const defaultDay = () => clamp(S.info.currentDay, 1, S.info.total);
  function renderDayPick() {
    const sel = $('#dayPick'), cur = +sel.value || defaultDay();
    sel.innerHTML = dayOptions(cur);
  }

  /* ---------- جدول المتابعة ---------- */
  function renderGrid() {
    const wrap = $('#gridwrap'), sl = wrap.scrollLeft, st = wrap.scrollTop;
    const q = $('#gq').value.trim().toLowerCase(), sc = $('#gscope').value, i = S.info, m = subMap();
    const rows = S.rows.filter(r => (!q || r.p.full_name.toLowerCase().includes(q) || r.p.instagram.toLowerCase().includes(q)) &&
      (!sc || (sc === 'm' ? r.p.is_member : !r.p.is_member)));
    if (!S.rows.length) { wrap.innerHTML = '<div class="empty">لا يوجد مشاركون معتمدون بعد. اعتمد الطلبات من تبويب «الطلبات» أو أضف مشاركًا.</div>'; return; }
    let h = '<table class="grid"><thead><tr><th class="name">المشارك</th><th>#</th><th>أيام</th>';
    for (let d = 1; d <= i.total; d++) h += `<th class="${d === i.currentDay ? 'today' : ''}">${d}</th>`;
    h += '</tr></thead><tbody>';
    for (const r of rows) {
      h += `<tr><td class="name"><div class="who" data-edit="${esc(r.p.id)}">${avatarHTML(r.p)}<div><b>${r.p.is_member ? '🎓 ' : ''}${esc(r.p.full_name)}</b><br><small style="color:var(--mut)">@${esc(r.p.instagram)}${r.p.country_code ? ' · ' + flag(r.p.country_code) : ''}</small></div></div></td><td class="tot">${r.rank}</td><td class="tot">${r.done}</td>`;
      for (let d = 1; d <= i.total; d++) {
        const s = m.get(key(r.p.id, d)), cls = s ? (s.status === 'pending' ? 'pend' : 'ok') : '';
        const fut = i.state !== 'ended' && (i.state === 'unset' || d > i.currentDay) ? 'future' : '';
        h += `<td><button class="cell ${cls} ${fut} ${d === i.currentDay ? 'today' : ''}" data-p="${esc(r.p.id)}" data-d="${d}" title="${esc(r.p.full_name)} · يوم ${d}">${s ? (s.status === 'pending' ? '?' : '✓') : '·'}</button></td>`;
      }
      h += '</tr>';
    }
    wrap.innerHTML = h + '</tbody></table>';
    wrap.scrollLeft = sl; wrap.scrollTop = st;
  }
  $('#gq').oninput = renderGrid; $('#gscope').onchange = renderGrid;
  $('#gridwrap').onclick = async e => {
    const c = e.target.closest('.cell'), w = e.target.closest('[data-edit]');
    if (c) return toggleCell(c.dataset.p, +c.dataset.d);
    if (w) return openPerson(w.dataset.edit);
  };

  async function toggleCell(pid, day) {
    const s = subMap().get(key(pid, day));
    if (!s) {
      const { data, error } = await sb.from('submissions').insert({ participant_id: pid, day_number: day, status: 'approved' }).select().single();
      if (error) return toast('تعذّر الحفظ', 'err'); S.subs.push(data);
    } else if (s.status === 'pending') {
      const { error } = await sb.from('submissions').update({ status: 'approved' }).eq('id', s.id);
      if (error) return toast('تعذّر الاعتماد', 'err'); s.status = 'approved';
    } else {
      const { error } = await sb.from('submissions').delete().eq('id', s.id);
      if (error) return toast('تعذّر الإلغاء', 'err'); S.subs = S.subs.filter(x => x.id !== s.id);
    }
    renderAll();
  }

  $('#markAll').onclick = async () => {
    const day = +$('#dayPick').value, m = subMap();
    const todo = approvedParts().filter(p => m.get(key(p.id, day))?.status !== 'approved');
    if (!todo.length) return toast('الجميع مسجَّل لهذا اليوم بالفعل');
    if (!confirm(`تسجيل إنجاز اليوم ${day} لـ ${todo.length} مشارك؟`)) return;
    const { error } = await sb.from('submissions').upsert(todo.map(p => ({ participant_id: p.id, day_number: day, status: 'approved' })), { onConflict: 'participant_id,day_number' });
    if (error) return toast('تعذّر التنفيذ', 'err');
    await loadAll(); renderAll(); toast('تم التسجيل ✅');
  };

  $('#csv').onclick = () => {
    const lines = [['الترتيب', 'الاسم', 'النوع', 'الدولة', 'المدينة', 'إنستغرام', 'التخصص', 'أيام منجزة', 'سلسلة حالية', 'أيام فائتة'].map(csvCell).join(',')];
    S.rows.forEach(r => lines.push([r.rank, r.p.full_name, r.p.is_member ? CFG.MEMBER_LABEL : CFG.OPEN_LABEL, countryName(r.p.country_code), r.p.city, r.p.instagram, r.p.specialty, r.done, r.streak, r.missed].map(csvCell).join(',')));
    downloadText('ranking.csv', '﻿' + lines.join('\n'), 'text/csv;charset=utf-8');
  };

  /* ---------- اليوم والتذكير ---------- */
  function renderToday() {
    const sel = $('#todayDay'), cur = +sel.value || defaultDay();
    sel.innerHTML = dayOptions(cur);
    const day = +sel.value, m = subMap(), miss = [], pend = [], done = [];
    for (const r of S.rows) { const s = m.get(key(r.p.id, day)); if (!s) miss.push(r); else if (s.status === 'pending') pend.push({ r, s }); else done.push(r); }
    $('#missN').textContent = miss.length + pend.length; $('#doneN').textContent = done.length;
    $('#todaySum').textContent = `${done.length} أنجزوا · ${pend.length} بانتظار الاعتماد · ${miss.length} لم يرسلوا`;
    const igLink = p => `<a href="https://instagram.com/${encodeURIComponent(p.instagram)}" target="_blank" rel="noopener" style="color:var(--blue)">@${esc(p.instagram)}</a>`;
    $('#missBox').innerHTML = (pend.map(({ r, s }) => `<div class="card item">${avatarHTML(r.p)}<div class="grow"><b>${esc(r.p.full_name)} <span class="badge pending">ريلز بانتظار الاعتماد</span></b><small>${s.reel_url && isHttps(s.reel_url) ? `<a href="${esc(s.reel_url)}" target="_blank" rel="noopener" style="color:var(--blue);font-weight:800">فتح الريلز ↗</a>` : 'بدون رابط'}</small></div><div class="acts"><button class="btn green sm" data-approve="${s.id}">اعتماد</button></div></div>`).join('') +
      miss.map(r => `<div class="card item">${avatarHTML(r.p)}<div class="grow"><b>${r.p.is_member ? '🎓 ' : ''}${esc(r.p.full_name)}</b><small>${igLink(r.p)}</small></div><div class="acts"><button class="btn sm" data-mark="${esc(r.p.id)}">✓ سجّل</button></div></div>`).join('')) || '<div class="empty">الجميع أنجزوا اليوم 🎉</div>';
    $('#doneBox').innerHTML = done.map(r => `<div class="card item" style="padding:8px 14px">${avatarHTML(r.p)}<div class="grow"><b>${r.p.is_member ? '🎓 ' : ''}${esc(r.p.full_name)}</b></div></div>`).join('') || '<div class="empty">لا أحد بعد</div>';
    buildReminder(day, miss);
  }
  function buildReminder(day, miss) {
    const fill = t => String(t || '').replace('{day}', day).replace('{total}', S.info.total);
    const names = miss.map(r => `• ${r.p.full_name} (@${r.p.instagram})`).join('\n');
    const text = miss.length ? `${fill(CFG.REMINDER_HEADER)}\n${names}\n\n${fill(CFG.REMINDER_FOOTER)}` : 'الجميع أنجزوا اليوم، لا حاجة لتذكير 🎉';
    $('#remindText').value = text;
    $('#waRemind').href = 'https://wa.me/?text=' + encodeURIComponent(text);
  }
  $('#todayDay').onchange = renderToday;
  $('#remindText').oninput = () => { $('#waRemind').href = 'https://wa.me/?text=' + encodeURIComponent($('#remindText').value); };
  $('#copyRemind').onclick = async () => toast(await copyText($('#remindText').value) ? 'تم نسخ الرسالة ✅' : 'تعذّر النسخ، انسخها يدويًا', 'ok');
  $('#t-today').onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.mark) return toggleCell(b.dataset.mark, +$('#todayDay').value);
    if (b.dataset.approve) {
      const { error } = await sb.from('submissions').update({ status: 'approved' }).eq('id', b.dataset.approve);
      if (error) return toast('تعذّر الاعتماد', 'err');
      await loadAll(); renderAll(); toast('تم الاعتماد ✅');
    }
  };

  /* ---------- الطلبات ---------- */
  function renderRequests() {
    const pp = S.parts.filter(p => p.status === 'pending'), ps = S.subs.filter(s => s.status === 'pending');
    const bulkP = pp.length > 1 ? `<button class="btn green sm" id="okAllP">قبول الكل (${pp.length})</button>` : '';
    const bulkS = ps.length > 1 ? `<button class="btn green sm" id="okAllS">اعتماد الكل (${ps.length})</button>` : '';
    let h = `<div class="colh" style="margin-bottom:10px"><h3>طلبات التسجيل (${pp.length})</h3>${bulkP}</div><div class="list" style="margin-bottom:24px">`;
    h += pp.length ? pp.map(p => `<div class="card item">${avatarHTML(p)}<div class="grow"><b>${esc(p.full_name)} ${memberBadgeHTML(p)}</b><small>${esc(p.specialty)} · ${esc(placeText(p) || 'بدون دولة')} · <a href="https://instagram.com/${encodeURIComponent(p.instagram)}" target="_blank" rel="noopener" style="color:var(--blue)">@${esc(p.instagram)}</a>${p.is_member && codeOfPart(p.id) ? ' · الكود: <span class="kbd">' + esc(codeOfPart(p.id).code) + '</span>' : ''}</small></div>
      <div class="acts"><button class="btn green sm" data-ap="${esc(p.id)}">قبول</button><button class="btn danger sm" data-rp="${esc(p.id)}">رفض</button></div></div>`).join('') : '<div class="card empty">لا توجد طلبات تسجيل جديدة.</div>';
    h += `</div><div class="colh" style="margin-bottom:10px"><h3>ريلز بانتظار الاعتماد (${ps.length})</h3>${bulkS}</div><div class="list">`;
    h += ps.length ? ps.map(s => { const p = pById(s.participant_id); if (!p) return ''; return `<div class="card item">${avatarHTML(p)}<div class="grow"><b>${esc(p.full_name)} · اليوم ${s.day_number}</b><small>${s.reel_url && isHttps(s.reel_url) ? `<a href="${esc(s.reel_url)}" target="_blank" rel="noopener" style="color:var(--blue);font-weight:800">فتح الريلز ↗</a>` : 'بدون رابط'}</small></div>
      <div class="acts"><button class="btn green sm" data-as="${s.id}">اعتماد</button><button class="btn danger sm" data-rs="${s.id}">رفض</button></div></div>`; }).join('') : '<div class="card empty">لا توجد ريلز معلّقة.</div>';
    $('#reqBox').innerHTML = h + '</div>';
  }
  $('#reqBox').onclick = async e => {
    const b = e.target.closest('button'); if (!b) return; b.disabled = true;
    const d = b.dataset; let r;
    if (b.id === 'okAllP') { if (!confirm('قبول كل طلبات التسجيل المعلّقة؟ راجع الصور والأسماء أولًا.')) { b.disabled = false; return; } r = await sb.from('participants').update({ status: 'approved' }).eq('status', 'pending'); }
    else if (b.id === 'okAllS') { if (!confirm('اعتماد كل الريلز المعلّقة؟ تأكد من فتح الروابط أولًا.')) { b.disabled = false; return; } r = await sb.from('submissions').update({ status: 'approved' }).eq('status', 'pending'); }
    else if (d.ap) r = await sb.from('participants').update({ status: 'approved' }).eq('id', d.ap);
    else if (d.rp) r = await sb.from('participants').update({ status: 'rejected' }).eq('id', d.rp);
    else if (d.as) r = await sb.from('submissions').update({ status: 'approved' }).eq('id', d.as);
    else if (d.rs) r = await sb.from('submissions').delete().eq('id', d.rs);
    if (r?.error) { b.disabled = false; return toast('تعذّر التنفيذ', 'err'); }
    await loadAll(); renderAll(); toast('تم ✅');
  };

  /* ---------- المشاركون ---------- */
  const statusAr = { pending: 'قيد المراجعة', approved: 'معتمد', rejected: 'مرفوض' };
  function renderPeople() {
    const q = $('#pq').value.trim().toLowerCase(), st = $('#pscope').value;
    const list = S.parts.filter(p => (!st || p.status === st) && (!q || p.full_name.toLowerCase().includes(q) || p.instagram.toLowerCase().includes(q)));
    $('#peopleBox').innerHTML = list.length ? list.map(p => `<div class="card item">${avatarHTML(p)}<div class="grow"><b>${esc(p.full_name)} <span class="badge ${p.status}">${statusAr[p.status]}</span> ${memberBadgeHTML(p)}</b><small>${esc(p.specialty)} · ${esc(placeText(p) || 'بدون دولة')} · @${esc(p.instagram)}</small></div>
      <div class="acts"><button class="btn ghost sm" data-e="${esc(p.id)}">تعديل</button><button class="btn danger sm" data-del="${esc(p.id)}">حذف</button></div></div>`).join('') : '<div class="card empty">لا يوجد مشاركون.</div>';
  }
  $('#pq').oninput = renderPeople; $('#pscope').onchange = renderPeople;
  $('#peopleBox').onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.e) return openPerson(b.dataset.e);
    if (b.dataset.del) {
      const p = pById(b.dataset.del);
      if (!confirm(`حذف «${p.full_name}» نهائيًا مع كل إنجازاته؟ (إن كان لديه كود عضوية فسيصبح الكود متاحًا من جديد)`)) return;
      const { error } = await sb.from('participants').delete().eq('id', p.id);
      if (error) return toast('تعذّر الحذف', 'err');
      const m = (p.photo_url || '').split('/avatars/')[1]; if (m) sb.storage.from('avatars').remove([m]).catch(() => { });
      await loadAll(); renderAll(); toast('تم الحذف');
    }
  };
  $('#addP').onclick = () => {
    openModal(`<div class="sheet-h"><h3 style="color:var(--navy);font-weight:900">إضافة مشارك</h3><button class="x" data-close aria-label="إغلاق">✕</button></div>
      <form class="form" id="addForm">
        <div class="field"><label>الاسم الكامل</label><input class="input" name="n" maxlength="80" required></div>
        <div class="two"><div class="field"><label>حساب إنستغرام</label><input class="input" name="ig" dir="ltr" required></div>
        <div class="field"><label>التخصص</label><input class="input" name="sp" maxlength="80" required></div></div>
        <div class="two"><div class="field"><label>الدولة</label><select class="select" name="co" required>${countryOptionsHTML('PS')}</select></div>
        <div class="field"><label>المدينة</label><input class="input" name="ci" maxlength="60"></div></div>
        <label class="switch"><input type="checkbox" name="mem"> عضو في البرنامج 🎓</label>
        <button class="btn" type="submit">إضافة (معتمد مباشرة)</button></form>`);
    $('#addForm').onsubmit = async e => {
      e.preventDefault(); const f = new FormData(e.target), ig = cleanHandle(f.get('ig'));
      if (!/^[A-Za-z0-9._]{1,40}$/.test(ig)) return toast('حساب إنستغرام غير صحيح', 'err');
      const { error } = await sb.from('participants').insert({ full_name: String(f.get('n')).trim(), instagram: ig, specialty: String(f.get('sp')).trim(), country_code: f.get('co'), city: String(f.get('ci')).trim() || null, is_member: !!f.get('mem'), status: 'approved' });
      if (error) return toast(error.code === '23505' ? 'الحساب مسجّل مسبقًا' : 'تعذّرت الإضافة', 'err');
      closeModal(); await loadAll(); renderAll(); toast('تمت الإضافة ✅');
    };
  };

  function openPerson(id) {
    const p = pById(id); if (!p) return;
    const code = codeOfPart(id);
    const draw = () => {
      const mine = S.subs.filter(s => s.participant_id === id).sort((a, b) => a.day_number - b.day_number);
      $('#pdays').innerHTML = mine.length ? mine.map(s => `<div class="item card" style="padding:8px 12px"><b>يوم ${s.day_number}</b>
        <span class="badge ${s.status}">${s.status === 'pending' ? 'معلّق' : 'معتمد'}</span>
        <span class="grow">${s.reel_url && isHttps(s.reel_url) ? `<a href="${esc(s.reel_url)}" target="_blank" rel="noopener" style="color:var(--blue)">الريلز ↗</a>` : '<small style="color:var(--mut)">بدون رابط</small>'}</span>
        <button class="btn danger sm" data-ds="${s.id}">حذف</button></div>`).join('') : '<small style="color:var(--mut)">لا توجد أيام مسجلة.</small>';
    };
    openModal(`<div class="sheet-h">${avatarHTML(p)}<h3 style="color:var(--navy);font-weight:900">${esc(p.full_name)}</h3><button class="x" data-close aria-label="إغلاق">✕</button></div>
      <form class="form" id="pf">
        <div class="field"><label>الاسم</label><input class="input" name="n" value="${esc(p.full_name)}" maxlength="80" required></div>
        <div class="two"><div class="field"><label>إنستغرام</label><input class="input" name="ig" dir="ltr" value="${esc(p.instagram)}" required></div>
        <div class="field"><label>التخصص</label><input class="input" name="sp" value="${esc(p.specialty)}" maxlength="80" required></div></div>
        <div class="two"><div class="field"><label>الدولة</label><select class="select" name="co">${countryOptionsHTML(p.country_code || '')}</select></div>
        <div class="field"><label>المدينة</label><input class="input" name="ci" value="${esc(p.city || '')}" maxlength="60"></div></div>
        <div class="two"><div class="field"><label>الحالة</label><select class="select" name="st">${Object.entries(statusAr).map(([k, v]) => `<option value="${k}" ${p.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        <div class="field"><label>العضوية</label><label class="switch" style="padding:12px 0"><input type="checkbox" name="mem" ${p.is_member ? 'checked' : ''}> عضو في البرنامج 🎓</label>${code ? `<small>الكود المستخدم: <span class="kbd">${esc(code.code)}</span></small>` : ''}</div></div>
        <button class="btn" type="submit">حفظ البيانات</button></form>
      <hr class="sep">
      <h4 style="color:var(--navy);margin-bottom:10px">تسجيل يوم مع رابط الريلز</h4>
      <form class="two" id="df" style="align-items:end"><div class="field"><label>اليوم</label><select class="select" name="d">${dayOptions(defaultDay())}</select></div>
        <div class="field"><label>رابط الريلز (اختياري)</label><input class="input" name="u" dir="ltr" type="url" placeholder="https://…"></div>
        <button class="btn green sm" type="submit" style="grid-column:1/-1">تسجيل / تحديث اليوم</button></form>
      <h4 style="color:var(--navy);margin:18px 0 8px">الأيام المسجلة</h4><div class="list" id="pdays"></div>`);
    draw();
    $('#pf').onsubmit = async e => {
      e.preventDefault(); const f = new FormData(e.target), ig = cleanHandle(f.get('ig'));
      if (!/^[A-Za-z0-9._]{1,40}$/.test(ig)) return toast('حساب إنستغرام غير صحيح', 'err');
      const { error } = await sb.from('participants').update({ full_name: String(f.get('n')).trim(), instagram: ig, specialty: String(f.get('sp')).trim(), country_code: f.get('co') || null, city: String(f.get('ci')).trim() || null, status: f.get('st'), is_member: !!f.get('mem') }).eq('id', id);
      if (error) return toast(error.code === '23505' ? 'الحساب مستخدم لمشارك آخر' : 'تعذّر الحفظ', 'err');
      await loadAll(); renderAll(); toast('تم الحفظ ✅');
    };
    $('#df').onsubmit = async e => {
      e.preventDefault(); const f = new FormData(e.target), u = String(f.get('u')).trim();
      if (u && !isHttps(u)) return toast('الرابط يجب أن يبدأ بـ https://', 'err');
      const { error } = await sb.from('submissions').upsert({ participant_id: id, day_number: +f.get('d'), reel_url: u || null, status: 'approved' }, { onConflict: 'participant_id,day_number' });
      if (error) return toast('تعذّر التسجيل', 'err');
      await loadAll(); renderAll(); draw(); toast('تم ✅');
    };
    $('#pdays').onclick = async e => {
      const b = e.target.closest('[data-ds]'); if (!b) return;
      const { error } = await sb.from('submissions').delete().eq('id', b.dataset.ds);
      if (error) return toast('تعذّر الحذف', 'err');
      await loadAll(); renderAll(); draw();
    };
  }

  /* ---------- أكواد العضوية ---------- */
  const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // بلا حروف متشابهة (O/0 و I/1)
  function randCode(prefix) {
    const b = new Uint8Array(8); crypto.getRandomValues(b);
    const s = [...b].map(x => ALPHA[x % 32]).join('');           // 256 % 32 = 0 فلا انحياز
    return `${prefix}-${s.slice(0, 4)}-${s.slice(4)}`;
  }
  const codeLine = c => c.note ? `${c.note}: ${c.code}` : c.code;

  function renderCodes() {
    const q = $('#cq').value.trim().toLowerCase(), f = $('#cfilter').value;
    const list = S.codes.filter(c => (!f || (f === 'free' ? !c.used_by : !!c.used_by)) &&
      (!q || c.code.toLowerCase().includes(q) || (c.note || '').toLowerCase().includes(q) || (pById(c.used_by)?.full_name || '').toLowerCase().includes(q)));
    $('#codesBox').innerHTML = list.length ? list.map(c => {
      const u = c.used_by ? pById(c.used_by) : null;
      return `<div class="card item"><div class="grow"><b><span class="kbd code-big">${esc(c.code)}</span></b>
        <small>${c.note ? '📝 ' + esc(c.note) + ' · ' : ''}${c.used_by ? `<span class="badge approved">مستخدم</span> ${u ? esc(u.full_name) + ' (@' + esc(u.instagram) + ') · ' + statusAr[u.status] : ''}` : '<span class="badge pending" style="background:#dcfbe9;color:#0d7d46">متاح</span>'}</small></div>
        <div class="acts"><button class="btn ghost sm" data-ccopy="${esc(c.code)}">نسخ</button><button class="btn ghost sm" data-cnote="${esc(c.code)}">ملاحظة</button>
        ${c.used_by ? `<button class="btn ghost sm" data-crel="${esc(c.code)}">تحرير</button>` : ''}<button class="btn danger sm" data-cdel="${esc(c.code)}">حذف</button></div></div>`;
    }).join('') : `<div class="card empty">${S.codes.length ? 'لا نتائج مطابقة.' : 'لا توجد أكواد بعد. ولّد أول مجموعة من النموذج أعلاه.'}</div>`;
  }
  $('#cq').oninput = renderCodes; $('#cfilter').onchange = renderCodes;

  $('#genForm').onsubmit = async e => {
    e.preventDefault();
    const prefix = $('#gPrefix').value.trim().toUpperCase();
    if (!/^[A-Z0-9]{1,6}$/.test(prefix)) return toast('البادئة: حتى 6 حروف/أرقام إنجليزية', 'err');
    const names = [...new Set($('#gNames').value.split('\n').map(s => s.trim()).filter(Boolean))].map(s => s.slice(0, 120));
    const n = names.length || +$('#gCount').value;
    if (!(n >= 1 && n <= 300)) return toast('العدد من 1 إلى 300', 'err');
    const btn = e.target.querySelector('button[type=submit]'); btn.disabled = true;
    let rows, error;
    for (let attempt = 0; attempt < 4; attempt++) {                // إعادة المحاولة عند تكرار نادر
      const used = new Set(); rows = [];
      for (let i = 0; i < n; i++) { let c; do { c = randCode(prefix); } while (used.has(c)); used.add(c); rows.push({ code: c, note: names[i] || null }); }
      ({ error } = await sb.from('member_codes').insert(rows));
      if (!error || error.code !== '23505') break;
    }
    btn.disabled = false;
    if (error) return toast('تعذّر توليد الأكواد', 'err');
    await loadAll(); renderAll();
    $('#gNames').value = '';
    const copied = await copyText(rows.map(codeLine).join('\n'));
    toast(copied ? `تم توليد ${rows.length} كود ونسخ القائمة ✅` : `تم توليد ${rows.length} كود ✅ (استخدم «نسخ المتاحة»)`);
  };

  $('#copyFree').onclick = async () => {
    const free = S.codes.filter(c => !c.used_by); if (!free.length) return toast('لا توجد أكواد متاحة');
    toast(await copyText(free.map(codeLine).join('\n')) ? `تم نسخ ${free.length} كود ✅` : 'تعذّر النسخ', 'ok');
  };
  $('#csvCodes').onclick = () => {
    const lines = [['الكود', 'الملاحظة', 'الحالة', 'المشارك', 'إنستغرام'].map(csvCell).join(',')];
    S.codes.forEach(c => { const u = c.used_by ? pById(c.used_by) : null; lines.push([c.code, c.note, c.used_by ? 'مستخدم' : 'متاح', u?.full_name, u?.instagram].map(csvCell).join(',')); });
    downloadText('member-codes.csv', '﻿' + lines.join('\n'), 'text/csv;charset=utf-8');
  };
  $('#codesBox').onclick = async e => {
    const b = e.target.closest('button'); if (!b) return; const d = b.dataset; let r;
    if (d.ccopy) return toast(await copyText(d.ccopy) ? 'تم نسخ الكود ✅' : 'تعذّر النسخ', 'ok');
    if (d.cnote) {
      const c = S.codes.find(x => x.code === d.cnote), v = prompt('ملاحظة للكود (مثلًا اسم صاحبه):', c.note || ''); if (v === null) return;
      r = await sb.from('member_codes').update({ note: v.trim().slice(0, 120) || null }).eq('code', d.cnote);
    } else if (d.crel) {
      if (!confirm('تحرير الكود ليصبح متاحًا من جديد؟ (لن يُحذف المشارك ولن تتغير عضويته)')) return;
      r = await sb.from('member_codes').update({ used_by: null, used_at: null }).eq('code', d.crel);
    } else if (d.cdel) {
      if (!confirm('حذف هذا الكود نهائيًا؟')) return;
      r = await sb.from('member_codes').delete().eq('code', d.cdel);
    }
    if (r?.error) return toast('تعذّر التنفيذ', 'err');
    await loadAll(); renderAll(); toast('تم ✅');
  };

  /* ---------- الفائزون ---------- */
  function winnerRows() {
    const mem = approvedParts().filter(p => p.is_member), ids = new Set(mem.map(p => p.id));
    const rows = computeRows(mem, S.subs.filter(s => s.status === 'approved' && ids.has(s.participant_id)), S.info);
    return rows.filter(r => r.done > 0).slice(0, S.settings.winners_count);
  }
  function renderWinners() {
    const rows = winnerRows(), pub = !!S.settings.winners_published;
    $('#winState').textContent = pub ? '✅ منشور على الموقع' : '⏸ غير منشور';
    $('#winPublish').textContent = pub ? '🙈 إخفاء الفائزين من الموقع' : '🎉 نشر الفائزين على الموقع';
    $('#winBox').innerHTML = rows.length ? rows.map((r, i) => `<div class="card item"><div class="grow"><b>${['🥇', '🥈', '🥉'][i] || '🏅'} ${esc(r.p.full_name)}</b>
      <small>@${esc(r.p.instagram)} · ${esc(placeText(r.p) || '')} · ${r.done} يومًا · سلسلة ${r.streak}🔥</small></div></div>`).join('')
      : '<div class="card empty">لا يوجد أعضاء بإنجازات معتمدة بعد.</div>';
  }
  $('#winPublish').onclick = async () => {
    const pub = !S.settings.winners_published;
    if (pub && !confirm('سيظهر الفائزون للجميع على الصفحة الرئيسية. متابعة؟')) return;
    const { error } = await sb.from('settings').update({ winners_published: pub }).eq('id', 1);
    if (error) return toast('تعذّر التنفيذ. هل شغّلت schema.sql المحدَّث؟', 'err');
    await loadAll(); renderAll(); toast(pub ? 'تم نشر الفائزين 🎉' : 'تم الإخفاء');
  };
  $('#winCopy').onclick = async () => {
    const rows = winnerRows(); if (!rows.length) return toast('لا يوجد فائزون بعد');
    const t = `🎉 مبروك لفائزي ${CFG.PROGRAM_NAME}!\n\n` + rows.map((r, i) => `${['🥇', '🥈', '🥉'][i] || '🏅'} ${r.p.full_name} (@${r.p.instagram}) · ${r.done} يومًا`).join('\n') + `\n\nالجائزة: ${S.settings.prize_amount} + ${S.settings.prize_extra}\n${siteUrl()}`;
    toast(await copyText(t) ? 'تم نسخ نص التهنئة ✅' : 'تعذّر النسخ', 'ok');
  };
  $('#winCsv').onclick = () => {
    const l = [['المركز', 'الاسم', 'إنستغرام', 'الدولة', 'أيام منجزة', 'سلسلة'].map(csvCell).join(',')];
    winnerRows().forEach((r, i) => l.push([i + 1, r.p.full_name, r.p.instagram, countryName(r.p.country_code), r.done, r.streak].map(csvCell).join(',')));
    downloadText('winners.csv', '﻿' + l.join('\n'), 'text/csv;charset=utf-8');
  };

  /* ---------- الإعلانات ---------- */
  function renderAnn() {
    $('#annWarn').classList.toggle('hide', S.annOk);
    $('#annBox').innerHTML = S.ann.length ? S.ann.map(n => `<div class="card item"><div class="grow"><b>${n.pinned ? '📌 ' : ''}${esc(n.body)}</b>
      <small>${n.active ? '<span class="badge approved">ظاهر</span>' : '<span class="badge rejected">مخفي</span>'}${n.link ? ' · ' + esc(n.link) : ''}</small></div>
      <div class="acts"><button class="btn ghost sm" data-apin="${n.id}">${n.pinned ? 'إلغاء التثبيت' : 'تثبيت'}</button><button class="btn ghost sm" data-aact="${n.id}">${n.active ? 'إخفاء' : 'إظهار'}</button><button class="btn danger sm" data-adel="${n.id}">حذف</button></div></div>`).join('')
      : '<div class="card empty">لا توجد إعلانات بعد.</div>';
  }
  $('#annForm').onsubmit = async e => {
    e.preventDefault();
    const body = $('#annBody').value.trim(), link = $('#annLink').value.trim();
    if (link && !isHttps(link)) return toast('الرابط يجب أن يبدأ بـ https://', 'err');
    const { error } = await sb.from('announcements').insert({ body, link: link || null, pinned: $('#annPin').checked });
    if (error) return toast('تعذّر النشر. هل شغّلت schema.sql المحدَّث؟', 'err');
    e.target.reset(); await loadAll(); renderAll(); toast('تم نشر الإعلان 📣');
  };
  $('#annBox').onclick = async e => {
    const b = e.target.closest('button'); if (!b) return; const d = b.dataset; let r;
    if (d.adel) { if (!confirm('حذف الإعلان؟')) return; r = await sb.from('announcements').delete().eq('id', d.adel); }
    else if (d.apin) { const n = S.ann.find(x => String(x.id) === d.apin); r = await sb.from('announcements').update({ pinned: !n.pinned }).eq('id', d.apin); }
    else if (d.aact) { const n = S.ann.find(x => String(x.id) === d.aact); r = await sb.from('announcements').update({ active: !n.active }).eq('id', d.aact); }
    if (r?.error) return toast('تعذّر التنفيذ', 'err');
    await loadAll(); renderAll(); toast('تم ✅');
  };

  /* ---------- منطقة الخطر ---------- */
  $('#dzRejected').onclick = async () => {
    const n = S.parts.filter(p => p.status === 'rejected').length; if (!n) return toast('لا يوجد مشاركون مرفوضون');
    if (!confirm(`حذف ${n} مشارك مرفوض نهائيًا؟`)) return;
    const { error } = await sb.from('participants').delete().eq('status', 'rejected');
    if (error) return toast('تعذّر التنفيذ', 'err'); await loadAll(); renderAll(); toast('تم الحذف ✅');
  };
  $('#dzSubs').onclick = async () => {
    if (prompt('هذا يحذف كل الإنجازات والريلزات نهائيًا. اكتب كلمة: تصفير') !== 'تصفير') return toast('أُلغي الإجراء');
    const { error } = await sb.from('submissions').delete().gte('day_number', 0);
    if (error) return toast('تعذّر التنفيذ', 'err'); await loadAll(); renderAll(); toast('تم التصفير ✅');
  };

  /* ---------- الإعدادات ---------- */
  function fillSettings() {
    const f = $('#setForm'), s = S.settings;
    f.title.value = s.title; f.start_date.value = s.start_date || ''; f.total_days.value = s.total_days;
    f.prize_amount.value = s.prize_amount; f.winners_count.value = s.winners_count; f.prize_extra.value = s.prize_extra;
    f.prize_scope_text.value = s.prize_scope_text || ''; f.registration_open.checked = !!s.registration_open;
  }
  $('#setForm').onsubmit = async e => {
    e.preventDefault(); const f = e.target;
    const upd = {
      title: f.title.value.trim(), start_date: f.start_date.value || null, total_days: +f.total_days.value,
      prize_amount: f.prize_amount.value.trim(), winners_count: +f.winners_count.value, prize_extra: f.prize_extra.value.trim(),
      prize_scope_text: f.prize_scope_text.value.trim(), registration_open: f.registration_open.checked, updated_at: new Date().toISOString()
    };
    const { error } = await sb.from('settings').update(upd).eq('id', 1);
    if (error) return toast('تعذّر حفظ الإعدادات', 'err');
    await loadAll(); renderAll(); toast('تم حفظ الإعدادات ✅');
  };

  $('#backup').onclick = async () => {
    try { await loadAll(); } catch { return toast('تعذّر جلب البيانات', 'err'); }
    const day = todayStr();
    downloadText(`challenge-backup-${day}.json`, JSON.stringify({ exported_at: new Date().toISOString(), settings: S.settings, participants: S.parts, submissions: S.subs, member_codes: S.codes }, null, 2), 'application/json');
    toast('تم تنزيل النسخة الاحتياطية ✅');
  };

  $('#pwForm').onsubmit = async e => {
    e.preventDefault(); const f = e.target, p1 = f.p1.value;
    if (p1.length < 10) return toast('كلمة المرور 10 أحرف على الأقل', 'err');
    if (p1 !== f.p2.value) return toast('كلمتا المرور غير متطابقتين', 'err');
    const { error } = await sb.auth.updateUser({ password: p1 });
    if (error) return toast('تعذّر تغيير كلمة المرور: ' + (error.message || ''), 'err');
    f.reset(); toast('تم تغيير كلمة المرور ✅');
  };

  /* ---------- نوافذ ---------- */
  function openModal(html) {
    closeModal();
    const m = document.createElement('div'); m.className = 'modal'; m.id = 'modal';
    m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
    m.innerHTML = `<div class="sheet wide">${html}</div>`;
    m.addEventListener('mousedown', e => { if (e.target === m) closeModal(); });
    m.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeModal(); });
    document.body.appendChild(m);
  }
  function closeModal() { $('#modal')?.remove(); }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  /* استئناف الجلسة */
  if (sb) {
    sb.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_OUT' && !$('#appView').classList.contains('hide')) location.reload(); });
    enter();
  }
})();
