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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // is_admin() checks auth.uid() internally — calling it through the
    // service-role client above carries no user JWT, so auth.uid() would
    // resolve to nothing and this always failed for real admins too. Use a
    // client that actually carries this user's token instead.
    const supabaseAsUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: isAdmin } = await supabaseAsUser.rpc("is_admin");
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Forbidden — admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY not configured");
    }
    const stripe = new Stripe(stripeKey, {
      apiVersion: "2024-12-18.acacia" as Stripe.LatestApiVersion,
    });

    const body = await req.json();
    const { booking_id } = body;
    if (!booking_id) {
      return new Response(
        JSON.stringify({ error: "booking_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: booking, error: bError } = await supabase
      .from("bookings")
      .select("id, reference, stripe_session_id, amount_paid_eur, payment_status")
      .eq("id", booking_id)
      .maybeSingle();

    if (bError || !booking) {
      return new Response(
        JSON.stringify({ error: "Booking not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!booking.stripe_session_id) {
      return new Response(
        JSON.stringify({ error: "No Stripe session for this booking" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (booking.payment_status === "refunded") {
      return new Response(
        JSON.stringify({ error: "Already refunded" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const session = await stripe.checkout.sessions.retrieve(booking.stripe_session_id);
    if (!session.payment_intent) {
      return new Response(
        JSON.stringify({ error: "No payment intent found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const refund = await stripe.refunds.create({
      payment_intent: session.payment_intent as string,
      reason: "requested_by_customer",
    });

    const { error: updateErr } = await supabase
      .from("bookings")
      .update({ payment_status: "refunded" })
      .eq("id", booking_id);

    if (updateErr) {
      // The Stripe refund already succeeded at this point — surface this
      // clearly rather than letting it look like the whole refund failed.
      console.error("[refund] Stripe refund succeeded but DB update failed:", updateErr);
      return new Response(
        JSON.stringify({
          error: `Refund processed in Stripe (${refund.id}) but failed to update booking status: ${updateErr.message}`,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    try {
      const { error: paymentsErr } = await supabase
        .from("payments")
        .insert({
          booking_id: booking_id,
          stripe_session_id: booking.stripe_session_id,
          stripe_payment_id: refund.id,
          amount_eur: -booking.amount_paid_eur,
          type: "refund",
          status: "completed",
        });
      if (paymentsErr) {
        console.error("[refund] payments audit log insert failed (non-fatal):", paymentsErr);
      }
    } catch (auditErr) {
      console.error("[refund] payments audit log insert threw (non-fatal):", auditErr);
    }

    return new Response(
      JSON.stringify({ success: true, refund_id: refund.id }),
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
