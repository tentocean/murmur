// Murmur — send-reminders Edge Function
// Deploy:  supabase functions deploy send-reminders --no-verify-jwt --project-ref <PROJECT_REF>
// Secrets: supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@example.com
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.)
//
// Called every minute by pg_cron (see murmur_schema.sql). It finds tasks whose
// reminder time has passed and pushes them to that user's devices, once.

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

Deno.serve(async () => {
  const nowIso = new Date().toISOString();

  const { data: due, error } = await supabase
    .from("murmur_tasks")
    .select("id,user_id,title,ts")
    .eq("done", false)
    .is("notified_at", null)
    .not("ts", "is", null)
    .lte("ts", nowIso)
    .limit(200);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  let sent = 0;
  for (const t of due ?? []) {
    const { data: subs } = await supabase
      .from("murmur_push_subscriptions")
      .select("id,endpoint,p256dh,auth")
      .eq("user_id", t.user_id);

    const payload = JSON.stringify({
      title: t.title,
      body: "ถึงเวลาแล้ว",
      url: "/Murmur.dc.html",
      tag: "task-" + t.id,
      taskId: t.id,
    });

    for (const s of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
        sent++;
      } catch (e) {
        // 404/410 = subscription expired → clean it up
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          await supabase.from("murmur_push_subscriptions").delete().eq("id", s.id);
        }
      }
    }

    await supabase.from("murmur_tasks").update({ notified_at: nowIso }).eq("id", t.id);
  }

  return new Response(JSON.stringify({ ok: true, tasks: (due ?? []).length, pushes: sent }), {
    headers: { "Content-Type": "application/json" },
  });
});
