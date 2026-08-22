# Murmur — Handoff

แอปจดสิ่งที่ต้องทำ/เตือน แบบสั่งด้วยเสียง (voice-first to-do & reminders)
โปรเจกต์อิสระ แยกขาดจากแอป OCEAN (คนละโฟลเดอร์ / repo / Supabase / โดเมน)

- **Live:** https://murmur.tent25670.workers.dev  (แอปจริงอยู่ที่ `/Murmur.dc`)
- **Repo:** https://github.com/tentocean/murmur
- **โฟลเดอร์:** `~/Desktop/murmur-app`

---

## 1. ภาพรวม / ฟีเจอร์

- เพิ่มงานด้วย **เสียง** (Web Speech API, ภาษาไทย) หรือ **พิมพ์**
- **อ่านวัน-เวลาจากประโยค** ทั้งไทย/อังกฤษ ("พรุ่งนี้บ่าย 3 โมง", "in 2 hours")
- **ช่องเลือกวัน-เวลา** (datetime picker) ตอนพิมพ์ — ถ้าเลือกจะ override การอ่านจากข้อความ
- จัดกลุ่ม **Today / Upcoming / Done** + วงแหวนความคืบหน้า
- **ปฏิทินรายเดือน** ใน Upcoming — จุดบอกวันมีงาน + เลื่อนเดือน (‹ › + Today)
- **เพิ่ม / เช็คเสร็จ / แก้ไข / ลบ** งาน
- **Login ด้วย Google** (Supabase Auth) + เก็บงานบน cloud (sync ข้ามอุปกรณ์)
- **Web Push เตือนตามเวลา** แม้ปิดแอป (Service Worker + Edge Function + cron)
- **PWA เต็มจอบน iOS** (Add to Home Screen)

---

## 2. เทคโนโลยี / สถาปัตยกรรม

- **Frontend:** ไฟล์เดียว `Murmur.dc.html` — เป็น "Design Component" รันบน **DC runtime** (`support.js`)
  ซึ่งเป็น React-based interpreter ใช้แท็ก `<x-dc>`, `<helmet>`, `<sc-if>`, `<sc-for>`,
  binding `{{ }}` และคลาส `class Component extends DCLogic` ที่มีเมธอด `renderVals()`
  คืน object ให้ template ใช้ (ไม่มี build step)
- **Backend:** Supabase (Postgres + Auth + Edge Functions)
- **Push:** Web Push (VAPID) ผ่าน Service Worker + Supabase Edge Function ยิงด้วย pg_cron
- **Hosting:** Cloudflare Workers (static assets, `wrangler.toml` → `[assets] directory = "./"`)

### โหมดการทำงาน (สำคัญ)
โค้ดอ่าน `window.MURMUR_CONFIG` (บนสุดของ `Murmur.dc.html`):
- ถ้ามี `SUPABASE_URL` + `SUPABASE_ANON_KEY` → **cloud mode** (login + เก็บ cloud + push)
- ถ้าเว้นว่าง → **demo mode** (งานตัวอย่างในหน่วยความจำ ไม่ต้อง login) — มีไว้ทดสอบ UI

---

## 3. โครงไฟล์

```
murmur-app/
  index.html              redirect → ./Murmur.dc.html
  Murmur.dc.html          ★ ตัวแอปทั้งหมด (markup + logic)
  support.js              DC runtime (คัดลอกมาจาก OCEAN — อย่าแก้)
  sw.js                   Service Worker (push + คลิกแจ้งเตือน; ไม่มี fetch handler)
  manifest.webmanifest    PWA manifest (ชี้ icon.png)
  icon.png                ไอคอนแอป 512×512 (favicon / home screen / push)
  assets/logo.png         (ไอคอนเก่า — เลิกใช้แล้ว)
  _ds/organic-.../        styles.css (design tokens) + _ds_bundle.js (ว่าง)
  wrangler.toml           ตั้งค่า deploy Cloudflare
  .assetsignore           ไฟล์ที่ไม่ต้อง serve (docs, supabase, ฯลฯ)
  supabase/
    murmur_schema.sql     ตาราง + RLS (รันครั้งเดียวใน SQL Editor)
    functions/send-reminders/index.ts   Edge Function ส่ง push
  MURMUR_GUIDE.md         คู่มือติดตั้งละเอียด (ไม่ serve)
  MURMUR_SETUP.md         เช็คลิสต์สั้น (ไม่ serve)
  HANDOFF.md              ไฟล์นี้
```

---

## 4. ฐานข้อมูล (Supabase)

Project: `Murmur` (ref `qiuktriwvzwvyvykvaxe`) — **แยกจาก OCEAN**

ตาราง (สร้างจาก `supabase/murmur_schema.sql`):
- `murmur_tasks` — `id(uuid) · user_id · title · ts(timestamptz|null) · done · notified_at · created_at`
  - RLS: เห็น/แก้ได้เฉพาะของตัวเอง (`auth.uid() = user_id`)
  - `ts` = เวลาเตือน (null = ไม่มีเวลา) · `notified_at` = ตั้งเมื่อส่ง push แล้ว กันส่งซ้ำ
  - แอปเก็บ `ts` ในหน่วย **epoch ms** ฝั่ง state, แปลงเป็น/จาก ISO ตอนคุย DB
- `murmur_push_subscriptions` — `id · user_id · endpoint(unique) · p256dh · auth · created_at` (RLS ของตัวเอง)

---

## 5. ระบบแจ้งเตือน (Web Push)

```
แอป (กด "เปิดการแจ้งเตือน") → ขอสิทธิ์ + subscribe → เก็บลง murmur_push_subscriptions
                                    │
pg_cron (ทุก 1 นาที) → net.http_post → Edge Function "send-reminders"
                                    │
  หา murmur_tasks ที่ ts <= now, done=false, notified_at=null
  → ส่ง Web Push ไปทุก subscription ของ user → set notified_at
                                    │
  sw.js รับ push event → showNotification (เด้งแม้ปิดแอป)
```

- **VAPID public key** อยู่ใน `MURMUR_CONFIG` (client)
- **VAPID private key / subject** เป็น Supabase **secret** (ตั้งด้วย `supabase secrets set`)
- Edge Function ใช้ `SUPABASE_SERVICE_ROLE_KEY` (inject อัตโนมัติ) เพื่อข้าม RLS
- cron ตั้งไว้แล้ว: `select cron.schedule('murmur-send-reminders','* * * * *', ...)`
  ยกเลิก: `select cron.unschedule('murmur-send-reminders');`

---

## 6. รันในเครื่อง (dev)

```bash
cd ~/Desktop/murmur-app
python3 -m http.server 8125
# เปิด http://localhost:8125/Murmur.dc.html
```
- localhost ถือเป็น secure origin → Service Worker + Web Push + Speech ทำงานได้
- ทดสอบ UI แบบไม่ต้อง login: เว้น `SUPABASE_URL`/`ANON_KEY` ใน config ให้ว่าง = demo mode

---

## 7. Deploy

**ทางเร็ว (แนะนำ):**
```bash
cd ~/Desktop/murmur-app && npx --yes wrangler deploy
```
**ทาง git:** `git push origin main` → Cloudflare auto-deploy (ช้ากว่า/บางครั้งไม่ trigger)

deploy ทั้งสองทางได้ผลเหมือนกัน (อ่าน `wrangler.toml`) — ไม่มี build step

**แก้ Edge Function แล้ว deploy ใหม่:**
```bash
cd ~/Desktop/murmur-app
npx --yes supabase@latest link --project-ref qiuktriwvzwvyvykvaxe
npx --yes supabase@latest functions deploy send-reminders --no-verify-jwt
```

---

## 8. จุดที่ต้องระวัง (gotchas) ⚠️

1. **supabase-js v2 เป็น lazy** — query จะถูกส่งจริงก็ต่อเมื่อ `await` หรือมี `.then()`
   ถ้าเขียน `sb.from().delete().eq()` เฉย ๆ (ไม่ await) **request ไม่ถูกส่ง**
   → ทุกคำสั่งเขียน DB (toggle/edit/delete/snooze) ต้องมี `.then(()=>{}, ()=>{})` ต่อท้าย
   (บั๊กนี้เคยทำให้ลบแล้วงานกลับมา — แก้แล้ว)

2. **Cloudflare ตัด `.html`** — `/Murmur.dc.html` จะ 307 redirect → **`/Murmur.dc`** (canonical)
   path สัมพัทธ์ (`./sw.js`, `manifest.webmanifest`, `_ds/...`) ยัง resolve ถูก

3. **Unicode ภาษาไทย** — ต้อง `.normalize("NFC")` ก่อน parse (มือถือบางเครื่องพิมพ์มาเป็น NFD ทำให้ regex ไทยไม่แมตช์) — จัดการใน `parse()` แล้ว

4. **iOS Web Push** — ใช้ได้เฉพาะเมื่อ **Add to Home Screen** (iOS 16.4+) เท่านั้น

5. **apple-touch-icon โปร่งใส** — iOS อาจใส่พื้นดำหลังไอคอน (icon.png พื้นโปร่ง) ถ้าไม่ชอบให้ทำเวอร์ชันมีพื้นหลัง

6. **`sw.js` ไม่มี fetch handler** — ตั้งใจ เพื่อไม่ให้แคช/กระทบอะไร (scope `/`)

7. Web Speech ตั้ง `lang="th-TH"` — พูดไทยแม่นสุด, พูดอังกฤษล้วนอาจเพี้ยน; ต้องต่อเน็ต + สิทธิ์ไมค์ + HTTPS/localhost

---

## 9. ความลับ / credentials

- **ปลอดภัยที่จะอยู่ใน client:** Supabase URL, anon key, VAPID public key (อยู่ใน `MURMUR_CONFIG`)
- **ห้ามอยู่ใน client / เก็บเป็น secret เท่านั้น:** VAPID private key, Google Client Secret, service_role key, **Database password**
- 🔴 **ค้าง:** ตอน setup รหัส DB เคยหลุดใน Terminal/แชร์รูป — ควร **reset database password** (Supabase → Settings → Database) ยังไม่ได้ทำ ควรทำเพื่อความปลอดภัย (ไม่กระทบระบบ เพราะทุกอย่างใช้ access token/anon key)

---

## 10. งานที่อาจทำต่อ (backlog)

- ปุ่ม "ล้างทั้งหมด" ในแอป (+ popup ยืนยัน)
- ยืนยันก่อนลบ (กันเผลอ)
- แสดงวันที่เป็นภาษาไทย (ตอนนี้ label เป็นอังกฤษ: Today/Tomorrow/Aug 31)
- สลับภาษาเสียง ไทย/อังกฤษ
- แก้เวลาในหน้ายืนยันเสียง (voice confirm sheet)
- custom domain แทน *.workers.dev
