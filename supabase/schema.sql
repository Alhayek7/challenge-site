-- =====================================================================
-- تحدي الـ 30 يومًا | صناع الأثر الرقمي  —  مخطط قاعدة البيانات (Supabase)
-- الإصدار 3: مشاركة مفتوحة للجميع + أكواد عضوية للبرنامج + الدولة + أمان مشدَّد
--
-- طريقة الاستخدام:
--   Supabase > SQL Editor > New query > الصق الملف كاملًا > Run
-- الملف آمن لإعادة التشغيل أكثر من مرة (لا يحذف بياناتك).
--
-- فكرة العضوية:
--   • أي شخص يستطيع التسجيل (مشارك مفتوح).
--   • أعضاء البرنامج يحصلون على كود خاص من الإدارة، يكتبونه عند التسجيل.
--   • الكود يُتحقق منه في الخادم فقط، ولا يستطيع الزوار قراءة جدول الأكواد إطلاقًا.
--   • العضو الموثَّق يحمل علامة is_member، وعليها تُبنى أحقية الجوائز.
--
-- ✏️ أشياء قد تغيّرها هنا (ابحث عن ✏️):
--   1) المنطقة الزمنية لحساب "اليوم الحالي":  'Asia/Gaza'
--   2) سقف طلبات التسجيل المعلّقة:  300
--   3) أيام السماح بالإرسال المتأخر: 6 أيام للخلف، و3 أيام بعد انتهاء التحدي
--   4) حد محاولات الكود الخاطئة: 10 محاولات لكل عنوان IP خلال 10 دقائق
-- =====================================================================

-- 1) الإعدادات (صف واحد فقط) ------------------------------------------
create table if not exists public.settings (
  id               int primary key default 1 check (id = 1),
  title            text    not null default 'تحدي الـ 30 يومًا',
  start_date       date,
  total_days       int     not null default 30 check (total_days between 1 and 90),
  prize_amount     text    not null default '100$',
  winners_count    int     not null default 5 check (winners_count between 1 and 20),
  prize_extra      text    not null default 'عضوية استوديو النقاء: ساعات استخدام مجانية',
  registration_open boolean not null default true,
  updated_at       timestamptz not null default now()
);
-- ✏️ نص يوضّح لمن تُمنح الجوائز (يظهر في الصفحة الرئيسية، ويمكن تعديله من لوحة الإدارة)
alter table public.settings add column if not exists prize_scope_text text not null
  default 'الجوائز مخصصة لأعضاء برنامج صناع الأثر الرقمي، والمشاركة مفتوحة للجميع من كل مكان.';
insert into public.settings (id) values (1) on conflict (id) do nothing;

-- 2) المديرون -----------------------------------------------------------
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- 3) المشاركون ----------------------------------------------------------
create table if not exists public.participants (
  id           uuid primary key default gen_random_uuid(),
  full_name    text not null check (char_length(full_name) between 2 and 80),
  instagram    text not null check (char_length(instagram) between 1 and 40
                                    and instagram ~ '^[A-Za-z0-9._]+$'),
  specialty    text not null check (char_length(specialty) between 2 and 80),
  photo_url    text check (photo_url is null or (char_length(photo_url) <= 500 and photo_url ~ '^https://')),
  status       text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at   timestamptz not null default now()
);
-- الدولة (رمزان بحروف كبيرة، مثل PS) والمدينة، وعلامة عضوية البرنامج
alter table public.participants add column if not exists country_code text
  check (country_code is null or country_code ~ '^[A-Z]{2}$');
alter table public.participants add column if not exists city text
  check (city is null or char_length(city) <= 60);
alter table public.participants add column if not exists is_member boolean not null default false;

create unique index if not exists participants_instagram_uq
  on public.participants (lower(instagram));
create index if not exists participants_status_idx on public.participants (status);

-- 4) أكواد العضوية (للإدارة فقط، لا يراها الزوار) -----------------------
create table if not exists public.member_codes (
  code       text primary key check (code = upper(code) and code ~ '^[A-Z0-9-]{3,24}$'),
  note       text check (note is null or char_length(note) <= 120),   -- مثلًا: اسم من سلّمته الكود
  used_by    uuid references public.participants(id) on delete set null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);
-- كود واحد لكل مشارك
create unique index if not exists member_codes_used_by_uq
  on public.member_codes (used_by) where used_by is not null;

-- سجل المحاولات الخاطئة (للحماية من تخمين الأكواد)
create table if not exists public.code_attempts (
  id  bigint generated always as identity primary key,
  ip  text not null,
  at  timestamptz not null default now()
);
create index if not exists code_attempts_ip_at_idx on public.code_attempts (ip, at);

-- 5) الإنجازات اليومية ----------------------------------------------------
create table if not exists public.submissions (
  id             bigint generated always as identity primary key,
  participant_id uuid not null references public.participants(id) on delete cascade,
  day_number     int  not null check (day_number between 1 and 90),
  reel_url       text check (reel_url is null or (char_length(reel_url) <= 500 and reel_url ~ '^https://')),
  status         text not null default 'approved' check (status in ('pending','approved')),
  created_at     timestamptz not null default now(),
  unique (participant_id, day_number)
);
create index if not exists submissions_status_idx on public.submissions (status);
create index if not exists submissions_participant_idx on public.submissions (participant_id);

-- 6) قواعد تُفرض في الخادم (لا يمكن تجاوزها من المتصفح) -----------------
-- 6-أ) حماية إضافية للتسجيل المباشر (التسجيل العادي يمر عبر register_participant)
create or replace function public.enforce_participant_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  if not coalesce((select registration_open from public.settings where id = 1), false) then
    raise exception 'registration_closed' using errcode = 'P0001';
  end if;
  -- ✏️ سقف الطلبات المعلّقة (حماية من الإغراق)
  if (select count(*) from public.participants where status = 'pending') >= 300 then
    raise exception 'too_many_pending' using errcode = 'P0001';
  end if;
  new.status := 'pending';
  return new;
end;
$$;

drop trigger if exists participants_rules on public.participants;
create trigger participants_rules
  before insert on public.participants
  for each row execute function public.enforce_participant_rules();

-- 6-ب) الريلز: يُسمح فقط باليوم الحالي أو الأيام القريبة، ويلزم رابط
create or replace function public.enforce_submission_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  s   public.settings;
  cur int;
begin
  if public.is_admin() then
    return new;
  end if;

  select * into s from public.settings where id = 1;
  if s.start_date is null then
    raise exception 'challenge_not_started' using errcode = 'P0001';
  end if;

  -- ✏️ المنطقة الزمنية لحساب اليوم الحالي
  cur := ((now() at time zone 'Asia/Gaza')::date - s.start_date) + 1;

  if cur < 1 then
    raise exception 'challenge_not_started' using errcode = 'P0001';
  end if;
  -- ✏️ بعد انتهاء التحدي نسمح بـ 3 أيام فقط لإرسال المتأخر
  if cur > s.total_days + 3 then
    raise exception 'challenge_ended' using errcode = 'P0001';
  end if;
  -- ✏️ لا يُسمح بالمستقبل، ولا بالرجوع أكثر من 6 أيام
  if new.day_number > least(cur, s.total_days)
     or new.day_number > s.total_days
     or new.day_number < cur - 6 then
    raise exception 'day_not_open' using errcode = 'P0001';
  end if;
  if new.reel_url is null then
    raise exception 'reel_url_required' using errcode = 'P0001';
  end if;

  new.status := 'pending';
  return new;
end;
$$;

drop trigger if exists submissions_rules on public.submissions;
create trigger submissions_rules
  before insert on public.submissions
  for each row execute function public.enforce_submission_rules();

-- 6-جـ) دالة التسجيل (المدخل الوحيد لتسجيل الزوار)
-- تتحقق من الكود وتفرض الحدود وتُرجع نتيجة مفهومة بدل أخطاء خام.
-- النتيجة: {"ok":true,"id":"...","is_member":true|false}  أو  {"ok":false,"error":"..."}
-- رموز الأخطاء: registration_closed, too_many_pending, invalid_data, invalid_code,
--               code_used, too_many_attempts, duplicate
create or replace function public.register_participant(
  p_full_name   text,
  p_instagram   text,
  p_specialty   text,
  p_country     text,
  p_city        text,
  p_photo_url   text,
  p_member_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code   text;
  v_ip     text := 'unknown';
  v_hdr    text;
  v_id     uuid := gen_random_uuid();
  v_used   uuid;
  v_found  boolean;
  v_member boolean := false;
begin
  if not coalesce((select registration_open from settings where id = 1), false) then
    return jsonb_build_object('ok', false, 'error', 'registration_closed');
  end if;
  -- ✏️ سقف الطلبات المعلّقة
  if (select count(*) from participants where status = 'pending') >= 300 then
    return jsonb_build_object('ok', false, 'error', 'too_many_pending');
  end if;

  p_country := upper(btrim(coalesce(p_country, '')));
  if p_country !~ '^[A-Z]{2}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_data');
  end if;

  -- تطبيع الكود: أرقام عربية → إنجليزية، حذف المسافات، حروف كبيرة
  v_code := nullif(upper(regexp_replace(
              translate(coalesce(p_member_code, ''), '٠١٢٣٤٥٦٧٨٩', '0123456789'),
              '[\s_]+', '', 'g')), '');

  if v_code is not null then
    -- عنوان المستخدم (يضيفه Supabase في ترويسة الطلب)
    begin
      v_hdr := current_setting('request.headers', true);
      v_ip := coalesce(nullif(btrim(split_part(coalesce((v_hdr::json) ->> 'x-forwarded-for', ''), ',', 1)), ''), 'unknown');
    exception when others then
      v_ip := 'unknown';
    end;

    delete from code_attempts where at < now() - interval '1 day';
    -- ✏️ حد المحاولات الخاطئة: 10 خلال 10 دقائق لكل IP
    if (select count(*) from code_attempts where ip = v_ip and at > now() - interval '10 minutes') >= 10 then
      return jsonb_build_object('ok', false, 'error', 'too_many_attempts');
    end if;

    select true, used_by into v_found, v_used
      from member_codes where code = v_code for update;

    if v_found is null then
      insert into code_attempts (ip) values (v_ip);
      return jsonb_build_object('ok', false, 'error', 'invalid_code');
    end if;
    if v_used is not null then
      insert into code_attempts (ip) values (v_ip);
      return jsonb_build_object('ok', false, 'error', 'code_used');
    end if;
    v_member := true;
  end if;

  begin
    insert into participants (id, full_name, instagram, specialty, country_code, city, photo_url, is_member, status)
    values (v_id, btrim(p_full_name), btrim(p_instagram), btrim(p_specialty), p_country,
            nullif(btrim(coalesce(p_city, '')), ''), nullif(btrim(coalesce(p_photo_url, '')), ''), v_member, 'pending');

    if v_member then
      update member_codes set used_by = v_id, used_at = now() where code = v_code;
    end if;
  exception
    when unique_violation then
      return jsonb_build_object('ok', false, 'error', 'duplicate');
    when check_violation then
      return jsonb_build_object('ok', false, 'error', 'invalid_data');
  end;

  return jsonb_build_object('ok', true, 'id', v_id, 'is_member', v_member);
end;
$$;

revoke all on function public.register_participant(text, text, text, text, text, text, text) from public;
grant execute on function public.register_participant(text, text, text, text, text, text, text) to anon, authenticated;

-- 7) الأمان (RLS) -------------------------------------------------------
alter table public.settings      enable row level security;
alter table public.admins        enable row level security;
alter table public.participants  enable row level security;
alter table public.submissions   enable row level security;
alter table public.member_codes  enable row level security;
alter table public.code_attempts enable row level security;   -- بلا سياسات: لا أحد يصل إليه إلا الدالة

-- settings
drop policy if exists settings_read   on public.settings;
drop policy if exists settings_update on public.settings;
create policy settings_read   on public.settings for select using (true);
create policy settings_update on public.settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- admins (المدير يرى صفّه فقط)
drop policy if exists admins_self on public.admins;
create policy admins_self on public.admins for select to authenticated
  using (user_id = auth.uid());

-- participants: الزوار يقرؤون المعتمدين فقط. التسجيل عبر register_participant فقط.
drop policy if exists participants_read         on public.participants;
drop policy if exists participants_insert       on public.participants;
drop policy if exists participants_insert_admin on public.participants;
drop policy if exists participants_update       on public.participants;
drop policy if exists participants_delete       on public.participants;
create policy participants_read on public.participants for select
  using (status = 'approved' or public.is_admin());
create policy participants_insert_admin on public.participants for insert to authenticated
  with check (public.is_admin());
create policy participants_update on public.participants for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy participants_delete on public.participants for delete to authenticated
  using (public.is_admin());

-- member_codes: للإدارة فقط (قراءة وكتابة وحذف)
drop policy if exists member_codes_admin on public.member_codes;
create policy member_codes_admin on public.member_codes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- submissions
drop policy if exists submissions_read   on public.submissions;
drop policy if exists submissions_insert on public.submissions;
drop policy if exists submissions_update on public.submissions;
drop policy if exists submissions_delete on public.submissions;
create policy submissions_read on public.submissions for select
  using (status = 'approved' or public.is_admin());
create policy submissions_insert on public.submissions for insert to anon, authenticated
  with check (
    public.is_admin()
    or (status = 'pending'
        and exists (select 1 from public.participants p
                    where p.id = participant_id and p.status = 'approved'))
  );
create policy submissions_update on public.submissions for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy submissions_delete on public.submissions for delete to authenticated
  using (public.is_admin());

-- 8) تخزين الصور الشخصية -------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = true, file_size_limit = 1048576,
      allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists avatars_insert on storage.objects;
drop policy if exists avatars_delete on storage.objects;
create policy avatars_insert on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'avatars');
create policy avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and public.is_admin());

-- =====================================================================
-- 9) إنشاء حساب المدير (بعد تشغيل ما سبق) — مرة واحدة فقط:
--   أ) Authentication > Users > Add user > Create new user
--      البريد:  admin@sonna3athr.app   (اسم المستخدم في الموقع = admin)
--      كلمة مرور قوية، وفعّل Auto Confirm User
--   ب) ثم شغّل هذا الأمر في SQL Editor:
--
--   insert into public.admins (user_id)
--   select id from auth.users where email = 'admin@sonna3athr.app';
--
--   جـ) Authentication > Providers > Email: أوقف "Allow new users to sign up"
--
--   ✏️ لإضافة مدير ثانٍ: أنشئ مستخدمًا جديدًا بنفس الطريقة وكرر الأمر (ب) ببريده.
-- =====================================================================

-- 10) إضافات الإصدار 4: الإعلانات + إعلان الفائزين ------------------------
alter table public.settings add column if not exists winners_published boolean not null default false;

create table if not exists public.announcements (
  id         bigserial primary key,
  body       text not null check (char_length(body) between 1 and 200),
  link       text check (link is null or (char_length(link) <= 300 and link ~ '^https://')),
  pinned     boolean not null default false,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.announcements enable row level security;
drop policy if exists ann_read  on public.announcements;
drop policy if exists ann_admin on public.announcements;
create policy ann_read  on public.announcements for select using (active or public.is_admin());
create policy ann_admin on public.announcements for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
grant select on public.announcements to anon, authenticated;
grant insert, update, delete on public.announcements to authenticated;
grant usage, select on sequence public.announcements_id_seq to authenticated;
