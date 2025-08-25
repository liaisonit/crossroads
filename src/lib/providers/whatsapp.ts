
import twilio from "twilio";

// Strictly render pre-approved templates
function render(template: string, vars: Record<string, any>) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (vars?.[k] ?? ""));
}

type WhatsAppConfig = {
    twilioAccountSid?: string;
    twilioAuthToken?: string;
    twilioWaNumber?: string;
}

type SendArgs = {
  toE164: string;                 // +1..., +91..., etc.
  templateBody: string;           // approved WA template with {{vars}}
  variables: Record<string, any>; // { name, date, deepLink }
  messageId: string;              // Our internal notification ID
  config: WhatsAppConfig;
};

export async function sendWhatsApp({
  toE164,
  templateBody,
  variables,
  messageId,
  config
}: SendArgs) {
  
  if (!config.twilioAccountSid || !config.twilioAuthToken || !config.twilioWaNumber) {
    console.warn("Twilio credentials are not fully configured in settings. Skipping WhatsApp notification.");
    return Promise.resolve({ provider: "twilio-wa", status: "skipped", reason: "not_configured" });
  }

  const client = twilio(config.twilioAccountSid, config.twilioAuthToken);
  
  const from = config.twilioWaNumber;
  const to = `whatsapp:${toE164.replace(/^whatsapp:/, "")}`;
  const body = render(templateBody, variables);

  try {
    const msg = await client.messages.create({
      from,
      to,
      body,
      // You can pass your own webhook URL here if you want per-message status updates
      // statusCallback: 'YOUR_WEBHOOK_URL', 
      applicationSid: messageId // Use this to pass our internal ID
    });
    return { provider: "twilio-wa", sid: msg.sid, status: msg.status };
  } catch (error: any) {
    console.error(`Twilio send failed for ${to}:`, error.message);
    // Rethrow the error to be caught by the deliver function
    throw new Error(`Twilio error: ${error.message}`);
  }
}
