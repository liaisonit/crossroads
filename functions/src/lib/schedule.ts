
import * as admin from "firebase-admin";
import { DateTime } from "luxon";
import { fanoutNotifications, pickChannels } from "./deliver";
import { audit } from "./utils/audit";
import { humanDateInTZ } from "./utils/tz";
const db = admin.firestore();

export async function enqueueDailyReminders() {
  const foremen = await db.collection("users").where("role","==","Foreman").get();
  const nowUtc = DateTime.utc();
  const payloads: any[] = [];

  for (const doc of foremen.docs) {
    const u = doc.data();
    if (!u.timezone) continue; // Skip users without a timezone set

    const targetLocal = nowUtc.setZone(u.timezone).set({ hour: 18, minute: 30, second: 0, millisecond: 0 });
    
    // If the target time has already passed for today, schedule for tomorrow
    if (nowUtc > targetLocal.toUTC()) {
        continue;
    }

    const scheduleAt = targetLocal.toUTC();
    const dedupeKey = `ts:due:${doc.id}:${targetLocal.toISODate()}`;
    const exists = await db.collection("notifications").where("dedupeKey","==",dedupeKey).limit(1).get();
    if (!exists.empty) continue;

    payloads.push({
      userId: doc.id,
      templateKey: "TS_REMIND_DUE_V1",
      channels: pickChannels(u, "timesheet"),
      scheduleAt: admin.firestore.Timestamp.fromDate(scheduleAt.toJSDate()),
      dedupeKey,
      payload: { date: humanDateInTZ(new Date(), u.timezone), deepLink: "app://timesheet" }
    });
  }
  
  // --- Reminder for expired drafts ---
  const twoDaysAgo = DateTime.utc().minus({ days: 2 }).toJSDate();
  const drafts = await db.collection("submissions")
    .where("status", "==", "Draft")
    .where("submittedAt", "<=", admin.firestore.Timestamp.fromDate(twoDaysAgo))
    .get();

  drafts.forEach(doc => {
      const draft = doc.data();
      const u = foremen.docs.find(d => d.id === draft.foremanId)?.data();
      if (!u) return;

      const dedupeKey = `ts:draft-expired:${doc.id}`;
      payloads.push({
          userId: draft.foremanId,
          templateKey: 'TS_DRAFT_EXPIRED_V1',
          channels: pickChannels(u, "timesheet"),
          scheduleAt: admin.firestore.Timestamp.now(),
          dedupeKey,
          payload: { jobName: draft.jobName, date: draft.date, deepLink: `app://submissions` }
      })
  });


  if (payloads.length) await fanoutNotifications(payloads);
  await audit("notify.schedule.foreman", { count: payloads.length });
}

export async function sendAdminMorningDigest() {
  const admins = await db.collection("users").where("role","in",["Admin","Super Admin"]).get();
  
  const twentyFourHoursAgo = admin.firestore.Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000);
  const pendingSubmissions = await db.collection("submissions")
      .where("status","==","Submitted")
      .where("submittedAt", "<=", twentyFourHoursAgo)
      .get();
  
  if (pendingSubmissions.empty) {
      await audit("notify.schedule.adminDigest", { count: 0, reason: "no_pending_submissions"});
      return;
  }

  const pendingCount = pendingSubmissions.size;
  
  const payloads = admins.docs.map(d => {
    const user = d.data();
    return {
        userId: d.id,
        templateKey: "ADMIN_DIGEST_V1",
        channels: pickChannels(user, "timesheet"),
        scheduleAt: admin.firestore.Timestamp.now(), // Send immediately
        payload: { count: pendingCount, range: "older than 24 hours" }
    };
  });

  if (payloads.length) await fanoutNotifications(payloads);
  await audit("notify.schedule.adminDigest", { count: payloads.length });
}

export async function checkCertificateExpirations() {
    const today = DateTime.utc();
    const thirtyDaysFromNow = today.plus({ days: 30 });
    const employeesSnapshot = await db.collection('employees').get();
    
    if (employeesSnapshot.empty) return;
    
    const allAdminsSnapshot = await db.collection('users').where('role', 'in', ['Admin', 'Super Admin']).get();
    const allAdmins = allAdminsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const notifications: any[] = [];

    for (const employeeDoc of employeesSnapshot.docs) {
        const employee = employeeDoc.data();
        if (!employee.certificates || !Array.isArray(employee.certificates)) continue;

        for (const cert of employee.certificates) {
            const expiryDate = DateTime.fromISO(cert.validUntil);
            if (expiryDate <= thirtyDaysFromNow && expiryDate >= today) {
                const daysUntilExpiry = Math.ceil(expiryDate.diff(today, 'days').days);
                
                const payload = {
                    employeeName: employee.name,
                    certificateName: cert.name,
                    expiryDate: expiryDate.toFormat('DDD'),
                    daysUntilExpiry: daysUntilExpiry.toString(),
                };
                
                // Notify the employee
                notifications.push({
                    userId: employeeDoc.id,
                    templateKey: 'CERT_EXPIRING_V1',
                    channels: pickChannels(employee, 'compliance'),
                    scheduleAt: admin.firestore.Timestamp.now(),
                    dedupeKey: `cert:${employeeDoc.id}:${cert.id}`,
                    payload,
                });

                // Notify their foreman
                if (employee.foremanId) {
                    const foremanDoc = await db.doc(`users/${employee.foremanId}`).get();
                    if (foremanDoc.exists()) {
                         notifications.push({
                            userId: employee.foremanId,
                            templateKey: 'CERT_EXPIRING_V1',
                            channels: pickChannels(foremanDoc.data(), 'compliance'),
                            scheduleAt: admin.firestore.Timestamp.now(),
                            dedupeKey: `cert:${employee.foremanId}:${cert.id}`,
                            payload,
                        });
                    }
                }
                
                // Notify all admins
                allAdmins.forEach(adminUser => {
                     notifications.push({
                        userId: adminUser.id,
                        templateKey: 'CERT_EXPIRING_V1',
                        channels: pickChannels(adminUser, 'compliance'),
                        scheduleAt: admin.firestore.Timestamp.now(),
                        dedupeKey: `cert:admin:${adminUser.id}:${cert.id}`,
                        payload,
                    });
                })
            }
        }
    }

    if (notifications.length > 0) {
        await fanoutNotifications(notifications);
    }

    await audit('notify.schedule.certExpiry', { count: notifications.length });
}
