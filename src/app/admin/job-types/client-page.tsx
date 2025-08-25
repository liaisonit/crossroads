
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
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, MoreHorizontal, Edit, Trash2, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { JobType } from "@/lib/types";

export default function JobTypesClientPage({ initialJobTypes }: {initialJobTypes: JobType[]}) {
  const { toast } = useToast();
  const [jobTypes, setJobTypes] = useState<JobType[]>(initialJobTypes);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setModalOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState<JobType | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const filteredJobTypes = useMemo(() => {
    return jobTypes.filter((type) =>
      type.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [jobTypes, searchTerm]);

  const handleSave = async (itemData: Omit<JobType, 'id'> & { id?: string }) => {
    setIsLoading(true);
    try {
      if (currentItem) {
        const { id, ...dataToUpdate } = itemData;
        const itemDoc = doc(db, "jobTypes", currentItem.id);
        await updateDoc(itemDoc, dataToUpdate);
        setJobTypes(jobTypes.map((item) =>
          item.id === currentItem.id ? { ...currentItem, ...dataToUpdate, id: currentItem.id } : item
        ));
        toast({ title: "Job Type Updated", description: `The job type "${dataToUpdate.name}" has been updated.` });
      } else {
        // Ensure name is not empty
        if (!itemData.name) {
            toast({ variant: 'destructive', title: "Error", description: "Job type name cannot be empty." });
            return;
        }
        const docRef = await addDoc(collection(db, "jobTypes"), {name: itemData.name});
        setJobTypes([...jobTypes, { name: itemData.name, id: docRef.id }]);
        toast({ title: "Job Type Added", description: `The job type "${itemData.name}" has been added.` });
      }
      setModalOpen(false);
      setCurrentItem(null);
    } catch (error) {
       console.error("Error saving job type:", error);
       toast({ variant: 'destructive', title: "Error", description: "Could not save job type." });
    } finally {
        setIsLoading(false);
    }
  };
  
  const handleAddNew = () => {
    setCurrentItem(null);
    setModalOpen(true);
  };
  
  const handleEdit = (item: JobType) => {
    setCurrentItem(item);
    setModalOpen(true);
  };

  const handleDelete = async (itemId: string) => {
    setIsLoading(true);
    try {
      await deleteDoc(doc(db, "jobTypes", itemId));
      setJobTypes(jobTypes.filter(item => item.id !== itemId));
      toast({ variant: 'destructive', title: "Job Type Deleted", description: `The job type has been removed from the system.` });
    } catch (error) {
      console.error("Error deleting job type:", error);
      toast({ variant: 'destructive', title: "Error", description: "Could not delete job type." });
    } finally {
        setIsLoading(false);
    }
  };


  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Job Types</h1>
        <p className="text-muted-foreground">
          Manage the list of job types available for timesheets.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Job Type List</CardTitle>
          <CardDescription>
            View, add, edit, or delete job types.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-4">
            <Input
              placeholder="Search job types..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
            <Button onClick={handleAddNew}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add New Job Type
            </Button>
          </div>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-[50px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredJobTypes.length > 0 ? (
                  filteredJobTypes.map((item) => (
                    <TableRow key={item.id} className="animate-fade-in">
                      <TableCell className="font-medium">{item.name}</TableCell>
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
                                <DropdownMenuItem onClick={() => handleEdit(item)}>
                                  <Edit className="mr-2 h-4 w-4"/>
                                  Edit
                                </DropdownMenuItem>
                                <AlertDialogTrigger asChild>
                                   <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10">
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
                                    This action cannot be undone. This will permanently delete the job type "{item.name}".
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(item.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={2} className="h-24 text-center">
                      No results found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <JobTypeFormModal
        isOpen={isModalOpen}
        onOpenChange={setModalOpen}
        onSave={handleSave}
        item={currentItem}
        isSaving={isLoading}
      />
    </div>
  );
}

// JobType Form Modal Component
type JobTypeFormModalProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (itemData: Omit<JobType, 'id'> & { id?: string }) => void;
  item: JobType | null;
  isSaving: boolean;
};

function JobTypeFormModal({ isOpen, onOpenChange, onSave, item, isSaving }: JobTypeFormModalProps) {
  const { toast } = useToast();
  const [name, setName] = useState("");

  React.useEffect(() => {
    if (item && isOpen) {
      setName(item.name);
    } else {
      setName("");
    }
  }, [item, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
        toast({ variant: 'destructive', title: "Error", description: "Please provide a name for the job type." });
        return;
    }
    onSave({ name, id: item?.id });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] animate-fade-in">
        <form onSubmit={handleSubmit}>
            <DialogHeader>
            <DialogTitle>{item ? "Edit Job Type" : "Add New Job Type"}</DialogTitle>
            <DialogDescription>
                {item ? "Update the name of this job type." : "Enter the name for the new job type."}
            </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">Name</Label>
                  <Input id="name" value={name} onChange={e => setName(e.target.value)} className="col-span-3" required/>
              </div>
            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="secondary" disabled={isSaving}>Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : (item ? "Save Changes" : "Add Job Type")}
                </Button>
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
