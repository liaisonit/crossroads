
"use client";

import React, { useState, useEffect } from 'react';
import { doc, getDoc, collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, BookOpen, ArrowDown, ArrowUp } from 'lucide-react';
import type { Job, Submission, MaterialOrder } from '@/lib/types';
import { format } from 'date-fns';

type LedgerEntry = {
  date: Date;
  materialName: string;
  type: 'Delivered' | 'Returned' | 'Used';
  quantityIn: number;
  quantityOut: number;
  reference: string;
  notes?: string;
};

export default function JobLedgerPage() {
  const { id: jobId } = useParams();
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (typeof jobId !== 'string') return;

    const fetchLedgerData = async () => {
      setIsLoading(true);
      try {
        const jobRef = doc(db, 'jobs', jobId);
        const jobSnap = await getDoc(jobRef);

        if (!jobSnap.exists()) {
          router.push('/admin/jobs');
          return;
        }
        setJob({ id: jobSnap.id, ...jobSnap.data() } as Job);

        const allEntries: LedgerEntry[] = [];

        // 1. Fetch Material Orders (Deliveries & Returns)
        const ordersQuery = query(collection(db, 'materialOrders'), where('jobId', '==', jobId));
        const ordersSnap = await getDocs(ordersQuery);
        ordersSnap.forEach(orderDoc => {
          const order = orderDoc.data() as MaterialOrder;
          const orderDate = order.deliveryDate ? order.deliveryDate.toDate() : order.createdAt.toDate();
          
          order.items.forEach(item => {
            const deliveredQty = item.deliveredQuantity ?? item.quantity;
            if (deliveredQty > 0 && (order.status === 'Delivered' || order.status === 'Partially Delivered')) {
              allEntries.push({
                date: orderDate,
                materialName: item.name,
                type: 'Delivered',
                quantityIn: deliveredQty,
                quantityOut: 0,
                reference: `Order #${orderDoc.id.substring(0, 5)}`,
                notes: item.notes
              });
            }
          });

          order.returnedItems?.forEach(item => {
            allEntries.push({
              date: new Date(item.returnedAt),
              materialName: item.name,
              type: 'Returned',
              quantityIn: item.returnedQuantity,
              quantityOut: 0,
              reference: `Return from Order #${orderDoc.id.substring(0, 5)}`,
              notes: item.reason
            });
          });
        });

        // 2. Fetch Timesheets (Used Materials)
        const submissionsQuery = query(collection(db, 'submissions'), where('jobId', '==', jobId));
        const submissionsSnap = await getDocs(submissionsQuery);
        submissionsSnap.forEach(subDoc => {
          const submission = subDoc.data() as Submission;
          if (submission.equipment && submission.equipment.length > 0) {
            submission.equipment.forEach(item => {
              allEntries.push({
                date: submission.createdAt.toDate(),
                materialName: item.equipment,
                type: 'Used',
                quantityIn: 0,
                quantityOut: item.quantity,
                reference: `Timesheet #${subDoc.id.substring(0, 5)}`,
                notes: `by ${submission.foremanName}`
              });
            });
          }
        });

        // Sort entries by date
        allEntries.sort((a, b) => a.date.getTime() - b.date.getTime());

        setLedgerEntries(allEntries);

      } catch (error) {
        console.error("Error fetching ledger data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLedgerData();
  }, [jobId, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
            <div className="flex items-center gap-2 mb-2">
                <Button asChild variant="outline" size="sm">
                    <Link href="/admin/jobs">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Jobs
                    </Link>
                </Button>
            </div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <BookOpen />
            Material Ledger
          </h1>
          <p className="text-muted-foreground">
            For Job: <span className="font-semibold text-primary">{job?.name} ({job?.jobCode})</span>
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>
            A chronological record of all material movements for this job.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead>Transaction</TableHead>
                  <TableHead>In</TableHead>
                  <TableHead>Out</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledgerEntries.length > 0 ? (
                  ledgerEntries.map((entry, index) => (
                    <TableRow key={index}>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(entry.date, 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell className="font-medium">{entry.materialName}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-2">
                          {entry.type === 'Delivered' && <ArrowDown className="h-4 w-4 text-green-500" />}
                          {entry.type === 'Returned' && <ArrowDown className="h-4 w-4 text-blue-500" />}
                          {entry.type === 'Used' && <ArrowUp className="h-4 w-4 text-red-500" />}
                          {entry.type}
                        </span>
                      </TableCell>
                      <TableCell className="text-green-600 font-mono">
                        {entry.quantityIn > 0 ? `+${entry.quantityIn}` : ''}
                      </TableCell>
                      <TableCell className="text-red-600 font-mono">
                        {entry.quantityOut > 0 ? `-${entry.quantityOut}` : ''}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {entry.reference}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      No material transactions found for this job.
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

