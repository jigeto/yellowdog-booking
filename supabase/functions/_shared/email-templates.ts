// Shared HTML email templates. Kept deliberately simple (table-based,
// inline styles) since most email clients strip <style> blocks and modern
// CSS layout.

const BRAND_YELLOW = "#F5B400";
const BRAND_INK = "#1A1A17";
const LOGO_URL = "https://yellowdog.bg/wp-content/uploads/2023/02/Logo_Yellow_Dog.png";
const STUDIO_ADDRESS = "бул. „Владимир Вазов“ 90, вх. Б, ет. 2, София";
const STUDIO_PHONE = "+359 876 822 686";
const STUDIO_EMAIL = "office@yellowdog.bg";

const BG_MONTHS = [
  "януари", "февруари", "март", "април", "май", "юни",
  "юли", "август", "септември", "октомври", "ноември", "декември",
];

function sofiaParts(iso: string): Record<string, string> {
  const d = new Date(iso);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Sofia",
    year: "numeric", month: "numeric", day: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  return fmt.formatToParts(d).reduce((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {} as Record<string, string>);
}

function formatDateBg(iso: string): string {
  const p = sofiaParts(iso);
  return `${parseInt(p.day)} ${BG_MONTHS[parseInt(p.month) - 1]} ${p.year}`;
}

function formatTimeBg(iso: string): string {
  const p = sofiaParts(iso);
  return `${p.hour}:${p.minute}`;
}

function eur(n: number | null | undefined): string {
  return `${(n ?? 0).toFixed(2)} €`;
}

function wrapper(bodyHtml: string): string {
  return `
<div style="font-family: Georgia, 'Times New Roman', serif; background:#FAF7F0; padding:32px 16px;">
  <div style="max-width:560px; margin:0 auto; background:#ffffff; border-radius:16px; overflow:hidden; border:1px solid #EFE9DC;">
    <div style="background:${BRAND_INK}; padding:20px 28px;">
      <img src="${LOGO_URL}" alt="Студио Жълто куче" height="36" style="display:block;" />
    </div>
    <div style="padding:28px;">
      ${bodyHtml}
    </div>
    <div style="background:#FAF7F0; padding:18px 28px; font-size:12px; color:#8a8a80; font-family: Arial, sans-serif;">
      Студио Жълто куче · ${STUDIO_ADDRESS}<br/>
      ${STUDIO_PHONE} · ${STUDIO_EMAIL}
    </div>
  </div>
</div>`.trim();
}

const STUDIO_PREP_URL = "https://yellowdog.bg/studio/kak-da-se-podgotvim";

type BookingRow = {
  reference: string;
  package_name_bg: string | null;
  starts_at: string | null;
  ends_at: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  pet_name: string | null;
  num_pets: number;
  total_eur: number;
  amount_paid_eur: number;
  amount_due_eur: number;
  payment_mode: string | null;
};

export function bookingConfirmationEmail(b: BookingRow): { subject: string; html: string } {
  const dateStr = b.starts_at ? `${formatDateBg(b.starts_at)}, ${formatTimeBg(b.starts_at)}ч.` : "—";
  const paidLine =
    b.amount_due_eur > 0
      ? `<p style="margin:4px 0; color:#555;">Платено: <strong>${eur(b.amount_paid_eur)}</strong> · Остатък за плащане на място: <strong>${eur(b.amount_due_eur)}</strong></p>`
      : `<p style="margin:4px 0; color:#555;">Платено изцяло: <strong>${eur(b.amount_paid_eur)}</strong></p>`;

  const html = wrapper(`
    <h1 style="font-size:22px; color:${BRAND_INK}; margin:0 0 4px;">Резервацията е потвърдена!</h1>
    <p style="color:#555; margin:0 0 20px;">Здравейте, ${b.customer_name || ""} — очакваме ви с нетърпение.</p>

    <table style="width:100%; border-collapse:collapse; margin-bottom:20px;">
      <tr><td style="padding:6px 0; color:#999; font-size:13px; text-transform:uppercase;">Референция</td><td style="padding:6px 0; text-align:right; font-family:monospace; font-weight:bold;">${b.reference}</td></tr>
      <tr><td style="padding:6px 0; color:#999; font-size:13px; text-transform:uppercase;">Пакет</td><td style="padding:6px 0; text-align:right;">${b.package_name_bg || "—"}</td></tr>
      <tr><td style="padding:6px 0; color:#999; font-size:13px; text-transform:uppercase;">Дата и час</td><td style="padding:6px 0; text-align:right;">${dateStr}</td></tr>
      <tr><td style="padding:6px 0; color:#999; font-size:13px; text-transform:uppercase;">Любимец</td><td style="padding:6px 0; text-align:right;">${b.pet_name || "—"} (${b.num_pets} бр.)</td></tr>
    </table>

    <div style="background:#FFF8E5; border-radius:10px; padding:14px 16px; margin-bottom:20px;">
      ${paidLine}
    </div>

    <p style="color:#555; line-height:1.6;">Адрес на студиото: <strong>${STUDIO_ADDRESS}</strong>.<br/>
    Ще ви пратим и напомняне ден преди фотосесията. Ако имате въпроси или ви се налага да промените часа, се обадете на ${STUDIO_PHONE}.</p>

    <p style="color:#555; line-height:1.6;">Как да се подготвите за фотосесията може да прочетете <a href="${STUDIO_PREP_URL}" style="color:#B8860B;">на този линк</a>.</p>

    <p style="margin-top:16px; color:#8a8a80; font-size:13px;">📅 Прикачили сме и файл за календара ви — отворете го, за да добавите часа в Google/Apple Calendar.</p>
  `);

  return { subject: `Потвърждение на резервация ${b.reference} — Студио Жълто куче`, html };
}

export function generateBookingICS(b: BookingRow): string {
  const esc = (s: string) => s.replace(/([,;])/g, "\\$1").replace(/\n/g, "\\n");
  const toICSDate = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const now = toICSDate(new Date().toISOString());
  const start = b.starts_at ? toICSDate(b.starts_at) : now;
  const end = b.ends_at ? toICSDate(b.ends_at) : start;
  const summary = esc(`Фотосесия ${b.package_name_bg || ""} — Студио Жълто куче`.trim());
  const description = esc(
    `Референция: ${b.reference}\\nПакет: ${b.package_name_bg || "—"}\\nЛюбимец: ${b.pet_name || "—"}`
  );
  const location = esc(STUDIO_ADDRESS);

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Studio Yellow Dog//Booking//BG",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${b.reference}@yellowdog.bg`,
    `DTSTAMP:${now}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function adminBookingNotificationEmail(b: BookingRow): { subject: string; html: string } {
  const dateStr = b.starts_at ? `${formatDateBg(b.starts_at)}, ${formatTimeBg(b.starts_at)}ч.` : "—";
  const paidLine =
    b.amount_due_eur > 0
      ? `Платено: ${eur(b.amount_paid_eur)} · Остатък на място: ${eur(b.amount_due_eur)}`
      : `Платено изцяло: ${eur(b.amount_paid_eur)}`;

  const html = wrapper(`
    <h1 style="font-size:20px; color:${BRAND_INK}; margin:0 0 16px;">🔔 Нова резервация</h1>
    <table style="width:100%; border-collapse:collapse; margin-bottom:16px;">
      <tr><td style="padding:6px 0; color:#999; font-size:13px; text-transform:uppercase;">Референция</td><td style="padding:6px 0; text-align:right; font-family:monospace; font-weight:bold;">${b.reference}</td></tr>
      <tr><td style="padding:6px 0; color:#999; font-size:13px; text-transform:uppercase;">Клиент</td><td style="padding:6px 0; text-align:right;">${b.customer_name || "—"}</td></tr>
      <tr><td style="padding:6px 0; color:#999; font-size:13px; text-transform:uppercase;">Телефон</td><td style="padding:6px 0; text-align:right;">${b.customer_phone || "—"}</td></tr>
      <tr><td style="padding:6px 0; color:#999; font-size:13px; text-transform:uppercase;">Имейл</td><td style="padding:6px 0; text-align:right;">${b.customer_email || "—"}</td></tr>
      <tr><td style="padding:6px 0; color:#999; font-size:13px; text-transform:uppercase;">Пакет</td><td style="padding:6px 0; text-align:right;">${b.package_name_bg || "—"}</td></tr>
      <tr><td style="padding:6px 0; color:#999; font-size:13px; text-transform:uppercase;">Дата и час</td><td style="padding:6px 0; text-align:right;">${dateStr}</td></tr>
      <tr><td style="padding:6px 0; color:#999; font-size:13px; text-transform:uppercase;">Любимец</td><td style="padding:6px 0; text-align:right;">${b.pet_name || "—"} (${b.num_pets} бр.)</td></tr>
    </table>
    <div style="background:#FFF8E5; border-radius:10px; padding:14px 16px;">
      <p style="margin:0; color:#555;">${paidLine}</p>
    </div>
  `);

  return { subject: `Нова резервация: ${b.reference}`, html };
}

export function bookingReminderEmail(b: BookingRow): { subject: string; html: string } {
  const dateStr = b.starts_at ? `утре, ${formatDateBg(b.starts_at)} от ${formatTimeBg(b.starts_at)}ч.` : "утре";
  const dueLine =
    b.amount_due_eur > 0
      ? `<p style="margin:4px 0; color:#555;">На място ще трябва да доплатите: <strong>${eur(b.amount_due_eur)}</strong></p>`
      : "";

  const html = wrapper(`
    <h1 style="font-size:22px; color:${BRAND_INK}; margin:0 0 4px;">Напомняне за утрешната фотосесия 🐾</h1>
    <p style="color:#555; margin:0 0 20px;">Здравейте, ${b.customer_name || ""} — очакваме ${b.pet_name || "любимеца ви"} ${dateStr}</p>

    <table style="width:100%; border-collapse:collapse; margin-bottom:20px;">
      <tr><td style="padding:6px 0; color:#999; font-size:13px; text-transform:uppercase;">Референция</td><td style="padding:6px 0; text-align:right; font-family:monospace; font-weight:bold;">${b.reference}</td></tr>
      <tr><td style="padding:6px 0; color:#999; font-size:13px; text-transform:uppercase;">Пакет</td><td style="padding:6px 0; text-align:right;">${b.package_name_bg || "—"}</td></tr>
      <tr><td style="padding:6px 0; color:#999; font-size:13px; text-transform:uppercase;">Адрес</td><td style="padding:6px 0; text-align:right;">${STUDIO_ADDRESS}</td></tr>
    </table>

    ${dueLine ? `<div style="background:#FFF8E5; border-radius:10px; padding:14px 16px; margin-bottom:20px;">${dueLine}</div>` : ""}

    <p style="color:#555; line-height:1.6;">Няколко съвета: елате няколко минути по-рано, вземете любима играчка/лакомство на ${b.pet_name || "любимеца"}, и не се притеснявайте — при нас фотосесиите са без стрес, с игра и почивки, колкото са нужни.</p>
    <p style="color:#555;">До утре! Ако нещо се промени, обадете ни се на ${STUDIO_PHONE}.</p>
  `);

  return { subject: `Напомняне: утре е фотосесията ви (${b.reference})`, html };
}

type VoucherRow = {
  code: string;
  package_name_bg: string | null;
  package_price_eur: number | null;
  recipient_name: string | null;
  purchaser_name: string | null;
  message: string | null;
  expires_at: string | null;
};

export function voucherConfirmationEmail(
  v: VoucherRow,
  audience: "purchaser" | "recipient" = "recipient"
): { subject: string; html: string } {
  const isGift = !!(v.purchaser_name && v.recipient_name && v.purchaser_name !== v.recipient_name);
  const expiresStr = v.expires_at ? formatDateBg(v.expires_at) : "—";

  let greetingName: string;
  let greetingLine: string;
  if (audience === "purchaser" && isGift) {
    greetingName = v.purchaser_name!;
    greetingLine = `вие подарихте ваучер на ${v.recipient_name}.`;
  } else if (isGift) {
    greetingName = v.recipient_name!;
    greetingLine = `${v.purchaser_name} ви подари фотосесия!`;
  } else {
    greetingName = v.recipient_name || v.purchaser_name || "";
    greetingLine = "заповядайте вашият ваучер за фотосесия!";
  }

  const html = wrapper(`
    <h1 style="font-size:22px; color:${BRAND_INK}; margin:0 0 4px;">🎁 Подаръчен ваучер</h1>
    <p style="color:#555; margin:0 0 20px;">Здравейте, ${greetingName} — ${greetingLine}</p>

    <div style="border:2px dashed ${BRAND_YELLOW}; border-radius:12px; padding:18px; text-align:center; margin-bottom:20px;">
      <p style="margin:0 0 4px; color:#999; font-size:12px; text-transform:uppercase;">Код на ваучера</p>
      <p style="margin:0 0 12px; font-family:monospace; font-size:22px; font-weight:bold; letter-spacing:1px;">${v.code}</p>
      <p style="margin:0; color:#555;">Пакет: <strong>${v.package_name_bg || "—"}</strong> (${eur(v.package_price_eur)})</p>
    </div>

    ${v.message ? `<p style="font-style:italic; color:#555; border-left:3px solid ${BRAND_YELLOW}; padding-left:12px; margin-bottom:20px;">„${v.message}"</p>` : ""}

    <p style="color:#555; line-height:1.6;">Валиден до <strong>${expiresStr}</strong>. За да го използвате, изберете час на <a href="https://booking.yellowdog.bg" style="color:#B8860B;">booking.yellowdog.bg</a> и въведете кода на ваучера при плащане.</p>
  `);

  return { subject: `Вашият подаръчен ваучер — Студио Жълто куче`, html };
}
