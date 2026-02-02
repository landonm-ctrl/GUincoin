import nodemailer from 'nodemailer';

const hasSmtpCredentials =
  Boolean(process.env.SMTP_HOST) &&
  Boolean(process.env.SMTP_USER) &&
  Boolean(process.env.SMTP_PASS);

if (!hasSmtpCredentials) {
  console.warn(
    '[email] SMTP credentials not found - falling back to JSON transport. Emails will be logged to the console.'
  );
}

export const isEmailConfigured = hasSmtpCredentials;

const transporter = hasSmtpCredentials
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  : nodemailer.createTransport({ jsonTransport: true });

export default transporter;
