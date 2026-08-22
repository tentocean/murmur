# Murmur — Setup (login + web push)

ไฟล์ที่ผมสร้างไว้ให้แล้ว:

| ไฟล์ | หน้าที่ |
|---|---|
| `Murmur.dc.html` | ตัวแอป (จะต่อ login + push + เก็บงานลง Supabase ในขั้นถัดไป) |
| `sw.js` | Service Worker รับ push + จัดการปุ่มในตัวแจ้งเตือน |
| `manifest.webmanifest` | ทำให้ Add to Home Screen เปิดเต็มจอเหมือนแอป |
| `supabase/murmur_schema.sql` | ตาราง `murmur_tasks`, `murmur_push_subscriptions` + RLS |
| `supabase/functions/send-reminders/index.ts` | Edge Function ส่ง push ตามเวลาเตือน |

VAPID keys (สร้างแล้ว):
- **PUBLIC**  `BOSSfQFvLRrtb9nRI64lYT4c3_dxcPLymYAAbDtiJ2oNrmz2R5Fg87W_Qi88goO0WUX2GDr6a_gX3vYhJiX_BbA`
- **PRIVATE** = ค่าที่ Claude แสดงในแชท (เก็บเป็นความลับ อย่าใส่ใน git — ใช้ตอนตั้ง secret ขั้นที่ 4)

---

## ✅ Checklist (สิ่งที่คุณต้องทำเอง)

### 1) สร้าง Supabase project ใหม่
- ไปที่ supabase.com → New project (เลือก region ใกล้ไทย เช่น Singapore)
- คัดลอกไว้: **Project URL** และ **anon public key** (Settings → API)
- 👉 เปิด `Murmur.dc.html` แล้ววาง 2 ค่านี้ในบล็อก `window.MURMUR_CONFIG` (บนสุดของไฟล์)
  ```js
  SUPABASE_URL: "https://xxxx.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGci...",   // anon key เปิดเผยได้ ปลอดภัย
  ```
  พอใส่ครบ แอปจะเปลี่ยนจากโหมดเดโม่ → **cloud mode** (login Google + เก็บงาน + push) อัตโนมัติ

### 2) สร้างตาราง
- Supabase → SQL Editor → วางเนื้อหา `supabase/murmur_schema.sql` → Run

### 3) เปิด Google Login
1. Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID (Web application)
2. Authorized redirect URI ใส่:
   `https://<PROJECT_REF>.supabase.co/auth/v1/callback`
3. ได้ **Client ID** + **Client Secret**
4. Supabase → Authentication → Providers → Google → เปิด แล้ววาง Client ID/Secret
5. Authentication → URL Configuration → เพิ่ม Site URL และ Redirect URLs:
   - `http://localhost:8123` (ทดสอบ)
   - โดเมน Cloudflare จริงตอน deploy

### 4) Deploy Edge Function + ตั้ง secret
```bash
# ติดตั้ง supabase CLI ครั้งเดียว: https://supabase.com/docs/guides/cli
supabase login
supabase link --project-ref <PROJECT_REF>
supabase secrets set VAPID_PUBLIC_KEY="BOSSfQFvLRrtb9nRI64lYT4c3_dxcPLymYAAbDtiJ2oNrmz2R5Fg87W_Qi88goO0WUX2GDr6a_gX3vYhJiX_BbA"
supabase secrets set VAPID_PRIVATE_KEY="<ค่า private key จาก Claude>"
supabase secrets set VAPID_SUBJECT="mailto:you@example.com"
supabase functions deploy send-reminders --no-verify-jwt
```

### 5) นัด cron ให้เช็คทุกนาที
- Dashboard → Database → Extensions → เปิด `pg_cron` และ `pg_net`
- SQL Editor → รันบล็อก `cron.schedule(...)` ท้ายไฟล์ `murmur_schema.sql` (แก้ `<PROJECT_REF>` และ key)

### 6) Deploy ตัวเว็บขึ้น Cloudflare
- `sw.js`, `manifest.webmanifest`, `Murmur.dc.html`, `assets/` ต้องอยู่ที่ root ของโดเมน (HTTPS)
- Web Push ใช้ได้เฉพาะ **HTTPS** (ยกเว้น `localhost` ที่ทดสอบได้)

---

## ข้อควรรู้
- **iOS:** ต้อง "Add to Home Screen" ก่อน ถึงจะรับ push ได้ (iOS 16.4+)
- `sw.js` **ไม่มี fetch handler** จึงไม่กระทบแอป OCEAN แม้ scope จะเป็น `/`
- **client ต่อเสร็จหมดแล้ว** (login Google, เก็บงานลง Supabase, ขอสิทธิ์ + subscribe push, ปุ่มออกจากระบบ, แบนเนอร์เปิดแจ้งเตือน) — เหลือแค่คุณใส่ config + ทำ checklist ข้อ 2–6
