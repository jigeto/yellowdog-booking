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

      let amountDue = isFull ? remainingTotal : Math.min(booking.deposit_eur ?? 0, remainingTotal);

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
      const label = isFull
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
          mode: isFull ? "full" : "deposit",
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
        .select("slug, name_bg, price_eur")
        .eq("slug", v.package_slug)
        .eq("active", true)
        .maybeSingle();

      if (pkgError || !pkg) {
        throw new Error("Invalid package");
      }

      const code = "YDS-" + Math.random().toString(36).substring(2, 6).toUpperCase() + "-" + Math.random().toString(36).substring(2, 6).toUpperCase();
      const validMonths = 6;
      const validUntil = new Date(Date.now() + validMonths * 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      const { data: voucher, error: vError } = await supabase
        .from("vouchers")
        .insert({
          code,
          kind: "gift_package",
          package_slug: pkg.slug,
          package_name_bg: pkg.name_bg,
          package_price_eur: pkg.price_eur,
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
