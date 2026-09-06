import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Setting = {
  user_id: string;
  reminder_enabled: boolean;
  email_reminders_enabled: boolean;
  reminder_time: string;
  timezone: string;
  skip_weekends: boolean;
  last_reminder_sent_on: string | null;
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const resendApiKey = Deno.env.get("RESEND_API_KEY");
const fromEmail = Deno.env.get("REMINDER_FROM_EMAIL") ?? "Daily Desk <reminders@example.com>";
const cronSecret = Deno.env.get("REMINDER_CRON_SECRET");

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function localNow(timezone: string): { date: string; time: string; day: number } {
  const now = new Date();
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      weekday: "short",
    }).formatToParts(now);
  } catch {
    // A stale/invalid IANA timezone should not stop reminders for every user.
    parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short",
    }).formatToParts(now);
  }
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const weekday = get("weekday");
  const day = ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as Record<string, number>)[weekday] ?? 0;
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}`, day };
}

function due(setting: Setting, current: ReturnType<typeof localNow>) {
  if (!setting.reminder_enabled || !setting.email_reminders_enabled) return false;
  if (setting.skip_weekends && (current.day === 0 || current.day === 6)) return false;
  if (setting.last_reminder_sent_on === current.date) return false;
  // Run the scheduled function every few minutes; send once at or after the configured time.
  return current.time >= setting.reminder_time.slice(0, 5);
}

async function sendEmail(to: string, date: string) {
  if (!resendApiKey) return { sent: false, reason: "RESEND_API_KEY is not configured" };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: fromEmail,
      to: [to],
      subject: "别忘了填写今天的工作记录",
      html: `<p>你好，今天（${date}）还没有工作记录。</p><p>打开每日工作台，花几分钟记录今天的进展吧。</p>`,
    }),
  });
  if (!response.ok) throw new Error(`Resend returned ${response.status}: ${await response.text()}`);
  return { sent: true };
}

Deno.serve(async (request) => {
  if (request.method !== "POST" && request.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }
  if (cronSecret && request.headers.get("x-cron-secret") !== cronSecret) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data, error } = await admin
    .from("user_settings")
    .select("user_id, reminder_enabled, email_reminders_enabled, reminder_time, timezone, skip_weekends, last_reminder_sent_on")
    .eq("reminder_enabled", true)
    .eq("email_reminders_enabled", true);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const results: Array<Record<string, unknown>> = [];
  for (const setting of (data ?? []) as Setting[]) {
    const current = localNow(setting.timezone);
    if (!due(setting, current)) continue;

    const { data: entry, error: entryError } = await admin
      .from("daily_entries")
      .select("id")
      .eq("user_id", setting.user_id)
      .eq("date", current.date)
      .is("deleted_at", null)
      .maybeSingle();
    if (entryError) {
      results.push({ user_id: setting.user_id, date: current.date, error: entryError.message });
      continue;
    }
    if (entry) continue;

    const user = await admin.auth.admin.getUserById(setting.user_id);
    const email = user.data.user?.email;
    if (!email) {
      results.push({ user_id: setting.user_id, date: current.date, skipped: "user has no email" });
      continue;
    }
    try {
      const delivery = await sendEmail(email, current.date);
      if (delivery.sent) {
        await admin.from("user_settings").update({ last_reminder_sent_on: current.date }).eq("user_id", setting.user_id);
      }
      results.push({ user_id: setting.user_id, date: current.date, ...delivery });
    } catch (sendError) {
      results.push({ user_id: setting.user_id, date: current.date, error: String(sendError) });
    }
  }

  return Response.json({ processed: results.length, results });
});
