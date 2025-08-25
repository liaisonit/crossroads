

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
import { Loader2, PlusCircle, PackageSearch, ArrowLeft, LogOut } from "lucide-react";
import type { MaterialOrder } from "@/lib/types";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { format } from 'date-fns';
import { useToast } from "@/hooks/use-toast";

export default function MaterialOrdersPage() {
  const [user, loading] = useAuthState(auth);
  const router = useRouter();
  const { toast } = useToast();
  const [orders, setOrders] = useState<MaterialOrder[]>([]);
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
        collection(db, "materialOrders"),
        where("foremanId", "==", user.uid),
        orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const rows = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as MaterialOrder));
        setOrders(rows);
        setIsLoading(false);
    }, (error) => {
        console.error("Error fetching real-time material orders:", error);
        // This is a good place to inform the user about the missing index.
        toast({
          variant: 'destructive',
          title: 'Error Fetching Orders',
          description: 'Could not load material orders. A Firestore index might be missing. See docs for details.',
          duration: 10000,
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

  const getStatusBadgeVariant = (status: MaterialOrder['status']) => {
    switch (status) {
      case 'Delivered': return 'default';
      case 'Rejected': return 'destructive';
      case 'Pending': return 'secondary';
      case 'Approved': return 'secondary';
      default: return 'outline';
    }
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
                  <h1 className="text-xl font-bold tracking-tight">My Material Orders</h1>
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
                <h1 className="text-3xl font-bold tracking-tight">Material Orders</h1>
                <p className="text-muted-foreground">
                  Create and track all your material requests.
                </p>
              </div>
              <Button asChild>
                <Link href="/dashboard/material-orders/new">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Create New Order
                </Link>
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><PackageSearch /> My Order History</CardTitle>
                <CardDescription>
                  A list of all material orders you've created. The list updates in real-time.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Job Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Items</TableHead>
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
                      ) : orders.length > 0 ? (
                        orders.map((order) => (
                          <TableRow key={order.id} className="animate-fade-in">
                            <TableCell>
                              {order.createdAt ? format(order.createdAt.toDate(), "dd MMM yyyy") : "..."}
                            </TableCell>
                            <TableCell className="font-medium">{order.jobName || '—'}</TableCell>
                            <TableCell>
                              <Badge variant={getStatusBadgeVariant(order.status)}>
                                {order.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant="secondary">{order.items.length}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button asChild variant="ghost" size="sm">
                                <Link href={`/dashboard/material-orders/${order.id}`}>View</Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="h-24 text-center">
                             No orders found. Use the "Create New Order" button to start.
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

    
