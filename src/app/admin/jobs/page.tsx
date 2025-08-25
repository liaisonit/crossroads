
"use client";

import React from "react";
import JobsClientPage from "./client-page";
import { Loader2 } from "lucide-react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Job } from "@/lib/types";


export default function JobsPage() {
  const [initialJobs, setInitialJobs] = React.useState<Job[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const jobsQuery = query(collection(db, "jobs"), orderBy("name"));

    const unsubscribe = onSnapshot(jobsQuery, (jobsSnapshot) => {
        const jobsData = jobsSnapshot.docs.map(doc => ({ 
            id: doc.id, 
            ...doc.data(),
            // currentHours will be calculated on the backend in a real scenario
            // For now, we are not calculating it on the client to avoid performance issues
            currentHours: doc.data().currentHours || 0 
        } as Job));
        
        setInitialJobs(jobsData);
        setIsLoading(false);
    }, (error) => {
        console.error("Error fetching jobs:", error);
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

  return <JobsClientPage initialJobs={initialJobs} />;
}
