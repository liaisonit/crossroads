
"use client";

import React, { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import JobTypesClientPage from "./client-page";
import type { JobType } from "@/lib/types";
import { Loader2 } from "lucide-react";

export default function JobTypesPage() {
  const [initialJobTypes, setInitialJobTypes] = useState<JobType[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "jobTypes"), (snapshot) => {
      const jobTypesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as JobType));
      setInitialJobTypes(jobTypesData);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return <JobTypesClientPage initialJobTypes={initialJobTypes} />;
}
