
"use client";

import React, { useState, useEffect } from "react";
import { doc, getDoc, Timestamp, updateDoc, arrayUnion, serverTimestamp, deleteDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
  } from "@/components/ui/alert-dialog"
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
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Loader2, ArrowLeft, User, Clock, Briefcase, FileText, ImageIcon, HardHat, CheckCircle, XCircle, Flag, Download, Lock, Unlock, MessageSquare, Send, Thermometer, Droplets, Wind, History, Building, Trash2, ShieldCheck, LogOut, Ticket } from "lucide-react";
import type { Submission } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { logActivity } from "@/lib/audit";
import Logo from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import Footer from "@/components/footer";
import NotificationBell from "@/components/notification-bell";


export default function SubmissionDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");
  const [user] = useAuthState(auth);
  
  // PDF options
  const [showWeather, setShowWeather] = useState(true);
  const [showLocation, setShowLocation] = useState(true);

  useEffect(() => {
    const role = localStorage.getItem("userRole");
    const name = localStorage.getItem("userName");
    setUserRole(role);
    setUserName(name);
    
    if (typeof id !== "string") return;

    const fetchSubmission = async () => {
      setIsLoading(true);
      try {
        const docRef = doc(db, "submissions", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setSubmission({ id: docSnap.id, ...docSnap.data() } as Submission);
        } else {
          console.log("No such document!");
          toast({ variant: "destructive", title: "Error", description: "Submission not found." });
        }
      } catch (error) {
        console.error("Error fetching submission:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not fetch submission." });
      } finally {
        setIsLoading(false);
      }
    };

    fetchSubmission();
  }, [id, toast]);
  
  const handleLogout = async () => {
    await auth.signOut();
    localStorage.removeItem("userName");
    localStorage.removeItem("userRole");
    router.push("/login");
  };

  const handleStatusUpdate = async (newStatus: Submission['status']) => {
    if (typeof id !== "string" || !submission || !userName) return;
    setIsUpdating(true);
    try {
        const docRef = doc(db, "submissions", id);
        
        await logActivity({
          actor: { name: user?.displayName, id: user?.uid },
          action: 'submission.statusUpdate',
          target: { type: 'submission', id: submission.id, name: `Timesheet for ${submission.jobName} on ${submission.date}` },
          diff: { before: { status: submission.status }, after: { status: newStatus } },
          details: `Submission status changed from ${submission.status} to ${newStatus}`
        });

        const statusComment = {
            author: "System",
            text: `Status changed to ${newStatus} by ${userName}.`,
            createdAt: serverTimestamp(),
        };

        await updateDoc(docRef, { 
            status: newStatus,
            comments: arrayUnion(statusComment)
        });

        // Refetch data to get server-generated timestamp
        const updatedDoc = await getDoc(docRef);
        setSubmission({ id: updatedDoc.id, ...updatedDoc.data() } as Submission);

        toast({ title: "Status Updated", description: `Report has been ${newStatus.toLowerCase()}.` });
    } catch(error) {
        console.error("Error updating status:", error);
        toast({ variant: "destructive", title: "Update Failed", description: "Could not update the report status." });
    } finally {
        setIsUpdating(false);
    }
  }

  const handleDeleteSubmission = async () => {
    if (typeof id !== "string" || !submission || !user) return;
    setIsUpdating(true);
    
    // Log deletion event first
    await logActivity({
        actor: { name: user.displayName, id: user.uid },
        action: 'submission.delete',
        target: { type: 'submission', id: id, name: `Timesheet for ${submission.jobName}` },
        diff: { before: submission, after: {} },
    });

    try {
        await deleteDoc(doc(db, "submissions", id));
        toast({ title: "Submission Deleted", description: "The timesheet has been permanently removed." });
        router.push("/submissions");
    } catch (error) {
        console.error("Error deleting submission:", error);
        toast({ variant: "destructive", title: "Deletion Failed", description: "Could not delete the submission." });
        setIsUpdating(false);
    }
  }

  const handleAddComment = async () => {
    if (!newComment.trim() || !userName) return;
    if (typeof id !== "string" || !submission) return;

    const comment = {
        author: userName,
        text: newComment,
        createdAt: serverTimestamp(),
    };

    try {
        const docRef = doc(db, "submissions", id);
        await updateDoc(docRef, { comments: arrayUnion(comment) });
        // Refetch to get accurate timestamp
        const updatedDoc = await getDoc(docRef);
        setSubmission({ id: updatedDoc.id, ...updatedDoc.data() } as Submission);

        setNewComment("");
        toast({ title: "Comment Added" });
    } catch(error) {
        console.error("Error adding comment:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not add your comment." });
    }
  }

  const generatePDF = async () => {
    toast({
      variant: "destructive",
      title: "Feature Temporarily Disabled",
      description: "PDF generation is currently disabled to resolve deployment issues.",
    });
    return;
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background text-center">
        <h1 className="text-2xl font-bold mb-4">Report Not Found</h1>
        <p className="text-muted-foreground mb-6">The requested submission could not be found.</p>
        <Button asChild>
            <Link href="/submissions">
                <ArrowLeft className="mr-2" />
                Back to Submissions
            </Link>
        </Button>
      </div>
    );
  }

  const totalHours = submission.employees.reduce((acc, emp) => acc + emp.totalHours, 0);
  const totalRegularHours = submission.employees.reduce((acc, emp) => acc + emp.regularHours, 0);
  const totalOvertimeHours = submission.employees.reduce((acc, emp) => acc + emp.overtimeHours, 0);
  const totalShiftHours = submission.employees.reduce((acc, emp) => acc + emp.shiftHours, 0);

  const canApprove = userRole === 'Super Admin' || userRole === 'Admin' || userRole === 'Billing Team';
  const canDelete = userRole === 'Super Admin' || userRole === 'Admin';
  const canLock = userRole === 'Super Admin';
  const isLocked = submission.status === 'Locked';
  const isFinalized = submission.status === 'Approved' || submission.status === 'Rejected';
  const actionsDisabled = isUpdating || isLocked || (isFinalized && !canLock);
  const isForeman = userRole === 'Foreman';
  const backHref = isForeman ? '/dashboard' : '/submissions';
  const backText = isForeman ? 'Back to Dashboard' : 'Back to All Submissions';


  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
        <header className="flex items-center justify-between p-4 border-b shrink-0 h-16 z-20 bg-background/50 backdrop-blur-sm sticky top-0">
          <div className="flex items-center gap-4">
            <Logo />
          </div>
          <div className="flex items-center gap-4 animate-fade-in">
             <NotificationBell />
            <div className="text-right hidden sm:block">
              <p className="font-semibold text-sm">{userName}</p>
              <p className="text-xs text-muted-foreground">{userRole}</p>
            </div>
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={handleLogout} className="lift-button">
                <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 md:p-8 animate-fade-in">
            <div className="max-w-7xl mx-auto">
                <div className="mb-6 flex justify-between items-start gap-4 flex-wrap">
                     <Button asChild variant="outline" className="lift-button">
                        <Link href={backHref}>
                            <ArrowLeft className="mr-2" />
                            {backText}
                        </Link>
                    </Button>
                    <div className="flex items-center gap-4 flex-wrap">
                      {/* 
                      <div className="flex items-center space-x-2">
                        <Checkbox id="show-weather" checked={showWeather} onCheckedChange={(checked) => setShowWeather(!!checked)} />
                        <Label htmlFor="show-weather" className="text-sm">Show Weather</Label>
                      </div>
                       <div className="flex items-center space-x-2">
                        <Checkbox id="show-location" checked={showLocation} onCheckedChange={(checked) => setShowLocation(!!checked)} />
                        <Label htmlFor="show-location" className="text-sm">Show Location</Label>
                      </div>
                      */}
                      <Button onClick={generatePDF} className="lift-button">
                          <Download className="mr-2"/>
                          Download PDF
                      </Button>
                    </div>
                </div>

                <Card className="glassmorphism">
                    <CardHeader className="flex flex-row justify-between items-start">
                        <div>
                            <CardTitle className="text-3xl font-bold">{submission.jobName}</CardTitle>
                            <CardDescription>
                                Daily report submitted on {new Date(submission.submittedAt.seconds * 1000).toLocaleString()}
                            </CardDescription>
                        </div>
                        <Badge variant={getStatusBadgeVariant(submission.status)} className="text-lg">
                            {submission.status || 'Submitted'}
                        </Badge>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Main Details */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div className="flex items-center gap-2"><HardHat className="text-primary"/><strong>Foreman:</strong><span>{submission.foreman}</span></div>
                            <div className="flex items-center gap-2"><Clock className="text-primary"/><strong>Report Date:</strong><span>{submission.date}</span></div>
                            <div className="flex items-center gap-2"><Briefcase className="text-primary"/><strong>Job Location:</strong><span>{submission.location || 'N/A'}</span></div>
                            <div className="flex items-center gap-2"><Building className="text-primary"/><strong>GC Name:</strong><span>{submission.gcName || 'N/A'}</span></div>
                            {submission.workType && (
                                <div className="flex items-center gap-2 capitalize"><Ticket className="text-primary"/><strong>Work Type:</strong><Badge variant="outline">{submission.workType}</Badge></div>
                            )}
                             {submission.workType === 'ticket' && submission.ticketNumber && (
                                <div className="flex items-center gap-2"><Ticket className="text-primary"/><strong>Ticket #:</strong><span>{submission.ticketNumber}</span></div>
                            )}
                        </div>

                        {submission.weather && (
                          <div className="text-sm space-y-2">
                              <h4 className="font-semibold flex items-center gap-2"><FileText /> Weather Conditions (Automatic)</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 p-2 rounded-md bg-secondary/50">
                                  <div className="flex items-center gap-2"><Thermometer className="h-4 w-4 text-primary"/>Temperature: {submission.weather.temperature}°F</div>
                                  <div className="flex items-center gap-2"><Droplets className="h-4 w-4 text-primary"/>Humidity: {submission.weather.humidity}%</div>
                                  <div className="flex items-center gap-2"><Wind className="h-4 w-4 text-primary"/>Dewpoint: {submission.weather.dewpoint}°F</div>
                                  <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary"/>Description: {submission.weather.description || 'N/A'}</div>
                              </div>
                          </div>
                        )}
                        
                        {submission.manualWeatherReadings && submission.manualWeatherReadings.length > 0 && (
                            <div>
                                <h4 className="text-lg font-semibold mb-2 flex items-center gap-2"><Thermometer /> Manual Weather Readings</h4>
                                <div className="border rounded-lg overflow-hidden">
                                    <Table>
                                        <TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Temp</TableHead><TableHead>Humidity</TableHead><TableHead>Dewpoint</TableHead><TableHead>Description</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {submission.manualWeatherReadings.map((reading, index) => (
                                                <TableRow key={index}>
                                                    <TableCell>{reading.time}</TableCell>
                                                    <TableCell>{reading.temperature}°F</TableCell>
                                                    <TableCell>{reading.humidity}%</TableCell>
                                                    <TableCell>{reading.dewpoint}°F</TableCell>
                                                    <TableCell>{reading.description}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        )}

                        <Separator />
                        
                        {/* Employee Hours */}
                        <div>
                            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2"><User /> Employee Hours</h3>
                            <div className="border rounded-lg overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Employee</TableHead>
                                            <TableHead>Role</TableHead>
                                            <TableHead>Location</TableHead>
                                            <TableHead>Task</TableHead>
                                            <TableHead>Time</TableHead>
                                            <TableHead className="text-right">Reg</TableHead>
                                            <TableHead className="text-right">OT</TableHead>
                                            <TableHead className="text-right">Shift</TableHead>
                                            <TableHead className="text-right">Total</TableHead>
                                            <TableHead>Notes</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {submission.employees.map((emp, index) => (
                                            <TableRow key={index}>
                                                <TableCell className="font-medium">{emp.employee}</TableCell>
                                                <TableCell>{emp.role}</TableCell>
                                                <TableCell className="text-xs text-muted-foreground">{emp.workLocation || 'N/A'}</TableCell>
                                                <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{emp.taskDescription}</TableCell>
                                                <TableCell>{emp.startTime} - {emp.endTime}</TableCell>
                                                <TableCell className="text-right">{emp.regularHours.toFixed(2)}</TableCell>
                                                <TableCell className="text-right">{emp.overtimeHours.toFixed(2)}</TableCell>
                                                <TableCell className="text-right">{emp.shiftHours.toFixed(2)}</TableCell>
                                                <TableCell className="text-right font-bold">{emp.totalHours.toFixed(2)}</TableCell>
                                                <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{emp.notes || '-'}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                            <div className="flex justify-end gap-4 mt-2 font-bold text-sm p-2 bg-secondary/50 rounded-md">
                               <span>Total Regular: {totalRegularHours.toFixed(2)}</span>
                               <span>Total Overtime: {totalOvertimeHours.toFixed(2)}</span>
                               <span>Total Shift: {totalShiftHours.toFixed(2)}</span>
                               <Separator orientation="vertical" className="h-auto"/>
                               <span>Grand Total: {totalHours.toFixed(2)}</span>
                            </div>
                        </div>
                        
                        {submission.equipment && submission.equipment.length > 0 && (
                            <>
                                <Separator />
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg flex items-center gap-2"><Briefcase /> Materials/Equipments Used</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="border rounded-lg overflow-hidden">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Item</TableHead>
                                                        <TableHead className="text-right">Quantity</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {submission.equipment.map((item, index) => (
                                                        <TableRow key={index}>
                                                            <TableCell>{item.equipment}</TableCell>
                                                            <TableCell className="text-right">{item.quantity}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </CardContent>
                                </Card>
                            </>
                        )}


                        {submission.safetyChecklist && (
                            <>
                            <Separator />
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg flex items-center gap-2"><ShieldCheck/> Daily Safety Checklist</CardTitle>
                                </CardHeader>
                                 <CardContent className="space-y-2">
                                     <div className="flex items-center gap-2">
                                        {submission.safetyChecklist.ppe 
                                            ? <CheckCircle className="text-green-500"/>
                                            : <XCircle className="text-destructive"/>
                                        }
                                        <span>All crew members have required PPE.</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {submission.safetyChecklist.tools
                                            ? <CheckCircle className="text-green-500"/>
                                            : <XCircle className="text-destructive"/>
                                        }
                                        <span>Tools and equipment have been inspected.</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {submission.safetyChecklist.siteClear
                                            ? <CheckCircle className="text-green-500"/>
                                            : <XCircle className="text-destructive"/>
                                        }
                                        <span>Work area is clear of hazards.</span>
                                    </div>
                                </CardContent>
                            </Card>
                            </>
                        )}

                        {submission.generalNotes && (
                            <>
                            <Separator />
                             <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg flex items-center gap-2"><FileText /> General Notes</CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 border rounded-lg bg-secondary/50 text-sm text-muted-foreground">
                                    <p className="whitespace-pre-wrap">{submission.generalNotes}</p>
                                </CardContent>
                            </Card>
                            </>
                        )}


                         {/* Comments Section */}
                        <div>
                            <Separator className="my-6"/>
                            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2"><MessageSquare /> Comments</h3>
                            <div className="space-y-4">
                                <div className="space-y-3 max-h-48 overflow-y-auto pr-2 border rounded-md p-2 bg-background">
                                    {submission.comments && submission.comments.length > 0 ? (
                                        submission.comments.map((comment, index) => (
                                            <div key={index} className="flex gap-2 text-sm p-2 rounded-md bg-secondary/50">
                                                <div className="font-semibold w-24">{comment.author}:</div>
                                                <p className="flex-1 text-muted-foreground">{comment.text}</p>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-sm text-muted-foreground text-center p-4">No comments yet.</p>
                                    )}
                                </div>
                                {canApprove && !isLocked && !isFinalized &&(
                                    <div className="flex gap-2">
                                        <Textarea 
                                            placeholder="Add a comment..." 
                                            value={newComment}
                                            onChange={(e) => setNewComment(e.target.value)}
                                        />
                                        <Button onClick={handleAddComment} disabled={!newComment.trim()}>
                                            <Send />
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        {/* Signature & Receipt */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6">
                            <div>
                                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2"><HardHat /> Foreman Signature</h3>
                                 <div className="border rounded-lg p-2 bg-secondary flex justify-center items-center h-40">
                                    {submission.signature ? (
                                        <Image src={submission.signature} alt="Foreman Signature" width={300} height={150} className="object-contain" />
                                    ) : <p className="text-muted-foreground">No Signature</p>}
                                </div>
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2"><ImageIcon /> Receipt</h3>
                                 <div className="border rounded-lg p-2 bg-secondary flex justify-center items-center h-40">
                                    {submission.receiptImage ? (
                                        <Image src={submission.receiptImage} alt="Uploaded Receipt" width={300} height={150} className="object-contain" />
                                    ) : <p className="text-muted-foreground">No Receipt Uploaded</p>}
                                </div>
                            </div>
                        </div>

                        {(canLock || canDelete) && (
                            <>
                            <Separator className="my-6" />
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg flex items-center gap-2"><History /> Audit Trail</CardTitle>
                                    <CardDescription>A log of all actions taken on this submission.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {canLock && <div>
                                        <h4 className="font-semibold text-sm mb-2">Status History &amp; Comments</h4>
                                        <div className="border rounded-lg max-h-60 overflow-y-auto">
                                            <Table>
                                                <TableBody>
                                                    {submission.comments && submission.comments.length > 0 ? (
                                                         [...submission.comments].sort((a,b) => b.createdAt.toMillis() - a.createdAt.toMillis()).map((comment, index) => (
                                                            <TableRow key={`comment-${index}`}>
                                                                <TableCell className="w-40">
                                                                    <span className="font-medium">{comment.author}</span>
                                                                    <p className="text-xs text-muted-foreground">
                                                                        {new Date(comment.createdAt.seconds * 1000).toLocaleString()}
                                                                    </p>
                                                                </TableCell>
                                                                <TableCell>{comment.text}</TableCell>
                                                            </TableRow>
                                                        ))
                                                    ) : (
                                                        <TableRow><TableCell className="text-center p-4 text-muted-foreground">No comments or status changes.</TableCell></TableRow>
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>}
                                    {canLock && <div>
                                        <h4 className="font-semibold text-sm mb-2">PDF Download History</h4>
                                        <div className="border rounded-lg max-h-48 overflow-y-auto">
                                            <Table>
                                                <TableBody>
                                                    {submission.downloadHistory && submission.downloadHistory.length > 0 ? (
                                                        [...submission.downloadHistory].sort((a,b) => b.downloadedAt.toMillis() - a.downloadedAt.toMillis()).map((download, index) => (
                                                            <TableRow key={`download-${index}`}>
                                                               <TableCell className="w-40 font-medium">{download.downloadedBy}</TableCell>
                                                               <TableCell className="text-muted-foreground">{new Date(download.downloadedAt.seconds * 1000).toLocaleString()}</TableCell>
                                                            </TableRow>
                                                        ))
                                                    ) : (
                                                        <TableRow><TableCell className="text-center p-4 text-muted-foreground">No downloads recorded.</TableCell></TableRow>
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>}
                                    {(canDelete) && <div className="pt-4">
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="destructive" disabled={isUpdating}>
                                                    <Trash2 className="mr-2" />
                                                    Delete Submission
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This action cannot be undone. This will permanently delete this timesheet submission.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={handleDeleteSubmission} className="bg-destructive hover:bg-destructive/90">
                                                        Yes, Delete Submission
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>}
                                </CardContent>
                            </Card>
                            </>
                        )}

                    </CardContent>
                    {canApprove && (
                        <CardFooter className="bg-secondary/50 p-4 border-t flex justify-end gap-2 flex-wrap">
                            <Button variant="outline" onClick={() => handleStatusUpdate('Flagged')} disabled={actionsDisabled}>
                                <Flag className="mr-2"/>
                                Flag for Review
                            </Button>
                            <Button variant="destructive" onClick={() => handleStatusUpdate('Rejected')} disabled={actionsDisabled}>
                                <XCircle className="mr-2"/>
                                Reject
                            </Button>
                            <Button onClick={() => handleStatusUpdate('Approved')} disabled={actionsDisabled}>
                                <CheckCircle className="mr-2"/>
                                Approve
                            </Button>
                            {canLock && (
                                isLocked ? (
                                    <Button onClick={() => handleStatusUpdate('Submitted')} disabled={isUpdating} variant="secondary">
                                        <Unlock className="mr-2"/>
                                        Unlock
                                    </Button>
                                ) : (
                                    <Button onClick={() => handleStatusUpdate('Locked')} disabled={isUpdating || isFinalized} variant="secondary">
                                        <Lock className="mr-2"/>
                                        Lock
                                    </Button>
                                )
                            )}
                        </CardFooter>
                    )}
                </Card>
            </div>
        </main>
        <Footer />
    </div>
  );
}
