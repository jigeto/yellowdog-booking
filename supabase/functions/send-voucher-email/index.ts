import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { PDFDocument, rgb } from "npm:pdf-lib@1.17.1";
import fontkit from "npm:@pdf-lib/fontkit@1.1.1";
import QRCode from "npm:qrcode@1.5.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const FROM_EMAIL = "Студио Жълто куче <resend@yellowdog.bg>";
const BRAND_YELLOW = "#F5B400";
const BRAND_INK = "#1A1A17";

async function sendEmail(to: string, subject: string, html: string, attachments?: { filename: string; content: string }[]): Promise<void> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey || !to) return;
  const body: Record<string, unknown> = { from: FROM_EMAIL, to: [to], subject, html };
  if (attachments?.length) body.attachments = attachments;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) console.error(`[send-voucher-email] Resend API error ${res.status}:`, await res.text());
}

function wrapper(bodyHtml: string): string {
  return `
<div style="font-family: Georgia, 'Times New Roman', serif; background:#FAF7F0; padding:32px 16px;">
  <div style="max-width:560px; margin:0 auto; background:#ffffff; border-radius:16px; overflow:hidden; border:1px solid #EFE9DC;">
    <div style="background:${BRAND_INK}; padding:20px 28px;">
      <img src="https://yellowdog.bg/wp-content/uploads/2023/02/Logo_Yellow_Dog.png" alt="Студио Жълто куче" height="36" style="display:block;" />
    </div>
    <div style="padding:28px;">${bodyHtml}</div>
    <div style="background:#FAF7F0; padding:18px 28px; font-size:12px; color:#8a8a80; font-family: Arial, sans-serif;">
      Студио Жълто куче · бул. „Владимир Вазов“ 90, вх. Б, ет. 2, София<br/>
      office@yellowdog.bg · +359 876 822 686
    </div>
  </div>
</div>`.trim();
}

const BG_MONTHS = ["януари","февруари","март","април","май","юни","юли","август","септември","октомври","ноември","декември"];
function formatDateBg(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${BG_MONTHS[m - 1]} ${y}`;
}
function eur(n: number | null | undefined): string {
  return `${(n ?? 0).toFixed(2)} €`;
}

function voucherConfirmationEmail(v: Record<string, unknown>, audience: "purchaser" | "recipient"): { subject: string; html: string } {
  const purchaserName = v.purchaser_name as string | null;
  const recipientName = v.recipient_name as string | null;
  const isGift = !!(purchaserName && recipientName && purchaserName !== recipientName);

  let greetingName: string;
  let greetingLine: string;
  if (audience === "purchaser" && isGift) {
    greetingName = purchaserName!;
    greetingLine = `вие подарихте ваучер на ${recipientName}.`;
  } else if (isGift) {
    greetingName = recipientName!;
    greetingLine = `${purchaserName} ви подари фотосесия!`;
  } else {
    greetingName = recipientName || purchaserName || "";
    greetingLine = "заповядайте вашият ваучер за фотосесия!";
  }

  const expiresStr = v.expires_at ? formatDateBg(v.expires_at as string) : "—";
  const message = v.message as string | null;

  const html = wrapper(`
    <h1 style="font-size:22px; color:${BRAND_INK}; margin:0 0 4px;">🎁 Подаръчен ваучер</h1>
    <p style="color:#555; margin:0 0 20px;">Здравейте, ${greetingName} — ${greetingLine}</p>
    <div style="border:2px dashed ${BRAND_YELLOW}; border-radius:12px; padding:18px; text-align:center; margin-bottom:20px;">
      <p style="margin:0 0 4px; color:#999; font-size:12px; text-transform:uppercase;">Код на ваучера</p>
      <p style="margin:0 0 12px; font-family:monospace; font-size:22px; font-weight:bold; letter-spacing:1px;">${v.code}</p>
      <p style="margin:0; color:#555;">Пакет: <strong>${v.package_name_bg || "—"}</strong></p>
    </div>
    ${message ? `<p style="font-style:italic; color:#555; border-left:3px solid ${BRAND_YELLOW}; padding-left:12px; margin-bottom:20px;">„${message}"</p>` : ""}
    <p style="color:#555; line-height:1.6;">Валиден до <strong>${expiresStr}</strong>. За да го използвате, изберете час на <a href="https://booking.yellowdog.bg" style="color:#B8860B;">booking.yellowdog.bg</a> и въведете кода на ваучера при плащане.</p>
  `);

  return { subject: `Вашият подаръчен ваучер — Студио Жълто куче`, html };
}

async function generateVoucherPDF(v: Record<string, unknown>): Promise<Uint8Array> {
  const [templateBytes, fontRegularBytes, fontBoldBytes] = await Promise.all([
    fetch("https://raw.githubusercontent.com/jigeto/yellowdog-booking/main/assets/voucher-template.jpg").then((r) => r.arrayBuffer()),
    fetch("https://raw.githubusercontent.com/google/fonts/main/ofl/ptserif/PT_Serif-Web-Regular.ttf").then((r) => r.arrayBuffer()),
    fetch("https://raw.githubusercontent.com/google/fonts/main/ofl/ptserif/PT_Serif-Web-Bold.ttf").then((r) => r.arrayBuffer()),
  ]);

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const jpgImage = await pdfDoc.embedJpg(new Uint8Array(templateBytes));
  const fontRegular = await pdfDoc.embedFont(new Uint8Array(fontRegularBytes), { subset: true });
  const fontBold = await pdfDoc.embedFont(new Uint8Array(fontBoldBytes), { subset: true });

  const pageWidth = 595.28;
  const pageHeight = pageWidth * (jpgImage.height / jpgImage.width);
  const page = pdfDoc.addPage([pageWidth, pageHeight]);
  page.drawImage(jpgImage, { x: 0, y: 0, width: pageWidth, height: pageHeight });

  const INK = rgb(0.16, 0.13, 0.08);
  const toY = (yFrac: number) => pageHeight * (1 - yFrac);
  const toX = (xFrac: number) => pageWidth * xFrac;
  const centerText = (text: string, xFrac: number, yFrac: number, size: number, font = fontRegular, color = INK) => {
    const width = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: toX(xFrac) - width / 2, y: toY(yFrac), size, font, color });
  };

  centerText("Специален подарък за", 0.505, 0.465, 22, fontRegular);

  const recipientName = (v.recipient_name as string) || (v.purchaser_name as string) || "";
  const maxNameWidth = pageWidth * 0.46;
  const words = recipientName.split(/\s+/).filter(Boolean);
  let lines: string[];
  let nameSize = 40;
  const fitsOneLine = fontBold.widthOfTextAtSize(recipientName, nameSize) <= maxNameWidth;
  if (words.length <= 1 || fitsOneLine) {
    lines = [recipientName];
  } else {
    let bestSplit = 1, bestWidth = Infinity;
    for (let i = 1; i < words.length; i++) {
      const w1 = fontBold.widthOfTextAtSize(words.slice(0, i).join(" "), nameSize);
      const w2 = fontBold.widthOfTextAtSize(words.slice(i).join(" "), nameSize);
      const worst = Math.max(w1, w2);
      if (worst < bestWidth) { bestWidth = worst; bestSplit = i; }
    }
    lines = [words.slice(0, bestSplit).join(" "), words.slice(bestSplit).join(" ")];
  }
  while (nameSize > 16 && lines.some((l) => fontBold.widthOfTextAtSize(l, nameSize) > maxNameWidth)) nameSize -= 2;
  const lineHeightFrac = (nameSize * 1.2) / pageHeight;
  const nameBaseY = 0.55;
  const startY = nameBaseY - ((lines.length - 1) * lineHeightFrac) / 2;
  lines.forEach((line, i) => centerText(line, 0.505, startY + i * lineHeightFrac, nameSize, fontBold));

  centerText(v.code as string, 0.44, 0.74, 18, fontBold);
  centerText(`Пакет: ${v.package_name_bg || "—"}`, 0.44, 0.775, 12, fontRegular);
  if (v.expires_at) centerText(`Валиден до ${formatDateBg(v.expires_at as string)}`, 0.44, 0.808, 12, fontRegular);

  const qrParams = new URLSearchParams({ voucher: v.code as string });
  if (v.recipient_email) qrParams.set("email", v.recipient_email as string);
  if (v.recipient_name) qrParams.set("name", v.recipient_name as string);
  const qrUrl = `https://booking.yellowdog.bg/?${qrParams.toString()}`;
  const qrPngDataUrl: string = await QRCode.toDataURL(qrUrl, { margin: 1, width: 300 });
  const qrPngBytes = Uint8Array.from(atob(qrPngDataUrl.split(",")[1]), (c) => c.charCodeAt(0));
  const qrImage = await pdfDoc.embedPng(qrPngBytes);
  const qrSize = pageHeight * 0.095;
  page.drawImage(qrImage, { x: toX(0.64) - qrSize / 2, y: toY(0.815), width: qrSize, height: qrSize });

  return pdfDoc.save();
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

    const { voucher_code } = await req.json();
    if (!voucher_code) throw new Error("voucher_code is required");

    const { data: voucher, error } = await supabase
      .from("voucher_admin_view")
      .select("*")
      .eq("code", voucher_code)
      .maybeSingle();

    if (error || !voucher) throw new Error("Voucher not found");

    const recipients = Array.from(
      new Set([voucher.purchaser_email, voucher.recipient_email].filter(Boolean))
    ) as string[];

    if (recipients.length === 0) {
      return new Response(
        JSON.stringify({ sent: false, reason: "no_email_on_file" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
      console.error("[send-voucher-email] PDF generation failed:", pdfErr);
    }

    for (const email of recipients) {
      const audience = email === voucher.purchaser_email ? "purchaser" : "recipient";
      const { subject, html } = voucherConfirmationEmail(voucher, audience);
      await sendEmail(email, subject, html, attachments);
    }

    return new Response(
      JSON.stringify({ sent: true, recipients }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[send-voucher-email]", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
