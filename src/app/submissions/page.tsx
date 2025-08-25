

"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { collection, query, orderBy, onSnapshot, Unsubscribe, where, Timestamp, getDocs } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Inbox, CheckCircle, XCircle, Hourglass, Flag, Lock, Edit } from "lucide-react";
import type { Submission } from "@/lib/types";
import { Combobox } from "@/components/ui/combobox";
import { useToast } from "@/hooks/use-toast";


function StatCard({ title, value, icon: Icon, color }: { title: string, value: number, icon: React.ElementType, color?: string }) {
    return (
        <Card className="glassmorphism">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className={`h-4 w-4 text-muted-foreground ${color}`} />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
            </CardContent>
        </Card>
    )
}

export default function SubmissionsPage() {
  const [user, loading] = useAuthState(auth);
  const { toast } = useToast();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filtering states
  const [jobFilter, setJobFilter] = useState("all");
  const [foremanFilter, setForemanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    // We get the role from localStorage on the client
    const role = localStorage.getItem('userRole');
    setUserRole(role);
  }, []);


  useEffect(() => {
    if (loading || !user || !userRole) {
      if (!loading && !user) setIsLoading(false); // Not logged in, stop loading
      return;
    };

    let q: any;
    const isForeman = userRole === 'Foreman';
    
    if (isForeman) {
      q = query(collection(db, "submissions"), where("foremanId", "==", user.uid), orderBy("createdAt", "desc"));
    } else { // Admin, Super Admin, Billing Team view
      q = query(collection(db, "submissions"), orderBy("createdAt", "desc"));
    }
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const submissionsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission));
        setSubmissions(submissionsData);
        setIsLoading(false);
    }, async (error) => {
        console.error("Error fetching submissions with orderBy:", error.message);
        // Fallback for foreman if the composite query fails due to rules or missing index
        if (isForeman) {
            toast({
                title: "Loading Submissions...",
                description: "Initial query failed, trying a simpler one. Sorting might be affected.",
                variant: "default"
            });
            const fallbackQuery = query(collection(db, "submissions"), where("foremanId", "==", user.uid));
            try {
                const snapshot = await getDocs(fallbackQuery);
                const submissionsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission));
                // Manual sort on the client
                submissionsData.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
                setSubmissions(submissionsData);
            } catch (fallbackError: any) {
                 console.error("Fallback query failed:", fallbackError.message);
                 toast({
                    title: "Failed to Load Submissions",
                    description: "Could not retrieve your submissions. Please check your connection or contact support.",
                    variant: "destructive"
                });
            }
        }
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user, loading, userRole, toast]);

  const { filteredSubmissions, uniqueJobs, uniqueForemen } = useMemo(() => {
    const uniqueJobs = [...new Set(submissions.map(s => s.jobName))];
    const uniqueForemen = [...new Set(submissions.map(s => s.foremanName))];

    const filtered = submissions.filter(s => {
        const submissionWithStatus = { ...s, status: s.status || 'Submitted' };
        const jobMatch = jobFilter === 'all' || submissionWithStatus.jobName === jobFilter;
        const foremanMatch = foremanFilter === 'all' || submissionWithStatus.foremanName === foremanFilter;
        const statusMatch = statusFilter === 'all' || submissionWithStatus.status === statusMatch;
        return jobMatch && foremanMatch && statusMatch;
    });

    return { filteredSubmissions: filtered, uniqueJobs, uniqueForemen };
  }, [submissions, jobFilter, foremanFilter, statusFilter]);

  const stats = useMemo(() => ({
    total: submissions.length,
    pending: submissions.filter(s => !s.status || s.status === 'Submitted').length,
    approved: submissions.filter(s => s.status === 'Approved').length,
    rejected: submissions.filter(s => s.status === 'Rejected').length,
    flagged: submissions.filter(s => s.status === 'Flagged').length,
  }), [submissions]);


  const getStatusInfo = (submission: Submission): { variant: "default" | "secondary" | "destructive" | "outline", label: string, isEditable: boolean } => {
    const now = Timestamp.now().toMillis();
    const submittedAt = submission.createdAt?.toMillis() || now;
    const isWithin48Hours = (now - submittedAt) < (48 * 60 * 60 * 1000);

    if (submission.status === 'Draft' && isWithin48Hours) {
        return { variant: 'secondary', label: 'Draft', isEditable: true };
    }
    if (submission.status === 'Draft' && !isWithin48Hours) {
        return { variant: 'outline', label: 'Draft (Expired)', isEditable: false };
    }
    if (submission.status === 'Rejected') {
        return { variant: 'destructive', label: 'Rejected', isEditable: true };
    }
    if ((submission.status === 'Submitted' || !submission.status) && isWithin48Hours) {
        return { variant: 'secondary', label: 'Submitted', isEditable: true };
    }
    if (submission.status === 'Approved') {
        return { variant: 'default', label: 'Approved', isEditable: false };
    }
    // If submitted and over 48 hours, or explicitly Locked/Approved
    return { variant: 'outline', label: submission.status || 'Locked', isEditable: false };
  };

  const jobOptions = useMemo(() => [
    { value: 'all', label: 'All Jobs' },
    ...uniqueJobs.map(job => ({ value: job, label: job }))
  ], [uniqueJobs]);

  const foremanOptions = useMemo(() => [
    { value: 'all', label: 'All Foremen' },
    ...uniqueForemen.map(foreman => ({ value: foreman, label: foreman || "N/A" }))
  ], [uniqueForemen]);

  const statusOptions = [
    { value: 'all', label: 'All Statuses' },
    { value: 'Submitted', label: 'Submitted' },
    { value: 'Approved', label: 'Approved' },
    { value: 'Rejected', label: 'Rejected' },
    { value: 'Flagged', label: 'Flagged' },
    { value: 'Locked', label: 'Locked' },
    { value: 'Draft', label: 'Draft' },
  ];
  

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {userRole === 'Foreman' ? "My Submissions" : "Submissions Dashboard"}
        </h1>
        <p className="text-muted-foreground">
          {userRole === 'Foreman' ? "A complete history of your submitted timesheets." : "Review and manage all daily work reports."}
        </p>
      </div>

      {userRole !== 'Foreman' && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <StatCard title="Total Submissions" value={stats.total} icon={Inbox} />
            <StatCard title="Pending Review" value={stats.pending} icon={Hourglass} color="text-yellow-500"/>
            <StatCard title="Approved" value={stats.approved} icon={CheckCircle} color="text-green-500" />
            <StatCard title="Rejected" value={stats.rejected} icon={XCircle} color="text-red-500" />
            <StatCard title="Flagged" value={stats.flagged} icon={Flag} color="text-blue-500" />
        </div>
      )}

      <Card className="glassmorphism">
        <CardHeader>
          <CardTitle>All Reports</CardTitle>
          <CardDescription>
            Filter and review submitted timesheets. The list updates in real-time.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex flex-col md:flex-row gap-4 mb-4">
                <Combobox
                    options={jobOptions}
                    value={jobFilter}
                    onValueChange={setJobFilter}
                    placeholder="Filter by job..."
                    searchPlaceholder="Search jobs..."
                />
                {userRole !== 'Foreman' && (
                    <Combobox
                        options={foremanOptions}
                        value={foremanFilter}
                        onValueChange={setForemanFilter}
                        placeholder="Filter by foreman..."
                        searchPlaceholder="Search foremen..."
                    />
                )}
                <Combobox
                    options={statusOptions}
                    value={statusFilter}
                    onValueChange={setStatusFilter}
                    placeholder="Filter by status..."
                    searchPlaceholder="Search statuses..."
                />
            </div>
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Job Name</TableHead>
                  {userRole !== 'Foreman' && <TableHead className="hidden md:table-cell">Foreman</TableHead>}
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total Hours</TableHead>
                  <TableHead className="w-[100px] text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                       <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                    </TableCell>
                  </TableRow>
                ) : filteredSubmissions.length > 0 ? (
                  filteredSubmissions.map((submission) => {
                    const statusInfo = getStatusInfo(submission);
                    return(
                        <TableRow key={submission.id} className="animate-fade-in">
                          <TableCell>
                            {submission.createdAt ? new Date(submission.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}
                          </TableCell>
                          <TableCell className="font-medium">{submission.jobName}</TableCell>
                          {userRole !== 'Foreman' && <TableCell className="hidden md:table-cell">{submission.foremanName}</TableCell>}
                          <TableCell>
                            <Badge variant={statusInfo.variant}>
                                {statusInfo.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary">{submission.employees.reduce((acc, emp) => acc + emp.totalHours, 0).toFixed(2)}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                             {statusInfo.isEditable && userRole === 'Foreman' ? (
                                <Button asChild variant="outline" size="sm">
                                <Link href={`/timesheet/${submission.id}/edit`}>
                                    <Edit className="mr-2 h-3 w-3" />
                                    Edit
                                </Link>
                                </Button>
                            ) : (
                                <Button asChild variant="ghost" size="sm">
                                  <Link href={`/submissions/${submission.id}`}>View</Link>
                                </Button>
                            )}
                          </TableCell>
                        </TableRow>
                    )
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      No submissions found matching your filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

    
