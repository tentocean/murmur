# Murmur — คู่มือติดตั้งแบบละเอียด (login Google + web push)

ทำตามลำดับ A → G ได้เลย แต่ละส่วนมี **จุดตรวจสอบ ✅** และ **ปัญหาที่เจอบ่อย ⚠️**

> เวลาเจอ `<ref>` = **Project Reference ID** ของ Supabase (ตัวอักษรใน URL เช่น `abcd1234` จาก `https://abcd1234.supabase.co`)

---

## A. สร้าง Supabase project

1. เปิด https://supabase.com → **Sign in** (ใช้ GitHub/Google ก็ได้)
2. กด **New project**
   - **Name:** `murmur`
   - **Database Password:** ตั้งรหัสแล้ว **จดเก็บไว้** (จะใช้ตอน `supabase link`)
   - **Region:** `Southeast Asia (Singapore)` (ใกล้ไทยสุด)
   - **Plan:** Free
3. กด **Create new project** → รอ ~2 นาที ให้สถานะขึ้น **Active**

### เอาค่า config
4. เมนูซ้าย → **Project Settings** (รูปเฟือง) → **API**
5. คัดลอก 2 ค่า:
   - **Project URL** เช่น `https://abcd1234.supabase.co`
   - **Project API keys → `anon` `public`** (สายยาวขึ้นต้น `eyJ...`)

✅ **ตรวจสอบ:** ได้ Project URL + anon key + จำ `<ref>` (ส่วน `abcd1234`) ได้

---

## B. สร้างตารางในฐานข้อมูล

1. เมนูซ้าย → **SQL Editor** → **+ New query**
2. เปิดไฟล์ `supabase/murmur_schema.sql` ในเครื่อง → คัดลอกทั้งหมด → วางในช่อง
3. กด **Run** (หรือ Cmd/Ctrl + Enter)

✅ **ตรวจสอบ:** เมนู **Table Editor** ต้องเห็นตาราง `murmur_tasks` และ `murmur_push_subscriptions`

⚠️ ถ้าแดง `permission denied` → ตรวจว่าวางทั้งไฟล์ ไม่ตกบรรทัด `enable row level security`

---

## C. ใส่ config ในแอป (เปิดโหมด cloud)

1. เปิดไฟล์ `Murmur.dc.html` → หาส่วนบนสุด `window.MURMUR_CONFIG`
2. วางค่าจากข้อ A:
   ```js
   window.MURMUR_CONFIG = {
     SUPABASE_URL: "https://abcd1234.supabase.co",
     SUPABASE_ANON_KEY: "eyJhbGci...(anon key)",
     VAPID_PUBLIC_KEY: "BOSSfQFvLRrtb9nRI64lYT4c3_dxcPLymYAAbDtiJ2oNrmz2R5Fg87W_Qi88goO0WUX2GDr6a_gX3vYhJiX_BbA"
   };
   ```
3. เซฟไฟล์

✅ **ตรวจสอบ:** เปิด `http://localhost:8123/Murmur.dc.html` ต้องเจอ **หน้า Login Google** (ถ้ายังเห็นรายการงานเดโม่ = config ยังว่าง/ยังไม่เซฟ)

> รันเซิร์ฟเวอร์ทดสอบ: `cd "โฟลเดอร์โปรเจกต์" && python3 -m http.server 8123`

---

## D. เปิด Google Login

### D-1. สร้าง OAuth client ใน Google Cloud
1. เปิด https://console.cloud.google.com → มุมซ้ายบนเลือก/สร้าง **Project** (เช่น `murmur`)
2. เมนู → **APIs & Services** → **OAuth consent screen**
   - **User Type:** External → Create
   - กรอก App name (`Murmur`), User support email, Developer email → Save
   - **Test users:** กด Add users → ใส่อีเมล Google ของคุณ (ตอนยังไม่ publish จะล็อกอินได้เฉพาะอีเมลที่อยู่ในนี้)
3. เมนู → **Credentials** → **+ Create Credentials** → **OAuth client ID**
   - **Application type:** Web application
   - **Name:** `murmur-web`
   - **Authorized redirect URIs → + Add URI:**
     ```
     https://<ref>.supabase.co/auth/v1/callback
     ```
   - กด **Create** → จะได้ **Client ID** และ **Client Secret** (คัดลอกไว้)

### D-2. ใส่ใน Supabase
4. Supabase → **Authentication** → **Sign In / Providers** → **Google** → เปิด (Enable)
5. วาง **Client ID** และ **Client Secret** → **Save**

### D-3. ตั้ง URL ที่อนุญาตให้เด้งกลับ
6. Supabase → **Authentication** → **URL Configuration**
   - **Site URL:** `http://localhost:8123` (ตอนทดสอบ)
   - **Redirect URLs → Add URL:** ใส่ทั้ง 2
     ```
     http://localhost:8123
     http://localhost:8123/Murmur.dc.html
     ```
   - (ตอน deploy จริงค่อยเพิ่มโดเมน Cloudflare)

✅ **ตรวจสอบ:** เปิดแอป → กด "เข้าสู่ระบบด้วย Google" → เลือกบัญชี → เด้งกลับมาเห็นรายการงาน (ว่าง) + ปุ่มออกจากระบบมุมขวาบน

⚠️ **error ที่เจอบ่อย:**
- `redirect_uri_mismatch` → URI ใน Google ไม่ตรง ต้องเป็น `https://<ref>.supabase.co/auth/v1/callback` เป๊ะ ๆ
- ล็อกอินแล้วเด้งไปหน้าเปล่า/ไม่กลับ → ยังไม่ได้ใส่ localhost ใน **Redirect URLs** ของ Supabase (ข้อ 6)
- `Access blocked` → อีเมลไม่ได้อยู่ใน Test users (ข้อ 2) หรือยังไม่ publish

---

## E. Deploy Edge Function (ตัวส่ง push)

### E-1. ติดตั้ง Supabase CLI (ครั้งเดียว)
```bash
# macOS
brew install supabase/tap/supabase
# ตรวจว่าติดตั้งแล้ว
supabase --version
```

### E-2. เชื่อมโปรเจกต์
```bash
cd "/Users/tentthapanaphong/Desktop/ocean drinking water.webapp"
supabase login          # เปิดเบราว์เซอร์ให้กด Authorize
supabase link --project-ref <ref>    # ใส่ database password จากข้อ A
```

### E-3. ตั้งค่าลับ (VAPID)
```bash
supabase secrets set VAPID_PUBLIC_KEY="BOSSfQFvLRrtb9nRI64lYT4c3_dxcPLymYAAbDtiJ2oNrmz2R5Fg87W_Qi88goO0WUX2GDr6a_gX3vYhJiX_BbA"
supabase secrets set VAPID_PRIVATE_KEY="<ค่า private key ที่ Claude สร้างให้ในแชท>"
supabase secrets set VAPID_SUBJECT="mailto:tent25670@gmail.com"
```

### E-4. Deploy
```bash
supabase functions deploy send-reminders --no-verify-jwt
```

✅ **ตรวจสอบ:** ทดสอบเรียกฟังก์ชันดู (ควรตอบ JSON `{"ok":true,...}`)
```bash
curl -i -X POST "https://<ref>.supabase.co/functions/v1/send-reminders" \
  -H "Authorization: Bearer <anon key>"
```

⚠️ ถ้าได้ 401 → ใส่ header `Authorization: Bearer <anon key>` ให้ถูก
⚠️ ถ้า error VAPID → ตรวจว่า set secrets ครบ 3 ตัว (`supabase secrets list`)

---

## F. ตั้ง cron ให้เช็คเวลาทุกนาที

1. Supabase → **Database** → **Extensions** → ค้น `pg_cron` เปิด, ค้น `pg_net` เปิด
2. **SQL Editor** → New query → วาง (แก้ `<ref>` และ `<anon key>`):
   ```sql
   select cron.schedule(
     'murmur-send-reminders',
     '* * * * *',
     $$
     select net.http_post(
       url     := 'https://<ref>.supabase.co/functions/v1/send-reminders',
       headers := jsonb_build_object(
         'Content-Type','application/json',
         'Authorization','Bearer <anon key>'
       )
     );
     $$
   );
   ```
3. Run

✅ **ตรวจสอบ (ทดสอบ push จริง):**
   1. เปิดแอป (login แล้ว) → กด **"เปิดการแจ้งเตือน"** → อนุญาต
   2. เพิ่มงานที่เวลา **อีก 1–2 นาที** เช่น พิมพ์ `ทดสอบ อีก 1 นาที`
   3. รอถึงเวลา → ควรเด้งแจ้งเตือน "ทดสอบ"

- ดูงานที่นัดไว้: `select * from cron.job;`
- ยกเลิก cron: `select cron.unschedule('murmur-send-reminders');`

⚠️ push ไม่มา:
- ยังไม่กด "เปิดการแจ้งเตือน" (ไม่มี subscription) → เช็ค `select count(*) from murmur_push_subscriptions;`
- งานไม่มีเวลา (`ts` เป็น null) จะไม่เตือน
- iOS ต้อง **Add to Home Screen** ก่อน (ดูข้อ G)

---

## G. Deploy ขึ้น Cloudflare + ใช้บน iPhone

1. เอาไฟล์เหล่านี้ขึ้น root ของเว็บ (HTTPS): `Murmur.dc.html`, `support.js`, `sw.js`, `manifest.webmanifest`, โฟลเดอร์ `_ds/`, `assets/`
   - โปรเจกต์นี้ deploy Cloudflare อยู่แล้ว (มี `wrangler.toml`) — push ไฟล์ตามปกติ
2. กลับไป **เพิ่มโดเมนจริง** ใน 2 ที่:
   - Google Cloud → Credentials (ถ้าเปลี่ยน redirect) — ปกติ redirect ชี้ Supabase อยู่แล้ว ไม่ต้องแก้
   - Supabase → Authentication → URL Configuration → เพิ่ม `https://โดเมนจริง` และ `https://โดเมนจริง/Murmur.dc.html` ใน Site URL + Redirect URLs
3. **บน iPhone (Safari):** เปิดเว็บ → ปุ่มแชร์ → **Add to Home Screen** → เปิดจากไอคอนบนจอโฮม → กด "เปิดการแจ้งเตือน"
   - iOS รับ push ได้เฉพาะเมื่อเปิดจากไอคอนที่ Add to Home Screen แล้วเท่านั้น (iOS 16.4+)

✅ **เสร็จสมบูรณ์:** login Google + เก็บงาน cloud + เตือนแม้ปิดแอป ครบทุกเครื่อง

---

## สรุปลำดับสั้น ๆ
A สร้าง project → B รัน SQL → C ใส่ config → D เปิด Google login → E deploy function → F ตั้ง cron → G deploy + iPhone

ติดตรงไหน ส่ง error หรือ screenshot มาได้เลยครับ
