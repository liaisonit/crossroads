

"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { collection, getDocs, addDoc, serverTimestamp, query, where, orderBy, limit, doc, getDoc } from "firebase/firestore";
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
import { Trash2, Plus, LogOut, Loader2, UploadCloud, X, CheckCircle, ArrowLeft, Edit, Wand2, Thermometer, Save, Users, Copy, ShieldCheck } from "lucide-react";
import SignaturePad from "@/components/signature-pad";
import { useToast } from "@/hooks/use-toast";
import Logo from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import WeatherDisplay from "@/components/weather-display";
import { Combobox } from "@/components/ui/combobox";
import type { Employee, RoleType, Job, Equipment, JobType, ManualWeatherReading, Submission, SafetyChecklist, Union, ShiftTemplate, WeatherOutput, SystemSettings } from "@/lib/types";
import { generateTags } from "@/ai/flows/tagging-flow";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { suggestCrew, type CrewSuggestion } from "@/ai/flows/crew-suggestion-flow";
import { getWeatherForJob } from "./actions";

type EmployeeEntry = {
  id: number;
  employee: string;
  role: string;
  union: 'DC09' | '806' | 'PLA' | 'Other';
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

type StaticData = {
    jobs: Job[];
    equipment: Equipment[];
    employees: Employee[];
    roleTypes: RoleType[];
    jobTypes: JobType[];
    unions: Union[];
    shiftTemplates: ShiftTemplate[];
    settings: SystemSettings | null;
}

export default function TimesheetPageClient({ staticData }: { staticData: StaticData}) {
  const router = useRouter();
  const { toast } = useToast();
  const [user, authLoading] = useAuthState(auth);

  const [foremanName, setForemanName] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState("");
  
  const [employeeEntries, setEmployeeEntries] = useState<EmployeeEntry[]>([]);
  const [equipmentEntries, setEquipmentEntries] = useState<EquipmentEntry[]>([]);
  const [generalNotes, setGeneralNotes] = useState("");
  const [isSignatureModalOpen, setSignatureModalOpen] = useState(false);
  const [isSuccessModalOpen, setSuccessModalOpen] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [workLocation, setWorkLocation] = useState("");
  const signaturePadRef = useRef<{ clear: () => void }>(null);
  const [weatherData, setWeatherData] = useState<WeatherOutput | null>(null);
  const [isWeatherLoading, setIsWeatherLoading] = useState(false);
  const [manualWeatherReadings, setManualWeatherReadings] = useState<ManualWeatherReading[]>([]);
  const [safetyChecklist, setSafetyChecklist] = useState<SafetyChecklist>({ ppe: false, tools: false, siteClear: false });
  const [workType, setWorkType] = useState("regular");
  const [ticketNumber, setTicketNumber] = useState("");


  const [isEmployeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [currentEmployeeEntry, setCurrentEmployeeEntry] = useState<EmployeeEntry | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPopulating, setIsPopulating] = useState(false);
  
  // Crew Suggestions
  const [crewSuggestions, setCrewSuggestions] = useState<CrewSuggestion[]>([]);
  const [isSuggestingCrew, setIsSuggestingCrew] = useState(false);

  // Use state for static data to allow for updates (e.g. new hire)
  const [jobs, setJobs] = useState<Job[]>(staticData.jobs);
  const [equipment, setEquipment] = useState<Equipment[]>(staticData.equipment);
  const [employees, setEmployees] = useState<Employee[]>(staticData.employees);


  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
    const storedForeman = localStorage.getItem("userName");
    const userRole = localStorage.getItem("userRole");

    if (storedForeman && user && (userRole === 'Foreman' || userRole === 'Super Admin' || userRole === 'Admin')) {
      setForemanName(storedForeman);
    } else if (!authLoading && user) {
        router.push('/login');
    }

    const savedSignature = localStorage.getItem("foremanSignature");
    if (savedSignature) {
        setSignature(savedSignature);
    }

    setCurrentDate(new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));

    setIsLoading(false);
  }, [user, authLoading, router, toast]);
  
  const selectedJob = useMemo(() => jobs.find(j => j.id === selectedJobId), [jobs, selectedJobId]);

  const handleJobSelection = async (jobId: string) => {
    setSelectedJobId(jobId);
    const job = jobs.find(j => j.id === jobId);
    const apiKey = staticData.settings?.weather?.apiKey;

    if (job && job.location && apiKey) {
        setIsWeatherLoading(true);
        setWeatherData(null);
        
        const result = await getWeatherForJob(job.location, apiKey);

        if (result.data) {
            setWeatherData(result.data);
        } else {
            console.error("Weather fetch failed:", result.error);
            toast({ variant: "destructive", title: "Weather Failed", description: result.error || "Could not retrieve weather data." });
            setWeatherData(null);
        }
        setIsWeatherLoading(false);

    } else {
        setWeatherData(null);
        if (job && !apiKey) {
             toast({ variant: "destructive", title: "Weather Disabled", description: "The Weather API key has not been configured in system settings." });
        }
    }
    if (job) {
        setWorkLocation(job.location || ''); // Set main work location from job
    }
  };


  useEffect(() => {
    if (!selectedJobId) {
        setCrewSuggestions([]);
        return;
    }
    const fetchCrewSuggestions = async () => {
        setIsSuggestingCrew(true);
        try {
            const suggestions = await suggestCrew({ jobId: selectedJobId });
            setCrewSuggestions(suggestions);
        } catch (error) {
            console.error("Failed to fetch crew suggestions:", error);
            // Don't bother the user with a toast for this
        } finally {
            setIsSuggestingCrew(false);
        }
    }
    fetchCrewSuggestions();
  }, [selectedJobId]);

  const { availableEmployees, jobOptions, equipmentOptions } = useMemo(() => {
    const selectedEmployeeNames = employeeEntries.map(entry => entry.employee);
    const availableEmployees = employees.filter(emp => emp.roleName !== 'Foreman' && emp.roleName !== 'Super Admin' && !selectedEmployeeNames.includes(emp.name));
    const jobOptions = jobs.map(j => ({ value: j.id, label: j.name }));
    const equipmentOptions = equipment.map(e => ({ value: e.name, label: e.name }));
    return { availableEmployees, jobOptions, equipmentOptions };
  }, [employees, jobs, equipment, employeeEntries]);

  const getAvailableEquipmentOptions = (currentEquipment: string) => {
    const selectedIds = equipmentEntries.map(entry => entry.equipment).filter(eq => eq !== currentEquipment);
    return equipmentOptions.filter(opt => !selectedIds.includes(opt.value));
  }

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

  const handleSaveSignature = (dataUrl: string) => {
    setSignature(dataUrl);
    localStorage.setItem("foremanSignature", dataUrl); // Save signature locally
    setSignatureModalOpen(false);
    toast({
      title: "Signature Captured",
      description: "Your signature has been saved for future use.",
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

  const resetForm = useCallback(() => {
    setSelectedJobId("");
    setWorkLocation("");
    setEmployeeEntries([]);
    setEquipmentEntries([]);
    setGeneralNotes("");
    setReceiptImage(null);
  }, []);
  
  const calculateHours = (startTime: string, endTime: string, isShiftRate: boolean) => {
    const start = new Date('1970-01-01T' + startTime + ':00');
    const end = new Date('1970-01-01T' + endTime + ':00');
    
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


  const handleSave = async (status: 'Submitted' | 'Draft') => {
    setIsSubmitting(true);
    if (!selectedJobId) {
        toast({ variant: "destructive", title: "Error", description: "Please select a job." });
        setIsSubmitting(false);
        return;
    }
    
    if (employeeEntries.length === 0) {
        toast({ variant: "destructive", title: "Error", description: "Please add at least one employee work log." });
        setIsSubmitting(false);
        return;
    }
    if (status === 'Submitted' && !signature) {
      toast({ variant: "destructive", title: "Error", description: "Please provide a signature before submitting." });
      setIsSubmitting(false);
      return;
    }
    if (status === 'Submitted' && (!safetyChecklist.ppe || !safetyChecklist.tools || !safetyChecklist.siteClear)) {
        toast({ variant: "destructive", title: "Safety Check Required", description: "Please complete all items in the safety checklist before submitting." });
        setIsSubmitting(false);
        return;
    }
    if (!user || !foremanName) {
        toast({ variant: "destructive", title: "Authentication Error", description: "Could not verify user. Please log out and log back in." });
        setIsSubmitting(false);
        return;
    }
    
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
            shiftHours,
        };
    });

    try {
      const selectedJobData = jobs.find(j => j.id === selectedJobId);
      await addDoc(collection(db, "submissions"), {
        foremanId: user.uid,
        foremanName: foremanName,
        jobId: selectedJobId,
        jobName: selectedJobData?.name,
        location: workLocation,
        gcName: selectedJobData?.gcName || null,
        date: new Date().toISOString().split('T')[0],
        createdAt: serverTimestamp(),
        employees: processedEmployees,
        equipment: equipmentEntries.map(({ id, isClosing, ...rest }) => rest),
        generalNotes,
        signature,
        receiptImage,
        status,
        weather: weatherData,
        manualWeatherReadings: manualWeatherReadings.map(({id, ...rest}) => rest),
        safetyChecklist,
        comments: [],
        downloadHistory: [],
        workType,
        ticketNumber: workType === 'ticket' ? ticketNumber : null,
      });
      resetForm();
      if(status === 'Submitted') {
        setSuccessModalOpen(true);
      } else {
        toast({ title: "Draft Saved", description: "Your timesheet has been saved as a draft."});
        router.push('/dashboard');
      }
    } catch (error) {
      console.error("Error saving timesheet: ", error);
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: "Could not save the timesheet. Please try again.",
      });
    } finally {
        setIsSubmitting(false);
    }
  };
  
  const handleOpenEmployeeModal = (entry: EmployeeEntry | null) => {
    setCurrentEmployeeEntry(entry);
    setEmployeeModalOpen(true);
  };

  const handleQuickAddCrew = (suggestion: CrewSuggestion) => {
    const employeeData = employees.find(e => e.name === suggestion.name);
    if (!employeeData) return;

    const newEntry: EmployeeEntry = {
        id: Date.now(),
        employee: suggestion.name,
        role: suggestion.role,
        union: employeeData.unionCode,
        startTime: '07:00',
        endTime: '14:30',
        notes: '',
        tags: [],
        workLocation: workLocation,
        taskDescription: '', // Foreman needs to fill this
        rateType: 'Regular',
        isShiftRate: false,
    };
    setEmployeeEntries(prev => [...prev, newEntry]);
    toast({ title: "Employee Added", description: `${suggestion.name} has been added to the work log.` });
  };

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

  const handleStartWithYesterday = async () => {
    if (!user || !selectedJobId) {
      toast({ variant: "destructive", title: "Action Required", description: "Please select a job before proceeding." });
      return;
    }
    setIsPopulating(true);

    try {
        const q = query(
            collection(db, "submissions"),
            where("foremanId", "==", user.uid),
            where("jobId", "==", selectedJobId),
            orderBy("createdAt", "desc"),
            limit(1)
        );
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            toast({ title: "No Previous Submission", description: "No data available from the previous day for this job." });
            return;
        }

        const lastSubmission = querySnapshot.docs[0].data() as any;
        
        setGeneralNotes(lastSubmission.generalNotes || '');
        setEquipmentEntries(lastSubmission.equipment?.map((e: any, i: number) => ({...e, id: Date.now() + i})) || []);
        
        const lastEmployeeEntries: EmployeeEntry[] = lastSubmission.employees.map((emp: any, index: number) => ({
            id: Date.now() + index,
            employee: emp.employee,
            role: emp.role,
            union: emp.union,
            startTime: emp.startTime,
            endTime: emp.endTime,
            notes: emp.notes,
            tags: emp.tags || [],
            workLocation: emp.workLocation,
            taskDescription: emp.taskDescription,
            rateType: emp.rateType,
            isShiftRate: emp.isShiftRate,
        }));
        setEmployeeEntries(lastEmployeeEntries);
        
        toast({ title: "Form Populated", description: "Timesheet has been pre-filled with your last submission." });

    } catch (error) {
        console.error("Error populating from yesterday:", error);
        toast({ variant: 'destructive', title: "Error", description: "Could not load data from previous timesheet." });
    } finally {
        setIsPopulating(false);
    }
  };


  const handleRemoveWeatherReading = (id: number) => {
      setManualWeatherReadings(prev => prev.filter(r => r.id !== id));
  }

  const handleWeatherReadingChange = (id: number, field: keyof Omit<ManualWeatherReading, 'id'>, value: string | number) => {
      setManualWeatherReadings(prev => prev.map(r => r.id === id ? {...r, [field]: value} : r));
  }

  const handleSafetyCheckChange = (key: keyof SafetyChecklist, checked: boolean) => {
    setSafetyChecklist(prev => ({ ...prev, [key]: checked }));
  }

  const filteredCrewSuggestions = useMemo(() => {
    const loggedEmployeeNames = new Set(employeeEntries.map(e => e.employee));
    return crewSuggestions.filter(s => !loggedEmployeeNames.has(s.name));
  }, [crewSuggestions, employeeEntries]);

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
        <main className="p-4 md:p-6">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 max-w-7xl mx-auto">
            {/* Left Column */}
            <div className="lg:col-span-2 flex flex-col gap-6">
                <Card className="animate-fade-in">
                <CardHeader>
                    <CardTitle>Job Details</CardTitle>
                    <CardDescription>{currentDate}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="jobName">Job Name</Label>
                        <Combobox
                        options={jobOptions}
                        value={selectedJobId}
                        onValueChange={handleJobSelection}
                        placeholder="Select a job..."
                        searchPlaceholder="Search jobs..."
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="workLocation">Work Location / Sub-site</Label>
                        <Input
                            id="workLocation"
                            placeholder="e.g., 5th Floor, East Wing"
                            value={workLocation}
                            onChange={(e) => setWorkLocation(e.target.value)}
                        />
                    </div>
                    {selectedJob?.gcName && (
                        <div className="text-sm text-muted-foreground pt-2">
                            <strong>GC:</strong> {selectedJob.gcName}
                        </div>
                    )}
                    {selectedJobId && (
                        <div className="pt-4 mt-2 border-t">
                            <Button
                                variant="outline"
                                className="w-full"
                                onClick={handleStartWithYesterday}
                                disabled={isPopulating}
                            >
                                {isPopulating ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                <Copy className="mr-2 h-4 w-4" />
                                )}
                                Start with Yesterday
                            </Button>
                        </div>
                    )}
                    <div className="space-y-3 pt-4 border-t mt-4">
                            <Label>Work Type</Label>
                            <RadioGroup value={workType} onValueChange={setWorkType} className="flex gap-4">
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="regular" id="r1" />
                                    <Label htmlFor="r1">Regular Work</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="ticket" id="r2" />
                                    <Label htmlFor="r2">Ticket Work</Label>
                                </div>
                            </RadioGroup>
                            {workType === 'ticket' && (
                                <div className="space-y-2 animate-fade-in">
                                    <Label htmlFor="ticketNumber">Ticket Number</Label>
                                    <Input id="ticketNumber" value={ticketNumber} onChange={e => setTicketNumber(e.target.value)} placeholder="Enter ticket number..."/>
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
                        <WeatherDisplay weather={weatherData} isLoading={isWeatherLoading} jobSelected={!!selectedJobId}/>
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
                
                <Card className="animate-fade-in" style={{animationDelay: '200ms'}}>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><ShieldCheck/> Daily Safety Checklist</CardTitle>
                        <CardDescription>Confirm these checks were completed before starting work.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center space-x-2">
                            <Checkbox id="ppe" checked={safetyChecklist.ppe} onCheckedChange={(checked) => handleSafetyCheckChange('ppe', !!checked)} />
                            <Label htmlFor="ppe" className="leading-snug">All crew members have required PPE, including Safety Harness, Helmets &amp; Gears.</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox id="tools" checked={safetyChecklist.tools} onCheckedChange={(checked) => handleSafetyCheckChange('tools', !!checked)} />
                            <Label htmlFor="tools" className="leading-snug">Tools and equipment have been inspected and are in good working order.</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox id="siteClear" checked={safetyChecklist.siteClear} onCheckedChange={(checked) => handleSafetyCheckChange('siteClear', !!checked)} />
                            <Label htmlFor="siteClear" className="leading-snug">Work area is clear of hazards and safe to begin work.</Label>
                        </div>
                    </CardContent>
                </Card>

                <Card className="animate-fade-in" style={{animationDelay: '300ms'}}>
                    <CardHeader>
                        <CardTitle>General Notes</CardTitle>
                        <CardDescription>Add any overall notes for the day's work.</CardDescription>
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

                <Card className="animate-fade-in" style={{animationDelay: '400ms'}}>
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

                <Card className="animate-fade-in" style={{animationDelay: '500ms'}}>
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


                <Card className="animate-fade-in" style={{animationDelay: '600ms'}}>
                <CardHeader>
                    <CardTitle>Foreman Signature</CardTitle>
                    <CardDescription>Sign below to verify this timesheet.</CardDescription>
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
                <CardFooter className="flex justify-between flex-wrap gap-2">
                    <Button
                    variant="outline"
                    onClick={() => setSignatureModalOpen(true)}
                    className="lift-button"
                    >
                    {signature ? "Re-sign" : "Sign"}
                    </Button>
                    <Button variant="secondary" onClick={() => handleSave('Draft')} className="lift-button" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="animate-spin" /> : <><Save className="mr-2 h-4 w-4"/>Save as Draft</>}
                    </Button>
                    <Button onClick={() => handleSave('Submitted')} className="lift-button bg-gradient-to-r from-orange-500 to-amber-500 text-white" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="animate-spin" /> : "Submit Timesheet"}
                    </Button>
                </CardFooter>
                </Card>
            </div>

            {/* Right Column */}
            <div className="lg:col-span-3 flex flex-col gap-6">
                <Card className="animate-fade-in" style={{animationDelay: '100ms'}}>
                <CardHeader>
                    <CardTitle>AI Crew Suggestions</CardTitle>
                    <CardDescription>Based on past timesheets for this job.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isSuggestingCrew ? (
                        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/>Loading suggestions...</div>
                    ) : filteredCrewSuggestions.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {filteredCrewSuggestions.map(s => (
                                <Button key={s.name} variant="outline" size="sm" onClick={() => handleQuickAddCrew(s)} className="lift-button">
                                    <Users className="mr-2 h-4 w-4"/>
                                    <span>{s.name} <span className="text-muted-foreground/80">({s.role})</span></span>
                                </Button>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">{selectedJobId ? 'No frequent crew members found for this job.' : 'Select a job to see crew suggestions.'}</p>
                    )}
                </CardContent>
                </Card>
                <Card className="flex-1 animate-fade-in" style={{animationDelay: '200ms'}}>
                <CardHeader className="flex flex-row justify-between items-center">
                    <CardTitle>Employee Work Log</CardTitle>
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
            staticData={staticData}
            availableEmployees={availableEmployees}
            onNewHire={(newEmployee) => {
                setEmployees(prev => [...prev, newEmployee]);
            }}
            workLocation={workLocation}
        />

        <Dialog open={isSignatureModalOpen} onOpenChange={setSignatureModalOpen}>
            <DialogContent className="sm:max-w-[425px]">
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
            <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <DialogTitle className="text-center mt-4">Submission Successful</DialogTitle>
                <DialogDescription className="text-center">
                    Your timesheet has been submitted. You will be redirected to your dashboard.
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
    staticData: StaticData;
    onNewHire: (employee: Employee) => void;
    workLocation: string;
}

function EmployeeLogFormModal({ isOpen, onOpenChange, onSave, entry, availableEmployees, staticData, onNewHire, workLocation }: EmployeeLogFormModalProps) {
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
        workLocation: workLocation,
        taskDescription: '',
        rateType: 'Regular' as 'Regular' | 'Powertool/Spray',
        isShiftRate: false,
    }), [workLocation]);
    
    const [formData, setFormData] = useState<Omit<EmployeeEntry, 'id'>>(getInitialFormData());
    const [selectedShiftTemplate, setSelectedShiftTemplate] = useState('');
    const [isGeneratingTags, setIsGeneratingTags] = useState(false);
    const [isAddingNewHire, setAddingNewHire] = useState(false);

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
            const selectedTemplate = staticData.shiftTemplates.find(st => st.id === value);
            if (selectedTemplate) {
                setFormData(prev => ({
                    ...prev,
                    startTime: selectedTemplate.startTime,
                    endTime: selectedTemplate.endTime,
                }));
            }
            return;
        }

        let updatedFormData: Omit<EmployeeEntry, 'id'> = {...formData, [field]: value};
        
        if (field === 'employee') {
            if(value === 'add_new_hire') {
                setAddingNewHire(true);
                updatedFormData.employee = '';
                setFormData(updatedFormData);
                return;
            }
            const selectedEmployee = staticData.employees.find(e => e.name === value);
            if (selectedEmployee) {
                updatedFormData.union = selectedEmployee.unionCode;
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
        const options = availableEmployees.map(emp => ({ value: emp.name, label: emp.name }));
        if (entry?.employee && !options.find(opt => opt.value === entry.employee)) {
            options.unshift({ value: entry.employee, label: entry.employee });
        }
        return options;
    }, [availableEmployees, entry]);
    
    const actionOptions = [{ value: 'add_new_hire', label: '+ Add New Hire' }];

    const roleTypeOptions = useMemo(() => {
        const excludedRoles = ["Admin", "Super Admin", "Billing Team"];
        return staticData.roleTypes
            .filter(rt => !excludedRoles.includes(rt.name))
            .map(rt => ({ value: rt.name, label: rt.name }));
    }, [staticData.roleTypes]);

    const unionOptions = useMemo(() => staticData.unions.map(u => ({ value: u.name, label: u.name })), [staticData.unions]);
    const rateTypeOptions = [
        { value: 'Regular', label: 'Regular Rate' },
        { value: 'Powertool/Spray', label: 'Powertool/Spray Rate' },
    ];
    
    const shiftTemplateOptions = useMemo(() => {
        const selectedUnion = staticData.unions.find(u => u.name === formData.union);
        if (!selectedUnion) return [];
        return staticData.shiftTemplates
            .filter(st => st.unionId === selectedUnion.id)
            .map(st => ({ value: st.id, label: st.name }));
    }, [formData.union, staticData.unions, staticData.shiftTemplates]);


    if (isAddingNewHire) {
        return <AddNewHireModal 
            isOpen={isAddingNewHire} 
            onOpenChange={setAddingNewHire} 
            roleTypes={staticData.roleTypes}
            unions={staticData.unions}
            onHire={ (newEmployee) => {
                onNewHire(newEmployee);
                setFormData(prev => ({...prev, employee: newEmployee.name, union: newEmployee.unionCode as any}));
                setAddingNewHire(false);
            }}
        />
    }

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
                                    actionOptions={actionOptions}
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
                            <Label htmlFor="workLocation">Work Location</Label>
                            <Input id="workLocation" placeholder="e.g. 5th Floor, East Wing" value={formData.workLocation} onChange={(e) => setFormData(p => ({...p, workLocation: e.target.value}))} />
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

function AddNewHireModal({ isOpen, onOpenChange, roleTypes, unions, onHire }: {isOpen: boolean, onOpenChange: (open: boolean) => void, roleTypes: RoleType[], unions: Union[], onHire: (employee: Employee) => void}) {
    const { toast } = useToast();
    const [name, setName] = useState('');
    const [role, setRole] = useState('');
    const [union, setUnion] = useState<string>('DC09');
    const [isLoading, setIsLoading] = useState(false);

    const roleOptions = useMemo(() => roleTypes.map(rt => ({ value: rt.name, label: rt.name })), [roleTypes]);
    const unionOptions = useMemo(() => unions.map(u => ({ value: u.name, label: u.name })), [unions]);
    
    const handleAddNewHire = async () => {
        if (!name || !role) {
            toast({ variant: 'destructive', title: 'Missing fields', description: 'Name and Role are required.'});
            return;
        }
        setIsLoading(true);
        try {
            const docRef = await addDoc(collection(db, 'employees'), {
                name,
                roleId: 'ROLE-002', // Default Journeyman
                roleName: role,
                unionCode: union,
                isActive: true,
            });
            toast({ title: 'New Hire Added', description: `${name} has been added to the employee list.`});
            onHire({ id: docRef.id, name, roleId: 'ROLE-002', roleName: role, unionCode: union as any, isActive: true });
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not add new hire.'});
        } finally {
            setIsLoading(false);
            setName('');
            setRole('');
            setUnion('DC09');
        }
    }
    
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent onInteractOutside={(e) => e.preventDefault()}>
                <DialogHeader>
                    <DialogTitle>Add New Hire</DialogTitle>
                    <DialogDescription>Create a temporary record for a new employee. You can add more details later in the Admin panel.</DialogDescription>
                </DialogHeader>
                 <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="new-hire-name">Name</Label>
                        <Input id="new-hire-name" value={name} onChange={e => setName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="new-hire-role">Role</Label>
                        <Combobox options={roleOptions} value={role} onValueChange={setRole} placeholder="Select role..." searchPlaceholder="Search roles..." />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="new-hire-union">Union</Label>
                        <Combobox options={unionOptions} value={union} onValueChange={v => setUnion(v)} placeholder="Select union..." searchPlaceholder="Search unions..." />
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                         <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    </DialogClose>
                    <Button onClick={handleAddNewHire} disabled={isLoading}>
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : 'Add Employee'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
