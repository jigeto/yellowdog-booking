import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import Stripe from "npm:stripe@17.3.1";
import { sendEmail } from "../_shared/resend.ts";
import { bookingConfirmationEmail, voucherConfirmationEmail } from "../_shared/email-templates.ts";

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
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!stripeKey || !webhookSecret) {
      throw new Error("Stripe keys not configured");
    }
    const stripe = new Stripe(stripeKey, {
      apiVersion: "2024-12-18.acacia" as Stripe.LatestApiVersion,
    });

    const sig = req.headers.get("stripe-signature");
    if (!sig) {
      throw new Error("No stripe-signature header");
    }

    const rawBody = await req.text();
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(rawBody, sig, webhookSecret);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return new Response(
        JSON.stringify({ error: `Webhook signature verification failed: ${message}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const type = session.metadata?.type;

        if (type === "booking") {
          const reference = session.metadata?.booking_reference;
          if (reference) {
            const amountPaid = (session.amount_total || 0) / 100;
            await supabase.rpc("confirm_booking_payment", {
              p_reference: reference,
              p_stripe_session_id: session.id,
              p_stripe_payment_id: session.payment_intent as string,
              p_amount_paid: amountPaid,
            });

            try {
              const { data: booking } = await supabase
                .from("booking_admin_view")
                .select("*")
                .eq("reference", reference)
                .maybeSingle();
              if (booking?.customer_email) {
                const { subject, html } = bookingConfirmationEmail(booking);
                await sendEmail(booking.customer_email, subject, html);
              }
            } catch (emailErr) {
              console.error("[stripe-webhook] booking confirmation email failed:", emailErr);
            }
          }
        } else if (type === "voucher") {
          const voucherId = session.metadata?.voucher_id;
          if (voucherId) {
            const amountPaid = (session.amount_total || 0) / 100;
            await supabase.rpc("confirm_voucher_payment", {
              p_voucher_id: voucherId,
              p_stripe_session_id: session.id,
              p_stripe_payment_id: session.payment_intent as string,
              p_amount_paid: amountPaid,
            });

            // Belt-and-braces: confirm_voucher_payment predates the
            // pending_payment status, so make sure a successful payment
            // always flips the voucher to active regardless of what that
            // RPC does internally.
            await supabase
              .from("vouchers")
              .update({ status: "active" })
              .eq("id", voucherId)
              .eq("status", "pending_payment");

            try {
              const { data: voucher } = await supabase
                .from("voucher_admin_view")
                .select("*")
                .eq("id", voucherId)
                .maybeSingle();
              const recipientEmail = voucher?.recipient_email || voucher?.purchaser_email;
              if (voucher && recipientEmail) {
                const { subject, html } = voucherConfirmationEmail(voucher);
                await sendEmail(recipientEmail, subject, html);
              }
            } catch (emailErr) {
              console.error("[stripe-webhook] voucher confirmation email failed:", emailErr);
            }
          }
        }
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const sessionId = charge.metadata?.booking_reference;
        if (sessionId) {
          await supabase
            .from("bookings")
            .update({ payment_status: "refunded", updated_at: new Date().toISOString() })
            .eq("reference", sessionId);
        }
        break;
      }
    }

    return new Response(
      JSON.stringify({ received: true }),
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
