
import { Timestamp } from "firebase/firestore";

export type WeatherOutput = {
    temperature: number;
    humidity: number;
    description: string;
    dewpoint: number;
};

export type ManualWeatherReading = {
    id: number;
    time: string;
    temperature: number;
    humidity: number;
    dewpoint: number;
    description: string;
};


export type Role = {
    id: string;
    name: string;
    canCreateTimesheets: boolean;
    canApproveTimesheets: boolean;
    canCreateJobs: boolean;
    canEditBilling: boolean;
};

export type Employee = {
    id: string;
    name: string;
    roleId: string;
    roleName?: string; // This can be derived/joined, but good to have for display
    unionCode: 'DC09' | '806' | 'PLA' | 'Other';
    isActive: boolean;
    address?: string;
    email?: string;
    phone?: string;
    hiringDate?: string;
    whatsappOptIn?: boolean;
    timezone?: string;
    notifyPrefs?: {
        email: boolean;
        whatsapp: boolean;
        inApp: boolean;
        quietHours: { start: string, end: string };
        categories: { timesheet: string, MO: string, inventory: string, compliance: string };
    };
    certificates?: TrainingCertificate[];
    foremanId?: string; // ID of the foreman this employee reports to
};

export type TrainingCertificate = {
    id: string;
    name: string;
    validFrom: string; // YYYY-MM-DD
    validUntil: string; // YYYY-MM-DD
    fileUrl?: string;
};


export type Job = {
    id: string;
    name:string;
    foreman: string;
    status: "Ongoing" | "Completed" | "On Hold";
    jobCode: string;
    location: string;
    locations: string[];
    gcName?: string;
    budgetHours?: number;
    currentHours?: number;
    startDate?: string;
    projectedCompletionDate?: string;
};

export type JobType = {
    id: string;
    name: string;
};

export type BillingRate = {
    id: string;
    name: string;
    union: string;
    rateType: 'RT' | 'OT';
    rate: number;
    unit: string;
};

export type Equipment = {
    id: string;
    name: string;
    category: "Asset" | "Consumable";
    status: "Available" | "In Use" | "Maintenance";
    quantityOnHand?: number;
    unit?: string; // uom
    minStock?: number;
    aliases?: string[];
};

export type RoleType = {
    id: string;
    name: string;
};

export type Comment = {
    author: string;
    text: string;
    createdAt: Timestamp;
}

export type DownloadHistory = {
    downloadedBy: string;
    downloadedAt: Timestamp;
}

export type SafetyChecklist = {
    ppe: boolean;
    tools: boolean;
    siteClear: boolean;
};

export type SubmissionEmployee = {
  employee: string;
  role: string;
  union: 'DC09' | '806' | 'PLA' | 'Other';
  jobType?: string;
  rateType: 'Regular' | 'Powertool/Spray';
  isShiftRate: boolean;
  workLocation: string;
  taskDescription: string;
  startTime: string;
  endTime: string;
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  shiftHours: number;
  notes: string;
  tags: string[];
};

export type Submission = {
    id: string;
    foremanId: string; // Firebase Auth UID of the foreman
    foremanName: string;
    date: string;
    jobId: string;
    jobName: string;
    location: string;
    gcName?: string;
    status: 'Submitted' | 'Approved' | 'Rejected' | 'Flagged' | 'Locked' | 'Draft';
    employees: SubmissionEmployee[];
    equipment?: {
        equipment: string;
        quantity: number;
    }[],
    generalNotes?: string;
    signature: string;
    receiptImage?: string | null;
    createdAt: Timestamp;
    submittedAt: Timestamp;
    weather?: WeatherOutput;
    manualWeatherReadings?: Omit<ManualWeatherReading, 'id'>[];
    comments?: Comment[];
    downloadHistory?: DownloadHistory[];
    resubmissionComment?: string;
    safetyChecklist?: SafetyChecklist;
    workType?: 'regular' | 'ticket';
    ticketNumber?: string;
};

export type WeeklySummary = {
    [key in 'employee' | 'job' | 'role']: {
        [category: string]: {
            regularHours: number;
            overtimeHours: number;
            totalHours: number;
        }
    }
};

export type AuditLogEntry = {
    id?: string;
    actor: {
        id: string; // user UID
        name: string;
        role: string;
    };
    action: string; // e.g., 'timesheet.delete', 'job.create'
    target: {
        type: string; // e.g., 'job', 'employee'
        id: string;
        name?: string; // e.g. job name or employee name
    };
    diff?: {
        before: any;
        after: any;
    };
    timestamp: Timestamp;
    details?: string;
    severity: 'info' | 'warn' | 'error';
};

export type MaterialOrderItem = {
    name: string;
    quantity: number;
    notes?: string;
};

export type ReturnItem = {
    name: string;
    returnedQuantity: number;
    reason: string;
    tags: string[];
    returnedAt: string;
    processedBy: string;
};

export type MaterialOrder = {
    id: string;
    foremanId: string; // Firebase Auth UID of the foreman
    foremanName: string;
    jobId: string;
    jobName: string;
    status: 'Pending' | 'Approved' | 'Rejected' | 'Picking' | 'In Transit' | 'Delivered' | 'Partially Delivered';
    items: (MaterialOrderItem & { deliveredQuantity?: number })[];
    createdAt: Timestamp;
    requestedDeliveryDate: string; // "YYYY-MM-DD" format
    deliveryDate?: Timestamp;
    deliveryDriver?: string;
    deliveryProofUrl?: string;
    notes?: string;
    returnedItems?: ReturnItem[];
};


export type MaterialSuggestion = {
    name: string;
    confidence: number;
    suggestedQuantity?: number;
};

export type CrewSuggestion = {
    name: string;
    role: string;
    confidence: number;
};

// --- NOTIFICATION SYSTEM TYPES ---

export type NotificationTemplate = {
    id: string; // e.g. 'TS_REMIND_DUE_V1'
    subject: string;
    emailHtml: string;
    whatsappTemplateName?: string;
    whatsappBody?: string;
    inappText: string;
    category: 'timesheet' | 'MO' | 'inventory' | 'system' | 'compliance';
};

export type Notification = {
    id: string;
    userId: string;
    channels: ('email' | 'whatsapp' | 'inapp')[];
    event: string; // e.g. 'timesheet.reminder.due'
    payload: { [key: string]: any };
    templateKey: string;
    scheduleAt: Timestamp;
    status: 'scheduled' | 'sent' | 'failed' | 'skipped_quiet_hours' | 'partially_failed';
    dedupeKey?: string;
    priorityHigh?: boolean;
    attempts: number;
    results?: { channel: string; status: 'ok' | 'error'; provider: string; messageId?: string, error?: string }[];
    createdAt: Timestamp;
    sentAt?: Timestamp;
    lastError?: string;
    twilioMessageSid?: string;
};

export type SystemSettings = {
    id: 'integrations';
    whatsApp: {
        enabled: boolean;
        twilioAccountSid?: string;
        twilioAuthToken?: string;
        twilioWaNumber?: string;
    };
    smtp: {
        enabled: boolean;
        host?: string;
        port?: number;
        secure?: boolean;
        username?: string;
        password?: string;
        fromName?: string;
        fromEmail?: string;
    };
    weather: {
        apiKey?: string;
    };
};

export type Union = {
    id: string;
    name: string;
}

export type ShiftTemplate = {
    id: string;
    unionId: string;
    name: string;
    startTime: string;
    endTime: string;
}
