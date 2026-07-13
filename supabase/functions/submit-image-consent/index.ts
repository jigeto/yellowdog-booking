import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const FROM_EMAIL = "Студио Жълто куче <resend@yellowdog.bg>";
const BRAND_INK = "#1A1A17";
const BRAND_YELLOW = "#F5B400";

function wrapper(bodyHtml: string): string {
  return `
<div style="font-family: Georgia, 'Times New Roman', serif; background:#FAF7F0; padding:32px 16px;">
  <div style="max-width:560px; margin:0 auto; background:#ffffff; border-radius:16px; overflow:hidden; border:1px solid #EFE9DC;">
    <div style="background:${BRAND_INK}; padding:20px 28px;">
      <img src="https://yellowdog.bg/wp-content/uploads/2023/02/Logo_Yellow_Dog.png" alt="Студио Жълто куче" height="36" style="display:block;" />
    </div>
    <div style="padding:28px;">
      ${bodyHtml}
    </div>
    <div style="background:#FAF7F0; padding:18px 28px; font-size:12px; color:#8a8a80; font-family: Arial, sans-serif;">
      Студио Жълто куче · бул. „Владимир Вазов“ 90, вх. Б, ет. 2, София<br/>
      office@yellowdog.bg · +359 876 822 686
    </div>
  </div>
</div>`.trim();
}

const CATEGORY_LABELS: Record<string, string> = {
  website: "Уебсайт и портфолио на Студиото",
  social: "Социални мрежи на Студиото",
  contests: "Конкурси и изложби",
  print: "Печатни и електронни материали",
  media: "Медийни, образователни и презентационни формати",
};

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey || !to) return;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
  });
  if (!res.ok) {
    console.error(`[image-consent] Resend API error ${res.status}:`, await res.text());
  }
}

function sofiaDateOnly(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Sofia",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(iso)).reduce((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {} as Record<string, string>);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const {
      booking_reference,
      full_name,
      contact,
      includes_child,
      child_name,
      granted,
      categories,
      other_category,
      signature_png,
    } = body;

    if (!booking_reference || !full_name) {
      throw new Error("booking_reference and full_name are required");
    }
    if (granted && !signature_png) {
      throw new Error("signature_png is required when granted is true");
    }

    // Validate the booking actually exists before recording anything
    // against it — the tablet has no login, so this is the only guard
    // against garbage submissions.
    const { data: booking, error: bookingError } = await supabase
      .from("booking_admin_view")
      .select("id, reference, starts_at, customer_email, customer_name")
      .eq("reference", booking_reference)
      .maybeSingle();

    if (bookingError || !booking) {
      throw new Error("Booking not found");
    }

    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("cf-connecting-ip") ||
      null;

    const { error: insertError } = await supabase.from("image_consents").insert({
      booking_id: booking.id,
      full_name,
      contact: contact || null,
      includes_child: !!includes_child,
      child_name: includes_child ? child_name || null : null,
      session_date: booking.starts_at ? sofiaDateOnly(booking.starts_at) : null,
      granted: !!granted,
      categories: granted ? categories || [] : null,
      other_category: other_category || null,
      signature_png: granted ? signature_png : null,
      ip_address: ipAddress,
    });

    if (insertError) {
      console.error("[image-consent] insert failed:", insertError);
      throw new Error("Failed to save consent");
    }

    // Best-effort email copy to the client — never blocks the response.
    const emailTo = contact && contact.includes("@") ? contact : booking.customer_email;
    if (emailTo) {
      const categoryList = (categories || [])
        .map((c: string) => CATEGORY_LABELS[c] || c)
        .concat(other_category ? [other_category] : []);

      const html = granted
        ? wrapper(`
            <h1 style="font-size:20px; color:${BRAND_INK}; margin:0 0 16px;">Съгласие за ползване на изображения — потвърдено</h1>
            <p style="color:#555;">Здравейте, ${full_name} — потвърждаваме, че на ${new Date().toLocaleDateString("bg-BG")} дадохте съгласие Студио „Жълто куче“ да ползва избрани изображения за:</p>
            <ul style="color:#555;">${categoryList.map((c: string) => `<li>${c}</li>`).join("")}</ul>
            <p style="color:#555; line-height:1.6;">Можете да оттеглите съгласието си по всяко време с писмено уведомление на office@yellowdog.bg — вижте т. 11.8 от Общите условия.</p>
          `)
        : wrapper(`
            <h1 style="font-size:20px; color:${BRAND_INK}; margin:0 0 16px;">Вашето предпочитание е записано</h1>
            <p style="color:#555;">Здравейте, ${full_name} — потвърждаваме, че сте избрали да НЕ давате съгласие за маркетингова употреба на изображения от фотосесията си. Това по никакъв начин не се отразява на резервацията или цената ѝ.</p>
          `);

      await sendEmail(emailTo, "Съгласие за ползване на изображения — Студио Жълто куче", html);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[image-consent]", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
