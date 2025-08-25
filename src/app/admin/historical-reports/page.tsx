"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Link from "next/link";
import { collection, getDocs, query, where, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
    Table,
    TableHeader,
    TableRow,
    TableHead,
    TableBody,
    TableCell,
  } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from '@/lib/utils';
import { CalendarIcon, Loader2, Search } from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import type { Submission } from '@/lib/types';
import { DateRange } from 'react-day-picker';

export default function HistoricalReportsPage() {
    const { toast } = useToast();
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        to: new Date(),
    });
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    
    const fetchSubmissions = async () => {
        if (!dateRange?.from || !dateRange?.to) {
            toast({
              variant: 'destructive',
              title: 'Invalid Date Range',
              description: 'Please select both a start and end date.',
            });
            return;
        }
        
        setIsLoading(true);
        setHasSearched(true);
        setSubmissions([]); // Clear previous results

        // Use startOfDay for the beginning and endOfDay for the end to include the full day
        const startTimestamp = Timestamp.fromDate(startOfDay(dateRange.from));
        const endTimestamp = Timestamp.fromDate(endOfDay(dateRange.to));
  
        try {
          const q = query(
            collection(db, 'submissions'),
            where('submittedAt', '>=', startTimestamp),
            where('submittedAt', '<=', endTimestamp),
            orderBy('submittedAt', 'desc')
          );
          const querySnapshot = await getDocs(q);
          const submissionsData = querySnapshot.docs.map(
            doc => ({ id: doc.id, ...doc.data() } as Submission)
          );
          setSubmissions(submissionsData);
          if (submissionsData.length > 0) {
              toast({
                title: "Reports Loaded",
                description: `Found ${submissionsData.length} submissions in the selected range.`
              });
          }
        } catch (error) {
          console.error('Error fetching submissions:', error);
          toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Could not fetch data for the selected date range.',
          });
        } finally {
          setIsLoading(false);
        }
    };

    const getStatusBadgeVariant = (status?: Submission['status']) => {
        switch (status) {
            case 'Approved': return 'default';
            case 'Rejected': return 'destructive';
            case 'Flagged': return 'secondary';
            case 'Locked': return 'outline';
            default: return 'secondary';
        }
    };
    
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Historical Reports</h1>
        <p className="text-muted-foreground">
          Review all timesheet submissions within a specific date range.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filter by Date</CardTitle>
          <CardDescription>
            Select a date range to view all submitted timesheets.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant={"outline"}
                  className={cn(
                    "w-full sm:w-[300px] justify-start text-left font-normal",
                    !dateRange && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd, y")} -{" "}
                        {format(dateRange.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
            <Button onClick={fetchSubmissions} disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Search className="mr-2 h-4 w-4" />}
                Search
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
            <CardTitle>Submission Results</CardTitle>
            <CardDescription>
                {hasSearched
                ? `Found ${submissions.length} submissions for the selected date range.`
                : 'No results to display. Please click "Search" to fetch reports.'
                }
            </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="border rounded-lg overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Job Name</TableHead>
                            <TableHead>Foreman</TableHead>
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
                        ) : submissions.length > 0 ? (
                            submissions.map((submission) => (
                                <TableRow key={submission.id} className="animate-fade-in">
                                    <TableCell>
                                        {new Date(submission.submittedAt.seconds * 1000).toLocaleDateString()}
                                    </TableCell>
                                    <TableCell className="font-medium">{submission.jobName}</TableCell>
                                    <TableCell>{submission.foreman}</TableCell>
                                    <TableCell>
                                        <Badge variant={getStatusBadgeVariant(submission.status)}>
                                            {submission.status || 'Submitted'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Badge variant="secondary">{submission.employees.reduce((acc, emp) => acc + emp.totalHours, 0).toFixed(2)}</Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button asChild variant="ghost" size="sm">
                                            <Link href={`/submissions/${submission.id}`}>View</Link>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">
                                    {hasSearched ? 'No submissions found for this date range.' : 'Select a date range and click Search.'}
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
