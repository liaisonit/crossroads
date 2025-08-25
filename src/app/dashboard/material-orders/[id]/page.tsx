
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { doc, getDoc, updateDoc, writeBatch, collection, query, where, getDocs, limit, arrayUnion } from "firebase/firestore";
import { getStorage, ref, uploadString, getDownloadURL } from "firebase/storage";
import { db, auth } from "@/lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Loader2, ArrowLeft, User, Briefcase, FileText, Calendar, Package, UploadCloud, X, ClipboardList, RefreshCw } from "lucide-react";
import type { MaterialOrder, MaterialOrderItem, Equipment, ReturnItem } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { debounce } from "lodash";
import { logActivity } from "@/lib/audit";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { classifyReturnReason } from "@/ai/flows/return-reason-tagging-flow";

export default function MaterialOrderDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [user] = useAuthState(auth);
  const [order, setOrder] = useState<MaterialOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (typeof id !== "string") return;

    const fetchOrder = async () => {
      setIsLoading(true);
      try {
        const docRef = doc(db, "materialOrders", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setOrder({ id: docSnap.id, ...docSnap.data() } as MaterialOrder);
        } else {
          toast({ variant: "destructive", title: "Error", description: "Order not found." });
          router.push('/dashboard/material-orders');
        }
      } catch (error) {
        console.error("Error fetching order:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not fetch order details." });
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrder();
  }, [id, toast, router]);


  const getStatusBadgeVariant = (status: MaterialOrder['status']) => {
    switch (status) {
      case 'Delivered': return 'default';
      case 'Rejected': return 'destructive';
      case 'Pending': return 'secondary';
      case 'Approved': return 'secondary';
      default: return 'outline';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center">
        <p>Order not found.</p>
        <Button asChild className="mt-4">
          <Link href="/dashboard/material-orders">Back to All Orders</Link>
        </Button>
      </div>
    );
  }
  
  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8 animate-fade-in">
        <div className="mb-6 flex justify-between items-start gap-4 flex-wrap">
             <Button asChild variant="outline" className="lift-button">
                <Link href="/dashboard/material-orders">
                    <ArrowLeft className="mr-2" />
                    Back to All Orders
                </Link>
            </Button>
        </div>

        <Card className="glassmorphism">
            <CardHeader className="flex flex-col md:flex-row justify-between md:items-center">
                <div>
                    <CardTitle className="text-3xl font-bold">{order.jobName}</CardTitle>
                    <CardDescription>
                        Order placed by {order.foremanName} on {new Date(order.createdAt.seconds * 1000).toLocaleDateString()}
                    </CardDescription>
                </div>
                <Badge variant={getStatusBadgeVariant(order.status)} className="text-lg mt-2 md:mt-0">
                    {order.status}
                </Badge>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="flex items-center gap-2"><User className="text-primary"/><strong>Foreman:</strong><span>{order.foremanName}</span></div>
                    <div className="flex items-center gap-2"><Briefcase className="text-primary"/><strong>Job:</strong><span>{order.jobName}</span></div>
                    <div className="flex items-center gap-2"><Calendar className="text-primary"/><strong>Requested By:</strong><span>{order.requestedDeliveryDate}</span></div>
                </div>
                 {order.notes && (
                     <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2"><FileText /> Foreman's Notes</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 border rounded-lg bg-secondary/50 text-sm text-muted-foreground">
                            <p className="whitespace-pre-wrap">{order.notes}</p>
                        </CardContent>
                    </Card>
                )}
                <Separator />
                <div>
                    <h3 className="text-lg font-semibold mb-2 flex items-center gap-2"><Package /> Order Items</h3>
                    <div className="border rounded-lg overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Item Name</TableHead>
                                    <TableHead>Requested</TableHead>
                                    <TableHead>Notes</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {order.items.map((item, index) => (
                                    <TableRow key={index}>
                                        <TableCell className="font-medium">{item.name}</TableCell>
                                        <TableCell>{item.quantity}</TableCell>
                                        <TableCell>{item.notes || 'N/A'}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </CardContent>
        </Card>
    </div>
  );
}
