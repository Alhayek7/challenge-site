/* ===== شهادة الإنجاز =====
   تُرسم الشهادة داخل المتصفح (Canvas) ثم تُحمَّل كصورة PNG. لا يلزم أي خادم.
   ✏️ لتغيير الألوان أو النصوص عدّل الدالة build أدناه. اللون الكحلي: #0a2463 · الذهبي: #f5b942 */
const Certificate = (() => {
  const W = 1754, H = 1240;                       // مقاس A4 أفقي تقريبًا
  const FONT = 'Tajawal, "Segoe UI", Tahoma, Arial, sans-serif';

  function loadLogo(src = 'assets/logo.png') {
    return new Promise(res => {
      const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null);
      im.src = src;
    });
  }
  function rr(x, a, b, w, h, r) {                 // مستطيل بزوايا مدورة
    x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r);
    x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath();
  }
  function fit(x, text, weight, size, maxW) {     // تصغير الخط حتى يناسب العرض
    do { x.font = `${weight} ${size}px ${FONT}`; size -= 4; } while (x.measureText(text).width > maxW && size > 30);
  }

  /* opts: { name, done, total, isMember, countryName, city, program, memberLabel, openLabel, signer, url } */
  async function build(opts, withLogo = true) {
    try { await document.fonts.load(`900 90px Tajawal`); await document.fonts.load(`500 30px Tajawal`); } catch { }
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.direction = 'rtl'; x.textAlign = 'center'; x.textBaseline = 'middle';

    // خلفية بيضاء مع توهج ناعم
    x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
    let g = x.createRadialGradient(W * .85, 0, 0, W * .85, 0, 700); g.addColorStop(0, '#e4f0ff'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    g = x.createRadialGradient(0, H * .9, 0, 0, H * .9, 600); g.addColorStop(0, '#fff3d1'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, W, H);

    // الإطار
    g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#1d6bf0'); g.addColorStop(1, '#0a2463');
    x.lineWidth = 16; x.strokeStyle = g; rr(x, 44, 44, W - 88, H - 88, 36); x.stroke();
    x.lineWidth = 3; x.strokeStyle = '#f5b942'; rr(x, 76, 76, W - 152, H - 152, 24); x.stroke();

    // الشريط العلوي
    g = x.createLinearGradient(0, 120, W, 340); g.addColorStop(0, '#1d6bf0'); g.addColorStop(1, '#0a2463');
    x.fillStyle = g; rr(x, 120, 120, W - 240, 220, 30); x.fill();
    if (withLogo) {
      const logo = await loadLogo();
      if (logo) x.drawImage(logo, W - 120 - 40 - 170, 120 + 25, 170, 170);
      const mq = await loadLogo('assets/marqat-white.png');   // شعار المؤسسة على الجهة اليسرى
      if (mq) x.drawImage(mq, 120 + 50, 120 + 30, 200 * 378 / 599, 160);
    }
    x.fillStyle = '#fff'; x.font = `900 92px ${FONT}`; x.fillText('شهادة إنجاز', W / 2, 205);
    x.fillStyle = '#cfe2ff'; x.font = `500 34px ${FONT}`;
    x.fillText(`تحدي الـ ${opts.total} يومًا · ${opts.program}`, W / 2, 285);

    // النص
    x.fillStyle = '#6b7a99'; x.font = `500 38px ${FONT}`; x.fillText('تُمنح هذه الشهادة إلى', W / 2, 430);

    x.fillStyle = '#0a2463'; fit(x, opts.name, 900, 120, W - 420); x.fillText(opts.name, W / 2, 545);
    g = x.createLinearGradient(W * .3, 0, W * .7, 0); g.addColorStop(0, 'rgba(245,185,66,0)'); g.addColorStop(.5, '#f5b942'); g.addColorStop(1, 'rgba(245,185,66,0)');
    x.fillStyle = g; x.fillRect(W * .25, 625, W * .5, 5);

    x.fillStyle = '#10234d'; x.font = `500 44px ${FONT}`;
    x.fillText(`لإنجازه ${opts.done} يومًا من أصل ${opts.total} في تحدي نشر ريلز يوميًا`, W / 2, 725);
    const who = opts.isMember ? opts.memberLabel : opts.openLabel;
    const place = [opts.countryName, opts.city].filter(Boolean).join('، ');
    x.fillText(`بصفته ${who}${place ? ' من ' + place : ''}`, W / 2, 800);
    x.fillStyle = '#6b7a99'; x.font = `500 34px ${FONT}`;
    x.fillText('تقديرًا لالتزامه وإصراره وصناعته أثرًا رقميًا نافعًا', W / 2, 870);

    // الختم الذهبي
    const sx = 290, sy = 1010;
    g = x.createRadialGradient(sx - 25, sy - 25, 10, sx, sy, 110); g.addColorStop(0, '#ffe3a1'); g.addColorStop(.6, '#f5b942'); g.addColorStop(1, '#b87508');
    x.fillStyle = g; x.beginPath(); x.arc(sx, sy, 100, 0, Math.PI * 2); x.fill();
    x.lineWidth = 5; x.strokeStyle = 'rgba(255,255,255,.7)'; x.beginPath(); x.arc(sx, sy, 84, 0, Math.PI * 2); x.stroke();
    x.fillStyle = '#5a3500'; x.font = `900 78px ${FONT}`; x.fillText('★', sx, sy - 8);
    x.font = `800 24px ${FONT}`; x.fillText(opts.isMember ? 'عضو' : 'مشارك', sx, sy + 52);

    // التاريخ والتوقيع
    const date = new Date().toLocaleDateString('ar-u-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' });
    x.fillStyle = '#10234d'; x.font = `700 36px ${FONT}`; x.fillText(`تاريخ الإصدار: ${date}`, W / 2, 1000);
    x.fillStyle = '#0a2463'; x.fillRect(W - 640, 1035, 420, 3);
    x.font = `800 34px ${FONT}`; x.fillText(opts.signer, W - 430, 1075);

    x.fillStyle = '#6b7a99'; x.font = `500 24px ${FONT}`;
    x.fillText(opts.url, W / 2, 1150);
    return c;
  }

  /* يبني الشهادة ويُرجع {canvas, dataUrl}. إن منع المتصفح التصدير (ملف محلي) نعيد المحاولة بدون الشعار */
  async function make(opts) {
    let canvas = await build(opts, true), dataUrl;
    try { dataUrl = canvas.toDataURL('image/png'); }
    catch { canvas = await build(opts, false); dataUrl = canvas.toDataURL('image/png'); }
    return { canvas, dataUrl };
  }
  function download(dataUrl, name) {
    const a = document.createElement('a'); a.href = dataUrl; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  }
  return { make, download };
})();
