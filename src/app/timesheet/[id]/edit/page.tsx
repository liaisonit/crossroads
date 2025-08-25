
import React from 'react';
import { doc, getDoc, collection, getDocs, DocumentData, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import EditTimesheetClientPage from "./client-page";
import type { Submission, Job, Equipment, Employee, RoleType, JobType, Union, ShiftTemplate } from "@/lib/types";
import { notFound } from "next/navigation";
import Link from 'next/link';
import Logo from '@/components/logo';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

async function getSubmissionData(id: string): Promise<{
    submission: Submission,
    jobs: Job[],
    equipment: Equipment[],
    employees: Employee[],
    roleTypes: RoleType[],
    jobTypes: JobType[],
    unions: Union[],
    shiftTemplates: ShiftTemplate[],
} | null> {
    try {
        const submissionRef = doc(db, "submissions", id);
        const submissionSnap = await getDoc(submissionRef);

        if (!submissionSnap.exists()) {
            return null;
        }

        const submissionData = { id: submissionSnap.id, ...submissionSnap.data() } as Submission;
        
        // Allow editing for Drafts, Rejected, or Submitted within 48 hours
        const now = Timestamp.now().toMillis();
        const submittedAt = submissionData.submittedAt?.toMillis() || now;
        const isWithin48Hours = (now - submittedAt) < (48 * 60 * 60 * 1000);
        
        const isEditable = (submissionData.status === 'Draft' && isWithin48Hours) || 
                           submissionData.status === 'Rejected' || 
                           ((submissionData.status === 'Submitted' || !submissionData.status) && isWithin48Hours);

        if (!isEditable) {
             console.log(`Submission ${id} is not in an editable state (Status: ${submissionData.status}, isWithin48Hours: ${isWithin48Hours}).`);
             return null;
        }

        const [jobsSnap, equipSnap, empSnap, jobTypesSnap, roleTypesSnap, unionsSnap, shiftsSnap] = await Promise.all([
            getDocs(collection(db, "jobs")),
            getDocs(collection(db, "equipment")),
            getDocs(collection(db, "employees")),
            getDocs(collection(db, "jobTypes")),
            getDocs(collection(db, "refRoles")),
            getDocs(collection(db, "refUnions")),
            getDocs(collection(db, "refShiftTemplates")),
        ]);

        const jobs = jobsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Job));
        const equipment = equipSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Equipment));
        const employees = empSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
        const jobTypes = jobTypesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as JobType));
        const roleTypes = roleTypesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as RoleType));
        const unions = unionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Union));
        const shiftTemplates = shiftsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ShiftTemplate));

        return {
            submission: submissionData,
            jobs,
            equipment,
            employees,
            roleTypes,
            jobTypes,
            unions,
            shiftTemplates,
        };
    } catch (error) {
        console.error("Error fetching submission data for editing:", error);
        return null;
    }
}


export default async function EditTimesheetPage({ params }: { params: { id: string } }) {
  const data = await getSubmissionData(params.id);

  if (!data) {
    notFound();
  }

  return (
    <EditTimesheetClientPage
        submission={data.submission}
        jobs={data.jobs}
        equipment={data.equipment}
        employees={data.employees}
        roleTypes={data.roleTypes}
        jobTypes={data.jobTypes}
        unions={data.unions}
        shiftTemplates={data.shiftTemplates}
    />
  );
}
