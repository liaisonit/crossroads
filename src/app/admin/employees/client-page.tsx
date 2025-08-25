
"use client";

import React, { useState, useMemo } from "react";
import { collection, addDoc, updateDoc, deleteDoc, doc, getDoc, serverTimestamp } from "firebase/firestore";
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
import { MoreHorizontal, Edit, Trash2, Loader2, PlusCircle, FileUp, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Combobox } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import type { Employee, Role, TrainingCertificate } from "@/lib/types";
import { logActivity } from "@/lib/audit";
import { Checkbox } from "@/components/ui/checkbox";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { Textarea } from "@/components/ui/textarea";

export default function EmployeesClientPage({ initialEmployees, initialRoles }: { initialEmployees: Employee[], initialRoles: Role[] }) {
  const [user] = useAuthState(auth);
  const { toast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  const [roles, setRoles] = useState<Role[]>(initialRoles);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setModalOpen] = useState(false);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const userRole = typeof window !== 'undefined' ? localStorage.getItem('userRole') : null;

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) =>
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (emp.roleName && emp.roleName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      emp.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [employees, searchTerm]);
  
  const handleAddNew = () => {
    setCurrentEmployee(null);
    setModalOpen(true);
  };

  const handleSave = async (employeeData: Omit<Employee, 'id'> & { id?: string }) => {
    setIsLoading(true);
    try {
      const selectedRole = roles.find(r => r.id === employeeData.roleId);
      if (!selectedRole) {
          toast({ variant: 'destructive', title: "Error", description: "Invalid role selected." });
          setIsLoading(false);
          return;
      }

      const dataToSave: any = {
          ...employeeData,
          roleName: selectedRole.name,
      };

      if (currentEmployee) { // Editing existing employee
        const { id, ...dataToUpdate } = dataToSave;
        const employeeDoc = doc(db, "employees", currentEmployee.id);
        
        await logActivity({
          actor: { name: user?.displayName, role: userRole, id: user?.uid },
          action: 'employee.update',
          target: { type: 'employee', id: currentEmployee.id, name: currentEmployee.name },
          diff: { before: currentEmployee, after: dataToUpdate },
        });

        await updateDoc(employeeDoc, dataToUpdate);
        setEmployees(employees.map((emp) =>
          emp.id === currentEmployee.id ? { ...dataToSave, id: currentEmployee.id } : emp
        ));
        toast({ title: "Employee Updated", description: `${dataToSave.name}'s details have been updated.` });
      } else { // Adding new employee
        if (!dataToSave.email || !dataToSave.name) {
            toast({ variant: 'destructive', title: 'Error', description: 'Email and Name are required for a new employee.'});
            setIsLoading(false);
            return;
        }

        // We don't have a password from the admin form, so we can't create an auth user.
        // We will just create the employee record in Firestore.
        const docRef = await addDoc(collection(db, "employees"), dataToSave);
        await logActivity({
          actor: { name: user?.displayName, role: userRole, id: user?.uid },
          action: 'employee.create',
          target: { type: 'employee', id: docRef.id, name: dataToSave.name },
          diff: { before: {}, after: dataToSave },
        });
        setEmployees(prev => [...prev, { ...dataToSave, id: docRef.id }]);
        toast({ title: 'Employee Created', description: `${dataToSave.name} has been added. They can now sign up with their email.`});
      }
      setModalOpen(false);
      setCurrentEmployee(null);
    } catch (error) {
      console.error("Error saving employee:", error);
      toast({ variant: 'destructive', title: "Error", description: "Could not save employee." });
    } finally {
        setIsLoading(false);
    }
  };
  
  const handleEdit = (employee: Employee) => {
    setCurrentEmployee(employee);
    setModalOpen(true);
  };

  const handleDelete = async (employeeId: string) => {
    setIsLoading(true);
    try {
      const empRef = doc(db, "employees", employeeId);
      const empSnap = await getDoc(empRef);
      const empToDelete = empSnap.data();

      await deleteDoc(empRef);

      await logActivity({
        actor: { name: user?.displayName, role: userRole, id: user?.uid },
        action: 'employee.delete',
        target: { type: 'employee', id: employeeId, name: empToDelete?.name },
        diff: { before: empToDelete, after: {} },
      });

      setEmployees(employees.filter(emp => emp.id !== employeeId));
      toast({ variant: 'destructive', title: "Employee Deleted", description: `The employee has been removed from the system.` });
    } catch (error) {
      console.error("Error deleting employee:", error);
      toast({ variant: 'destructive', title: "Error", description: "Could not delete employee." });
    } finally {
        setIsLoading(false);
    }
  };


  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Employees & Roles</h1>
        <p className="text-muted-foreground">
          Manage employee records and assign their system roles.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Employee List</CardTitle>
          <CardDescription>
            View and manage employee records. New employees must be added by an admin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-4">
            <Input
              placeholder="Search employees..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
            <Button onClick={handleAddNew}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Employee
            </Button>
          </div>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Assigned Role</TableHead>
                  <TableHead className="w-[50px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.length > 0 ? (
                  filteredEmployees.map((employee) => (
                    <TableRow key={employee.id} className="animate-fade-in">
                      <TableCell className="font-mono text-xs">{employee.id}</TableCell>
                      <TableCell className="font-medium">{employee.name}</TableCell>
                      <TableCell className="text-muted-foreground">{employee.email}</TableCell>
                      <TableCell>
                        {employee.roleName ? 
                          <Badge variant="secondary">{employee.roleName}</Badge> : 
                          <span className="text-muted-foreground">Not Assigned</span>
                        }
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
                                <DropdownMenuItem onClick={() => handleEdit(employee)}>
                                  <Edit className="mr-2 h-4 w-4"/>
                                  Edit Details
                                </DropdownMenuItem>
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
                                    This action cannot be undone. This will permanently delete the employee record for {employee.name}. This does not delete their auth account.
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(employee.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      No results found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <EmployeeFormModal
        isOpen={isModalOpen}
        onOpenChange={setModalOpen}
        onSave={handleSave}
        employee={currentEmployee}
        roles={roles}
        isSaving={isLoading}
      />
    </div>
  );
}

type EmployeeFormModalProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (employeeData: Omit<Employee, 'id'> & {id?: string}) => void;
  employee: Employee | null;
  roles: Role[];
  isSaving: boolean;
};

function EmployeeFormModal({ isOpen, onOpenChange, onSave, employee, roles, isSaving }: EmployeeFormModalProps) {
    const { toast } = useToast();
    
    const getInitialFormData = (): Omit<Employee, 'id'> => ({
        name: '',
        roleId: '',
        roleName: '',
        unionCode: 'DC09',
        isActive: true,
        email: '',
        phone: '',
        hiringDate: '',
        whatsappOptIn: false,
        timezone: 'America/New_York',
        address: '',
        certificates: [],
        foremanId: '',
    });

  const [formData, setFormData] = useState<Omit<Employee, 'id'>>(getInitialFormData());

  React.useEffect(() => {
    if (isOpen) {
        if (employee) {
            setFormData({
                name: employee.name || '',
                roleId: employee.roleId || '',
                roleName: employee.roleName || '',
                unionCode: employee.unionCode || 'DC09',
                isActive: employee.isActive === undefined ? true : employee.isActive,
                email: employee.email || '',
                phone: employee.phone || '',
                hiringDate: employee.hiringDate || '',
                whatsappOptIn: employee.whatsappOptIn || false,
                timezone: employee.timezone || 'America/New_York',
                address: employee.address || '',
                certificates: employee.certificates || [],
                foremanId: employee.foremanId || '',
            });
        } else {
            setFormData(getInitialFormData());
        }
    }
  }, [employee, isOpen]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { id, value } = e.target;
      setFormData(prev => ({ ...prev, [id]: value }));
  }

  const handleSelectChange = (field: string) => (value: string) => {
      setFormData(prev => ({...prev, [field]: value}));
  }

  const handleCertificateChange = (index: number, field: keyof TrainingCertificate, value: string) => {
    const updatedCerts = [...(formData.certificates || [])];
    updatedCerts[index] = { ...updatedCerts[index], [field]: value };
    setFormData(prev => ({ ...prev, certificates: updatedCerts }));
  }

  const addCertificate = () => {
    const newCert: TrainingCertificate = { id: `cert-${Date.now()}`, name: '', validFrom: '', validUntil: '' };
    setFormData(prev => ({...prev, certificates: [...(prev.certificates || []), newCert]}));
  }

  const removeCertificate = (index: number) => {
    const updatedCerts = [...(formData.certificates || [])];
    updatedCerts.splice(index, 1);
    setFormData(prev => ({ ...prev, certificates: updatedCerts }));
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.roleId) {
        toast({variant: 'destructive', title: "Missing fields", description: "Name, Email, and Role are required."});
        return;
    }
    onSave({ ...formData, id: employee?.id });
  };

  const roleOptions = useMemo(() => {
    return roles.map(role => ({ value: role.id, label: role.name }));
  }, [roles]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl animate-fade-in">
        <form onSubmit={handleSubmit}>
            <DialogHeader>
            <DialogTitle>{employee ? `Edit ${employee.name}` : "Add New Employee"}</DialogTitle>
            <DialogDescription>
                {employee ? "Update employee details and certifications." : "Enter details for the new employee."}
            </DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-4 max-h-[60vh] overflow-y-auto pr-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input id="name" value={formData.name} onChange={handleChange} required/>
                  </div>
                  <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" value={formData.email} onChange={handleChange} required/>
                  </div>
              </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number (E.164 format)</Label>
                      <Input id="phone" type="tel" value={formData.phone} onChange={handleChange} placeholder="+15551234567" />
                  </div>
                   <div className="space-y-2">
                      <Label htmlFor="address">Address</Label>
                      <Textarea id="address" value={formData.address} onChange={handleChange} placeholder="123 Main St, Anytown, USA"/>
                  </div>
               </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="roleId">Role</Label>
                        <Combobox
                            options={roleOptions}
                            value={formData.roleId}
                            onValueChange={handleSelectChange('roleId')}
                            placeholder="Select a role..."
                            searchPlaceholder="Search roles..."
                        />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="hiringDate">Hiring Date</Label>
                        <Input id="hiringDate" type="date" value={formData.hiringDate} onChange={handleChange} />
                    </div>
                </div>
                 <div className="flex items-center space-x-4 pt-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox id="isActive" checked={formData.isActive} onCheckedChange={(checked) => setFormData(p => ({...p, isActive: !!checked}))}/>
                      <Label htmlFor="isActive">Employee is Active</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="whatsappOptIn" checked={formData.whatsappOptIn} onCheckedChange={(checked) => setFormData(p => ({...p, whatsappOptIn: !!checked}))}/>
                      <Label htmlFor="whatsappOptIn">WhatsApp Opt-In</Label>
                    </div>
                </div>
                 <div className="space-y-4 pt-4 border-t">
                    <h4 className="text-lg font-medium">Training Certificates</h4>
                    {formData.certificates?.map((cert, index) => (
                        <div key={cert.id} className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] gap-2 items-end p-2 border rounded-md">
                           <div className="space-y-2">
                             <Label htmlFor={`cert-name-${index}`}>Certificate Name</Label>
                             <Input id={`cert-name-${index}`} value={cert.name} onChange={e => handleCertificateChange(index, 'name', e.target.value)} />
                           </div>
                           <div className="space-y-2">
                             <Label htmlFor={`cert-from-${index}`}>Valid From</Label>
                             <Input id={`cert-from-${index}`} type="date" value={cert.validFrom} onChange={e => handleCertificateChange(index, 'validFrom', e.target.value)} />
                           </div>
                           <div className="space-y-2">
                             <Label htmlFor={`cert-until-${index}`}>Expires On</Label>
                             <Input id={`cert-until-${index}`} type="date" value={cert.validUntil} onChange={e => handleCertificateChange(index, 'validUntil', e.target.value)} />
                           </div>
                           <Button type="button" variant="ghost" size="icon" onClick={() => removeCertificate(index)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                           </Button>
                        </div>
                    ))}
                    <Button type="button" variant="outline" onClick={addCertificate}>Add Certificate</Button>
                </div>
            </div>
            <DialogFooter className="pt-4 border-t">
                <DialogClose asChild>
                    <Button type="button" variant="secondary" disabled={isSaving}>Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : "Save Changes"}
                </Button>
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
