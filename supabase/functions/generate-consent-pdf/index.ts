import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { PDFDocument, rgb } from "npm:pdf-lib@1.17.1";
import fontkit from "npm:@pdf-lib/fontkit@1.1.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const FONT_REGULAR_URL = "https://raw.githubusercontent.com/google/fonts/main/ofl/ptserif/PT_Serif-Web-Regular.ttf";
const FONT_BOLD_URL = "https://raw.githubusercontent.com/google/fonts/main/ofl/ptserif/PT_Serif-Web-Bold.ttf";

const INK = rgb(0.1, 0.1, 0.09);
const GRAY = rgb(0.45, 0.45, 0.42);
const BG_MONTHS = [
  "януари", "февруари", "март", "април", "май", "юни",
  "юли", "август", "септември", "октомври", "ноември", "декември",
];

const CATEGORY_LABELS: Record<string, string> = {
  website: "Уебсайт и портфолио на Студиото",
  social: "Социални мрежи на Студиото",
  contests: "Конкурси и изложби",
  print: "Печатни и електронни материали",
  media: "Медийни, образователни и презентационни формати",
};

function formatDateTimeBg(iso: string): string {
  const d = new Date(iso);
  const day = d.getDate();
  const month = BG_MONTHS[d.getMonth()];
  const year = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${day} ${month} ${year} г., ${hh}:${mm}ч.`;
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const token = authHeader.replace("Bearer ", "");

    const supabaseAsUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData } = await supabaseAsUser.auth.getUser(token);
    if (!userData.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { data: isAdmin } = await supabaseAsUser.rpc("is_admin");
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Forbidden — admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { consent_id } = await req.json();
    if (!consent_id) throw new Error("consent_id is required");

    const { data: consent, error } = await supabase
      .from("image_consents")
      .select("*, bookings(reference)")
      .eq("id", consent_id)
      .maybeSingle();

    if (error || !consent) throw new Error("Consent record not found");

    const [fontRegularBytes, fontBoldBytes] = await Promise.all([
      fetchBytes(FONT_REGULAR_URL),
      fetchBytes(FONT_BOLD_URL),
    ]);

    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);
    const fontRegular = await pdfDoc.embedFont(fontRegularBytes, { subset: true });
    const fontBold = await pdfDoc.embedFont(fontBoldBytes, { subset: true });

    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    const margin = 56;
    let y = pageHeight - margin;

    const drawText = (text: string, opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; gap?: number } = {}) => {
      const size = opts.size ?? 11;
      const font = opts.bold ? fontBold : fontRegular;
      const color = opts.color ?? INK;
      const maxWidth = pageWidth - margin * 2;

      // simple word-wrap
      const words = text.split(" ");
      let line = "";
      const lines: string[] = [];
      for (const w of words) {
        const test = line ? `${line} ${w}` : w;
        if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
          lines.push(line);
          line = w;
        } else {
          line = test;
        }
      }
      if (line) lines.push(line);

      for (const l of lines) {
        page.drawText(l, { x: margin, y, size, font, color });
        y -= size * 1.4;
      }
      y -= opts.gap ?? 6;
    };

    const reference = (consent.bookings as { reference?: string } | null)?.reference || "—";

    drawText("Съгласие за ползване на изображения", { size: 18, bold: true, gap: 4 });
    drawText("Студио „Жълто куче“", { size: 11, color: GRAY, gap: 20 });

    drawText(`Референция на резервация: ${reference}`, { bold: true, gap: 2 });
    if (consent.session_date) drawText(`Дата на фотосесията: ${consent.session_date}`, { gap: 2 });
    drawText(`Дата и час на подписване: ${formatDateTimeBg(consent.created_at)}`, { gap: 2 });
    if (consent.ip_address) drawText(`IP адрес при подписване: ${consent.ip_address}`, { gap: 16 });
    else y -= 16;

    drawText(`Име и фамилия: ${consent.full_name}`, { bold: true, gap: 2 });
    if (consent.contact) drawText(`Контакт: ${consent.contact}`, { gap: 2 });
    if (consent.includes_child && consent.child_name) {
      drawText(`Съгласието включва и дете: ${consent.child_name}`, { gap: 2 });
    }
    y -= 12;

    if (consent.granted) {
      drawText("РЕЗУЛТАТ: Съгласието Е ДАДЕНО за следните цели:", { bold: true, gap: 6 });
      const cats: string[] = consent.categories || [];
      for (const cat of cats) {
        drawText(`•  ${CATEGORY_LABELS[cat] || cat}`, { gap: 2 });
      }
      if (consent.other_category) {
        drawText(`•  ${consent.other_category}`, { gap: 2 });
      }
      y -= 10;

      if (consent.withdrawn_at) {
        drawText(`ОТТЕГЛЕНО на: ${formatDateTimeBg(consent.withdrawn_at)}`, { bold: true, color: rgb(0.6, 0.2, 0.2), gap: 16 });
      }

      if (consent.signature_png) {
        const pngBytes = Uint8Array.from(atob(consent.signature_png.split(",")[1]), (c) => c.charCodeAt(0));
        const img = await pdfDoc.embedPng(pngBytes);
        const sigWidth = 220;
        const sigHeight = (img.height / img.width) * sigWidth;
        y -= 10;
        drawText("Подпис:", { color: GRAY, gap: 4 });
        page.drawImage(img, { x: margin, y: y - sigHeight, width: sigWidth, height: sigHeight });
        y -= sigHeight + 10;
        page.drawLine({ start: { x: margin, y }, end: { x: margin + sigWidth, y }, thickness: 0.5, color: GRAY });
      }
    } else {
      drawText("РЕЗУЛТАТ: Съгласието НЕ Е ДАДЕНО.", { bold: true, gap: 6 });
      drawText("Клиентът е избрал да не дава съгласие за маркетингова употреба на изображения от тази фотосесия. Това не се отразява на резервацията или цената.", { color: GRAY });
    }

    const pdfBytes = await pdfDoc.save();

    return new Response(pdfBytes, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="saglasie-${reference}.pdf"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
