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
async function send(to: string, subject: string, action: string, url: string, footer: string) {
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
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto"><h2>PGTS Performance Dashboard</h2><p>${action}</p><p><a style="display:inline-block;padding:12px 20px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:8px" href="${url}">${action}</a></p><p style="color:#6b7280;font-size:13px">${footer}</p></div>`,
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
