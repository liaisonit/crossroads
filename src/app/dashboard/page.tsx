

"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { collection, getDocs, query, where, orderBy, Timestamp, limit, onSnapshot } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, PlusCircle, Edit, Hourglass, CheckCircle, XCircle, PackageSearch } from "lucide-react";
import type { MaterialOrder, Submission } from "@/lib/types";
import { startOfWeek, endOfWeek, format } from "date-fns";
import { useToast } from "@/hooks/use-toast";


function RecentSubmissionsCard() {
  const [user, authLoading] = useAuthState(auth);
  const [rows, setRows] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setRows([]); setLoading(false); return; }

    const q = query(
      collection(db, "submissions"),
      where("foremanId", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(5)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission));
      setRows(data);
      setLoading(false);
    }, (error) => {
      console.error("Primary submissions query failed:", error);
      toast({
        variant: "destructive",
        title: "Could not load recent submissions",
        description: "This might be due to a missing Firestore index. Trying a simpler query.",
        duration: 8000,
      });

      // Fallback query without ordering, sorting will be done on the client
      const fallbackQuery = query(
        collection(db, "submissions"),
        where("foremanId", "==", user.uid),
        limit(5)
      );
      
      getDocs(fallbackQuery).then(snapshot => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission));
        data.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
        setRows(data);
      }).catch(fallbackError => {
        console.error("Fallback submissions query also failed:", fallbackError);
        toast({
          variant: "destructive",
          title: "Failed to load data",
          description: "Could not retrieve any of your submissions. Please contact support.",
        });
      }).finally(() => {
        setLoading(false);
      });
    });

    return () => unsubscribe();
  }, [authLoading, user?.uid, toast]);

  const getSubmissionStatusInfo = (submission: Submission): { variant: "default" | "secondary" | "destructive" | "outline", label: string, isEditable: boolean } => {
    const now = Timestamp.now().toMillis();
    const submittedAt = (submission.createdAt as Timestamp)?.toMillis?.() || (submission.date ? Date.parse(submission.date) : now);
    const isWithin48Hours = (now - submittedAt) < (48 * 60 * 60 * 1000);

    if (submission.status === 'Draft') {
        return { variant: 'secondary', label: 'Draft', isEditable: true };
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
    return { variant: 'outline', label: submission.status || 'Locked', isEditable: false };
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full p-4"><Loader2 className="animate-spin text-primary" /></div>;
  }
  
  if (rows.length === 0) {
    return <div className="text-sm text-muted-foreground p-4 text-center h-full flex items-center justify-center">You haven't submitted any timesheets yet.</div>;
  }

  return (
    <div className="border rounded-lg overflow-x-auto">
        <Table>
        <TableHeader>
            <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Job Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[100px] text-right">Action</TableHead>
            </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(r => {
            const dt = (r.createdAt as Timestamp)?.toDate?.() ?? (r.date ? new Date(r.date) : null);
            const dateText = dt ? format(dt, "dd MMM yyyy") : "—";
            const statusInfo = getSubmissionStatusInfo(r);
            return (
                <TableRow key={r.id} className="animate-fade-in">
                <TableCell>{dateText}</TableCell>
                <TableCell className="font-medium">{r.jobName}</TableCell>
                <TableCell>
                    <Badge variant={statusInfo.variant}>
                        {statusInfo.label}
                    </Badge>
                </TableCell>
                <TableCell className="text-right">
                    {statusInfo.isEditable ? (
                        <Button asChild variant="outline" size="sm">
                        <Link href={`/timesheet/${r.id}/edit`}>
                            <Edit className="mr-2 h-3 w-3" />
                            Edit
                        </Link>
                        </Button>
                    ) : (
                        <Button asChild variant="ghost" size="sm">
                            <Link href={`/submissions/${r.id}`}>View</Link>
                        </Button>
                    )}
                </TableCell>
                </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}


function StatCard({ title, value, icon: Icon, color }: { title: string, value: string | number, icon: React.ElementType, color?: string }) {
    return (
        <Card>
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

export default function DashboardPage() {
  const [user, loading] = useAuthState(auth);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [materialOrders, setMaterialOrders] = useState<MaterialOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setIsLoading(false);
      return;
    };
    
    setIsLoading(true);

    const sortWithFallback = (rows: any[]) =>
        rows.sort((a,b) => {
            const ta = (a.createdAt as Timestamp)?.toMillis?.() ?? (a.date ? Date.parse(a.date) : 0);
            const tb = (b.createdAt as Timestamp)?.toMillis?.() ?? (b.date ? Date.parse(b.date) : 0);
            return tb - ta;
        });

    const submissionsQuery = query(
      collection(db, "submissions"),
      where("foremanId", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    const unsubSubmissions = onSnapshot(submissionsQuery, (snapshot) => {
        const subs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission));
        setSubmissions(sortWithFallback(subs));
        setIsLoading(false);
    }, (error) => {
        console.error("Error fetching submissions:", error);
        // Fallback or secondary query if the first fails
        const fallbackQuery = query(collection(db, "submissions"), where("uid", "==", user.uid));
        onSnapshot(fallbackQuery, (snapshot) => {
            const subs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Submission));
            setSubmissions(sortWithFallback(subs));
            setIsLoading(false);
        }, (fallbackError) => {
            console.error("Fallback submissions query failed:", fallbackError);
            setIsLoading(false);
        });
    });

    const materialOrdersQuery = query(
        collection(db, "materialOrders"),
        where("foremanId", "==", user.uid),
        orderBy("createdAt", "desc"),
        limit(5)
    );
    const unsubMaterialOrders = onSnapshot(materialOrdersQuery, (snapshot) => {
        const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MaterialOrder));
        setMaterialOrders(sortWithFallback(orders));
    }, (error) => {
        console.error("Error fetching material orders:", error);
    });

    return () => {
        unsubSubmissions();
        unsubMaterialOrders();
    };

  }, [user, loading]);

  const weeklyStats = useMemo(() => {
    if (!submissions || submissions.length === 0) {
        return { totalHours: 0, pendingSubmissions: 0, pendingOrders: materialOrders.filter(o => o.status === 'Pending' || o.status === 'Approved').length };
    }
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    const thisWeekSubmissions = submissions.filter(s => {
        const submissionDate = (s.createdAt as Timestamp)?.toDate() ?? (s.date ? new Date(s.date) : null);
        if (!submissionDate) return false;
        return submissionDate >= weekStart && submissionDate <= weekEnd;
    });
    
    const totalHours = thisWeekSubmissions.reduce((total, sub) => 
        total + (sub.employees?.reduce((subTotal: number, emp: any) => subTotal + (emp.totalHours || 0), 0) || 0), 0);
        
    const pendingSubmissions = submissions.filter(s => !s.status || s.status === 'Submitted').length;
    const pendingOrders = materialOrders.filter(o => o.status === 'Pending' || o.status === 'Approved').length;

    return { totalHours, pendingSubmissions, pendingOrders };
  }, [submissions, materialOrders]);

  
  if (loading) {
     return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Foreman Dashboard</h1>
            <p className="text-muted-foreground">
                Your weekly overview and quick actions.
            </p>
        </div>
        <div className="flex gap-2">
            <Button asChild>
                <Link href="/dashboard/material-orders/new">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    New Material Order
                </Link>
            </Button>
             <Button asChild>
                <Link href="/timesheet">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    New Timesheet
                </Link>
            </Button>
        </div>
      </div>

       <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <StatCard title="Total Hours This Week" value={Math.round(weeklyStats.totalHours)} icon={Hourglass} />
            <StatCard title="Pending Timesheets" value={weeklyStats.pendingSubmissions} icon={CheckCircle} color="text-yellow-500" />
            <StatCard title="Pending Material Orders" value={weeklyStats.pendingOrders} icon={PackageSearch} color="text-blue-500" />
        </div>


      <div className="grid gap-6 md:grid-cols-2">
        <Card className="glassmorphism">
            <CardHeader>
            <CardTitle>My Recent Submissions</CardTitle>
            <CardDescription>
                A history of the last few timesheets you've submitted.
            </CardDescription>
            </CardHeader>
            <CardContent>
                <RecentSubmissionsCard />
            </CardContent>
            <CardFooter>
                <Button variant="outline" asChild className="w-full">
                    <Link href="/submissions">View All My Submissions</Link>
                </Button>
            </CardFooter>
        </Card>
        <Card className="glassmorphism">
            <CardHeader>
                <CardTitle>My Recent Material Orders</CardTitle>
                <CardDescription>
                    A history of the last few material orders you've created.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="border rounded-lg overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Job</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                             {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">
                                        <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
                                    </TableCell>
                                </TableRow>
                             ) : materialOrders.length > 0 ? (
                                materialOrders.map((order) => (
                                    <TableRow key={order.id}>
                                        <TableCell>
                                            {(order.createdAt as Timestamp) ? format((order.createdAt as Timestamp).toDate(), "dd MMM yyyy") : '—'}
                                        </TableCell>
                                        <TableCell>{order.jobName}</TableCell>
                                        <TableCell><Badge>{order.status}</Badge></TableCell>
                                        <TableCell className="text-right">
                                             <Button asChild variant="ghost" size="sm">
                                                <Link href={`/dashboard/material-orders/${order.id}`}>View</Link>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                             ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">
                                        You haven't created any material orders yet.
                                    </TableCell>
                                </TableRow>
                             )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
            <CardFooter>
                 <Button variant="outline" asChild className="w-full">
                    <Link href="/dashboard/material-orders">View All My Material Orders</Link>
                </Button>
            </CardFooter>
        </Card>
      </div>
    </div>
  );
}
