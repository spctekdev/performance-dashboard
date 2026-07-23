import "server-only";
import nodemailer from "nodemailer";
import { env } from "./env";
import { logError } from "./logger";

export class EmailDeliveryError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "EmailDeliveryError";
  }
}

function transport() {
  const e = env();
  return nodemailer.createTransport({
    host: e.SMTP_HOST,
    port: e.SMTP_PORT,
    secure: e.SMTP_SECURE === "true",
    auth: e.SMTP_USER ? { user: e.SMTP_USER, pass: e.SMTP_PASSWORD } : undefined,
  });
}
async function send(to: string, subject: string, action: string, url: string, footer: string, cta = "Open dashboard") {
  let e: ReturnType<typeof env>;
  try {
    e = env();
    const mailer = transport();
    await mailer.verify();
    await mailer.sendMail({
      from: e.EMAIL_FROM,
      to,
      subject,
      text: `${action}: ${url}\n\n${footer}`,
      html: emailTemplate(action, url, footer, cta),
    });
  } catch (error) {
    logError("SMTP verification or email delivery failed", error, {
      smtpHost: process.env.SMTP_HOST || "unset",
      smtpPort: process.env.SMTP_PORT || "unset",
      smtpSecure: process.env.SMTP_SECURE === "true",
      recipient: to,
      subject,
    });
    throw new EmailDeliveryError("The email could not be delivered. Check SMTP configuration and server logs.", error);
  }
}
function emailTemplate(action: string, url: string, footer: string, cta: string) {
  const sections = action.split("\n\n").filter(Boolean);
  const [heading, ...details] = sections;
  return `<div style="margin:0;padding:32px 16px;background:#f5f7fb;font-family:Arial,sans-serif;color:#172033">
    <div style="max-width:560px;margin:auto;overflow:hidden;background:#ffffff;border:1px solid #e4e8f1;border-radius:16px">
      <div style="padding:24px 28px;background:linear-gradient(135deg,#312e81,#4f46e5);color:#ffffff"><div style="font-size:12px;font-weight:700;letter-spacing:1.2px">PGTS PERFORMANCE DASHBOARD</div><h1 style="margin:10px 0 0;font-size:24px;line-height:1.25">${escapeHtml(heading ?? "Dashboard notification")}</h1></div>
      <div style="padding:28px"><div style="display:grid;gap:10px">${details.map((detail) => `<p style="margin:0;padding:12px 14px;background:#f8fafc;border-left:3px solid #818cf8;border-radius:6px;font-size:14px;line-height:1.5;white-space:pre-wrap">${escapeHtml(detail)}</p>`).join("")}</div><p style="margin:24px 0 0"><a style="display:inline-block;padding:12px 18px;background:#4f46e5;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:700" href="${escapeHtml(url)}">${escapeHtml(cta)}</a></p></div>
      <div style="padding:16px 28px;border-top:1px solid #e4e8f1;color:#6b7280;font-size:12px;line-height:1.5">${escapeHtml(footer)}</div>
    </div>
  </div>`;
}
function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!,
  );
}
export async function sendInquiryNotification(
  email: string,
  details: {
    subject: string;
    senderName: string;
    preview: string;
    inquiryId: string;
    referenceLabel?: string | null;
    heading: string;
  },
) {
  const baseUrl = env().NEXTAUTH_URL.replace(/\/$/, "");
  const safePreview = details.preview.replace(/[<>]/g, "").slice(0, 300);
  await send(
    email,
    `Inquiry · ${details.subject}`,
    `${details.heading} ${details.senderName}\n\nSubject: ${details.subject}${details.referenceLabel ? `\n\nReference: ${details.referenceLabel}` : ""}\n\nMessage: ${safePreview}`,
    `${baseUrl}/dashboard?tab=inquiries&inquiry=${details.inquiryId}`,
    "Open the dashboard to view the full conversation and respond when ready.",
    "Open inquiry",
  );
}
export const sendVerificationEmail = (email: string, token: string) =>
  sendWithConfiguredUrl(email, token, "Verify your email", "Verify email address", "/verify-email");
export const sendPasswordResetEmail = (email: string, token: string) =>
  sendWithConfiguredUrl(email, token, "Reset your password", "Reset password", "/reset-password");
export const sendDashboardInvitationEmail = (email: string) =>
  sendWithConfiguredUrl(
    email,
    undefined,
    "You've been added to the Performance Dashboard",
    "You've been added to the Performance Dashboard. Use the credentials supplied by your administrator to sign in.",
    "/login",
    "If you were not expecting this invitation, you can ignore this email.",
  );

async function sendWithConfiguredUrl(
  email: string,
  token: string | undefined,
  subject: string,
  action: string,
  path: string,
  footer = "If you did not request this, you can ignore this email.",
) {
  try {
    const baseUrl = env().NEXTAUTH_URL.replace(/\/$/, "");
    const url = token ? `${baseUrl}${path}?token=${encodeURIComponent(token)}` : `${baseUrl}${path}`;
    await send(email, subject, action, url, footer);
  } catch (error) {
    if (error instanceof EmailDeliveryError) throw error;
    logError("Email configuration is invalid", error, { recipient: email, subject });
    throw new EmailDeliveryError(
      "The email service is not configured correctly. Check environment variables and server logs.",
      error,
    );
  }
}
