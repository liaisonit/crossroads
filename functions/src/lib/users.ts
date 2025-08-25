
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

const db = admin.firestore();

/**
 * Triggered on new user creation in Firebase Auth.
 * Copies the role from the 'employees' collection to a new 'users' collection document.
 * This 'users' collection is used for security rules.
 */
export async function copyEmployeeDataToUser(user: functions.auth.UserRecord) {
  const { uid, email, displayName } = user;

  if (!email) {
    functions.logger.warn(`User ${uid} has no email, cannot create profile.`);
    return;
  }

  // Find the corresponding employee document by email
  const employeesRef = db.collection("employees");
  const q = employeesRef.where("email", "==", email).limit(1);
  const snapshot = await q.get();

  if (snapshot.empty) {
    functions.logger.error(
      `No employee record found for new user with email: ${email} (UID: ${uid})`
    );
    // Optional: You could delete the auth user here if they are not pre-approved
    // await admin.auth().deleteUser(uid);
    return;
  }

  const employeeData = snapshot.docs[0].data();
  const roleName = employeeData.roleName || "No Role"; // Default role if not set

  // Create a new document in the 'users' collection with the UID as the ID
  const userRef = db.collection("users").doc(uid);

  try {
    await userRef.set({
      name: displayName || employeeData.name,
      email: email,
      role: roleName,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    functions.logger.log(
      `Successfully created user profile for ${email} with role ${roleName}`
    );
  } catch (error) {
    functions.logger.error(
      `Failed to create user profile for ${email}:`,
      error
    );
  }
}
