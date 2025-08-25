
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Loader2, FileLock2, Sparkles, Wand2 } from 'lucide-react';
import type { AuditLogEntry } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Combobox } from '@/components/ui/combobox';
import { analyzeAuditLogs } from '@/ai/flows/audit-analysis-flow';


export default function AuditLogPage() {
    const { toast } = useToast();
    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // Filtering states
    const [userFilter, setUserFilter] = useState('all');
    const [actionFilter, setActionFilter] = useState('all');
    const [severityFilter, setSeverityFilter] = useState('all');

    // AI Analysis states
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<string | null>(null);


    useEffect(() => {
        const fetchLogs = async () => {
            setIsLoading(true);
            try {
                const q = query(collection(db, 'auditLog'), orderBy('timestamp', 'desc'));
                const querySnapshot = await getDocs(q);
                const logsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditLogEntry));
                setLogs(logsData);
            } catch (error) {
                console.error("Error fetching audit logs:", error);
                toast({
                    variant: 'destructive',
                    title: 'Error',
                    description: 'Could not fetch audit logs.'
                });
            } finally {
                setIsLoading(false);
            }
        };

        fetchLogs();
    }, [toast]);

    const { filteredLogs, uniqueUsers, uniqueActions } = useMemo(() => {
        const uniqueUsers = [...new Set(logs.map(log => log.actor.name))];
        const uniqueActions = [...new Set(logs.map(log => log.action))];

        const filtered = logs.filter(log => {
            const userMatch = userFilter === 'all' || log.actor.name === userFilter;
            const actionMatch = actionFilter === 'all' || log.action === actionFilter;
            const severityMatch = severityFilter === 'all' || log.severity === severityFilter;
            return userMatch && actionMatch && severityMatch;
        });

        return { filteredLogs: filtered, uniqueUsers, uniqueActions };
    }, [logs, userFilter, actionFilter, severityFilter]);

    const handleAnalysis = async () => {
        if (filteredLogs.length === 0) {
            toast({ variant: 'destructive', title: 'No Data', description: 'There are no logs in the current filter to analyze.' });
            return;
        }
        setIsAnalyzing(true);
        setAnalysisResult(null);
        try {
            const result = await analyzeAuditLogs(filteredLogs);
            setAnalysisResult(result);
        } catch(error) {
            console.error("AI Analysis failed:", error);
            toast({ variant: 'destructive', title: 'Analysis Failed', description: 'The AI analysis could not be completed.'});
        } finally {
            setIsAnalyzing(false);
        }
    }

    const getSeverityVariant = (severity: AuditLogEntry['severity']): 'default' | 'secondary' | 'destructive' => {
        switch(severity) {
            case 'warn': return 'destructive';
            case 'error': return 'destructive';
            case 'info':
            default: return 'secondary';
        }
    }
    
    const userOptions = useMemo(() => ([
        { value: 'all', label: 'All Users' },
        ...uniqueUsers.map(u => ({ value: u, label: u }))
    ]), [uniqueUsers]);

    const actionOptions = useMemo(() => ([
        { value: 'all', label: 'All Actions' },
        ...uniqueActions.map(a => ({ value: a, label: a }))
    ]), [uniqueActions]);

    const severityOptions = [
        { value: 'all', label: 'All Severities' },
        { value: 'info', label: 'Info' },
        { value: 'warn', label: 'Warning' },
        { value: 'error', label: 'Error' },
    ];


    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Audit Log</h1>
                <p className="text-muted-foreground">
                    A record of all major activities across the system.
                </p>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Filters &amp; Analysis</CardTitle>
                    <CardDescription>
                        Narrow down the logs using the filters below, then use AI to find important events.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        <Combobox
                            options={userOptions}
                            value={userFilter}
                            onValueChange={setUserFilter}
                            placeholder="Filter by user..."
                            searchPlaceholder="Search users..."
                        />
                        <Combobox
                            options={actionOptions}
                            value={actionFilter}
                            onValueChange={setActionFilter}
                            placeholder="Filter by action..."
                            searchPlaceholder="Search actions..."
                        />
                        <Combobox
                            options={severityOptions}
                            value={severityFilter}
                            onValueChange={setSeverityFilter}
                            placeholder="Filter by severity..."
                            searchPlaceholder="Search severities..."
                        />
                    </div>
                    <Button onClick={handleAnalysis} disabled={isAnalyzing}>
                        {isAnalyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Wand2 className="mr-2 h-4 w-4" />}
                        Analyze with AI
                    </Button>
                </CardContent>
            </Card>

            {isAnalyzing && (
                <Alert>
                    <Sparkles className="h-4 w-4" />
                    <AlertTitle>Analyzing Logs</AlertTitle>
                    <AlertDescription className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        The AI is processing the audit logs. This may take a moment...
                    </AlertDescription>
                </Alert>
            )}

            {analysisResult && (
                <Alert className="animate-fade-in">
                    <Sparkles className="h-4 w-4" />
                    <AlertTitle>AI-Powered Analysis</AlertTitle>
                    <AlertDescription className="prose prose-sm dark:prose-invert whitespace-pre-wrap">
                        {analysisResult}
                    </AlertDescription>
                </Alert>
            )}


            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileLock2 />
                        Activity History
                    </CardTitle>
                    <CardDescription>
                        This log shows all creation, update, and deletion events. Found {filteredLogs.length} matching entries.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>User</TableHead>
                                    <TableHead>Action</TableHead>
                                    <TableHead>Target</TableHead>
                                    <TableHead>Details</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-48 text-center">
                                            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                                        </TableCell>
                                    </TableRow>
                                ) : filteredLogs.length > 0 ? (
                                    filteredLogs.map((log) => (
                                        <TableRow key={log.id}>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {log.timestamp ? new Date(log.timestamp.seconds * 1000).toLocaleString() : 'No date'}
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {log.actor.name} <Badge variant="outline">{log.actor.role}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge 
                                                    variant={getSeverityVariant(log.severity)}
                                                    className="capitalize"
                                                >
                                                    {log.action.split('.').join(' ')}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="font-mono text-xs">
                                                {log.target.type}<br/>{log.target.id}
                                            </TableCell>
                                            <TableCell className="text-sm">{log.details}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">
                                            No system events found matching your filters.
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
