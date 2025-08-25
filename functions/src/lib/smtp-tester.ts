
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import nodemailer from "nodemailer";

export const testSmtpConnection = async (data: any, context: functions.https.CallableContext) => {
    // Authentication check
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }
    
    // Role check to ensure only Super Admins can call this.
    const userDoc = await admin.firestore().doc(`users/${context.auth.uid}`).get();
    if (userDoc.data()?.role !== 'Super Admin') {
        throw new functions.https.HttpsError('permission-denied', 'Only Super Admins can test SMTP settings.');
    }

    const { host, port, secure, username, password } = data;

    if (!host || !port || !username || !password) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing SMTP credentials for testing.');
    }

    const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
            user: username,
            pass: password,
        },
    });

    try {
        await transporter.verify();
        return { success: true, message: 'Connection successful!' };
    } catch (error: any) {
        console.error("SMTP Verification Error:", error.message);
        // Throw a new HttpsError, ensuring the detailed message is passed in the 'message' field
        // which the client is expecting.
        throw new functions.https.HttpsError('internal', error.message, error);
    }
};
