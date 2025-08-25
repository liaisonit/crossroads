

"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { collection, getDocs, doc, getDoc, updateDoc, serverTimestamp, arrayUnion } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Trash2, Plus, LogOut, Loader2, UploadCloud, X, CheckCircle, ArrowLeft, Edit, Wand2, Thermometer } from "lucide-react";
import SignaturePad from "@/components/signature-pad";
import { useToast } from "@/hooks/use-toast";
import Logo from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import WeatherDisplay from "@/components/weather-display";
import { Combobox } from "@/components/ui/combobox";
import type { Employee, RoleType, Submission, Job, Equipment, JobType, ManualWeatherReading, Union, ShiftTemplate } from "@/lib/types";
import type { WeatherOutput } from "@/ai/flows/weather";
import { generateTags } from "@/ai/flows/tagging-flow";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type EmployeeEntry = {
  id: number;
  employee: string;
  role: string;
  union: 'DC09' | '806';
  startTime: string;
  endTime: string;
  notes: string;
  tags: string[];
  workLocation: string;
  taskDescription: string;
  rateType: 'Regular' | 'Powertool/Spray';
  isShiftRate: boolean;
};

type EquipmentEntry = {
  id: number;
  equipment: string;
  quantity: number;
  isClosing?: boolean;
};

type EditTimesheetClientPageProps = {
    submission: Submission;
    jobs: Job[];
    equipment: Equipment[];
    employees: Employee[];
    roleTypes: RoleType[];
    jobTypes: JobType[];
    unions: Union[];
    shiftTemplates: ShiftTemplate[];
}

export default function EditTimesheetClientPage({ submission, jobs, equipment, employees, roleTypes, jobTypes, unions, shiftTemplates }: EditTimesheetClientPageProps) {
  const router = useRouter();
  const params = useParams();
  const submissionId = params.id as string;

  const { toast } = useToast();
  const [user, authLoading] = useAuthState(auth);

  const [foreman, setForeman] = useState<string | null>(submission.foreman);
  const [currentDate, setCurrentDate] = useState(submission.date);
  
  const [employeeEntries, setEmployeeEntries] = useState<EmployeeEntry[]>(submission.employees.map((e, i) => ({
      ...e,
      id: Date.now() + i,
      tags: e.tags || [],
  })));

  const [equipmentEntries, setEquipmentEntries] = useState<EquipmentEntry[]>(submission.equipment?.map((e,i) => ({...e, id: Date.now() + i})) || []);
  const [generalNotes, setGeneralNotes] = useState(submission.generalNotes || "");
  const [isSignatureModalOpen, setSignatureModalOpen] = useState(false);
  const [isSuccessModalOpen, setSuccessModalOpen] = useState(false);
  const [signature, setSignature] = useState<string | null>(submission.signature);
  const [receiptImage, setReceiptImage] = useState<string | null>(submission.receiptImage || null);
  const [selectedJobId, setSelectedJobId] = useState<string | undefined>(submission.jobId);
  const signaturePadRef = useRef<{ clear: () => void }>(null);
  const [weatherData, setWeatherData] = useState<WeatherOutput | null>(submission.weather || null);
  const [resubmissionComment, setResubmissionComment] = useState("");
  const [manualWeatherReadings, setManualWeatherReadings] = useState<ManualWeatherReading[]>(submission.manualWeatherReadings?.map((r, i) => ({ ...r, id: Date.now() + i })) || []);
  
  const [isEmployeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [currentEmployeeEntry, setCurrentEmployeeEntry] = useState<EmployeeEntry | null>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
     const savedSignature = localStorage.getItem("foremanSignature");
    if (savedSignature) {
        setSignature(savedSignature);
    }
  }, [user, authLoading, router]);

  const availableEmployees = useMemo(() => {
    const selectedEmployeeNames = employeeEntries.map(entry => entry.employee);
    return employees.filter(emp => emp.roleName !== 'Foreman' && emp.roleName !== 'Super Admin' && !selectedEmployeeNames.includes(emp.name));
  }, [employees, employeeEntries]);

  const handleEquipmentChange = (id: number, field: 'equipment' | 'quantity', value: string | number) => {
    setEquipmentEntries(prev => prev.map(entry => {
        if (entry.id === id) {
             if (field === 'quantity') {
                 return {...entry, quantity: Number(value) || 1 };
             }
            return {...entry, [field]: value};
        }
        return entry;
    }));
  };
  
  const removeEmployeeEntry = (id: number) => {
    setEmployeeEntries((prevEntries) =>
        prevEntries.filter((entry) => entry.id !== id)
    );
  };

  const addEquipmentEntry = () => {
    setEquipmentEntries([
      ...equipmentEntries,
      { id: Date.now(), equipment: "", quantity: 1, isClosing: false },
    ]);
  };

  const removeEquipmentEntry = (id: number) => {
    setEquipmentEntries((prevEntries) =>
      prevEntries.map((entry) =>
        entry.id === id ? { ...entry, isClosing: true } : entry
      )
    );
    setTimeout(() => {
      setEquipmentEntries((prevEntries) =>
        prevEntries.filter((entry) => entry.id !== id)
      );
    }, 500);
  };

  const equipmentOptions = useMemo(() => {
    return equipment.map(e => ({ value: e.name, label: e.name }));
  }, [equipment]);

  const getAvailableEquipmentOptions = (currentEquipment: string) => {
    const selectedIds = equipmentEntries.map(entry => entry.equipment).filter(eq => eq !== currentEquipment);
    return equipmentOptions.filter(opt => !selectedIds.includes(opt.value));
  }


  const handleSaveSignature = (dataUrl: string) => {
    setSignature(dataUrl);
    localStorage.setItem("foremanSignature", dataUrl);
    setSignatureModalOpen(false);
    toast({
      title: "Signature Captured",
      description: "Your signature has been saved.",
    });
  };

  const handleReceiptUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceiptImage(reader.result as string);
        toast({ title: "Receipt Uploaded", description: "The receipt image has been loaded." });
      };
      reader.readAsDataURL(file);
    }
  };
  
  const calculateHours = (startTime: string, endTime: string, isShiftRate: boolean) => {
    const start = new Date(`1970-01-01T${startTime}:00`);
    const end = new Date(`1970-01-01T${endTime}:00`);
    
    if (end < start) {
        end.setDate(end.getDate() + 1);
    }
    
    const diff = (end.getTime() - start.getTime()) / (1000 * 60);
    const totalHours = Math.max(0, (diff - 30) / 60); 

    if (totalHours === 0) return { totalHours: 0, regularHours: 0, overtimeHours: 0, shiftHours: 0 };
    
    const today = new Date();
    const dayOfWeek = today.getDay();
    const isWeekend = dayOfWeek === 6 || dayOfWeek === 0;

    if(isShiftRate) {
        return { totalHours, regularHours: 0, overtimeHours: 0, shiftHours: totalHours };
    }

    if(isWeekend) {
        return { totalHours, regularHours: 0, overtimeHours: totalHours, shiftHours: 0 };
    }

    const regularStart = new Date('1970-01-01T06:00:00');
    const regularEnd = new Date('1970-01-01T14:30:00');

    const overlapStart = new Date(Math.max(start.getTime(), regularStart.getTime()));
    const overlapEnd = new Date(Math.min(end.getTime(), regularEnd.getTime()));

    let regularMinutes = 0;
    if (overlapEnd > overlapStart) {
        regularMinutes = (overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60);
    }
    
    const regularHours = Math.max(0, (regularMinutes - 30) / 60);
    const overtimeHours = Math.max(0, totalHours - regularHours);

    return { totalHours, regularHours, overtimeHours, shiftHours: 0 };
  };


  const handleSubmit = async () => {
    if (!selectedJobId || !submissionId) return;
    if (employeeEntries.length === 0) {
        toast({ variant: "destructive", title: "Error", description: "Please add at least one employee log." });
        return;
    }
    if (!signature) {
      toast({ variant: "destructive", title: "Error", description: "Please provide a signature." });
      return;
    }
    if (!resubmissionComment.trim()) {
      toast({ variant: "destructive", title: "Error", description: "A resubmission comment is required." });
      return;
    }
    
    setIsSubmitting(true);
    
    const processedEmployees = employeeEntries.map(entry => {
        const { totalHours, regularHours, overtimeHours, shiftHours } = calculateHours(entry.startTime, entry.endTime, entry.isShiftRate);
        return {
            employee: entry.employee,
            role: entry.role,
            union: entry.union,
            workLocation: entry.workLocation,
            taskDescription: entry.taskDescription,
            startTime: entry.startTime,
            endTime: entry.endTime,
            notes: entry.notes,
            tags: entry.tags,
            rateType: entry.rateType,
            isShiftRate: entry.isShiftRate,
            totalHours,
            regularHours,
            overtimeHours,
            shiftHours
        };
    });

    const newComment = {
        author: foreman,
        text: `Resubmitted with changes: ${resubmissionComment}`,
        createdAt: serverTimestamp(),
    };
    
    const selectedJobData = jobs.find(j => j.id === selectedJobId);

    try {
        const submissionRef = doc(db, "submissions", submissionId);
        await updateDoc(submissionRef, {
            foremanId: user.uid,
            jobId: selectedJobId,
            jobName: selectedJobData?.name,
            location: selectedJobData?.location,
            gcName: selectedJobData?.gcName || null,
            employees: processedEmployees,
            equipment: equipmentEntries.map(({ id, isClosing, ...rest }) => rest),
            generalNotes,
            signature,
            receiptImage,
            submittedAt: serverTimestamp(),
            status: 'Submitted', // Reset status
            weather: weatherData,
            manualWeatherReadings: manualWeatherReadings.map(({id, ...rest}) => rest),
            comments: arrayUnion(newComment)
        });
      setSuccessModalOpen(true);
    } catch (error) {
      console.error("Error resubmitting timesheet: ", error);
      toast({ variant: "destructive", title: "Resubmission Failed", description: "Could not resubmit the timesheet." });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await auth.signOut();
    localStorage.removeItem("userName");
    localStorage.removeItem("userRole");
    router.push("/login");
  };

  const handleOpenEmployeeModal = (entry: EmployeeEntry | null) => {
    setCurrentEmployeeEntry(entry);
    setEmployeeModalOpen(true);
  }

  const handleSaveEmployeeLog = (entry: EmployeeEntry) => {
    if(currentEmployeeEntry) { // Editing
      setEmployeeEntries(prev => prev.map(e => e.id === currentEmployeeEntry.id ? entry : e));
    } else { // Adding
      setEmployeeEntries(prev => [...prev, {...entry, id: Date.now() }]);
    }
    setEmployeeModalOpen(false);
    setCurrentEmployeeEntry(null);
  }

  const handleAddWeatherReading = () => {
    setManualWeatherReadings(prev => [...prev, {
        id: Date.now(),
        time: new Date().toTimeString().slice(0,5),
        temperature: 0,
        humidity: 0,
        dewpoint: 0,
        description: ''
    }]);
  }

  const handleRemoveWeatherReading = (id: number) => {
      setManualWeatherReadings(prev => prev.filter(r => r.id !== id));
  }

  const handleWeatherReadingChange = (id: number, field: keyof Omit<ManualWeatherReading, 'id'>, value: string | number) => {
      setManualWeatherReadings(prev => prev.map(r => r.id === id ? {...r, [field]: value} : r));
  }

  const selectedJob = jobs.find(job => job.id === selectedJobId);
  const jobOptions = jobs.map(j => ({ value: j.id, label: j.name }));


  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-y-auto">
      <header className="flex items-center justify-between p-4 border-b shrink-0 animate-fade-in h-16">
        <div className="flex items-center gap-4">
          <Button asChild variant="outline" size="icon" className="lift-button">
              <Link href="/dashboard">
                  <ArrowLeft />
              </Link>
          </Button>
          <Logo />
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="font-semibold text-sm">{foreman}</p>
            <p className="text-xs text-muted-foreground">Foreman</p>
          </div>
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={handleLogout} className="lift-button">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-6 animate-fade-in">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 max-w-7xl mx-auto">
          {/* Left Column */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <Card className="animate-fade-in">
              <CardHeader>
                <CardTitle>Edit Timesheet</CardTitle>
                <CardDescription>{currentDate}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="jobName">Job Name</Label>
                      <Combobox
                        options={jobOptions}
                        value={selectedJobId}
                        onValueChange={setSelectedJobId}
                        placeholder="Select a job..."
                        searchPlaceholder="Search jobs..."
                      />
                    </div>
                  {selectedJob?.gcName && (
                    <div className="text-sm text-muted-foreground pt-2">
                        <strong>GC:</strong> {selectedJob.gcName}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

             <Card className="animate-fade-in" style={{animationDelay: '100ms'}}>
                <CardHeader>
                    <CardTitle>Weather</CardTitle>
                    <CardDescription>Automatic and manual weather logs.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <WeatherDisplay weather={weatherData} isLoading={false} jobSelected={!!selectedJobId} />
                     <div className="space-y-2">
                        <Label>Manual Weather Log</Label>
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                           {manualWeatherReadings.map(reading => (
                               <div key={reading.id} className="grid grid-cols-[auto_1fr_auto] gap-2 items-center p-2 rounded-md border">
                                    <Input type="time" value={reading.time} onChange={e => handleWeatherReadingChange(reading.id, 'time', e.target.value)} className="w-24"/>
                                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
                                       <Input type="number" placeholder="Temp °F" value={reading.temperature || ''} onChange={e => handleWeatherReadingChange(reading.id, 'temperature', e.target.valueAsNumber)} />
                                       <Input type="number" placeholder="Hum %" value={reading.humidity || ''} onChange={e => handleWeatherReadingChange(reading.id, 'humidity', e.target.valueAsNumber)} />
                                       <Input type="number" placeholder="Dew °F" value={reading.dewpoint || ''} onChange={e => handleWeatherReadingChange(reading.id, 'dewpoint', e.target.valueAsNumber)} />
                                       <Input type="text" placeholder="Desc" value={reading.description} onChange={e => handleWeatherReadingChange(reading.id, 'description', e.target.value)} />
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => handleRemoveWeatherReading(reading.id)} className="text-muted-foreground hover:text-destructive shrink-0">
                                        <Trash2 className="h-4 w-4"/>
                                    </Button>
                               </div>
                           ))}
                        </div>
                        <Button variant="outline" size="sm" onClick={handleAddWeatherReading} className="w-full">
                            <Thermometer className="mr-2 h-4 w-4" />
                            Add Manual Reading
                        </Button>
                    </div>
                </CardContent>
             </Card>

            <Card className="animate-fade-in border-primary/50" style={{animationDelay: '100ms'}}>
                <CardHeader>
                    <CardTitle>Resubmission Comment</CardTitle>
                    <CardDescription>Please explain the changes you made. This is required.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Textarea 
                        value={resubmissionComment}
                        onChange={(e) => setResubmissionComment(e.target.value)}
                        placeholder="e.g., Corrected hours for John Doe, added missing equipment..."
                        required
                    />
                </CardContent>
            </Card>

            <Card className="animate-fade-in" style={{animationDelay: '100ms'}}>
              <CardHeader>
                <CardTitle>Materials/Equipments Used</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                {equipmentEntries.map((entry) => (
                    <div
                    key={entry.id}
                    className={`transition-all duration-500 animate-fade-in grid grid-cols-[1fr_auto_auto] items-center gap-2 ${
                        entry.isClosing ? "opacity-0 -translate-x-full" : "opacity-100"
                    }`}
                    >
                    <Combobox
                        options={getAvailableEquipmentOptions(entry.equipment)}
                        value={entry.equipment}
                        onValueChange={(value) => handleEquipmentChange(entry.id, 'equipment', value)}
                        placeholder="Select material..."
                        searchPlaceholder="Search material..."
                    />
                        <Input 
                        type="number" 
                        className="w-20"
                        value={entry.quantity || ''}
                        onChange={(e) => handleEquipmentChange(entry.id, 'quantity', e.target.valueAsNumber || 1)}
                        min="1"
                        />
                        <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeEquipmentEntry(entry.id)}
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 lift-button shrink-0"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                    </div>
                ))}
                </div>
                <Button variant="outline" size="sm" onClick={addEquipmentEntry} className="w-full mt-2">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Material/Equipment
                </Button>
              </CardContent>
            </Card>
            
             <Card className="animate-fade-in" style={{animationDelay: '200ms'}}>
                <CardHeader>
                    <CardTitle>General Notes</CardTitle>
                </CardHeader>
                <CardContent>
                    <Textarea
                        id="generalNotes"
                        placeholder="e.g., Any absentees, overall project status..."
                        value={generalNotes}
                        onChange={(e) => setGeneralNotes(e.target.value)}
                    />
                </CardContent>
            </Card>

            <Card className="animate-fade-in" style={{animationDelay: '300ms'}}>
                <CardHeader>
                    <CardTitle>Receipts & Reimbursements</CardTitle>
                    <CardDescription>Upload a screenshot of any bills to be reimbursed.</CardDescription>
                </CardHeader>
                <CardContent>
                    {!receiptImage ? (
                        <div className="relative border-2 border-dashed border-muted-foreground/50 rounded-lg p-6 text-center">
                            <UploadCloud className="mx-auto h-10 w-10 text-muted-foreground" />
                            <p className="mt-2 text-sm text-muted-foreground">Click to upload a receipt</p>
                            <Input 
                                type="file" 
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                accept="image/png, image/jpeg, image/webp"
                                onChange={handleReceiptUpload}
                            />
                        </div>
                    ) : (
                        <div className="relative border rounded-lg p-2 bg-secondary">
                             <Image
                                src={receiptImage}
                                alt="Uploaded Receipt"
                                width={300}
                                height={200}
                                className="w-full h-auto object-contain rounded-md max-h-48"
                            />
                            <Button
                                variant="destructive"
                                size="icon"
                                className="absolute top-2 right-2 h-7 w-7 lift-button"
                                onClick={() => setReceiptImage(null)}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>


            <Card className="animate-fade-in" style={{animationDelay: '400ms'}}>
              <CardHeader>
                <CardTitle>Foreman Signature</CardTitle>
                <CardDescription>Sign below to re-verify this timesheet.</CardDescription>
              </CardHeader>
              <CardContent>
                {signature ? (
                  <div className="border rounded-lg p-2 bg-secondary flex justify-center items-center">
                    <Image
                      src={signature}
                      alt="Foreman's Signature"
                      width={300}
                      height={150}
                      className="object-contain"
                    />
                  </div>
                ) : (
                  <div className="border rounded-lg p-4 text-center text-muted-foreground bg-secondary/50">
                    Signature not yet provided.
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => setSignatureModalOpen(true)}
                  className="lift-button"
                >
                  {signature ? "Re-sign" : "Sign"}
                </Button>
                <Button onClick={handleSubmit} className="lift-button bg-gradient-to-r from-orange-500 to-amber-500 text-white" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="animate-spin" /> : "Resubmit Timesheet"}
                </Button>
              </CardFooter>
            </Card>
          </div>

          {/* Right Column */}
          <div className="lg:col-span-3 flex flex-col gap-6">
            <Card className="flex-1 animate-fade-in" style={{animationDelay: '100ms'}}>
              <CardHeader className="flex flex-row justify-between items-center">
                <div>
                    <CardTitle>Employee Work Log</CardTitle>
                    <CardDescription>Add, remove, and edit employee entries for today.</CardDescription>
                </div>
                 <Button onClick={() => handleOpenEmployeeModal(null)}>
                  <Plus className="mr-2 h-4 w-4" /> Add Log
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                  <div className="border rounded-lg overflow-x-auto">
                     <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Employee</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Task</TableHead>
                                <TableHead className="text-right">Hours</TableHead>
                                <TableHead className="w-[100px] text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {employeeEntries.length > 0 ? employeeEntries.map((entry) => (
                                <TableRow key={entry.id}>
                                    <TableCell className="font-medium">{entry.employee}</TableCell>
                                    <TableCell>{entry.role}</TableCell>
                                    <TableCell className="text-muted-foreground">{entry.taskDescription}</TableCell>
                                    <TableCell className="text-right">{calculateHours(entry.startTime, entry.endTime, entry.isShiftRate).totalHours.toFixed(2)}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => handleOpenEmployeeModal(entry)}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                         <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removeEmployeeEntry(entry.id)}
                                            className="text-muted-foreground hover:text-destructive"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                             )) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                        No employee logs added yet.
                                    </TableCell>
                                </TableRow>
                             )}
                        </TableBody>
                    </Table>
                  </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <EmployeeLogFormModal 
        isOpen={isEmployeeModalOpen}
        onOpenChange={setEmployeeModalOpen}
        onSave={handleSaveEmployeeLog}
        entry={currentEmployeeEntry}
        availableEmployees={availableEmployees}
        allEmployees={employees}
        roleTypes={roleTypes}
        jobTypes={jobTypes}
        unions={unions}
        shiftTemplates={shiftTemplates}
      />

      <Dialog open={isSignatureModalOpen} onOpenChange={setSignatureModalOpen}>
        <DialogContent className="sm:max-w-[425px] animate-fade-in" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Provide Signature</DialogTitle>
            <DialogDescription>
              Use your mouse or finger to sign in the box below.
            </DialogDescription>
          </DialogHeader>
          <SignaturePad onSave={handleSaveSignature} ref={signaturePadRef} />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => signaturePadRef.current?.clear()}
            >
              Clear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isSuccessModalOpen} onOpenChange={setSuccessModalOpen}>
        <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
             <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <DialogTitle className="text-center mt-4">Resubmission Successful</DialogTitle>
            <DialogDescription className="text-center">
                Your edited timesheet has been submitted. You will be redirected to your dashboard.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center">
            <DialogClose asChild>
              <Button type="button" onClick={() => router.push('/dashboard')}>
                Go to Dashboard
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type EmployeeLogFormModalProps = {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    onSave: (entry: EmployeeEntry) => void;
    entry: EmployeeEntry | null;
    availableEmployees: Employee[];
    allEmployees: Employee[];
    roleTypes: RoleType[];
    jobTypes: JobType[];
    unions: Union[];
    shiftTemplates: ShiftTemplate[];
}

function EmployeeLogFormModal({ isOpen, onOpenChange, onSave, entry, availableEmployees, allEmployees, roleTypes, jobTypes, unions, shiftTemplates }: EmployeeLogFormModalProps) {
    const { toast } = useToast();
    const dialogRef = React.useRef<HTMLDivElement>(null);
    const getInitialFormData = useCallback(() => ({
        employee: '',
        role: 'Journeyman',
        union: 'DC09' as 'DC09' | '806',
        startTime: '07:00',
        endTime: '14:30',
        notes: '',
        tags: [],
        workLocation: '',
        taskDescription: '',
        rateType: 'Regular' as 'Regular' | 'Powertool/Spray',
        isShiftRate: false,
    }), []);
    
    const [formData, setFormData] = useState<Omit<EmployeeEntry, 'id'>>(getInitialFormData());
    const [selectedShiftTemplate, setSelectedShiftTemplate] = useState('');
    const [isGeneratingTags, setIsGeneratingTags] = useState(false);


    useEffect(() => {
        if (isOpen) {
            if (entry) {
                setFormData({...entry, tags: entry.tags || []});
            } else {
                 setFormData(getInitialFormData());
            }
             setSelectedShiftTemplate('');
        }
    }, [entry, isOpen, getInitialFormData]);
    
    const handleSelectChange = (field: 'employee' | 'role' | 'union' | 'rateType' | 'shiftTemplate', value: string) => {
        if (field === 'shiftTemplate') {
            setSelectedShiftTemplate(value);
            const selectedTemplate = shiftTemplates.find(st => st.id === value);
            if (selectedTemplate) {
                setFormData(prev => ({
                    ...prev,
                    startTime: selectedTemplate.startTime,
                    endTime: selectedTemplate.endTime,
                }));
            }
            return;
        }

        let updatedFormData = {...formData, [field]: value};
        if (field === 'employee') {
            const selectedEmployee = allEmployees.find(e => e.name === value);
            if (selectedEmployee) {
                updatedFormData.union = selectedEmployee.unionCode;
                const unionData = unions.find(u => u.name === selectedEmployee.unionCode);
                if (unionData) {
                    const shiftTemplate = shiftTemplates.find(st => st.unionId === unionData.id);
                    if(shiftTemplate) {
                        updatedFormData.startTime = shiftTemplate.startTime;
                        updatedFormData.endTime = shiftTemplate.endTime;
                    }
                }
            }
        }
        setFormData(updatedFormData);
    }
    
    const handleTagGeneration = async () => {
        if (!formData.notes) {
            toast({ variant: 'destructive', title: 'Cannot generate tags', description: 'Please enter some notes first.' });
            return;
        }
        setIsGeneratingTags(true);
        try {
            const tags = await generateTags({ notes: formData.notes });
            setFormData(prev => ({...prev, tags: [...new Set([...prev.tags, ...tags])]}));
        } catch (error) {
            console.error("Error generating tags:", error);
            toast({ variant: 'destructive', title: 'Tag Generation Failed' });
        } finally {
            setIsGeneratingTags(false);
        }
    }
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.employee || !formData.role || !formData.taskDescription || !formData.union) {
            toast({ variant: 'destructive', title: "Missing Fields", description: "Please fill out all required fields, including Union." });
            return;
        }
        onSave({ ...formData, id: entry?.id || Date.now() });
    }

    const employeeOptions = useMemo(() => {
        // If editing, include the current employee in the list
        const options = availableEmployees.map(emp => ({ value: emp.name, label: emp.name }));
        if (entry?.employee && !options.find(opt => opt.value === entry.employee)) {
            options.unshift({ value: entry.employee, label: entry.employee });
        }
        return options;
    }, [availableEmployees, entry]);

    const roleTypeOptions = useMemo(() => {
        const excludedRoles = ["Admin", "Super Admin", "Billing Team"];
        return roleTypes
            .filter(rt => !excludedRoles.includes(rt.name))
            .map(rt => ({ value: rt.name, label: rt.name }));
    }, [roleTypes]);
    const unionOptions = useMemo(() => unions.map(u => ({ value: u.name, label: u.name })), [unions]);
    const rateTypeOptions = [
        { value: 'Regular', label: 'Regular Rate' },
        { value: 'Powertool/Spray', label: 'Powertool/Spray Rate' },
    ];
    const shiftTemplateOptions = useMemo(() => {
        const selectedUnion = unions.find(u => u.name === formData.union);
        if (!selectedUnion) return [];
        return shiftTemplates
            .filter(st => st.unionId === selectedUnion.id)
            .map(st => ({ value: st.id, label: st.name }));
    }, [formData.union, unions, shiftTemplates]);


    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent ref={dialogRef} className="sm:max-w-lg flex flex-col h-full max-h-[90vh]">
                 <DialogHeader>
                    <DialogTitle>{entry ? 'Edit' : 'Add'} Employee Log</DialogTitle>
                    <DialogDescription>Fill in the details for this employee's work for the day.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 space-y-4 py-4 pr-4 overflow-y-auto">
                        <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-2">
                                <Label htmlFor="employee">Employee</Label>
                                 <Combobox
                                    options={employeeOptions}
                                    value={formData.employee}
                                    onValueChange={(value) => handleSelectChange('employee', value)}
                                    placeholder="Select employee..."
                                    searchPlaceholder="Search employees..."
                                    portalContainer={dialogRef.current}
                                 />
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="role">Role</Label>
                                 <Combobox
                                    options={roleTypeOptions}
                                    value={formData.role}
                                    onValueChange={(value) => handleSelectChange('role', value)}
                                    placeholder="Select role..."
                                    searchPlaceholder="Search roles..."
                                    portalContainer={dialogRef.current}
                                 />
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="union">Union</Label>
                                <Combobox
                                    options={unionOptions}
                                    value={formData.union}
                                    onValueChange={(value) => handleSelectChange('union', value as any)}
                                    placeholder="Select union..."
                                    searchPlaceholder="Search unions..."
                                    portalContainer={dialogRef.current}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Shift Template</Label>
                                <Combobox
                                    options={shiftTemplateOptions}
                                    value={selectedShiftTemplate}
                                    onValueChange={(value) => handleSelectChange('shiftTemplate', value)}
                                    placeholder="Select template..."
                                    searchPlaceholder="Search templates..."
                                    portalContainer={dialogRef.current}
                                />
                            </div>
                        </div>
                        
                         <div className="space-y-2">
                            <Label htmlFor="taskDescription">Task Description</Label>
                            <Input id="taskDescription" placeholder="e.g. Painting interior walls, installing fixtures" value={formData.taskDescription} onChange={(e) => setFormData(p => ({...p, taskDescription: e.target.value}))} />
                        </div>
                        
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="rateType">Rate Type</Label>
                                <Combobox
                                    options={rateTypeOptions}
                                    value={formData.rateType}
                                    onValueChange={(value) => handleSelectChange('rateType', value as 'Regular' | 'Powertool/Spray')}
                                    placeholder="Select rate type..."
                                    searchPlaceholder="Search rate types..."
                                    portalContainer={dialogRef.current}
                                />
                            </div>
                            <div className="flex items-end pb-2">
                                <div className="flex items-center space-x-2">
                                    <Checkbox id="isShiftRate" checked={formData.isShiftRate} onCheckedChange={(checked) => setFormData(p => ({...p, isShiftRate: !!checked}))}/>
                                    <Label htmlFor="isShiftRate">Shift Rate</Label>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="startTime">Start Time</Label>
                                <Input id="startTime" type="time" value={formData.startTime} onChange={(e) => setFormData(p => ({...p, startTime: e.target.value}))} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="endTime">End Time</Label>
                                <Input id="endTime" type="time" value={formData.endTime} onChange={(e) => setFormData(p => ({...p, endTime: e.target.value}))} />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="notes">Notes</Label>
                            <Textarea id="notes" placeholder="Enter notes here and click the button to generate relevant tags..." value={formData.notes} onChange={(e) => setFormData(p => ({...p, notes: e.target.value, tags: []}))} />
                            <Button type="button" variant="outline" size="sm" onClick={handleTagGeneration} disabled={isGeneratingTags || !formData.notes}>
                                {isGeneratingTags ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Wand2 className="mr-2 h-4 w-4" />}
                                Generate AI Tags
                            </Button>
                            {formData.tags.length > 0 && (
                                <div className="flex flex-wrap gap-2 pt-2">
                                    {formData.tags.map((tag, i) => <Badge key={i} variant="secondary">{tag}</Badge>)}
                                </div>
                            )}
                        </div>
                    </div>
                    <DialogFooter className="pt-4 border-t shrink-0">
                        <DialogClose asChild>
                            <Button type="button" variant="secondary">Cancel</Button>
                        </DialogClose>
                        <Button type="submit">Save Entry</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
