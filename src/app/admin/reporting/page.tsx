
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { Calendar as CalendarIcon, Download, Loader2, Sparkles, Wand2, Search } from 'lucide-react';
import { format, startOfWeek, endOfWeek, addDays } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import type { Submission, WeeklySummary } from '@/lib/types';
import { analyzeReport } from '@/ai/flows/reporting-flow';


type Grouping = 'employee' | 'job' | 'role';

export default function ReportingPage() {
    const { toast } = useToast();
    const [date, setDate] = useState<Date | undefined>(new Date());
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<Grouping>('employee');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysis, setAnalysis] = useState<string | null>(null);
    const [hasSearched, setHasSearched] = useState(false);

    const weekStart = startOfWeek(date || new Date(), { weekStartsOn: 1 }); // Monday
    const weekEnd = endOfWeek(date || new Date(), { weekStartsOn: 1 });

    const fetchSubmissions = async () => {
        if (!date) return;
        setIsLoading(true);
        setAnalysis(null);
        setSubmissions([]);
        setHasSearched(false);
  
        const startTimestamp = Timestamp.fromDate(weekStart);
        const endTimestamp = Timestamp.fromDate(addDays(weekEnd, 1));
  
        try {
          const q = query(
            collection(db, 'submissions'),
            where('submittedAt', '>=', startTimestamp),
            where('submittedAt', '<', endTimestamp)
          );
          const querySnapshot = await getDocs(q);
          const submissionsData = querySnapshot.docs.map(
            doc => ({ id: doc.id, ...doc.data() } as Submission)
          );
          setSubmissions(submissionsData);
          setHasSearched(true);
        } catch (error) {
          console.error('Error fetching submissions:', error);
          toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Could not fetch data for the selected week.',
          });
        } finally {
          setIsLoading(false);
        }
      };

      const weeklySummary = useMemo<WeeklySummary>(() => {
        const summary: WeeklySummary = {
          employee: {},
          job: {},
          role: {},
        };
    
        submissions.forEach(submission => {
          submission.employees.forEach(emp => {
            // Group by employee
            if (!summary.employee[emp.employee]) {
              summary.employee[emp.employee] = { regularHours: 0, overtimeHours: 0, totalHours: 0 };
            }
            summary.employee[emp.employee].regularHours += emp.regularHours;
            summary.employee[emp.employee].overtimeHours += emp.overtimeHours;
            summary.employee[emp.employee].totalHours += emp.totalHours;
    
            // Group by job
            if (!summary.job[submission.jobName]) {
              summary.job[submission.jobName] = { regularHours: 0, overtimeHours: 0, totalHours: 0 };
            }
            summary.job[submission.jobName].regularHours += emp.regularHours;
            summary.job[submission.jobName].overtimeHours += emp.overtimeHours;
            summary.job[submission.jobName].totalHours += emp.totalHours;

            // Group by role
            if (emp.role && !summary.role[emp.role]) {
                summary.role[emp.role] = { regularHours: 0, overtimeHours: 0, totalHours: 0 };
            }
            if (emp.role) {
                summary.role[emp.role].regularHours += emp.regularHours;
                summary.role[emp.role].overtimeHours += emp.overtimeHours;
                summary.role[emp.role].totalHours += emp.totalHours;
            }
          });
        });
    
        return summary;
      }, [submissions]);

      const handleAnalysis = async () => {
        if (!hasSearched) {
            toast({ variant: 'destructive', title: 'No Data', description: 'Please search for a week before running analysis.' });
            return;
        }
        if (submissions.length === 0) {
            toast({ variant: 'destructive', title: 'No Data', description: 'There are no submissions in the selected week to analyze.' });
            return;
        }
        setIsAnalyzing(true);
        setAnalysis(null);
        try {
            const result = await analyzeReport(weeklySummary);
            setAnalysis(result);
        } catch(error) {
            console.error("AI Analysis failed:", error);
            toast({ variant: 'destructive', title: 'Analysis Failed', description: 'The AI analysis could not be completed.'});
        } finally {
            setIsAnalyzing(false);
        }
      }

      const exportToCSV = () => {
        if (!weeklySummary[activeTab] || Object.keys(weeklySummary[activeTab]).length === 0) {
            toast({ variant: "destructive", title: "No data to export", description: "There is no summary data for the current view." });
            return;
        }
      
        const headers = ['Category', 'Regular Hours', 'Overtime Hours', 'Total Hours'];
        const rows = Object.entries(weeklySummary[activeTab]).map(([category, data]) => 
          [
            `"${category.replace(/"/g, '""')}"`, // Handle quotes in category name
            data.regularHours.toFixed(2),
            data.overtimeHours.toFixed(2),
            data.totalHours.toFixed(2)
          ]
        );
      
        let csvContent = "data:text/csv;charset=utf-8," 
          + headers.join(",") + "\n" 
          + rows.map(e => e.join(",")).join("\n");
      
        const link = document.createElement("a");
        link.setAttribute("href", encodeURI(csvContent));
        link.setAttribute("download", `weekly_summary_${activeTab}_${format(weekStart, 'yyyy-MM-dd')}.csv`);
        document.body.appendChild(link);
      
        link.click();
        document.body.removeChild(link);

        toast({ title: "Export Successful", description: "Your CSV file has been downloaded." });
      };
      
    const tableData = useMemo(() => {
        return Object.entries(weeklySummary[activeTab])
            .map(([name, data]) => ({ name, ...data }))
            .sort((a,b) => b.totalHours - a.totalHours);
    }, [weeklySummary, activeTab]);


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Weekly Reporting</h1>
        <p className="text-muted-foreground">
          Generate and export weekly timesheet summaries.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Report Generator</CardTitle>
          <CardDescription>
            Select a week and search to generate a summary report. The report will include
            all submitted timesheets from Monday to Sunday of the selected week.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4 items-center">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={'outline'}
                  className={cn(
                    'w-full sm:w-auto justify-start text-left font-normal',
                    !date && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? (
                    <span>
                      Week of {format(weekStart, 'LLL dd, y')}
                    </span>
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <Button onClick={fetchSubmissions} disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Search className="mr-2 h-4 w-4" />}
                Search
            </Button>
             <Button onClick={handleAnalysis} disabled={isAnalyzing || isLoading || !hasSearched}>
                {isAnalyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Wand2 className="mr-2 h-4 w-4" />}
                Analyze with AI
            </Button>
            <Button onClick={exportToCSV} disabled={!hasSearched || submissions.length === 0}>
                <Download className="mr-2 h-4 w-4" />
                Export to CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {isAnalyzing && (
         <Alert>
            <Sparkles className="h-4 w-4" />
            <AlertTitle>Analyzing Data</AlertTitle>
            <AlertDescription className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                The AI is processing the weekly data. This might take a moment...
            </AlertDescription>
        </Alert>
      )}

      {analysis && (
        <Alert className="animate-fade-in">
            <Sparkles className="h-4 w-4" />
            <AlertTitle>AI-Powered Weekly Analysis</AlertTitle>
            <AlertDescription className="prose prose-sm dark:prose-invert whitespace-pre-wrap">
                {analysis}
            </AlertDescription>
        </Alert>
      )}
      
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as Grouping)}>
        <TabsList className="mb-4">
            <TabsTrigger value="employee">By Employee</TabsTrigger>
            <TabsTrigger value="job">By Job Site</TabsTrigger>
            <TabsTrigger value="role">By Role</TabsTrigger>
        </TabsList>

        <Card>
            <CardHeader>
                 <CardTitle className="capitalize">{activeTab} Summary</CardTitle>
                 <CardDescription>Total hours for the week of {format(weekStart, 'LLL dd, y')}.</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex justify-center items-center h-96">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : hasSearched && tableData.length > 0 ? (
                    <div className="border rounded-lg max-h-[600px] overflow-y-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="capitalize">{activeTab}</TableHead>
                                    <TableHead className="text-right">Regular</TableHead>
                                    <TableHead className="text-right">Overtime</TableHead>
                                    <TableHead className="text-right font-bold">Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {tableData.map((item) => (
                                    <TableRow key={item.name}>
                                        <TableCell className="font-medium">{item.name}</TableCell>
                                        <TableCell className="text-right">{item.regularHours.toFixed(2)}</TableCell>
                                        <TableCell className="text-right">{item.overtimeHours.toFixed(2)}</TableCell>
                                        <TableCell className="text-right font-bold">{item.totalHours.toFixed(2)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-96 text-center text-muted-foreground">
                        <p className="text-lg font-medium">
                            {hasSearched ? `No data found for the selected week.` : 'Please select a week and click "Search".'}
                        </p>
                        <p className="text-sm">Once data is loaded, it will be visualized here.</p>
                    </div>
                )}
            </CardContent>
        </Card>
      </Tabs>
    </div>
  );
}
