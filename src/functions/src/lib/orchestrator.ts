
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { fanoutNotifications, pickChannels } from "./deliver";
import { audit } from "./utils/audit";

const db = admin.firestore();

// Helper to calculate hours on the server-side to ensure accuracy
function calculateHours(startTime: string, endTime: string, isShiftRate: boolean, date: Date) {
    const start = new Date(`${date.toISOString().split('T')[0]}T${startTime}:00`);
    const end = new Date(`${date.toISOString().split('T')[0]}T${endTime}:00`);

    if (end < start) {
        end.setDate(end.getDate() + 1);
    }
    
    const diff = (end.getTime() - start.getTime()) / (1000 * 60);
    const totalHours = Math.max(0, (diff - 30) / 60); 

    if (totalHours === 0) return { totalHours: 0, regularHours: 0, overtimeHours: 0, shiftHours: 0 };
    
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 6 || dayOfWeek === 0;

    if(isShiftRate) {
        return { totalHours, regularHours: 0, overtimeHours: 0, shiftHours: totalHours };
    }

    if(isWeekend) {
        return { totalHours, regularHours: 0, overtimeHours: totalHours, shiftHours: 0 };
    }

    const regularStart = new Date(`${date.toISOString().split('T')[0]}T06:00:00`);
    const regularEnd = new Date(`${date.toISOString().split('T')[0]}T14:30:00`);

    const overlapStart = new Date(Math.max(start.getTime(), regularStart.getTime()));
    const overlapEnd = new Date(Math.min(end.getTime(), regularEnd.getTime()));

    let regularMinutes = 0;
    if (overlapEnd > overlapStart) {
        regularMinutes = (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60);
    }
    
    const regularHours = Math.max(0, (regularMinutes - 30) / 60);
    const overtimeHours = Math.max(0, totalHours - regularHours);

    return { totalHours, regularHours, overtimeHours, shiftHours: 0 };
}


export async function onSubmissionChange(
    change: functions.Change<functions.firestore.DocumentSnapshot>,
    context: functions.EventContext
  ) {
    const submissionId = context.params.id;
    const submissionData = change.after.data();
    const beforeData = change.before.data();

    // If document is deleted, do nothing here. Deletions are logged elsewhere.
    if (!submissionData) return;

    // --- Create Event ---
    if (!change.before.exists) {
        await handleSubmissionCreation(submissionId, submissionData);
        return;
    }
    
    // --- Update Event ---
    const statusChanged = beforeData?.status !== submissionData.status;
    const hoursNeedValidation = JSON.stringify(beforeData?.employees) !== JSON.stringify(submissionData.employees);
    
    if (hoursNeedValidation && !statusChanged) {
        await validateHoursOnUpdate(submissionId, submissionData);
    }

    if(statusChanged) {
        await handleStatusChange(submissionId, beforeData, submissionData);
    }
}

async function validateHoursOnUpdate(submissionId: string, data: any) {
    const submissionDate = data.submittedAt.toDate();
    const validatedEmployees = data.employees.map((emp: any) => {
        const hours = calculateHours(emp.startTime, emp.endTime, emp.isShiftRate, submissionDate);
        return { ...emp, ...hours };
    });

    await db.doc(`submissions/${submissionId}`).update({
        employees: validatedEmployees,
    });
    await audit("submission.update.recalculate", { id: submissionId });
}


async function handleSubmissionCreation(submissionId: string, data: any) {
    const { jobId, foreman } = data;
    
    // --- Server-Side Validation ---
    if (!jobId || !foreman) {
        await db.doc(`submissions/${submissionId}`).update({
            status: 'Rejected',
            comments: admin.firestore.FieldValue.arrayUnion({
                author: 'System',
                text: 'Submission automatically rejected due to missing Job or Foreman ID.',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            })
        });
        await audit("submission.create.fail", { id: submissionId, reason: "missing_data" });
        return;
    }
    
    // --- Server-Side Hour Calculation ---
    const submissionDate = data.submittedAt.toDate();
    const validatedEmployees = data.employees.map((emp: any) => {
        const hours = calculateHours(emp.startTime, emp.endTime, emp.isShiftRate, submissionDate);
        return { ...emp, ...hours };
    });

    await db.doc(`submissions/${submissionId}`).update({
        employees: validatedEmployees,
        status: data.status || 'Submitted' // Ensure status is set correctly
    });
    
    if (data.status !== 'Draft') {
        // --- Notify Admin on new submission ---
        const admins = await db.collection("users").where("role", "in", ["Admin", "Super Admin"]).get();
        
        const notifications = admins.docs.map(doc => {
            const user = doc.data();
            return {
                userId: doc.id,
                templateKey: 'TS_NEEDS_APPROVAL_V1',
                channels: pickChannels(user, "timesheet"),
                scheduleAt: admin.firestore.Timestamp.now(),
                payload: {
                    foreman: foreman,
                    jobName: data.jobName,
                    date: data.date,
                    deepLink: `app://submissions/${submissionId}`
                }
            };
        });

        if (notifications.length > 0) {
            await fanoutNotifications(notifications);
        }
        await audit("submission.create.success", { id: submissionId, count: notifications.length });
    }
}

async function handleStatusChange(submissionId: string, beforeData: any, afterData: any) {
    await audit("submission.status.change", { id: submissionId, status: afterData.status });
    
    const { status, foremanId, jobName, date } = afterData;

    // Notify foreman on approval or rejection
    if ((status === 'Approved' || status === 'Rejected') && foremanId) {
        const foremanUserSnap = await db.doc(`users/${foremanId}`).get();
        if (!foremanUserSnap.exists) return;
        
        const foremanUser = foremanUserSnap.data();
        const templateKey = status === 'Approved' ? 'TS_APPROVED_V1' : 'TS_REJECTED_V1';

        await fanoutNotifications([{
            userId: foremanId,
            templateKey: templateKey,
            channels: pickChannels(foremanUser, "timesheet"),
            scheduleAt: admin.firestore.Timestamp.now(),
            payload: {
                jobName: jobName,
                date: date,
                deepLink: `app://submissions/${submissionId}`
            }
        }]);
    }
}


// --- Material Order Orchestration ---

export async function onMaterialOrderChange(
    change: functions.Change<functions.firestore.DocumentSnapshot>,
    context: functions.EventContext
) {
    const orderId = context.params.id;
    const afterData = change.after.data();
    const beforeData = change.before.data();

    if (!afterData) return; // Deleted

    // New Order Submitted
    if (!beforeData) {
        await handleMaterialOrderCreation(orderId, afterData);
        return;
    }

    // Status Changed
    if (beforeData.status !== afterData.status) {
        await handleMaterialOrderStatusChange(orderId, beforeData, afterData);
    }
}

async function handleMaterialOrderCreation(orderId: string, data: any) {
    await audit("materialOrder.create", { id: orderId });

    // Notify Admins and Warehouse staff
    const admins = await db.collection("users").where("role", "in", ["Admin", "Super Admin", "Warehouse"]).get();
    
    const notifications = admins.docs.map(doc => {
        const user = doc.data();
        return {
            userId: doc.id,
            templateKey: 'MO_NEW_ORDER_V1',
            channels: pickChannels(user, "MO"),
            scheduleAt: admin.firestore.Timestamp.now(),
            payload: {
                foremanName: data.foremanName,
                jobName: data.jobName,
                deepLink: `app://admin/material-orders/${orderId}`
            }
        };
    });

    if (notifications.length > 0) {
        await fanoutNotifications(notifications);
    }
}

async function handleMaterialOrderStatusChange(orderId: string, beforeData: any, afterData: any) {
    await audit("materialOrder.status.change", { id: orderId, status: afterData.status });
    
    const { status, foremanId, foremanName, jobName } = afterData;

    // Notify foreman on status update
    if (foremanId && status !== 'Pending') {
        const foremanUserSnap = await db.doc(`users/${foremanId}`).get();
        if (!foremanUserSnap.exists) return;

        const foremanUser = foremanUserSnap.data();
        await fanoutNotifications([{
            userId: foremanId,
            templateKey: 'MO_STATUS_UPDATE_V1',
            channels: pickChannels(foremanUser, "MO"),
            scheduleAt: admin.firestore.Timestamp.now(),
            payload: {
                foremanName,
                jobName,
                status,
                deepLink: `app://dashboard/material-orders/${orderId}`
            }
        }]);
    }
}
