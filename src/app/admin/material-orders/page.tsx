
"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
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
import { Loader2, Truck } from "lucide-react";
import type { MaterialOrder } from "@/lib/types";
import { Combobox } from "@/components/ui/combobox";

export default function AdminMaterialOrdersPage() {
  const [orders, setOrders] = useState<MaterialOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filtering states
  const [jobFilter, setJobFilter] = useState("all");
  const [foremanFilter, setForemanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    const q = query(collection(db, "materialOrders"), orderBy("createdAt", "desc"));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const ordersData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MaterialOrder));
        setOrders(ordersData);
        setIsLoading(false);
    }, (error) => {
        console.error("Error fetching material orders in real-time:", error);
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const { filteredOrders, uniqueJobs, uniqueForemen } = useMemo(() => {
    const uniqueJobs = [...new Set(orders.map(o => o.jobName))];
    const uniqueForemen = [...new Set(orders.map(o => o.foremanName))];

    const filtered = orders.filter(o => {
        const jobMatch = jobFilter === 'all' || o.jobName === jobFilter;
        const foremanMatch = foremanFilter === 'all' || o.foremanName === foremanFilter;
        const statusMatch = statusFilter === 'all' || o.status === statusFilter;
        return jobMatch && foremanMatch && statusMatch;
    });

    return { filteredOrders: filtered, uniqueJobs, uniqueForemen };
  }, [orders, jobFilter, foremanFilter, statusFilter]);

  const getStatusBadgeVariant = (status: MaterialOrder['status']) => {
    switch (status) {
      case 'Delivered': return 'default';
      case 'Rejected': return 'destructive';
      case 'Pending': return 'secondary';
      case 'Approved': return 'secondary';
      default: return 'outline';
    }
  };

  const jobOptions = useMemo(() => [
    { value: 'all', label: 'All Jobs' },
    ...uniqueJobs.map(job => ({ value: job, label: job }))
  ], [uniqueJobs]);

  const foremanOptions = useMemo(() => [
    { value: 'all', label: 'All Foremen' },
    ...uniqueForemen.map(foreman => ({ value: foreman, label: foreman }))
  ], [uniqueForemen]);

  const statusOptions = [
    { value: 'all', label: 'All Statuses' },
    { value: 'Pending', label: 'Pending' },
    { value: 'Approved', label: 'Approved' },
    { value: 'Rejected', label: 'Rejected' },
    { value: 'Picking', label: 'Picking' },
    { value: 'In Transit', label: 'In Transit' },
    { value: 'Delivered', label: 'Delivered' },
    { value: 'Partially Delivered', label: 'Partially Delivered' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Material Orders</h1>
        <p className="text-muted-foreground">
          Review and manage all material order requests from foremen.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Truck /> All Orders</CardTitle>
          <CardDescription>
            Filter and review submitted material orders. The list updates in real-time.
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
                <Combobox
                    options={foremanOptions}
                    value={foremanFilter}
                    onValueChange={setForemanFilter}
                    placeholder="Filter by foreman..."
                    searchPlaceholder="Search foremen..."
                />
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
                  <TableHead>Requested Date</TableHead>
                  <TableHead>Job Name</TableHead>
                  <TableHead>Foreman</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Items</TableHead>
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
                ) : filteredOrders.length > 0 ? (
                  filteredOrders.map((order) => (
                    <TableRow key={order.id} className="animate-fade-in">
                      <TableCell>
                        {order.requestedDeliveryDate}
                      </TableCell>
                      <TableCell className="font-medium">{order.jobName}</TableCell>
                      <TableCell>{order.foremanName}</TableCell>
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
                          <Link href={`/admin/material-orders/${order.id}`}>View</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      No material orders found matching your filters.
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
