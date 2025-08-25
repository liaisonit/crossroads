
"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { collection, addDoc, updateDoc, deleteDoc, doc, getDoc } from "firebase/firestore";
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
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
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
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, MoreHorizontal, Edit, Trash2, Loader2, X, BookOpen } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import type { Job } from "@/lib/types";
import { logActivity } from "@/lib/audit";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export default function JobsClientPage({ initialJobs }: { initialJobs: Job[] }) {
  const [user] = useAuthState(auth);
  const { toast } = useToast();
  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setModalOpen] = useState(false);
  const [currentJob, setCurrentJob] = useState<Job | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const userRole = typeof window !== 'undefined' ? localStorage.getItem('userRole') : null;

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) =>
      job.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (job.foreman && job.foreman.toLowerCase().includes(searchTerm.toLowerCase())) ||
      job.jobCode.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [jobs, searchTerm]);

  const handleSave = async (jobData: Omit<Job, 'id'> & { id?: string }) => {
    setIsLoading(true);
    try {
      if (currentJob) {
        const { id, ...dataToUpdate } = jobData;
        const jobDoc = doc(db, "jobs", currentJob.id);
        
        await logActivity({
          actor: { name: user?.displayName, role: userRole, id: user?.uid },
          action: 'job.update',
          target: { type: 'job', id: currentJob.id, name: currentJob.name },
          diff: { before: currentJob, after: dataToUpdate },
        });

        await updateDoc(jobDoc, dataToUpdate);
        setJobs(jobs.map((job) =>
          job.id === currentJob.id ? { ...currentJob, ...dataToUpdate, id: currentJob.id } : job
        ));
        toast({ title: "Job Updated", description: `${dataToUpdate.name}'s details have been updated.` });
      } else {
        const docRef = await addDoc(collection(db, "jobs"), jobData);
        await logActivity({
          actor: { name: user?.displayName, role: userRole, id: user?.uid },
          action: 'job.create',
          target: { type: 'job', id: docRef.id, name: jobData.name },
          diff: { before: {}, after: jobData },
        });
        setJobs([...jobs, { ...jobData, id: docRef.id }]);
        toast({ title: "Job Added", description: `${jobData.name} has been added.` });
      }
      setModalOpen(false);
      setCurrentJob(null);
    } catch (error) {
      console.error("Error saving job:", error);
      toast({ variant: 'destructive', title: "Error", description: "Could not save job." });
    } finally {
        setIsLoading(false);
    }
  };
  
  const handleAddNew = () => {
    setCurrentJob(null);
    setModalOpen(true);
  };
  
  const handleEdit = (job: Job) => {
    setCurrentJob(job);
    setModalOpen(true);
  };

  const handleDelete = async (jobId: string) => {
    setIsLoading(true);
    try {
      const jobRef = doc(db, "jobs", jobId);
      const jobSnap = await getDoc(jobRef);
      const jobToDelete = jobSnap.data();
      
      await deleteDoc(jobRef);

      await logActivity({
        actor: { name: user?.displayName, role: userRole, id: user?.uid },
        action: 'job.delete',
        target: { type: 'job', id: jobId, name: jobToDelete?.name },
        diff: { before: jobToDelete, after: {} },
      });

      setJobs(jobs.filter(job => job.id !== jobId));
      toast({ variant: 'destructive', title: "Job Deleted", description: `The job has been removed from the system.` });
    } catch (error) {
      console.error("Error deleting job:", error);
      toast({ variant: 'destructive', title: "Error", description: "Could not delete job." });
    } finally {
        setIsLoading(false);
    }
  };

  const getScheduleStatus = (job: Job) => {
      if (!job.projectedCompletionDate) return { label: 'N/A', color: 'bg-gray-400' };
      const today = new Date();
      const completionDate = new Date(job.projectedCompletionDate);
      today.setHours(0,0,0,0);
      completionDate.setHours(0,0,0,0);

      const diffDays = (completionDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);

      if (diffDays < 0) return { label: 'Overdue', color: 'bg-red-500' };
      if (diffDays <= 7) return { label: 'Due Soon', color: 'bg-yellow-500' };
      return { label: 'On Track', color: 'bg-green-500' };
  }


  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Jobs</h1>
        <p className="text-muted-foreground">
          Manage all ongoing and completed jobs with real-time progress tracking.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Job List</CardTitle>
          <CardDescription>
            View, add, edit, or delete job records.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-4">
            <Input
              placeholder="Search jobs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
            <Button onClick={handleAddNew}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add New Job
            </Button>
          </div>
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job Site</TableHead>
                  <TableHead>Foreman</TableHead>
                  <TableHead>Budgeted Hours</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredJobs.length > 0 ? (
                  filteredJobs.map((job) => {
                    const budgetProgress = job.budgetHours ? ((job.currentHours || 0) / job.budgetHours) * 100 : 0;
                    const schedule = getScheduleStatus(job);
                    
                    return (
                        <TableRow key={job.id} className="animate-fade-in">
                        <TableCell className="font-medium">
                            <div>{job.name}</div>
                            <div className="text-xs text-muted-foreground">{job.jobCode}</div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{job.foreman || 'N/A'}</TableCell>
                        <TableCell>
                            <div className="flex flex-col gap-1">
                                <span>{(job.currentHours || 0).toFixed(1)} / {job.budgetHours || 'N/A'} hrs</span>
                                {job.budgetHours && (
                                    <Progress value={budgetProgress} className="h-2"/>
                                )}
                            </div>
                        </TableCell>
                        <TableCell>
                            <div className="flex items-center gap-2">
                                <div className={cn("h-2.5 w-2.5 rounded-full", schedule.color)}></div>
                                <span>{schedule.label}</span>
                            </div>
                             <div className="text-xs text-muted-foreground">
                                Due: {job.projectedCompletionDate || 'N/A'}
                            </div>
                        </TableCell>
                        <TableCell>
                            <Badge variant={
                                job.status === 'Ongoing' ? 'default' : job.status === 'Completed' ? 'secondary' : 'destructive'
                            }>
                                {job.status}
                            </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                            <AlertDialog>
                                <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-8 w-8 p-0" disabled={isLoading}>
                                    <span className="sr-only">Open menu</span>
                                    <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onSelect={() => handleEdit(job)}>
                                        <Edit className="mr-2 h-4 w-4"/>
                                        Edit
                                    </DropdownMenuItem>
                                     <DropdownMenuItem asChild>
                                        <Link href={`/admin/jobs/${job.id}/ledger`}>
                                            <BookOpen className="mr-2 h-4 w-4"/>
                                            View Ledger
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    {(userRole === 'Admin' || userRole === 'Super Admin') && (
                                    <AlertDialogTrigger asChild>
                                    <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10">
                                        <Trash2 className="mr-2 h-4 w-4"/>
                                        Delete
                                    </DropdownMenuItem>
                                    </AlertDialogTrigger>
                                    )}
                                </DropdownMenuContent>
                                </DropdownMenu>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This action cannot be undone. This will permanently delete the job record for {job.name}.
                                    </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(job.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>

                        </TableCell>
                        </TableRow>
                    )
                })
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      No results found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <JobFormModal
        isOpen={isModalOpen}
        onOpenChange={setModalOpen}
        onSave={handleSave}
        job={currentJob}
        isSaving={isLoading}
      />
    </div>
  );
}

// Job Form Modal Component
type JobFormModalProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (jobData: Omit<Job, 'id'> & { id?: string }) => void;
  job: Job | null;
  isSaving: boolean;
};

function JobFormModal({ isOpen, onOpenChange, onSave, job, isSaving }: JobFormModalProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<Omit<Job, 'id' | 'currentHours'>>({
    name: "",
    foreman: "",
    status: "Ongoing",
    jobCode: "",
    location: "",
    locations: [],
    gcName: "",
    budgetHours: 0,
    startDate: '',
    projectedCompletionDate: '',
  });
  const [newLocation, setNewLocation] = useState("");

  React.useEffect(() => {
    if (isOpen) {
        if (job) {
          setFormData({
            name: job.name || "",
            foreman: job.foreman || "",
            status: job.status || "Ongoing",
            jobCode: job.jobCode || "",
            location: job.location || "",
            locations: job.locations || [],
            gcName: job.gcName || "",
            budgetHours: job.budgetHours || 0,
            startDate: job.startDate || '',
            projectedCompletionDate: job.projectedCompletionDate || '',
          });
        } else {
          setFormData({
            name: "",
            foreman: "",
            status: "Ongoing",
            jobCode: "",
            location: "",
            locations: [],
            gcName: "",
            budgetHours: 0,
            startDate: new Date().toISOString().split('T')[0],
            projectedCompletionDate: '',
          });
        }
    }
  }, [job, isOpen]);

  const handleChange = (id: string, value: string | number) => {
    setFormData(prev => ({...prev, [id]: value}));
  }

  const handleSelectChange = (value: string) => {
    setFormData(prev => ({...prev, status: value as Job['status']}));
  }

  const handleAddLocation = () => {
    if(newLocation && !formData.locations.includes(newLocation)) {
        setFormData(prev => ({...prev, locations: [...prev.locations, newLocation]}));
        setNewLocation("");
    }
  }

  const handleRemoveLocation = (loc: string) => {
    setFormData(prev => ({...prev, locations: prev.locations.filter(l => l !== loc)}));
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.jobCode) {
        toast({ variant: 'destructive', title: "Error", description: "Please fill out Job Site and Job Code." });
        return;
    }
    // Ensure primary location is in the locations list
    const finalData = { ...formData };
    if (finalData.location && !finalData.locations.includes(finalData.location)) {
        finalData.locations.unshift(finalData.location);
    } else if (!finalData.location && finalData.locations.length > 0) {
        finalData.location = finalData.locations[0];
    }
    onSave({ ...finalData, id: job?.id });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md animate-fade-in">
        <form onSubmit={handleSubmit}>
            <DialogHeader>
            <DialogTitle>{job ? "Edit Job" : "Add New Job"}</DialogTitle>
            <DialogDescription>
                {job ? "Update the details for this job." : "Enter the details for the new job."}
            </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
              <div className="space-y-2">
                  <Label htmlFor="name">Job Site Name</Label>
                  <Input id="name" value={formData.name} onChange={e => handleChange(e.target.id, e.target.value)} required/>
              </div>
               <div className="space-y-2">
                  <Label htmlFor="jobCode">Job Code</Label>
                  <Input id="jobCode" value={formData.jobCode} onChange={e => handleChange(e.target.id, e.target.value)} required/>
              </div>
               <div className="space-y-2">
                  <Label htmlFor="location">Primary Location / Address</Label>
                  <Input id="location" value={formData.location} onChange={e => handleChange(e.target.id, e.target.value)} placeholder="e.g. 123 Main St, New York, NY"/>
              </div>
              <div className="space-y-2">
                <Label>Additional Locations / Sub-sites</Label>
                <div className="flex gap-2">
                    <Input value={newLocation} onChange={e => setNewLocation(e.target.value)} placeholder="e.g., East Wing, 5th Floor" />
                    <Button type="button" onClick={handleAddLocation} variant="outline">Add</Button>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                    {formData.locations.map(loc => (
                        <Badge key={loc} variant="secondary" className="flex items-center gap-1">
                            {loc}
                            <button type="button" onClick={() => handleRemoveLocation(loc)} className="rounded-full hover:bg-muted-foreground/20 p-0.5">
                                <X className="h-3 w-3" />
                            </button>
                        </Badge>
                    ))}
                </div>
              </div>
              <div className="space-y-2">
                  <Label htmlFor="gcName">GC Name</Label>
                  <Input id="gcName" value={formData.gcName} onChange={e => handleChange(e.target.id, e.target.value)} placeholder="General Contractor Name"/>
              </div>
               <div className="space-y-2">
                  <Label htmlFor="budgetHours">Budget Hours</Label>
                  <Input id="budgetHours" type="number" value={formData.budgetHours || ''} onChange={e => handleChange(e.target.id, e.target.valueAsNumber || 0)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input id="startDate" type="date" value={formData.startDate} onChange={e => handleChange(e.target.id, e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="projectedCompletionDate">End Date</Label>
                    <Input id="projectedCompletionDate" type="date" value={formData.projectedCompletionDate} onChange={e => handleChange(e.target.id, e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                  <Label htmlFor="foreman">Foreman</Label>
                  <Input id="foreman" value={formData.foreman} onChange={e => handleChange(e.target.id, e.target.value)} />
              </div>
              <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                   <Combobox
                        options={[
                            { value: 'Ongoing', label: 'Ongoing' },
                            { value: 'Completed', label: 'Completed' },
                            { value: 'On Hold', label: 'On Hold' },
                        ]}
                        value={formData.status}
                        onValueChange={handleSelectChange}
                        placeholder="Select status..."
                        searchPlaceholder="Search status..."
                   />
              </div>
            </div>
            <DialogFooter className="border-t pt-4">
                <DialogClose asChild>
                    <Button type="button" variant="secondary" disabled={isSaving}>Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : (job ? "Save Changes" : "Add Job")}
                </Button>
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
