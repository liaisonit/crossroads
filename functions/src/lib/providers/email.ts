
import nodemailer from "nodemailer";

type SmtpConfig = {
    enabled?: boolean;
    host?: string;
    port?: number;
    secure?: boolean;
    username?: string;
    password?: string;
    fromName?: string;
    fromEmail?: string;
}

type SendArgs = {
  to: string;
  subject: string;
  html: string;
  config: SmtpConfig;
};

export async function sendEmail({
  to,
  subject,
  html,
  config
}: SendArgs) {

  if (!config.enabled || !config.host || !config.port || !config.username || !config.password) {
    console.warn("SMTP credentials are not fully configured. Skipping email.");
    return Promise.resolve({ provider: "smtp", status: "skipped", reason: "not_configured" });
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure, // true for 465, false for other ports
    auth: {
      user: config.username,
      pass: config.password,
    },
  });

  const fromAddress = `"${config.fromName || 'Crossroads'}" <${config.fromEmail || config.username}>`;

  const mailOptions = {
    from: fromAddress,
    to: to,
    subject: subject,
    html: html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Message sent: %s", info.messageId);
    return { provider: "smtp", id: info.messageId };
  } catch (error: any) {
    console.error(`SMTP send failed to ${to}:`, error.toString());
    // Rethrow to be caught by the deliver function
    throw new Error(`SMTP error: ${error.message}`);
  }
}
