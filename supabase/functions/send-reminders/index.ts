import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { sendEmail } from "../_shared/resend.ts";
import { bookingReminderEmail } from "../_shared/email-templates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Window: bookings starting between 23h and 25h from now. The 2-hour
    // width means as long as this runs at least once every ~2 hours, every
    // booking gets exactly one reminder — reminder_sent guards against
    // duplicates if it runs more often than that.
    const now = Date.now();
    const windowStart = new Date(now + 23 * 60 * 60 * 1000).toISOString();
    const windowEnd = new Date(now + 25 * 60 * 60 * 1000).toISOString();

    const { data: bookings, error } = await supabase
      .from("booking_admin_view")
      .select("*")
      .eq("status", "confirmed")
      .eq("reminder_sent", false)
      .gte("starts_at", windowStart)
      .lte("starts_at", windowEnd);

    if (error) throw error;

    let sent = 0;
    for (const booking of bookings || []) {
      if (booking.customer_email) {
        try {
          const { subject, html } = bookingReminderEmail(booking);
          await sendEmail(booking.customer_email, subject, html);
          sent++;
        } catch (emailErr) {
          console.error(`[send-reminders] failed for ${booking.reference}:`, emailErr);
        }
      }
      // Mark as handled regardless of send outcome so a persistent Resend
      // issue doesn't retry-spam the same booking forever; failures are
      // visible in the function logs for manual follow-up.
      await supabase.from("bookings").update({ reminder_sent: true }).eq("id", booking.id);
    }

    return new Response(
      JSON.stringify({ checked: (bookings || []).length, sent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
