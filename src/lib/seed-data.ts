
import type { Employee, Job, Role, BillingRate, JobType, Equipment, RoleType, NotificationTemplate, Union, ShiftTemplate } from './types';

// F1: Master Data Setup (SSOT)
export const initialUnions: Union[] = [
    { id: 'U01', name: 'DC09' },
    { id: 'U02', name: '806' },
    { id: 'U03', name: 'PLA' },
    { id: 'U04', name: 'Other' },
];

export const initialShiftTemplates: ShiftTemplate[] = [
    { id: 'S01', unionId: 'U01', name: 'DC09 Shift', startTime: '07:00', endTime: '14:30' },
    { id: 'S02', unionId: 'U02', name: '806 Shift', startTime: '07:00', endTime: '15:30' },
    { id: 'S03', unionId: 'U03', name: 'PLA Shift', startTime: '07:00', endTime: '14:30' },
];

export const initialRoles: Role[] = [
    { id: 'ROLE-001', name: 'Foreman', canCreateTimesheets: true, canApproveTimesheets: false, canCreateJobs: true, canEditBilling: false },
    { id: 'ROLE-002', name: 'Journeyman', canCreateTimesheets: false, canApproveTimesheets: false, canCreateJobs: false, canEditBilling: false },
    { id: 'ROLE-003', name: '1st Year Apprentice', canCreateTimesheets: false, canApproveTimesheets: false, canCreateJobs: false, canEditBilling: false },
    { id: 'ROLE-004', name: '2nd Year Apprentice', canCreateTimesheets: false, canApproveTimesheets: false, canCreateJobs: false, canEditBilling: false },
    { id: 'ROLE-005', name: '3rd Year Apprentice', canCreateTimesheets: false, canApproveTimesheets: false, canCreateJobs: false, canEditBilling: false },
    { id: 'ROLE-006', name: '4th Year Apprentice', canCreateTimesheets: false, canApproveTimesheets: false, canCreateJobs: false, canEditBilling: false },
    { id: 'ROLE-010', name: 'Admin', canCreateTimesheets: true, canApproveTimesheets: true, canCreateJobs: true, canEditBilling: true },
    { id: 'ROLE-011', name: 'Super Admin', canCreateTimesheets: true, canApproveTimesheets: true, canCreateJobs: true, canEditBilling: true },
    { id: 'ROLE-012', name: 'Warehouse', canCreateTimesheets: false, canApproveTimesheets: false, canCreateJobs: false, canEditBilling: false },
    { id: 'ROLE-013', name: 'Delivery', canCreateTimesheets: false, canApproveTimesheets: false, canCreateJobs: false, canEditBilling: false },
    { id: 'ROLE-015', name: 'Billing Team', canCreateTimesheets: false, canApproveTimesheets: true, canCreateJobs: false, canEditBilling: true },
];

export const initialRefRoles: RoleType[] = [
    { id: 'RT-001', name: 'Foreman' },
    { id: 'RT-002', name: 'Journeyman' },
    { id: 'RT-003', name: '1st Year Apprentice' },
    { id: 'RT-004', name: '2nd Year Apprentice' },
    { id: 'RT-005', name: '3rd Year Apprentice' },
    { id: 'RT-006', name: '4th Year Apprentice' },
    { id: 'RT-009', name: 'Warehouse' },
    { id: 'RT-010', name: 'Admin' },
    { id: 'RT-011', name: 'Super Admin' },
    { id: 'RT-012', name: 'Delivery'},
    { id: 'RT-013', name: 'Billing Team'},
];

// --- Legacy data below, will be refactored or removed as we progress through Track 1 ---

export const initialJobs: Omit<Job, 'foreman' | 'status' | 'currentHours'>[] = [
  { id: 'JOB-001', name: 'Site A', location: 'Downtown', locations: ['Downtown'], jobCode: 'JOB-001', gcName: 'BigBuild', budgetHours: 100, startDate: '2024-01-01', projectedCompletionDate: '2024-12-31' },
  { id: 'JOB-002', name: 'Site B', location: 'Harbor', locations: ['Harbor'], jobCode: 'JOB-002', gcName: 'UrbanDev', budgetHours: 200, startDate: '2024-03-01', projectedCompletionDate: '2024-10-31' },
  { id: 'JOB-003', name: 'Park Ave', location: 'Park Avenue, New York, NY', locations: ['Park Avenue, New York, NY', 'North Tower', 'South Tower', 'Basement Level'], jobCode: 'JOB-003', budgetHours: 500, startDate: '2023-11-01', projectedCompletionDate: '2024-08-30' },
  { id: 'JOB-004', name: 'QMT_Welkin', location: 'Queens Midtown Tunnel', locations: ['Queens Midtown Tunnel'], jobCode: 'JOB-004' },
  { id: 'JOB-005', name: 'Bowery Bay', location: 'Bowery Bay, Queens, NY', locations: ['Bowery Bay, Queens, NY'], jobCode: 'JOB-005' },
  { id: 'JOB-006', name: 'Parkchester Stn', location: 'Parkchester, Bronx, NY', locations: ['Parkchester, Bronx, NY'], jobCode: 'JOB-006' },
  { id: 'JOB-007', name: '143st_substation', location: '143rd Street, Bronx, NY', locations: ['143rd Street, Bronx, NY'], jobCode: 'JOB-007' },
];

export const initialBillingRates: BillingRate[] = [
  { id: 'BC-806-001', name: '806 Foreman Rate', union: '806', rateType: 'RT', rate: 64.70, unit: 'Hour' },
  { id: 'BC-DC09-001', name: 'DC09 Foreman Rate', union: 'DC09', rateType: 'RT', rate: 51.14, unit: 'Hour' },
];

export const initialJobTypes: JobType[] = [
  { id: 'JT-001', name: 'Electrical Wiring' },
  { id: 'JT-002', name: 'Interior Painting' },
  { id: 'JT-003', name: 'Drywall' },
  { id: 'JT-004', name: 'Tiling' },
];

export const initialEquipment: Equipment[] = [
    { id: 'M1', name: 'Wire Roll', category: 'Consumable', quantityOnHand: 50, unit: 'roll', minStock: 10, aliases: ["wire", "copper wire"] },
    { id: 'M2', name: 'Switch Box', category: 'Consumable', quantityOnHand: 100, unit: 'pcs', minStock: 20, aliases: ["box", "switch"] },
    { id: 'M3', name: 'Cable Ties', category: 'Consumable', quantityOnHand: 30, unit: 'pack', minStock: 15, aliases: ["zip ties"] },
    { id: 'EQ-001', name: 'Excavator', category: 'Asset', status: 'Available' },
    { id: 'EQ-002', name: 'Scissor Lift', category: 'Asset', status: 'In Use' },
];

const defaultNotifyPrefs = {
    email: true, whatsapp: true, inApp: true,
    quietHours: { start: "21:00", end: "07:00" },
    categories: { timesheet: "all", MO: "important", inventory: "off", compliance: "all" }
};

export const initialEmployees: Employee[] = [
  { id: 'AUTH_UID_SUPER_ADMIN', name: 'Anant', email: 'complete.anant@gmail.com', roleId: 'ROLE-011', roleName: 'Super Admin', unionCode: '806', isActive: true, phone: '+15551234567', timezone: 'America/New_York', notifyPrefs: defaultNotifyPrefs, whatsappOptIn: true },
  { id: 'AUTH_UID_FOREMAN', name: 'Hugo Orellana', email: 'hugo@crossroads.com', roleId: 'ROLE-001', roleName: 'Foreman', unionCode: '806', isActive: true, phone: '+15551234568', timezone: 'America/New_York', notifyPrefs: defaultNotifyPrefs, whatsappOptIn: true },
  { id: 'AUTH_UID_ADMIN', name: 'Pankaj', email: 'pankaj@crossroads.com', roleId: 'ROLE-010', roleName: 'Admin', unionCode: '806', isActive: true, phone: '+15551234569', timezone: 'America/New_York', notifyPrefs: defaultNotifyPrefs, whatsappOptIn: false },
  { id: 'AUTH_UID_WAREHOUSE', name: 'Warehouse User', email: 'warehouse@crossroads.com', roleId: 'ROLE-012', roleName: 'Warehouse', unionCode: '806', isActive: true, phone: '+15551234570', timezone: 'America/New_York', notifyPrefs: defaultNotifyPrefs, whatsappOptIn: true },
  { id: 'E1', name: 'Rahul Sharma', roleId: 'ROLE-002', roleName: 'Journeyman', unionCode: 'DC09', isActive: true, foremanId: 'AUTH_UID_FOREMAN' },
  { id: 'E2', name: 'Ana Torres', roleId: 'ROLE-003', roleName: '1st Year Apprentice', unionCode: '806', isActive: true, foremanId: 'AUTH_UID_FOREMAN' },
  { id: 'E3', name: 'Chris Lee', roleId: 'ROLE-002', roleName: 'Journeyman', unionCode: 'DC09', isActive: true, foremanId: 'AUTH_UID_FOREMAN' },
];

export const initialNotificationTemplates: NotificationTemplate[] = [
    {
        id: 'TS_REMIND_DUE_V1',
        category: 'timesheet',
        subject: 'Timesheet due for {{date}}',
        emailHtml: '<body><p>Hi {{name}},</p><p>This is a reminder that your timesheet for {{date}} is due soon. Please submit it at your earliest convenience.</p><p><a href="{{deepLink}}">Submit Now</a></p></body>',
        whatsappTemplateName: 'ts_due_v1',
        whatsappBody: 'Hi {{name}}, your timesheet for {{date}} is due. Open: {{deepLink}}',
        inappText: 'Your timesheet for {{date}} is due soon.',
    },
    {
        id: 'TS_DRAFT_EXPIRED_V1',
        category: 'timesheet',
        subject: 'Your timesheet draft for {{jobName}} has expired',
        emailHtml: '<body><p>Hi {{name}},</p><p>Your draft timesheet for {{jobName}} from {{date}} has expired. Please create a new timesheet.</p></body>',
        whatsappBody: 'Your draft timesheet for {{jobName}} from {{date}} has expired. Please create a new timesheet.',
        inappText: 'Your draft timesheet for {{jobName}} from {{date}} has expired.',
    },
    {
        id: 'TS_SUBMITTED_V1',
        category: 'timesheet',
        subject: 'Timesheet submitted for {{jobName}} on {{date}}',
        emailHtml: '<body><p>Hello,</p><p>A timesheet for job <strong>{{jobName}}</strong> on {{date}} was submitted by {{foreman}}.</p></body>',
        whatsappTemplateName: 'ts_submitted_v1',
        whatsappBody: 'Your hours for {{date}} were submitted by {{foreman}} for {{jobName}}.',
        inappText: 'Timesheet for {{jobName}} on {{date}} was submitted.',
    },
    {
        id: 'TS_NEEDS_APPROVAL_V1',
        category: 'timesheet',
        subject: 'Approval needed: {{foreman}} on {{jobName}} ({{date}})',
        emailHtml: '<body><p>Hello,</p><p>The timesheet submitted by {{foreman}} for job <strong>{{jobName}}</strong> on {{date}} is ready for your approval.</p><p><a href="{{deepLink}}">Review Now</a></p></body>',
        whatsappTemplateName: 'ts_needs_approval_v1',
        whatsappBody: 'Approval needed: {{foreman}} on {{jobName}} ({{date}}).',
        inappText: 'Timesheet from {{foreman}} for {{jobName}} needs approval.',
    },
    {
        id: 'TS_APPROVED_V1',
        category: 'timesheet',
        subject: 'Your timesheet for {{jobName}} was approved',
        emailHtml: '<body><p>Hello,</p><p>Your timesheet for job <strong>{{jobName}}</strong> on {{date}} has been approved.</p><p><a href="{{deepLink}}">View Details</a></p></body>',
        whatsappTemplateName: 'ts_approved_v1',
        whatsappBody: 'Your timesheet for {{jobName}} on {{date}} has been approved.',
        inappText: 'Your timesheet for {{jobName}} on {{date}} has been approved.',
    },
    {
        id: 'TS_REJECTED_V1',
        category: 'timesheet',
        subject: 'Your timesheet for {{jobName}} needs correction',
        emailHtml: '<body><p>Hello,</p><p>Your timesheet for job <strong>{{jobName}}</strong> on {{date}} was rejected. Please review the comments and resubmit.</p><p><a href="{{deepLink}}">Review Now</a></p></body>',
        whatsappTemplateName: 'ts_rejected_v1',
        whatsappBody: 'Your timesheet for {{jobName}} on {{date}} was rejected. Please review and resubmit.',
        inappText: 'Your timesheet for {{jobName}} on {{date}} was rejected.',
    },
    {
        id: 'ADMIN_DIGEST_V1',
        category: 'timesheet',
        subject: '{{count}} pending approvals for {{range}}',
        emailHtml: '<body><p>You have {{count}} pending approvals for {{range}}.</p></body>',
        whatsappTemplateName: 'admin_digest_v1',
        whatsappBody: 'You have {{count}} pending approvals for {{range}}. Open dashboard.',
        inappText: 'You have {{count}} pending approvals for {{range}}.',
    },
    {
        id: 'CERT_EXPIRING_V1',
        category: 'compliance',
        subject: 'Action Required: Certificate Expiring Soon',
        emailHtml: '<body><p>Hi {{employeeName}},</p><p>This is a reminder that your certificate for <strong>{{certificateName}}</strong> is set to expire on {{expiryDate}}. Please ensure you renew it and provide the updated certificate to the office.</p></body>',
        whatsappBody: 'Hi {{employeeName}}, your certificate for {{certificateName}} will expire on {{expiryDate}}. Please take action.',
        inappText: 'Certificate Expiring: {{certificateName}} for {{employeeName}} expires on {{expiryDate}}.',
    },
    {
        id: 'MO_NEW_ORDER_V1',
        category: 'MO',
        subject: 'New Material Order from {{foremanName}} for {{jobName}}',
        emailHtml: '<body><p>A new material order has been submitted by {{foremanName}} for job: <strong>{{jobName}}</strong>.</p><p><a href="{{deepLink}}">Review Order</a></p></body>',
        inappText: 'New Material Order from {{foremanName}} for {{jobName}}.',
    },
    {
        id: 'MO_STATUS_UPDATE_V1',
        category: 'MO',
        subject: 'Update on your material order for {{jobName}}',
        emailHtml: '<body><p>Hi {{foremanName}},</p><p>The status of your material order for <strong>{{jobName}}</strong> has been updated to: <strong>{{status}}</strong>.</p><p><a href="{{deepLink}}">View Order</a></p></body>',
        whatsappBody: 'Hi {{foremanName}}, your material order for {{jobName}} is now {{status}}.',
        inappText: 'Your material order for {{jobName}} is now: {{status}}.',
    },
];


export const collectionsToSeed = [
    { name: 'refUnions', data: initialUnions },
    { name: 'refShiftTemplates', data: initialShiftTemplates },
    { name: 'refRoles', data: initialRefRoles },
    { name: 'jobs', data: initialJobs, addStatus: true },
    { name: 'roles', data: initialRoles },
    { name: 'billingRates', data: initialBillingRates },
    { name: 'jobTypes', data: initialJobTypes },
    { name: 'equipment', data: initialEquipment },
    { name: 'employees', data: initialEmployees },
    { name: 'submissions', data: [] },
    { name: 'materialOrders', data: [] },
    { name: 'auditLog', data: [] },
    { name: 'notificationTemplates', data: initialNotificationTemplates },
    { name: 'notifications', data: [] }
];
