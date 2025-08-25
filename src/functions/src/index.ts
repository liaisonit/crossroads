
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { onSubmissionChange, onMaterialOrderChange } from "./lib/orchestrator";
import { deliverHttp } from "./lib/deliver";
import { enqueueDailyReminders, sendAdminMorningDigest, checkCertificateExpirations } from "./lib/schedule";
import { testSmtpConnection } from "./lib/smtp-tester";

admin.initializeApp();

export const submissionTrigger = functions.firestore
  .document("submissions/{id}")
  .onWrite(onSubmissionChange);

export const materialOrderTrigger = functions.firestore
  .document("materialOrders/{id}")
  .onWrite(onMaterialOrderChange);

// Cloud Task target for one notification
export const deliverNotification = functions.https.onRequest(deliverHttp);

// Schedulers
export const scheduleReminders = functions.pubsub
  .schedule("every 5 minutes")
  .timeZone("UTC")
  .onRun(enqueueDailyReminders);

export const adminMorningDigest = functions.pubsub
  .schedule("0 9 * * 1-5") // 09:00 in the project's timezone (default is America/Los_Angeles)
  .timeZone("America/New_York") // Example: Run at 9am Eastern Time
  .onRun(sendAdminMorningDigest);

export const scheduleCertificateChecks = functions.pubsub
  .schedule("0 9 * * *") // Every day at 9am
  .timeZone("America/New_York")
  .onRun(checkCertificateExpirations);

// Callable Functions
export const testSmtp = functions.https.onCall(testSmtpConnection);
