import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import Stripe from "npm:stripe@17.3.1";
import { sendEmail } from "../_shared/resend.ts";
import { bookingConfirmationEmail, voucherConfirmationEmail, generateBookingICS, adminBookingNotificationEmail } from "../_shared/email-templates.ts";
import { generateVoucherPDF } from "../_shared/voucher-pdf.ts";

const OFFICE_EMAIL = "office@yellowdog.bg";

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
            const { data: isFirst, error: confirmErr } = await supabase.rpc("confirm_booking_payment", {
              p_reference: reference,
              p_stripe_session_id: session.id,
              p_stripe_payment_id: session.payment_intent as string,
              p_amount_paid: amountPaid,
              p_mode: session.metadata?.mode || null,
            });

            if (confirmErr) {
              console.error(`[stripe-webhook] confirm_booking_payment failed for ${reference}:`, confirmErr);
            }

            if (isFirst) {
              try {
                const { data: booking } = await supabase
                  .from("booking_admin_view")
                  .select("*")
                  .eq("reference", reference)
                  .maybeSingle();
                if (booking?.customer_email) {
                  const { subject, html } = bookingConfirmationEmail(booking);
                  const icsContent = generateBookingICS(booking);
                  const icsBase64 = btoa(unescape(encodeURIComponent(icsContent)));
                  await sendEmail(booking.customer_email, subject, html, [
                    { filename: "fotosesiya.ics", content: icsBase64 },
                  ]);
                }
                if (booking) {
                  const { subject: officeSubject, html: officeHtml } = adminBookingNotificationEmail(booking);
                  await sendEmail(OFFICE_EMAIL, officeSubject, officeHtml);
                }
              } catch (emailErr) {
                console.error("[stripe-webhook] booking confirmation email failed:", emailErr);
              }
            }
          }
        } else if (type === "voucher") {
          const voucherId = session.metadata?.voucher_id;
          if (voucherId) {
            const amountPaid = (session.amount_total || 0) / 100;
            const { data: isFirst, error: confirmErr } = await supabase.rpc("confirm_voucher_payment", {
              p_voucher_id: voucherId,
              p_stripe_session_id: session.id,
              p_stripe_payment_id: session.payment_intent as string,
              p_amount_paid: amountPaid,
            });

            if (confirmErr) {
              console.error(`[stripe-webhook] confirm_voucher_payment failed for ${voucherId}:`, confirmErr);
            }

            if (isFirst) {
              try {
                const { data: voucher } = await supabase
                  .from("voucher_admin_view")
                  .select("*")
                  .eq("id", voucherId)
                  .maybeSingle();

                if (voucher) {
                  const recipients = Array.from(
                    new Set([voucher.purchaser_email, voucher.recipient_email].filter(Boolean))
                  ) as string[];

                  let attachments: { filename: string; content: string }[] | undefined;
                  try {
                    const pdfBytes = await generateVoucherPDF(voucher);
                    let binary = "";
                    const chunkSize = 8192;
                    for (let i = 0; i < pdfBytes.length; i += chunkSize) {
                      binary += String.fromCharCode(...pdfBytes.subarray(i, i + chunkSize));
                    }
                    attachments = [{ filename: `vaucher-${voucher.code}.pdf`, content: btoa(binary) }];
                  } catch (pdfErr) {
                    console.error("[stripe-webhook] voucher PDF generation failed:", pdfErr);
                  }

                  for (const email of recipients) {
                    const audience = email === voucher.purchaser_email ? "purchaser" : "recipient";
                    const { subject, html } = voucherConfirmationEmail(voucher, audience);
                    await sendEmail(email, subject, html, attachments);
                  }
                }
              } catch (emailErr) {
                console.error("[stripe-webhook] voucher confirmation email failed:", emailErr);
              }
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
            .update({ payment_status: "refunded" })
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
