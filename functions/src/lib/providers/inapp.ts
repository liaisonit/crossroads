
import * as admin from "firebase-admin";
const db = admin.firestore();

export async function writeInApp(uid: string, text: string, notificationId: string) {
  const ref = db.collection("users").doc(uid).collection("inbox").doc();
  await ref.set({ 
      text, 
      createdAt: admin.firestore.FieldValue.serverTimestamp(), 
      read: false,
      notificationId, // Link back to the master notification
    });
  return { provider: "inapp", id: ref.id };
}
