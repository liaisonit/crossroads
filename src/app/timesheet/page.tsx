
"use client";

import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import TimesheetPageClient from "./client-page";
import type { Job, Equipment, Employee, RoleType, JobType, Union, ShiftTemplate, SystemSettings } from "@/lib/types";
import Header from "@/components/header";
import { Loader2 } from 'lucide-react';

type StaticData = {
    jobs: Job[];
    equipment: Equipment[];
    employees: Employee[];
    roleTypes: RoleType[];
    jobTypes: JobType[];
    unions: Union[];
    shiftTemplates: ShiftTemplate[];
    settings: SystemSettings | null;
}

export default function TimesheetPage() {
  const [staticData, setStaticData] = useState<StaticData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [jobsSnap, equipSnap, empSnap, jobTypesSnap, roleTypesSnap, unionsSnap, shiftsSnap, settingsSnap] = await Promise.all([
            getDocs(collection(db, "jobs")),
            getDocs(collection(db, "equipment")),
            getDocs(collection(db, "employees")),
            getDocs(collection(db, "jobTypes")),
            getDocs(collection(db, "refRoles")),
            getDocs(collection(db, "refUnions")),
            getDocs(collection(db, "refShiftTemplates")),
            getDoc(doc(db, "systemSettings", "integrations")),
        ]);
        
        const data: StaticData = {
            jobs: jobsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Job)),
            equipment: equipSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Equipment)),
            employees: empSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)),
            jobTypes: jobTypesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as JobType)),
            roleTypes: roleTypesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as RoleType)),
            unions: unionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Union)),
            shiftTemplates: shiftsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ShiftTemplate)),
            settings: settingsSnap.exists() ? settingsSnap.data() as SystemSettings : null,
        };
        setStaticData(data);
      } catch (error) {
        console.error("Failed to fetch initial data:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
       <Header />
      <div className="flex-1 overflow-y-auto">
        {isLoading || !staticData ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
        ) : (
          <TimesheetPageClient staticData={staticData} />
        )}
      </div>
    </div>
  );
}
