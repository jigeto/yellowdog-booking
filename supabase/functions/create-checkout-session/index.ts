import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import Stripe from "npm:stripe@17.3.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
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

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY not configured");
    }
    const stripe = new Stripe(stripeKey, {
      apiVersion: "2024-12-18.acacia" as Stripe.LatestApiVersion,
    });

    const body = await req.json();
    const origin = req.headers.get("origin") || "http://localhost:5173";

    // Booking checkout
    if (body.booking_reference) {
      const { data: booking, error } = await supabase
        .from("bookings")
        .select("*, packages(name_bg, price_eur)")
        .eq("reference", body.booking_reference)
        .maybeSingle();

      if (error || !booking) {
        throw new Error("Booking not found");
      }

      const remainingTotal = (booking.total_eur ?? 0) - (booking.amount_paid_eur ?? 0);
      const mode = body.mode || booking.payment_mode;
      const isFull = mode === "full";
      const isVoucherUpgrade = mode === "voucher_upgrade";

      let amountDue = isFull ? remainingTotal : Math.min(booking.deposit_eur ?? 0, remainingTotal);

      if (isVoucherUpgrade) {
        if (!booking.voucher_id) {
          throw new Error("voucher_upgrade booking has no linked voucher");
        }
        const { data: voucher } = await supabase
          .from("vouchers")
          .select("amount_eur")
          .eq("id", booking.voucher_id)
          .maybeSingle();
        amountDue = remainingTotal - (voucher?.amount_eur ?? 0);
      }

      // Full upfront payment gets the configurable prepay discount (same
      // setting the frontend reads to show the discounted price). Only
      // applies when paying everything upfront in one go (amount_paid_eur
      // is 0 at that point) — the remaining balance after a deposit is
      // always settled in person at the studio, never online.
      if (isFull && (booking.amount_paid_eur ?? 0) === 0) {
        const { data: settingRow } = await supabase
          .from("settings")
          .select("value")
          .eq("key", "prepay_discount_pct")
          .maybeSingle();
        const discountPct = parseFloat(settingRow?.value || "5");
        amountDue = remainingTotal * (1 - discountPct / 100);
      }

      if (amountDue <= 0) {
        return new Response(
          JSON.stringify({ error: "No payment required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const packageName = booking.packages?.name_bg || "фотосесия";
      const label = isVoucherUpgrade
        ? `Доплащане на разлика — фотосесия ${packageName}`
        : isFull
        ? `Фотосесия ${packageName} — пълно плащане`
        : `Капаро за фотосесия ${packageName}`;

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "eur",
              product_data: { name: label },
              unit_amount: Math.round(amountDue * 100),
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${origin}/booking/${booking.reference}/confirmation`,
        cancel_url: `${origin}/?cancelled=1`,
        metadata: {
          type: "booking",
          booking_reference: booking.reference,
          booking_id: booking.id,
          mode: isVoucherUpgrade ? "voucher_upgrade" : isFull ? "full" : "deposit",
        },
        client_reference_id: booking.reference,
      });

      const { error: updateErr } = await supabase
        .from("bookings")
        .update({ stripe_session_id: session.id })
        .eq("id", booking.id);
      if (updateErr) {
        console.error(`[create-checkout-session] failed to store stripe_session_id for ${booking.reference}:`, updateErr);
      }

      return new Response(
        JSON.stringify({ url: session.url, session_id: session.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Voucher checkout
    if (body.voucher) {
      const v = body.voucher;
      if (!v.package_slug) {
        throw new Error("package_slug is required");
      }
      if (!v.purchaser?.name || !v.purchaser?.email) {
        throw new Error("Purchaser name and email required");
      }

      const { data: pkg, error: pkgError } = await supabase
        .from("packages")
        .select("id, slug, name_bg, price_eur")
        .eq("slug", v.package_slug)
        .eq("active", true)
        .maybeSingle();

      if (pkgError || !pkg) {
        throw new Error("Invalid package");
      }

      const codeChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid confusion
      let codeSuffix = "";
      for (let i = 0; i < 6; i++) {
        codeSuffix += codeChars[Math.floor(Math.random() * codeChars.length)];
      }
      const code = "YD-" + codeSuffix;
      const validMonths = 6;
      const validUntilDate = new Date();
      validUntilDate.setMonth(validUntilDate.getMonth() + validMonths);
      const validUntil = validUntilDate.toISOString().slice(0, 10);

      const { data: voucher, error: vError } = await supabase
        .from("vouchers")
        .insert({
          code,
          type: "gift_package",
          package_id: pkg.id,
          amount_eur: pkg.price_eur,
          purchaser_name: v.purchaser.name,
          purchaser_email: v.purchaser.email,
          recipient_name: v.recipient?.name || null,
          recipient_email: v.recipient?.email || null,
          message: v.message || null,
          status: "pending_payment",
          source: "purchase",
          valid_until: validUntil,
        })
        .select()
        .maybeSingle();

      if (vError || !voucher) {
        throw new Error("Failed to create voucher: " + (vError?.message || "unknown"));
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "eur",
              product_data: { name: `Подаръчен ваучер — пакет ${pkg.name_bg}` },
              unit_amount: Math.round(pkg.price_eur * 100),
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${origin}/voucher/thank-you`,
        cancel_url: `${origin}/voucher?cancelled=1`,
        metadata: {
          type: "voucher",
          voucher_id: voucher.id,
          voucher_code: code,
        },
        client_reference_id: voucher.id,
      });

      await supabase
        .from("vouchers")
        .update({ stripe_session_id: session.id })
        .eq("id", voucher.id);

      return new Response(
        JSON.stringify({ url: session.url, session_id: session.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error("Invalid request: provide booking_reference or voucher");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
