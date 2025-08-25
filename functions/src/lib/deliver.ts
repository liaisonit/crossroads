
import * as admin from "firebase-admin";
import { sendEmail } from "./providers/email";
import { sendWhatsApp } from "./providers/whatsapp";
import { writeInApp } from "./providers/inapp";
import { renderTemplate } from "./utils/templates";
import { audit } from "./utils/audit";
import { nanoid } from "./utils/ids";
import { inQuietHours } from "./utils/tz";

const db = admin.firestore();

type Notif = {
  userId: string;
  templateKey: string;
  channels: string[];
  payload: Record<string,any>;
  scheduleAt?: FirebaseFirestore.Timestamp;
  dedupeKey?: string;
  priorityHigh?: boolean;
};

export async function fanoutNotifications(list: Notif[]) {
  const batch = db.batch();
  for (const n of list) {
    const id = nanoid();
    const ref = db.collection("notifications").doc(id);
    batch.set(ref, {
      ...n, status: "scheduled", attempts: 0, createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }
  await batch.commit();
}

export function pickChannels(user: any, category: string): string[] {
  const prefs = user?.notifyPrefs || {};
  const enabled = (ch: string) => prefs[ch] !== false; // default on
  const channels = [];
  if (enabled("email")) channels.push("email");
  if (enabled("inApp") || enabled("inapp")) channels.push("inapp");
  if (enabled("whatsapp") && user?.whatsappOptIn) channels.push("whatsapp");
  return channels;
}

// Cloud Task target
export async function deliverHttp(req: any, res: any) {
  const id = req.query.id;
  if (!id) return res.status(400).send("Missing notification ID.");

  const snap = await db.doc(`notifications/${id}`).get();
  if (!snap.exists) return res.status(404).send("Notification not found.");
  
  const n = snap.data()!;
  
  // Avoid re-sending if already processed
  if (n.status === 'sent' || n.status === 'partially_failed' || n.status === 'failed') {
      return res.status(200).send(`Notification ${id} already processed with status: ${n.status}`);
  }

  const user = (await db.doc(`users/${n.userId}`).get()).data() || {};
  
  if (inQuietHours(user.notifyPrefs?.quietHours, user.timezone) && !n.priorityHigh) {
      await snap.ref.update({ status: "skipped_quiet_hours" });
      await audit("notify.skip", { id, reason: "quiet_hours" });
      return res.status(200).send("Skipped due to quiet hours.");
  }

  const tplSnap = await db.doc(`notification_templates/${n.templateKey}`).get();
  if (!tplSnap.exists) {
      await snap.ref.update({ status: "failed", lastError: `Template ${n.templateKey} not found.`});
      return res.status(500).send("Template not found.");
  }
  
  // Fetch system settings
  const settingsSnap = await db.doc('systemSettings/integrations').get();
  const settings = settingsSnap.data() || {};

  const tpl = tplSnap.data()!;
  const rendered = renderTemplate({ subject: tpl.subject, emailHtml: tpl.emailHtml, inappText: tpl.inappText }, n.payload);

  const deliveryPromises: Promise<any>[] = [];
  if (n.channels.includes("email") && user.email && settings.smtp?.enabled) {
      deliveryPromises.push(sendEmail({
        to: user.email, 
        subject: rendered.subject, 
        html: rendered.emailHtml,
        config: settings.smtp
    }).then(r => ({...r, channel: 'email', status: 'ok'})).catch(e => ({channel: 'email', status: 'error', error: String(e)})));
  }
  if (n.channels.includes("whatsapp") && user.phone && user.whatsappOptIn && settings.whatsApp?.enabled) {
      const templateBody = tpl.whatsappBody || tpl.inappText || rendered.subject;
      deliveryPromises.push(sendWhatsApp({
          toE164: user.phone, 
          templateBody, 
          variables: n.payload, 
          messageId: id,
          config: settings.whatsApp
      }).then(r => ({...r, channel: 'whatsapp', sid: r.sid, status: 'ok'})).catch(e => ({channel: 'whatsapp', status: 'error', error: String(e)})));
  }
  if (n.channels.includes("inapp")) {
      deliveryPromises.push(writeInApp(n.userId, rendered.inappText || rendered.subject, id).then(r => ({...r, channel: 'inapp', status: 'ok'})).catch(e => ({channel: 'inapp', status: 'error', error: String(e)})));
  }

  const results = await Promise.all(deliveryPromises);
  
  // Find the Twilio result to update the notification with the MessageSid
  const twilioResult = results.find(r => r.provider === 'twilio-wa');
  
  const hasFailures = results.some(r => r.status === 'error');
  const allFailed = results.every(r => r.status === 'error');

  const finalStatus = allFailed ? 'failed' : hasFailures ? 'partially_failed' : 'sent';
  const finalError = results.filter(r => r.status === 'error').map(r => `${r.channel}: ${r.error}`).join('; ');

  await snap.ref.update({
    status: finalStatus,
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
    attempts: admin.firestore.FieldValue.increment(1),
    results,
    lastError: finalError || null,
    twilioMessageSid: twilioResult?.sid || null,
  });


  await audit("notify.delivery.complete", { id, status: finalStatus, results });
  res.status(200).send(`Delivery complete with status: ${finalStatus}`);
}
