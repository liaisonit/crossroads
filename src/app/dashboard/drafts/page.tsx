
"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
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
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, PlusCircle, Edit, ArrowLeft, LogOut } from "lucide-react";
import type { Submission } from "@/lib/types";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { format } from 'date-fns';
import { useToast } from "@/hooks/use-toast";

export default function DraftsPage() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  const { toast } = useToast();
  const [drafts, setDrafts] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    if (loading) {
      setIsLoading(true);
      return;
    }
    if (!user) {
      router.push('/login');
      return;
    }
    
    setUserName(localStorage.getItem("userName"));

    const q = query(
        collection(db, "submissions"),
        where("foremanId", "==", user.uid),
        where("status", "==", "Draft")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const rows = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Submission));
        // Sort on the client to avoid needing a composite index
        rows.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
        setDrafts(rows);
        setIsLoading(false);
    }, (error) => {
        console.error("Error fetching drafts:", error);
        toast({
          variant: 'destructive',
          title: 'Error Fetching Drafts',
          description: 'Could not load your saved drafts.',
        });
        setIsLoading(false);
    });

    return () => unsubscribe();

 }, [user, loading, router, toast]);

  const handleLogout = async () => {
    await auth.signOut();
    localStorage.removeItem("userName");
    localStorage.removeItem("userRole");
    router.push("/login");
  };

  if (loading) {
    return (
     <div className="flex items-center justify-center h-screen">
       <Loader2 className="h-12 w-12 animate-spin text-primary" />
     </div>
   );
  }

  return (
     <div className="flex flex-col h-screen bg-background text-foreground">
        <header className="flex items-center justify-between p-4 border-b shrink-0 h-16">
            <div className="flex items-center gap-4">
                <Button asChild variant="outline" size="icon" className="lift-button">
                    <Link href="/dashboard">
                        <ArrowLeft />
                    </Link>
                </Button>
                <div className="hidden sm:block">
                  <h1 className="text-xl font-bold tracking-tight">My Drafts</h1>
                </div>
            </div>
            <div className="flex items-center gap-4">
                <div className="text-right hidden sm:block">
                    <p className="font-semibold text-sm">{userName}</p>
                    <p className="text-xs text-muted-foreground">Foreman</p>
                </div>
                <ThemeToggle />
                <Button variant="ghost" size="icon" onClick={handleLogout} className="lift-button">
                    <LogOut className="h-5 w-5" />
                </Button>
            </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6 animate-fade-in">
          <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">My Draft Timesheets</h1>
                <p className="text-muted-foreground">
                  Continue working on your saved drafts.
                </p>
              </div>
              <Button asChild>
                <Link href="/timesheet">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Create New Timesheet
                </Link>
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Saved Drafts</CardTitle>
                <CardDescription>
                  A list of all timesheets you've saved as a draft. The list updates in real-time.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Saved On</TableHead>
                        <TableHead>Job Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Employees</TableHead>
                        <TableHead className="w-[100px] text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow>
                          <TableCell colSpan={5} className="h-24 text-center">
                            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                          </TableCell>
                        </TableRow>
                      ) : drafts.length > 0 ? (
                        drafts.map((draft) => (
                          <TableRow key={draft.id} className="animate-fade-in">
                            <TableCell>
                              {draft.createdAt ? format(draft.createdAt.toDate(), "dd MMM yyyy") : "..."}
                            </TableCell>
                            <TableCell className="font-medium">{draft.jobName || '—'}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {draft.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant="secondary">{draft.employees.length}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button asChild variant="outline" size="sm">
                                <Link href={`/timesheet/${draft.id}/edit`}>
                                    <Edit className="mr-2 h-3 w-3" />
                                    Edit
                                </Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="h-24 text-center">
                             You have no saved drafts.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
    </div>
  );
}
