import { addNotification } from './db.js';

/**
 * Notification delivery for shop events.
 *
 * All events are logged to the shop_notifications table (shown in the staff
 * dashboard). External delivery is optional:
 *   - Email: enable by setting SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS,
 *     SMTP_FROM in server/.env. The `nodemailer` package is loaded lazily, so
 *     it is only needed when SMTP is configured.
 *   - WhatsApp: no SDK is bundled. When WHATSAPP_API_URL (a webhook/bridge like
 *     GreenAPI, Meta Cloud API, or a bot) is configured, we POST the message
 *     to it. Otherwise the message is logged with a wa.me deep link so staff
 *     can copy the recipient link.
 */

const SMTP = {
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 465),
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS,
  from: process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@shop.local',
};

const WHATSAPP_URL = process.env.WHATSAPP_API_URL;

function waLink(phone: string): string {
  const digits = String(phone).replace(/[^\d]/g, '');
  const intl = digits.startsWith('0') ? '2' + digits.slice(1) : digits;
  return `https://wa.me/${intl}`;
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!SMTP.host || !SMTP.user || !SMTP.pass) return false;
  try {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.default.createTransport({
      host: SMTP.host,
      port: SMTP.port,
      secure: SMTP.port === 465,
      auth: { user: SMTP.user, pass: SMTP.pass },
    });
    await transporter.sendMail({ from: SMTP.from, to, subject, html });
    return true;
  } catch (e: any) {
    console.error('[shop] email notification failed:', e?.message);
    return false;
  }
}

async function sendWhatsApp(phone: string, body: string) {
  if (!WHATSAPP_URL) return false;
  try {
    const res = await fetch(WHATSAPP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, message: body }),
    });
    return res.ok;
  } catch (e: any) {
    console.error('[shop] whatsapp notification failed:', e?.message);
    return false;
  }
}

export async function notify(opts: {
  type: string;
  recipient?: string | null;
  subject: string;
  body: string;
  whatsapp?: boolean;
}): Promise<void> {
  const { type, recipient, subject, body, whatsapp = false } = opts;
  await addNotification({ type, channel: 'inapp', recipient: recipient ?? null, subject, body });

  const phone = recipient && whatsapp ? recipient : null;
  const email = recipient && whatsapp === false ? recipient : null;

  const [emailed] = email
    ? [await sendEmail(email, subject, body)]
    : [false];

  const sentWA = phone ? await sendWhatsApp(phone, body) : false;

  if ((email && !emailed) || (phone && !sentWA)) {
    await addNotification({
      type,
      channel: phone ? 'whatsapp' : 'email',
      recipient: recipient ?? null,
      subject,
      body: phone ? `${body}\n(لا يمكن الإرسال التلقائي — ${waLink(phone)})` : `${body}\n(تعذر الإرسال — تحقق من إعدادات SMTP)`,
    });
  }
}
