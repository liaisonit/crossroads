
"use client";

import React, { useState, useMemo } from "react";
import { collection, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, MoreHorizontal, Edit, Trash2, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function RolesClientPage({ initialRoles }: { initialRoles: Role[]}) {
  const { toast } = useToast();
  const [roles, setRoles] = useState<Role[]>(initialRoles);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setModalOpen] = useState(false);
  const [currentRole, setCurrentRole] = useState<Role | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const filteredRoles = useMemo(() => {
    return roles.filter((role) =>
      role.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [roles, searchTerm]);

  const handleSave = async (roleData: Omit<Role, 'id'> & { id?: string }) => {
    setIsLoading(true);
    try {
      if (currentRole) {
        // Prevent editing Super Admin name
        if (currentRole.name === 'Super Admin' && roleData.name !== 'Super Admin') {
            toast({ variant: 'destructive', title: "Action Forbidden", description: "The Super Admin role name cannot be changed." });
            setIsLoading(false);
            return;
        }

        const { id, ...dataToUpdate } = roleData;
        const roleDoc = doc(db, "roles", currentRole.id);
        await updateDoc(roleDoc, dataToUpdate);
        setRoles(roles.map((role) =>
          role.id === currentRole.id ? { ...currentRole, ...dataToUpdate, id: currentRole.id } : role
        ));
        toast({ title: "Role Updated", description: `The ${dataToUpdate.name} role has been updated.` });
      } else {
        const docRef = await addDoc(collection(db, "roles"), roleData);
        setRoles([...roles, { ...roleData, id: docRef.id }]);
        toast({ title: "Role Added", description: `The ${roleData.name} role has been added.` });
      }
      setModalOpen(false);
      setCurrentRole(null);
    } catch (error) {
      console.error("Error saving role:", error);
      toast({ variant: 'destructive', title: "Error", description: "Could not save role." });
    } finally {
        setIsLoading(false);
    }
  };
  
  const handleAddNew = () => {
    setCurrentRole(null);
    setModalOpen(true);
  };
  
  const handleEdit = (role: Role) => {
    setCurrentRole(role);
    setModalOpen(true);
  };

  const handleDelete = async (roleId: string) => {
    setIsLoading(true);
    try {
      await deleteDoc(doc(db, "roles", roleId));
      setRoles(roles.filter(role => role.id !== roleId));
      toast({ variant: 'destructive', title: "Role Deleted", description: `The role has been removed from the system.` });
    } catch (error) {
      console.error("Error deleting role:", error);
      toast({ variant: 'destructive', title: "Error", description: "Could not delete role." });
    } finally {
        setIsLoading(false);
    }
  };

  const PermissionIndicator = ({ value, disabled = false }: { value: boolean, disabled?: boolean }) => (
    <div className="flex justify-center">
      {value ? (
        <CheckCircle2 className={cn("h-5 w-5", disabled ? "text-muted-foreground" : "text-green-500")} />
      ) : (
        <XCircle className="h-5 w-5 text-muted-foreground" />
      )}
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Roles & Permissions</h1>
        <p className="text-muted-foreground">
          Define user roles and their system permissions.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Role List</CardTitle>
          <CardDescription>
            View, add, edit, or delete user roles and their associated permissions. The Super Admin role cannot be modified.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-4">
            <Input
              placeholder="Search roles..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
            <Button onClick={handleAddNew}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add New Role
            </Button>
          </div>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role Name</TableHead>
                  <TableHead className="text-center">Create Timesheets</TableHead>
                  <TableHead className="text-center">Approve Timesheets</TableHead>
                  <TableHead className="text-center">Create Jobs</TableHead>
                  <TableHead className="text-center">Edit Billing</TableHead>
                  <TableHead className="w-[50px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRoles.length > 0 ? (
                  filteredRoles.map((role) => {
                    const isSuperAdmin = role.name === 'Super Admin';
                    return (
                        <TableRow key={role.id} className={cn("animate-fade-in", isSuperAdmin && "bg-secondary/50")}>
                        <TableCell className="font-medium">{role.name}</TableCell>
                        <TableCell><PermissionIndicator value={role.canCreateTimesheets} disabled={isSuperAdmin} /></TableCell>
                        <TableCell><PermissionIndicator value={role.canApproveTimesheets} disabled={isSuperAdmin} /></TableCell>
                        <TableCell><PermissionIndicator value={role.canCreateJobs} disabled={isSuperAdmin} /></TableCell>
                        <TableCell><PermissionIndicator value={role.canEditBilling} disabled={isSuperAdmin} /></TableCell>
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
                                    <DropdownMenuItem onClick={() => handleEdit(role)}>
                                    <Edit className="mr-2 h-4 w-4"/>
                                    Edit
                                    </DropdownMenuItem>
                                    <AlertDialogTrigger asChild>
                                    <DropdownMenuItem 
                                        className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                        disabled={isSuperAdmin}
                                    >
                                        <Trash2 className="mr-2 h-4 w-4"/>
                                        Delete
                                    </DropdownMenuItem>
                                    </AlertDialogTrigger>
                                </DropdownMenuContent>
                                </DropdownMenu>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This action cannot be undone. This will permanently delete the role record for {role.name}.
                                    </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(role.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
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

      <RoleFormModal
        isOpen={isModalOpen}
        onOpenChange={setModalOpen}
        onSave={handleSave}
        role={currentRole}
        isSaving={isLoading}
      />
    </div>
  );
}

// Role Form Modal Component
type RoleFormModalProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (roleData: Omit<Role, 'id'> & { id?: string }) => void;
  role: Role | null;
  isSaving: boolean;
};

function RoleFormModal({ isOpen, onOpenChange, onSave, role, isSaving }: RoleFormModalProps) {
    const { toast } = useToast();
    const [formData, setFormData] = useState<Omit<Role, 'id'>>({
        name: '',
        canCreateTimesheets: false,
        canApproveTimesheets: false,
        canCreateJobs: false,
        canEditBilling: false,
    });
    
    const isSuperAdmin = role?.name === 'Super Admin';

  React.useEffect(() => {
    if (role && isOpen) {
        setFormData({
            name: role.name,
            canCreateTimesheets: role.canCreateTimesheets,
            canApproveTimesheets: role.canApproveTimesheets,
            canCreateJobs: role.canCreateJobs,
            canEditBilling: role.canEditBilling,
        });
    } else if (!role && isOpen) {
      setFormData({
        name: '',
        canCreateTimesheets: false,
        canApproveTimesheets: false,
        canCreateJobs: false,
        canEditBilling: false,
      });
    }
  }, [role, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
        toast({ variant: 'destructive', title: "Error", description: "Please provide a role name." });
        return;
    }
    onSave({ ...formData, id: role?.id });
  };
  
  const handleCheckedChange = (permission: keyof Omit<Role, 'id' | 'name'>) => (checked: boolean | "indeterminate") => {
      setFormData(prev => ({...prev, [permission]: !!checked}));
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] animate-fade-in">
        <form onSubmit={handleSubmit}>
            <DialogHeader>
            <DialogTitle>{role ? "Edit Role" : "Add New Role"}</DialogTitle>
            <DialogDescription>
                {role ? "Update the details for this role." : "Enter the details for the new role."}
            </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">Name</Label>
                  <Input id="name" value={formData.name} onChange={e => setFormData(p => ({...p, name: e.target.value}))} className="col-span-3" required disabled={isSuperAdmin}/>
              </div>
              <div className="space-y-4 rounded-md border p-4">
                  <h4 className="text-sm font-medium">Permissions</h4>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="canCreateTimesheets" checked={formData.canCreateTimesheets} onCheckedChange={handleCheckedChange('canCreateTimesheets')} disabled={isSuperAdmin} />
                    <Label htmlFor="canCreateTimesheets" className={cn(isSuperAdmin && "text-muted-foreground")}>Can Create Timesheets</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="canApproveTimesheets" checked={formData.canApproveTimesheets} onCheckedChange={handleCheckedChange('canApproveTimesheets')} disabled={isSuperAdmin} />
                    <Label htmlFor="canApproveTimesheets" className={cn(isSuperAdmin && "text-muted-foreground")}>Can Approve Timesheets</Label>
                  </div>
                   <div className="flex items-center space-x-2">
                    <Checkbox id="canCreateJobs" checked={formData.canCreateJobs} onCheckedChange={handleCheckedChange('canCreateJobs')} disabled={isSuperAdmin}/>
                    <Label htmlFor="canCreateJobs" className={cn(isSuperAdmin && "text-muted-foreground")}>Can Create Jobs</Label>
                  </div>
                   <div className="flex items-center space-x-2">
                    <Checkbox id="canEditBilling" checked={formData.canEditBilling} onCheckedChange={handleCheckedChange('canEditBilling')} disabled={isSuperAdmin}/>
                    <Label htmlFor="canEditBilling" className={cn(isSuperAdmin && "text-muted-foreground")}>Can Edit Billing Rates</Label>
                  </div>
              </div>
            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="secondary" disabled={isSaving}>Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : (role ? "Save Changes" : "Add Role")}
                </Button>
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
