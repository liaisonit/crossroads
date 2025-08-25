
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { doc, getDoc, updateDoc, writeBatch, collection, query, where, getDocs, limit, arrayUnion, serverTimestamp } from "firebase/firestore";
import { getStorage, ref, uploadString, getDownloadURL } from "firebase/storage";
import { db, auth } from "@/lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";
import { Loader2, ArrowLeft, User, Briefcase, FileText, Calendar, Package, UploadCloud, X, ClipboardList, RefreshCw } from "lucide-react";
import type { MaterialOrder, MaterialOrderItem, Equipment, ReturnItem } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { debounce } from "lodash";
import { logActivity } from "@/lib/audit";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { classifyReturnReason } from "@/ai/flows/return-reason-tagging-flow";

export default function MaterialOrderDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [user] = useAuthState(auth);
  const [order, setOrder] = useState<MaterialOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [deliveryProofImage, setDeliveryProofImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isReturnModalOpen, setReturnModalOpen] = useState(false);


  useEffect(() => {
    if (typeof id !== "string") return;

    const fetchOrder = async () => {
      setIsLoading(true);
      try {
        const docRef = doc(db, "materialOrders", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const orderData = { id: docSnap.id, ...docSnap.data() } as MaterialOrder;
          // Pre-fill deliveredQuantity if it doesn't exist
          const itemsWithDeliveredQty = orderData.items.map(item => ({
              ...item,
              deliveredQuantity: item.deliveredQuantity ?? item.quantity
          }));
          setOrder({ ...orderData, items: itemsWithDeliveredQty });
        } else {
          toast({ variant: "destructive", title: "Error", description: "Order not found." });
          router.push('/admin/material-orders');
        }
      } catch (error) {
        console.error("Error fetching order:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not fetch order details." });
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrder();
  }, [id, toast, router]);

  const updateInventoryOnDelivery = async (items: MaterialOrderItem[]) => {
      // This function is now superseded by backend logic, but can be used for other client-side updates if needed.
      // For now, we assume the backend handles inventory updates on status change to 'Delivered' or 'Partially Delivered'.
  }

  const handleStatusUpdate = async (newStatus: MaterialOrder['status']) => {
    if (typeof id !== "string" || !order) return;
    setIsUpdating(true);
    let finalStatus = newStatus;
    
    // Auto-detect partial delivery when marking as "Delivered"
    if (newStatus === 'Delivered') {
        const isPartial = order.items.some(item => (item.deliveredQuantity ?? item.quantity) < item.quantity);
        if (isPartial) {
            finalStatus = 'Partially Delivered';
        }
    }

    try {
        await logActivity({
          actor: { name: user?.displayName, id: user?.uid },
          action: 'materialOrder.statusUpdate',
          target: { type: 'materialOrder', id: order.id, name: `Order for ${order.jobName}` },
          diff: { before: { status: order.status }, after: { status: finalStatus } },
          details: `Order status changed from ${order.status} to ${finalStatus}`
        });

        const docRef = doc(db, "materialOrders", id);
        // The backend Cloud Function should handle inventory updates based on this status change.
        await updateDoc(docRef, { status: finalStatus, deliveryDate: finalStatus === 'Delivered' || finalStatus === 'Partially Delivered' ? serverTimestamp() : null });
        
        setOrder(prev => prev ? {...prev, status: finalStatus } : null);
        toast({ title: "Status Updated", description: `Order status has been updated to ${finalStatus}.` });
    } catch(error) {
        console.error("Error updating status:", error);
        toast({ variant: "destructive", title: "Update Failed", description: "Could not update the order status." });
    } finally {
        setIsUpdating(false);
    }
  }

  const debouncedUpdateItemQuantity = useCallback(
    debounce(async (itemName: string, newQuantity: number) => {
      if (typeof id !== "string" || !order) return;

      const updatedItems = order.items.map(item => 
        item.name === itemName ? { ...item, deliveredQuantity: newQuantity } : item
      );

      try {
        const docRef = doc(db, "materialOrders", id);
        await updateDoc(docRef, { items: updatedItems });
        toast({ title: "Quantity Updated", description: `Delivered quantity for ${itemName} set to ${newQuantity}.` });
      } catch (error) {
        console.error("Error updating item quantity:", error);
        toast({ variant: "destructive", title: "Update Failed", description: "Could not update item quantity." });
      }
    }, 1000), // 1000ms debounce delay
    [id, order, toast]
  );

  const handleQuantityChange = (itemName: string, newQuantity: number) => {
      // Update local state immediately for better UX
      setOrder(prevOrder => {
          if (!prevOrder) return null;
          const updatedItems = prevOrder.items.map(item => 
            item.name === itemName ? { ...item, deliveredQuantity: newQuantity } : item
          );
          return { ...prevOrder, items: updatedItems };
      });
      // Debounce the firestore update
      debouncedUpdateItemQuantity(itemName, newQuantity);
  };


  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setDeliveryProofImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const saveDeliveryProof = async () => {
    if (!deliveryProofImage || typeof id !== 'string') return;
    setIsUploading(true);
    try {
        const storage = getStorage();
        const storageRef = ref(storage, `deliveryProofs/${id}/${Date.now()}.png`);
        const snapshot = await uploadString(storageRef, deliveryProofImage, 'data_url');
        const downloadURL = await getDownloadURL(snapshot.ref);

        const docRef = doc(db, "materialOrders", id);
        await updateDoc(docRef, { deliveryProofUrl: downloadURL });
        setOrder(prev => prev ? {...prev, deliveryProofUrl: downloadURL } : null);
        setDeliveryProofImage(null);
        toast({ title: "Proof of Delivery Saved", description: "The image has been uploaded and linked to the order." });
    } catch(error) {
        console.error("Error saving proof of delivery:", error);
        toast({ variant: "destructive", title: "Upload Failed", description: "Could not save the delivery proof." });
    } finally {
        setIsUploading(false);
    }
  }

  const handleReturnItems = async (itemsToReturn: Omit<ReturnItem, 'tags' | 'reason' | 'returnedAt' | 'processedBy'>[], reason: string) => {
      if (typeof id !== "string" || !order) return;
      setIsUpdating(true);
      
      try {
          // 1. Classify reason with AI
          const tags = await classifyReturnReason({ reasonText: reason });
          
          const fullReturnItems: ReturnItem[] = itemsToReturn.map(item => ({
              ...item,
              reason: reason,
              tags: tags,
              returnedAt: new Date().toISOString(),
              processedBy: user?.displayName || 'Unknown',
          }));

          // 2. Update inventory and order in a batch
          const batch = writeBatch(db);
          const equipmentRef = collection(db, 'equipment');
          
          for (const item of fullReturnItems) {
              const q = query(equipmentRef, where("name", "==", item.name), limit(1));
              const querySnapshot = await getDocs(q);

              if (!querySnapshot.empty) {
                  const docSnap = querySnapshot.docs[0];
                  const inventoryItem = docSnap.data() as Equipment;
                  if (inventoryItem.category === 'Consumable') {
                      const newQuantity = (inventoryItem.quantityOnHand ?? 0) + item.returnedQuantity;
                      batch.update(docSnap.ref, { quantityOnHand: newQuantity });
                  }
              }
          }
          
          const orderRef = doc(db, 'materialOrders', id);
          batch.update(orderRef, {
              returnedItems: arrayUnion(...fullReturnItems)
          });
          
          await batch.commit();

          // 3. Log activity
          await logActivity({
            actor: { name: user?.displayName, id: user?.uid },
            action: 'material.return',
            target: { type: 'materialOrder', id: order.id, name: `Order for ${order.jobName}` },
            details: `Processed return for ${fullReturnItems.length} item(s). Reason: ${reason}`
          });
          
          // 4. Update local state
          setOrder(prev => prev ? { ...prev, returnedItems: [...(prev.returnedItems || []), ...fullReturnItems] } : null);
          setReturnModalOpen(false);
          toast({ title: "Return Processed", description: "Inventory has been updated with returned items." });

      } catch (error) {
          console.error("Error processing return:", error);
          toast({ variant: 'destructive', title: "Return Failed", description: "Could not process the return." });
      } finally {
          setIsUpdating(false);
      }
  }

  const getStatusBadgeVariant = (status: MaterialOrder['status']) => {
    switch (status) {
      case 'Delivered': return 'default';
      case 'Rejected': return 'destructive';
      case 'Pending': return 'secondary';
      case 'Approved': return 'secondary';
      default: return 'outline';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center">
        <p>Order not found.</p>
        <Button asChild className="mt-4">
          <Link href="/admin/material-orders">Back to All Orders</Link>
        </Button>
      </div>
    );
  }
  
  const statusOptions: MaterialOrder['status'][] = ['Pending', 'Approved', 'Rejected', 'Picking', 'In Transit', 'Delivered'];


  return (
    <div className="space-y-6">
        <div className="mb-6 flex justify-between items-start gap-4 flex-wrap">
             <Button asChild variant="outline" className="lift-button">
                <Link href="/admin/material-orders">
                    <ArrowLeft className="mr-2" />
                    Back to All Orders
                </Link>
            </Button>
            { (order.status === 'Delivered' || order.status === 'Partially Delivered') && (
                <Button variant="outline" onClick={() => setReturnModalOpen(true)}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Return Items
                </Button>
            )}
        </div>

        <Card className="glassmorphism">
            <CardHeader className="flex flex-col md:flex-row justify-between md:items-center">
                <div>
                    <CardTitle className="text-3xl font-bold">{order.jobName}</CardTitle>
                    <CardDescription>
                        Order placed by {order.foremanName} on {new Date(order.createdAt.seconds * 1000).toLocaleDateString()}
                    </CardDescription>
                </div>
                <Badge variant={getStatusBadgeVariant(order.status)} className="text-lg mt-2 md:mt-0">
                    {order.status}
                </Badge>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="flex items-center gap-2"><User className="text-primary"/><strong>Foreman:</strong><span>{order.foremanName}</span></div>
                    <div className="flex items-center gap-2"><Briefcase className="text-primary"/><strong>Job:</strong><span>{order.jobName}</span></div>
                    <div className="flex items-center gap-2"><Calendar className="text-primary"/><strong>Requested By:</strong><span>{order.requestedDeliveryDate}</span></div>
                </div>
                 {order.notes && (
                     <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2"><FileText /> Foreman's Notes</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 border rounded-lg bg-secondary/50 text-sm text-muted-foreground">
                            <p className="whitespace-pre-wrap">{order.notes}</p>
                        </CardContent>
                    </Card>
                )}
                <Separator />
                <div>
                    <h3 className="text-lg font-semibold mb-2 flex items-center gap-2"><Package /> Order Items</h3>
                    <div className="border rounded-lg overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Item Name</TableHead>
                                    <TableHead>Requested</TableHead>
                                    <TableHead>Delivered</TableHead>
                                    <TableHead>Notes</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {order.items.map((item, index) => (
                                    <TableRow key={index}>
                                        <TableCell className="font-medium">{item.name}</TableCell>
                                        <TableCell>{item.quantity}</TableCell>
                                        <TableCell>
                                            <Input 
                                                type="number" 
                                                className="w-24" 
                                                value={item.deliveredQuantity ?? item.quantity}
                                                onChange={(e) => handleQuantityChange(item.name, e.target.valueAsNumber || 0)}
                                                disabled={isUpdating}
                                            />
                                        </TableCell>
                                        <TableCell>{item.notes || 'N/A'}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
                <Separator />
                <div>
                    <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">Proof of Delivery</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {order.deliveryProofUrl ? (
                             <div className="border rounded-lg p-2 bg-secondary">
                                 <Image src={order.deliveryProofUrl} alt="Proof of delivery" width={400} height={300} className="rounded-md object-contain" />
                             </div>
                        ) : (
                             <div className="relative border-2 border-dashed border-muted-foreground/50 rounded-lg p-6 text-center">
                                <UploadCloud className="mx-auto h-10 w-10 text-muted-foreground" />
                                <p className="mt-2 text-sm text-muted-foreground">Upload proof of delivery</p>
                                <Input 
                                    type="file" 
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    accept="image/png, image/jpeg, image/webp"
                                    onChange={handleImageUpload}
                                />
                            </div>
                        )}
                       {deliveryProofImage && (
                            <div className="space-y-4">
                                <div className="relative border rounded-lg p-2 bg-secondary">
                                    <Image src={deliveryProofImage} alt="Preview" width={400} height={300} className="rounded-md object-contain"/>
                                     <Button
                                        variant="destructive"
                                        size="icon"
                                        className="absolute top-2 right-2 h-7 w-7 lift-button"
                                        onClick={() => setDeliveryProofImage(null)}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                                <Button onClick={saveDeliveryProof} disabled={isUploading}>
                                    {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                                    Save Proof
                                </Button>
                            </div>
                       )}
                    </div>
                </div>
                 {order.returnedItems && order.returnedItems.length > 0 && (
                    <>
                        <Separator />
                        <div>
                             <h3 className="text-lg font-semibold mb-2 flex items-center gap-2"><RefreshCw /> Returned Items</h3>
                             <div className="border rounded-lg overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Item</TableHead>
                                            <TableHead>Qty</TableHead>
                                            <TableHead>Reason</TableHead>
                                            <TableHead>Tags</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {order.returnedItems.map((item, index) => (
                                            <TableRow key={index}>
                                                <TableCell>{item.name}</TableCell>
                                                <TableCell>{item.returnedQuantity}</TableCell>
                                                <TableCell className="text-xs text-muted-foreground">{item.reason}</TableCell>
                                                <TableCell>
                                                    <div className="flex flex-wrap gap-1">
                                                        {item.tags.map(tag => <Badge key={tag} variant="secondary">{tag}</Badge>)}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                             </div>
                        </div>
                    </>
                )}
            </CardContent>
             <CardFooter className="bg-secondary/50 p-4 border-t flex flex-col sm:flex-row justify-end items-center gap-4">
                <Label>Update Status:</Label>
                <div className="flex gap-2">
                    <Select onValueChange={(value) => handleStatusUpdate(value as MaterialOrder['status'])} value={order.status} disabled={isUpdating}>
                        <SelectTrigger className="w-[180px] bg-background">
                            <SelectValue placeholder="Change status..." />
                        </SelectTrigger>
                        <SelectContent>
                            {statusOptions.map(status => (
                                <SelectItem key={status} value={status}>{status}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {isUpdating && <Loader2 className="h-6 w-6 animate-spin" />}
                </div>
             </CardFooter>
        </Card>

        <ReturnItemsModal
            isOpen={isReturnModalOpen}
            onOpenChange={setReturnModalOpen}
            order={order}
            onReturnSubmit={handleReturnItems}
            isSubmitting={isUpdating}
        />
    </div>
  );
}


type ReturnItemsModalProps = {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    order: MaterialOrder;
    onReturnSubmit: (items: Omit<ReturnItem, 'tags' | 'reason' | 'returnedAt' | 'processedBy'>[], reason: string) => Promise<void>;
    isSubmitting: boolean;
};

function ReturnItemsModal({ isOpen, onOpenChange, order, onReturnSubmit, isSubmitting }: ReturnItemsModalProps) {
    const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
    const [reason, setReason] = useState("");

    useEffect(() => {
        if (isOpen) {
            setReturnQuantities({});
            setReason("");
        }
    }, [isOpen]);

    const handleQuantityChange = (itemName: string, value: number) => {
        setReturnQuantities(prev => ({...prev, [itemName]: value}));
    };

    const handleSubmit = () => {
        const itemsToReturn: Omit<ReturnItem, 'tags' | 'reason' | 'returnedAt' | 'processedBy'>[] = Object.entries(returnQuantities)
            .filter(([, qty]) => qty > 0)
            .map(([name, qty]) => ({ name, returnedQuantity: qty }));
        
        if (itemsToReturn.length > 0) {
            onReturnSubmit(itemsToReturn, reason);
        }
    };

    const getDeliveredQuantity = (item: MaterialOrderItem) => item.deliveredQuantity ?? item.quantity;
    
    const getAlreadyReturnedQuantity = (itemName: string) => {
        return order.returnedItems?.filter(i => i.name === itemName).reduce((sum, i) => sum + i.returnedQuantity, 0) ?? 0;
    }
    
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Return Items for Order</DialogTitle>
                    <DialogDescription>
                        Specify the quantity of items to return to inventory and provide a reason.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="max-h-[40vh] overflow-y-auto pr-2">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Item Name</TableHead>
                                    <TableHead className="text-center">Delivered</TableHead>
                                    <TableHead className="text-center">Returned</TableHead>
                                    <TableHead className="text-center">Return Qty</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {order.items.map(item => {
                                    const deliveredQty = getDeliveredQuantity(item);
                                    const returnedQty = getAlreadyReturnedQuantity(item.name);
                                    const maxReturnable = deliveredQty - returnedQty;
                                    if (maxReturnable <= 0) return null;

                                    return (
                                        <TableRow key={item.name}>
                                            <TableCell className="font-medium">{item.name}</TableCell>
                                            <TableCell className="text-center">{deliveredQty}</TableCell>
                                            <TableCell className="text-center">{returnedQty}</TableCell>
                                            <TableCell className="text-center">
                                                <Input 
                                                    type="number" 
                                                    min={0}
                                                    max={maxReturnable}
                                                    className="w-24 mx-auto"
                                                    value={returnQuantities[item.name] || ''}
                                                    onChange={e => handleQuantityChange(item.name, Math.min(e.target.valueAsNumber, maxReturnable) || 0)}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="return-reason">Reason for Return</Label>
                        <Textarea 
                            id="return-reason"
                            placeholder="e.g., Ordered too many, wrong size delivered, items were damaged..."
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="secondary" disabled={isSubmitting}>Cancel</Button>
                    </DialogClose>
                    <Button onClick={handleSubmit} disabled={isSubmitting || Object.values(returnQuantities).every(qty => !qty || qty === 0) || !reason.trim()}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                        Process Return
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
