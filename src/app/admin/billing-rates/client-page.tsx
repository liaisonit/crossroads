
"use client";

import React, { useState, useEffect, useMemo } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";

type BillingRate = {
  id: string;
  name: string;
  union: string;
  rateType: 'RT' | 'OT';
  rate: number;
  unit: string;
};

export default function BillingRatesClientPage({ initialRates }: { initialRates: BillingRate[] }) {
  const { toast } = useToast();
  const [rates, setRates] = useState<BillingRate[]>(initialRates);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setModalOpen] = useState(false);
  const [currentRate, setCurrentRate] = useState<BillingRate | null>(null);
  const [isLoading, setIsLoading] = useState(false); // For actions, not initial load

  const filteredRates = useMemo(() => {
    return rates.filter((rate) =>
      rate.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rate.union.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rate.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [rates, searchTerm]);

  const handleSave = async (rateData: Omit<BillingRate, 'id'> & { id?: string }) => {
    setIsLoading(true);
    try {
      if (currentRate) {
        const { id, ...dataToUpdate } = rateData;
        const rateDoc = doc(db, "billingRates", currentRate.id);
        await updateDoc(rateDoc, dataToUpdate);
        setRates(rates.map((rate) =>
          rate.id === currentRate.id ? { ...currentRate, ...dataToUpdate, id: currentRate.id } : rate
        ));
        toast({ title: "Billing Rate Updated", description: `The rate for ${dataToUpdate.name} has been updated.` });
      } else {
        const docRef = await addDoc(collection(db, "billingRates"), rateData);
        setRates([...rates, { ...rateData, id: docRef.id }]);
        toast({ title: "Billing Rate Added", description: `The rate for ${rateData.name} has been added.` });
      }
      setModalOpen(false);
      setCurrentRate(null);
    } catch (error) {
      console.error("Error saving billing rate:", error);
      toast({ variant: 'destructive', title: "Error", description: "Could not save billing rate." });
    } finally {
        setIsLoading(false);
    }
  };
  
  const handleAddNew = () => {
    setCurrentRate(null);
    setModalOpen(true);
  };
  
  const handleEdit = (rate: BillingRate) => {
    setCurrentRate(rate);
    setModalOpen(true);
  };

  const handleDelete = async (rateId: string) => {
    setIsLoading(true);
    try {
      await deleteDoc(doc(db, "billingRates", rateId));
      setRates(rates.filter(rate => rate.id !== rateId));
      toast({ variant: 'destructive', title: "Billing Rate Deleted", description: `The rate has been removed from the system.` });
    } catch (error) {
      console.error("Error deleting billing rate:", error);
      toast({ variant: 'destructive', title: "Error", description: "Could not delete billing rate." });
    } finally {
        setIsLoading(false);
    }
  };


  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Billing Rates</h1>
        <p className="text-muted-foreground">
          Manage billing codes and their hourly rates.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Rate List</CardTitle>
          <CardDescription>
            View, add, edit, or delete billing rates.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-4">
            <Input
              placeholder="Search by name, union, or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
            <Button onClick={handleAddNew}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add New Rate
            </Button>
          </div>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Union</TableHead>
                  <TableHead>Rate Type</TableHead>
                  <TableHead>Hourly Rate</TableHead>
                  <TableHead className="w-[50px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRates.length > 0 ? (
                  filteredRates.map((rate) => (
                    <TableRow key={rate.id} className="animate-fade-in">
                      <TableCell className="font-medium">{rate.name}</TableCell>
                      <TableCell><Badge variant="secondary">{rate.union}</Badge></TableCell>
                      <TableCell><Badge variant={rate.rateType === 'OT' ? "destructive" : "default"}>{rate.rateType}</Badge></TableCell>
                      <TableCell>${rate.rate.toFixed(2)} / {rate.unit}</TableCell>
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
                                <DropdownMenuItem onClick={() => handleEdit(rate)}>
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
                                    This action cannot be undone. This will permanently delete the billing rate for {rate.name} ({rate.id}).
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(rate.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
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

      <RateFormModal
        isOpen={isModalOpen}
        onOpenChange={setModalOpen}
        onSave={handleSave}
        rate={currentRate}
        isSaving={isLoading}
      />
    </div>
  );
}

// Rate Form Modal Component
type RateFormModalProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (rateData: Omit<BillingRate, 'id'> & { id?: string }) => void;
  rate: BillingRate | null;
  isSaving: boolean;
};

function RateFormModal({ isOpen, onOpenChange, onSave, rate, isSaving }: RateFormModalProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<Omit<BillingRate, 'id'>>({
      name: '',
      union: '',
      rateType: 'RT',
      rate: 0,
      unit: 'Hour'
  });

  React.useEffect(() => {
    if (rate && isOpen) {
      setFormData({
          name: rate.name,
          union: rate.union,
          rateType: rate.rateType,
          rate: rate.rate,
          unit: rate.unit
      });
    } else if (!rate && isOpen) {
      setFormData({
        name: '',
        union: '',
        rateType: 'RT',
        rate: 0,
        unit: 'Hour'
      });
    }
  }, [rate, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { id, value } = e.target;
      setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleSelectChange = (value: string) => {
    setFormData(prev => ({ ...prev, rateType: value as 'RT' | 'OT' }));
  }
  
  const handleRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setFormData(prev => ({...prev, rate: parseFloat(value) || 0}));
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.union || formData.rate <= 0) {
        toast({variant: 'destructive', title: "Error", description: "Please provide a valid name, union, and rate."});
        return;
    }
    onSave({ ...formData, id: rate?.id });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] animate-fade-in">
        <form onSubmit={handleSubmit}>
            <DialogHeader>
            <DialogTitle>{rate ? "Edit Rate" : "Add New Rate"}</DialogTitle>
            <DialogDescription>
                {rate ? "Update the billing rate details." : "Enter the details for the new billing rate."}
            </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">Name</Label>
                  <Input id="name" value={formData.name} onChange={handleChange} className="col-span-3" required/>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="union" className="text-right">Union</Label>
                  <Input id="union" value={formData.union} onChange={handleChange} className="col-span-3" required/>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="rateType" className="text-right">Rate Type</Label>
                  <Combobox
                    className="col-span-3"
                    options={[
                        {value: 'RT', label: 'RT (Regular Time)'},
                        {value: 'OT', label: 'OT (Overtime)'}
                    ]}
                    value={formData.rateType}
                    onValueChange={handleSelectChange}
                    placeholder="Select rate type..."
                    searchPlaceholder="Search rate type..."
                  />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="rate" className="text-right">Rate ($)</Label>
                  <Input id="rate" type="number" value={formData.rate} onChange={handleRateChange} className="col-span-3" required/>
              </div>
               <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="unit" className="text-right">Unit</Label>
                  <Input id="unit" value={formData.unit} onChange={handleChange} className="col-span-3" required/>
              </div>
            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="secondary" disabled={isSaving}>Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (rate ? "Save Changes" : "Add Rate")}
                </Button>
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
