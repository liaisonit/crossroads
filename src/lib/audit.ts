
'use server';

import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import type { AuditLogEntry } from './types';

type Actor = {
    name: string | null;
    id: string | null;
    role?: string | null;
};

type ActivityPayload = {
  actor: Actor;
  action: AuditLogEntry['action'];
  target: {
      type: string,
      id: string,
      name?: string,
  };
  details?: string;
  diff?: {
      before: any;
      after: any;
  };
};

export async function logActivity(payload: ActivityPayload) {
    if (!payload.actor.name || !payload.actor.id) {
        console.error('Audit log failed: user name or ID is missing.');
        return;
    }
    const userRole = payload.actor.role || (typeof window !== 'undefined' ? localStorage.getItem('userRole') : 'Unknown');

    const logEntry: Omit<AuditLogEntry, 'id' | 'timestamp'> = {
        actor: {
            id: payload.actor.id,
            name: payload.actor.name,
            role: userRole,
        },
        action: payload.action,
        target: payload.target,
        diff: payload.diff,
        severity: payload.action.includes('delete') ? 'warn' : 'info',
        timestamp: serverTimestamp() as any,
        details: payload.details || `${payload.actor.name} performed action '${payload.action}' on ${payload.target.type} ${payload.target.id}.`
    };

    try {
        await addDoc(collection(db, 'auditLog'), logEntry);
    } catch (error) {
        console.error('Failed to write to audit log:', error);
    }
}

type DeletionPayload = {
    actor: Actor;
    collectionName: string;
    documentId: string;
    documentData: any;
};

export async function logDeletion(payload: DeletionPayload) {
    const { actor, collectionName, documentId, documentData } = payload;
    
    await logActivity({
        actor,
        action: `${collectionName}.delete`,
        target: {
            type: collectionName,
            id: documentId,
            name: documentData?.name,
        },
        diff: {
            before: documentData,
            after: {},
        },
        details: `${actor.name} deleted ${documentData?.name || documentId} from ${collectionName}.`
    });
}
