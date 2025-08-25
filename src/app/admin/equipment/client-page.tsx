
"use client";

import React, { useState, useMemo } from "react";
import { collection, addDoc, updateDoc, deleteDoc, doc, getDoc } from "firebase/firestore";
import Link from "next/link";
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
import { PlusCircle, MoreHorizontal, Edit, Trash2, Loader2, Package, PackageCheck, PackageX, AlertTriangle, Inbox } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import type { Equipment } from "@/lib/types";
import { Combobox } from "@/components/ui/combobox";
import { logDeletion } from "@/lib/audit";

export default function EquipmentClientPage({ initialEquipment }: { initialEquipment: Equipment[]}) {
  const [user] = useAuthState(auth);
  const { toast } = useToast();
  const [equipment, setEquipment] = useState<Equipment[]>(initialEquipment);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setModalOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState<Equipment | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const userRole = typeof window !== 'undefined' ? localStorage.getItem('userRole') : null;

  const filteredEquipment = useMemo(() => {
    return equipment.filter((item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [equipment, searchTerm]);

  const handleSave = async (itemData: Omit<Equipment, 'id'> & { id?: string }) => {
    setIsLoading(true);
    try {
      if (currentItem) {
        const { id, ...dataToUpdate } = itemData;
        const itemDoc = doc(db, "equipment", currentItem.id);
        await updateDoc(itemDoc, dataToUpdate);
        setEquipment(equipment.map((item) =>
          item.id === currentItem.id ? { ...currentItem, ...dataToUpdate, id: currentItem.id } : item
        ));
        toast({ title: "Item Updated", description: `${dataToUpdate.name}'s details have been updated.` });
      } else {
        const docRef = await addDoc(collection(db, "equipment"), itemData);
        setEquipment([...equipment, { ...itemData, id: docRef.id }]);
        toast({ title: "Item Added", description: `${itemData.name} has been added to inventory.` });
      }
      setModalOpen(false);
      setCurrentItem(null);
    } catch (error) {
       console.error("Error saving equipment:", error);
       toast({ variant: 'destructive', title: "Error", description: "Could not save item." });
    } finally {
        setIsLoading(false);
    }
  };
  
  const handleAddNew = () => {
    setCurrentItem(null);
    setModalOpen(true);
  };
  
  const handleEdit = (item: Equipment) => {
    setCurrentItem(item);
    setModalOpen(true);
  };

  const handleDelete = async (itemId: string) => {
    setIsLoading(true);
    try {
      const itemRef = doc(db, "equipment", itemId);
      const itemSnap = await getDoc(itemRef);
      const itemToDelete = itemSnap.data();

      await deleteDoc(itemRef);
      
      await logDeletion({
        actor: { name: user?.displayName, id: user?.uid },
        collectionName: 'equipment',
        documentId: itemId,
        documentData: itemToDelete,
      });

      setEquipment(equipment.filter(item => item.id !== itemId));
      toast({ variant: 'destructive', title: "Item Deleted", description: `The item has been removed from inventory.` });
    } catch (error) {
      console.error("Error deleting equipment:", error);
      toast({ variant: 'destructive', title: "Error", description: "Could not delete item." });
    } finally {
        setIsLoading(false);
    }
  };


  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Inventory Management</h1>
        <p className="text-muted-foreground">
          Manage all company materials, equipment, and assets.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Inventory List</CardTitle>
          <CardDescription>
            View, add, edit, or delete inventory items.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
            <Input
              placeholder="Search inventory..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
            <div className="flex gap-2">
              <Button asChild>
                <Link href="/admin/equipment/receive">
                    <Inbox className="mr-2 h-4 w-4" /> Receive Stock
                </Link>
              </Button>
              <Button onClick={handleAddNew}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add New Item
              </Button>
            </div>
          </div>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status / Quantity</TableHead>
                  <TableHead className="w-[50px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEquipment.length > 0 ? (
                  filteredEquipment.map((item) => (
                    <TableRow key={item.id} className="animate-fade-in">
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.category}</TableCell>
                      <TableCell>
                        {item.category === 'Consumable' ? (
                            <div className="flex items-center gap-2">
                                {(item.quantityOnHand ?? 0) <= (item.minStock ?? 0) ? <AlertTriangle className="text-destructive"/> : ((item.quantityOnHand ?? 0) > 0 ? <PackageCheck className="text-green-500" /> : <PackageX className="text-destructive" />)}
                               <span>{item.quantityOnHand ?? 0} {item.unit}</span>
                               {(item.quantityOnHand ?? 0) <= (item.minStock ?? 0) && <Badge variant="destructive">Low Stock</Badge>}
                            </div>
                        ) : (
                            <Badge variant={
                                item.status === 'Available' ? 'default' : item.status === 'In Use' ? 'secondary' : 'destructive'
                            }>
                                {item.status}
                            </Badge>
                        )}
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
                                <DropdownMenuItem onClick={() => handleEdit(item)}>
                                  <Edit className="mr-2 h-4 w-4"/>
                                  Edit
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
                                    This action cannot be undone. This will permanently delete the inventory record for {item.name}.
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
                    <TableCell colSpan={4} className="h-24 text-center">
                      No results found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <EquipmentFormModal
        isOpen={isModalOpen}
        onOpenChange={setModalOpen}
        onSave={handleSave}
        item={currentItem}
        isSaving={isLoading}
      />
    </div>
  );
}

type EquipmentFormModalProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (itemData: Omit<Equipment, 'id'> & { id?: string }) => void;
  item: Equipment | null;
  isSaving: boolean;
};

function EquipmentFormModal({ isOpen, onOpenChange, onSave, item, isSaving }: EquipmentFormModalProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<Omit<Equipment, 'id'>>({
      name: "",
      category: "Consumable",
      status: "Available",
      quantityOnHand: 0,
      unit: "pieces",
      minStock: 0,
      aliases: [],
  });

  React.useEffect(() => {
    if (isOpen) {
      if (item) {
        setFormData({
            name: item.name,
            category: item.category,
            status: item.status,
            quantityOnHand: item.quantityOnHand ?? 0,
            unit: item.unit ?? 'pieces',
            minStock: item.minStock ?? 0,
            aliases: item.aliases ?? [],
        });
      } else {
        setFormData({
            name: "",
            category: "Consumable",
            status: "Available",
            quantityOnHand: 0,
            unit: "pieces",
            minStock: 0,
            aliases: [],
        });
      }
    }
  }, [item, isOpen]);

  const handleChange = (field: keyof typeof formData, value: string | number | string[]) => {
    setFormData(prev => ({...prev, [field]: value}));
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
        toast({ variant: 'destructive', title: "Error", description: "Please fill all fields." });
        return;
    }
    const dataToSave = {
        ...formData,
        aliases: Array.isArray(formData.aliases) ? formData.aliases : (formData.aliases as string).split(',').map(s => s.trim()).filter(Boolean),
    };

    // Don't save quantity if it's an asset
    if(formData.category === 'Asset') {
        onSave({ ...dataToSave, id: item?.id, quantityOnHand: undefined, unit: undefined, minStock: undefined });
    } else {
        onSave({ ...dataToSave, id: item?.id });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] animate-fade-in">
        <form onSubmit={handleSubmit}>
            <DialogHeader>
            <DialogTitle>{item ? "Edit Item" : "Add New Item"}</DialogTitle>
            <DialogDescription>
                {item ? "Update the details for this inventory item." : "Enter the details for a new inventory item."}
            </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">Name</Label>
                  <Input id="name" value={formData.name} onChange={e => handleChange('name', e.target.value)} className="col-span-3" required/>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="category" className="text-right">Category</Label>
                  <Combobox
                    className="col-span-3"
                    options={[
                        { value: 'Consumable', label: 'Consumable' },
                        { value: 'Asset', label: 'Asset' },
                    ]}
                    value={formData.category}
                    onValueChange={(value) => handleChange('category', value as Equipment['category'])}
                    placeholder="Select category..."
                    searchPlaceholder="Search categories..."
                  />
              </div>

             {formData.category === 'Consumable' && (
                <>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="quantityOnHand" className="text-right">Quantity</Label>
                        <Input id="quantityOnHand" type="number" value={formData.quantityOnHand} onChange={e => handleChange('quantityOnHand', e.target.valueAsNumber || 0)} className="col-span-3"/>
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="unit" className="text-right">Unit</Label>
                        <Input id="unit" value={formData.unit} onChange={e => handleChange('unit', e.target.value)} className="col-span-3" placeholder="e.g. pieces, box, feet"/>
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="minStock" className="text-right">Min Stock</Label>
                        <Input id="minStock" type="number" value={formData.minStock} onChange={e => handleChange('minStock', e.target.valueAsNumber || 0)} className="col-span-3" placeholder="Low stock warning level"/>
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="aliases" className="text-right">Aliases</Label>
                        <Input id="aliases" value={Array.isArray(formData.aliases) ? formData.aliases.join(', ') : ''} onChange={e => handleChange('aliases', e.target.value)} className="col-span-3" placeholder="Comma-separated"/>
                    </div>
                </>
             )}

              {formData.category === 'Asset' && (
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="status" className="text-right">Status</Label>
                    <Combobox
                      className="col-span-3"
                      options={[
                          { value: 'Available', label: 'Available' },
                          { value: 'In Use', label: 'In Use' },
                          { value: 'Maintenance', label: 'Maintenance' },
                      ]}
                      value={formData.status}
                      onValueChange={(value) => handleChange('status', value as Equipment['status'])}
                      placeholder="Select status..."
                      searchPlaceholder="Search status..."
                    />
                </div>
              )}
            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="secondary" disabled={isSaving}>Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : (item ? "Save Changes" : "Add Item")}
                </Button>
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
