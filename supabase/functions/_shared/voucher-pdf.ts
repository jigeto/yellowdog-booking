// Generates the voucher PDF certificate: the designed background image
// (assets/voucher-template.jpg in the repo, served via raw.githubusercontent.com)
// with the recipient's name overlaid in the speech bubble, code/package/
// validity below it, and a QR code linking straight to a pre-filled booking.
//
// Cyrillic text requires a custom embedded font — pdf-lib's built-in fonts
// only cover WinAnsi. We fetch PT Serif (regular + bold) from Google Fonts'
// own GitHub mirror at runtime and embed it via @pdf-lib/fontkit.

import { PDFDocument, rgb } from "npm:pdf-lib@1.17.1";
import fontkit from "npm:@pdf-lib/fontkit@1.1.1";
import QRCode from "npm:qrcode@1.5.4";

const TEMPLATE_URL = "https://raw.githubusercontent.com/jigeto/yellowdog-booking/main/assets/voucher-template.jpg";
const FONT_REGULAR_URL = "https://raw.githubusercontent.com/google/fonts/main/ofl/ptserif/PT_Serif-Web-Regular.ttf";
const FONT_BOLD_URL = "https://raw.githubusercontent.com/google/fonts/main/ofl/ptserif/PT_Serif-Web-Bold.ttf";
const BOOKING_URL = "https://booking.yellowdog.bg";

const INK = rgb(0.16, 0.13, 0.08); // warm dark brown/black, matches the gold-on-cream design

const BG_MONTHS = [
  "януари", "февруари", "март", "април", "май", "юни",
  "юли", "август", "септември", "октомври", "ноември", "декември",
];

function formatDateBg(dateStr: string): string {
  // expires_at (aliased from vouchers.valid_until in voucher_admin_view) is
  // a plain `date` column (YYYY-MM-DD), no timezone conversion needed
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${d} ${BG_MONTHS[m - 1]} ${y}`;
}

type VoucherRow = {
  code: string;
  package_name_bg: string | null;
  recipient_name: string | null;
  purchaser_name: string | null;
  recipient_email: string | null;
  expires_at: string;
};

async function fetchBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

export async function generateVoucherPDF(v: VoucherRow): Promise<Uint8Array> {
  const [templateBytes, fontRegularBytes, fontBoldBytes] = await Promise.all([
    fetchBytes(TEMPLATE_URL),
    fetchBytes(FONT_REGULAR_URL),
    fetchBytes(FONT_BOLD_URL),
  ]);

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const jpgImage = await pdfDoc.embedJpg(templateBytes);
  const fontRegular = await pdfDoc.embedFont(fontRegularBytes, { subset: true });
  const fontBold = await pdfDoc.embedFont(fontBoldBytes, { subset: true });

  // Page sized to exactly match the template image's aspect ratio (no
  // stretching or letterboxing).
  const imgW = jpgImage.width;
  const imgH = jpgImage.height;
  const pageWidth = 595.28;
  const pageHeight = pageWidth * (imgH / imgW);
  const page = pdfDoc.addPage([pageWidth, pageHeight]);

  page.drawImage(jpgImage, { x: 0, y: 0, width: pageWidth, height: pageHeight });

  // Helper: convert a fractional (0-1) position measured from the TOP-LEFT
  // of the image into PDF coordinates (origin bottom-left).
  const toY = (yFrac: number) => pageHeight * (1 - yFrac);
  const toX = (xFrac: number) => pageWidth * xFrac;

  const centerText = (text: string, xFrac: number, yFrac: number, size: number, font = fontRegular, color = INK) => {
    const width = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: toX(xFrac) - width / 2, y: toY(yFrac), size, font, color });
  };

  // --- "Специален подарък за" caption + recipient name, inside the bubble ---
  centerText("Специален подарък за", 0.505, 0.465, 22, fontRegular);

  const recipientName = v.recipient_name || v.purchaser_name || "";
  const maxNameWidth = pageWidth * 0.46;

  const words = recipientName.split(/\s+/).filter(Boolean);
  let lines: string[];
  let nameSize = 40;

  const fitsOneLine = fontBold.widthOfTextAtSize(recipientName, nameSize) <= maxNameWidth;
  if (words.length <= 1 || fitsOneLine) {
    lines = [recipientName];
  } else {
    // Balance the split across two lines: try every word-boundary split
    // and keep the one whose longer line is narrowest.
    let bestSplit = 1;
    let bestWidth = Infinity;
    for (let i = 1; i < words.length; i++) {
      const line1 = words.slice(0, i).join(" ");
      const line2 = words.slice(i).join(" ");
      const w1 = fontBold.widthOfTextAtSize(line1, nameSize);
      const w2 = fontBold.widthOfTextAtSize(line2, nameSize);
      const worst = Math.max(w1, w2);
      if (worst < bestWidth) {
        bestWidth = worst;
        bestSplit = i;
      }
    }
    lines = [words.slice(0, bestSplit).join(" "), words.slice(bestSplit).join(" ")];
  }

  // Shrink only if, even after wrapping, a line is still too wide.
  while (nameSize > 16 && lines.some((l) => fontBold.widthOfTextAtSize(l, nameSize) > maxNameWidth)) {
    nameSize -= 2;
  }

  const lineHeightFrac = (nameSize * 1.2) / pageHeight;
  const nameBaseY = 0.55;
  const startY = nameBaseY - ((lines.length - 1) * lineHeightFrac) / 2;
  lines.forEach((line, i) => {
    centerText(line, 0.505, startY + i * lineHeightFrac, nameSize, fontBold);
  });

  // --- Code / package / validity (left-of-center) and QR code (right), in
  // the clean band below the bubble — shifted toward the middle to close
  // the empty gap toward the QR, but still left of it. ---
  centerText(v.code, 0.44, 0.74, 18, fontBold);
  centerText(`Пакет: ${v.package_name_bg || "—"}`, 0.44, 0.775, 12, fontRegular);
  centerText(`Валиден до ${formatDateBg(v.expires_at)}`, 0.44, 0.808, 12, fontRegular);

  const qrParams = new URLSearchParams({ voucher: v.code });
  if (v.recipient_email) qrParams.set("email", v.recipient_email);
  if (v.recipient_name) qrParams.set("name", v.recipient_name);
  const qrUrl = `${BOOKING_URL}/?${qrParams.toString()}`;

  const qrPngDataUrl: string = await QRCode.toDataURL(qrUrl, { margin: 1, width: 300 });
  const qrPngBytes = Uint8Array.from(atob(qrPngDataUrl.split(",")[1]), (c) => c.charCodeAt(0));
  const qrImage = await pdfDoc.embedPng(qrPngBytes);

  const qrSize = pageHeight * 0.095;
  page.drawImage(qrImage, {
    x: toX(0.64) - qrSize / 2,
    y: toY(0.815),
    width: qrSize,
    height: qrSize,
  });

  return pdfDoc.save();
}
