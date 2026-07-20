import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { sendEmail } from "../_shared/resend.ts";
import { bookingConfirmationEmail, generateBookingICS, adminBookingNotificationEmail } from "../_shared/email-templates.ts";

const OFFICE_EMAIL = "office@yellowdog.bg";

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

    const { booking_reference } = await req.json();
    if (!booking_reference) {
      throw new Error("booking_reference is required");
    }

    const { data: booking, error } = await supabase
      .from("booking_admin_view")
      .select("*")
      .eq("reference", booking_reference)
      .maybeSingle();

    if (error || !booking) {
      throw new Error("Booking not found");
    }

    // Only ever send for bookings that are actually confirmed (no payment
    // owed) — this endpoint is not a way to fake-confirm a pending one.
    if (booking.status !== "confirmed" && booking.status !== "completed") {
      return new Response(
        JSON.stringify({ skipped: true, reason: "booking not confirmed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const icsContent = generateBookingICS(booking);
    const icsAttachment = [{ filename: "fotosesiya.ics", content: btoa(unescape(encodeURIComponent(icsContent))) }];

    if (booking.customer_email) {
      const { subject, html } = bookingConfirmationEmail(booking);
      await sendEmail(booking.customer_email, subject, html, icsAttachment);
    }
    const { subject: officeSubject, html: officeHtml } = adminBookingNotificationEmail(booking);
    await sendEmail(OFFICE_EMAIL, officeSubject, officeHtml, icsAttachment);

    return new Response(
      JSON.stringify({ sent: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    // Email delivery is best-effort — never surface this as a hard error to
    // the client, since the booking itself already succeeded.
    console.error("[send-confirmation-email]", message);
    return new Response(
      JSON.stringify({ sent: false, error: message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
