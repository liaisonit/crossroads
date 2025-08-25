

"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { collection, getDocs, addDoc, serverTimestamp, query, where, orderBy, limit, writeBatch, doc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Trash2, Plus, Loader2, ArrowLeft, CalendarIcon, Wand2, Package, Copy, ClipboardPaste, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Combobox } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { Job, Equipment, MaterialOrderItem, MaterialSuggestion, Submission } from "@/lib/types";
import { suggestMaterials } from "@/ai/flows/material-suggestion-flow";
import { parseMaterialOrderFromText } from "@/ai/flows/material-order-parser-flow";
import { ThemeToggle } from "@/components/theme-toggle";

type OrderItemEntry = Omit<MaterialOrderItem, 'id'> & {
    internalId: number;
    isClosing?: boolean;
}

export default function NewMaterialOrderPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, authLoading] = useAuthState(auth);
  const [userName, setUserName] = useState<string | null>(null);


  // Form State
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [requestedDeliveryDate, setRequestedDeliveryDate] = useState<Date | undefined>(new Date());
  const [orderItems, setOrderItems] = useState<OrderItemEntry[]>([]);
  const [notes, setNotes] = useState("");

  // Static Data
  const [jobs, setJobs] = useState<Job[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  
  // UI State
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPopulating, setIsPopulating] = useState(false);
  const [isParsingModalOpen, setParsingModalOpen] = useState(false);
  
  // AI Suggestions
  const [materialSuggestions, setMaterialSuggestions] = useState<MaterialSuggestion[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    const name = localStorage.getItem("userName");
    setUserName(name);

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [jobsSnap, equipSnap] = await Promise.all([
          getDocs(collection(db, "jobs")),
          getDocs(collection(db, "equipment")),
        ]);
        setJobs(jobsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Job)));
        setEquipment(equipSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Equipment)));
      } catch (error) {
        console.error("Error fetching data:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not load necessary data." });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user, authLoading, router, toast]);

  useEffect(() => {
    if (!selectedJobId) {
        setMaterialSuggestions([]);
        return;
    }
    const fetchSuggestions = async () => {
        setIsSuggesting(true);
        try {
            const suggestions = await suggestMaterials({ jobId: selectedJobId });
            setMaterialSuggestions(suggestions);
        } catch (error) {
            console.error("Failed to fetch material suggestions:", error);
        } finally {
            setIsSuggesting(false);
        }
    };
    fetchSuggestions();
  }, [selectedJobId]);
  
  const jobOptions = useMemo(() => jobs.map(j => ({ value: j.id, label: j.name })), [jobs]);
  const equipmentOptions = useMemo(() => equipment.map(e => ({ value: e.name, label: e.name })), [equipment]);

  const getAvailableEquipmentOptions = (currentItemName: string) => {
    const selectedNames = orderItems.map(item => item.name).filter(name => name !== currentItemName);
    return equipmentOptions.filter(opt => !selectedNames.includes(opt.value));
  }

  const addOrderItem = (name = "", quantity = 1, notes = "") => {
    setOrderItems(prev => [
      ...prev,
      { internalId: Date.now() + Math.random(), name, quantity, notes },
    ]);
  };

  const removeOrderItem = (internalId: number) => {
    setOrderItems((prev) =>
      prev.map((item) =>
        item.internalId === internalId ? { ...item, isClosing: true } : item
      )
    );
    setTimeout(() => {
      setOrderItems((prev) => prev.filter((item) => item.internalId !== internalId));
    }, 500);
  };
  
  const handleItemChange = (internalId: number, field: keyof OrderItemEntry, value: string | number) => {
    setOrderItems(prev => prev.map(item => {
      if (item.internalId === internalId) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const handleSubmit = async () => {
    if (!selectedJobId || !requestedDeliveryDate) {
      toast({ variant: "destructive", title: "Error", description: "Please select a job and a delivery date." });
      return;
    }
    if (orderItems.length === 0) {
      toast({ variant: "destructive", title: "Error", description: "Please add at least one item to the order." });
      return;
    }
    if (!user || !userName) {
      toast({ variant: "destructive", title: "Error", description: "Could not verify user information. Please try logging in again." });
      return;
    }

    setIsSubmitting(true);
    try {
        const batch = writeBatch(db);
        const newItemsToAdd: string[] = [];

        // Identify new items to add to the master equipment list
        orderItems.forEach(item => {
            const itemExists = equipment.some(e => e.name.toLowerCase() === item.name.toLowerCase());
            if (!itemExists && item.name) {
                newItemsToAdd.push(item.name);
            }
        });
        
        // Add new items to the equipment collection within the same batch
        newItemsToAdd.forEach(itemName => {
            const newItemRef = doc(collection(db, "equipment"));
            batch.set(newItemRef, {
                name: itemName,
                category: "Consumable",
                status: "Available",
                quantityOnHand: 0,
                unit: "unit",
                minStock: 0,
                aliases: [],
            });
        });

      const selectedJob = jobs.find(j => j.id === selectedJobId);
      const orderRef = doc(collection(db, "materialOrders"));
      
      batch.set(orderRef, {
        foremanId: user.uid,
        foremanName: userName,
        jobId: selectedJobId,
        jobName: selectedJob?.name,
        status: "Pending",
        items: orderItems.map(({ internalId, isClosing, ...rest }) => rest),
        createdAt: serverTimestamp(),
        requestedDeliveryDate: format(requestedDeliveryDate, "yyyy-MM-dd"),
        notes: notes,
      });

      await batch.commit();

      toast({ title: "Order Submitted", description: "Your material order has been successfully submitted." });
      router.push("/dashboard/material-orders");
    } catch (error) {
      console.error("Error submitting order:", error);
      toast({ variant: "destructive", title: "Submission Failed", description: "Could not submit your order." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartWithYesterday = async () => {
    if (!user) return;
    setIsPopulating(true);
    try {
        const q = query(
            collection(db, "materialOrders"),
            where("foremanId", "==", user.uid),
            orderBy("createdAt", "desc"),
            limit(1)
        );
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            toast({ title: "No Previous Order Found", description: "Could not find a previous material order to copy from." });
            return;
        }

        const lastOrder = querySnapshot.docs[0].data() as any; // Using any for flexibility
        
        setSelectedJobId(lastOrder.jobId);
        setNotes(lastOrder.notes || "");
        
        const lastOrderItems = lastOrder.items || [];
        setOrderItems(lastOrderItems.map((e: any, i: number) => ({
            internalId: Date.now() + i,
            name: e.name,
            quantity: e.quantity,
            notes: e.notes || '',
        })));
        
        toast({ title: "Form Populated", description: "Form has been pre-filled with your last material order." });

    } catch (error) {
        console.error("Error populating from yesterday:", error);
        toast({ variant: 'destructive', title: "Error", description: "Could not load data from previous order." });
    } finally {
        setIsPopulating(false);
    }
  };
  
  const filteredSuggestions = useMemo(() => {
      const currentItemNames = new Set(orderItems.map(item => item.name));
      return materialSuggestions.filter(s => !currentItemNames.has(s.name));
  }, [materialSuggestions, orderItems]);

  const handleLogout = async () => {
    await auth.signOut();
    localStorage.removeItem("userName");
    localStorage.removeItem("userRole");
    router.push("/login");
  };

  if (isLoading || authLoading) {
      return (
          <div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>
      )
  }

  return (
     <div className="flex flex-col h-screen bg-background text-foreground">
        <header className="flex items-center justify-between p-4 border-b shrink-0 h-16">
            <div className="flex items-center gap-4">
                <Button asChild variant="outline" size="icon" className="lift-button">
                    <Link href="/dashboard">
                        <ArrowLeft />
                    </Link>
                </Button>
                <div className="hidden sm:block">
                  <h1 className="text-xl font-bold tracking-tight">New Material Order</h1>
                </div>
            </div>
            <div className="flex items-center gap-4">
                <div className="text-right hidden sm:block">
                    <p className="font-semibold text-sm">{userName}</p>
                    <p className="text-xs text-muted-foreground">Foreman</p>
                </div>
                <ThemeToggle />
                <Button variant="ghost" size="icon" onClick={handleLogout} className="lift-button">
                    <LogOut className="h-5 w-5" />
                </Button>
            </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6 animate-fade-in">
          <div className="space-y-6 max-w-4xl mx-auto">
            <div className="flex justify-between items-center gap-4 flex-wrap">
              <div>
                  <h1 className="text-3xl font-bold tracking-tight">New Material Order</h1>
                  <p className="text-muted-foreground">
                      Fill out the form to request materials for a job site.
                  </p>
              </div>
              <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setParsingModalOpen(true)}>
                      <ClipboardPaste className="mr-2 h-4 w-4"/>
                      Paste from Text
                  </Button>
                  <Button variant="outline" onClick={handleStartWithYesterday} disabled={isPopulating}>
                      {isPopulating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Copy className="mr-2 h-4 w-4"/>}
                      Start with Last Order
                  </Button>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Order Details</CardTitle>
                <CardDescription>Select the job and requested delivery date.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                <div className="space-y-2">
                  <Label htmlFor="deliveryDate">Requested Delivery Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !requestedDeliveryDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {requestedDeliveryDate ? format(requestedDeliveryDate, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={requestedDeliveryDate}
                        onSelect={setRequestedDeliveryDate}
                        disabled={(date) => date < new Date() || date < new Date("1900-01-01")}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                  <CardTitle>AI Suggestions</CardTitle>
                  <CardDescription>Based on past orders for this job.</CardDescription>
              </CardHeader>
              <CardContent>
                  {isSuggesting ? (
                      <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/>Loading suggestions...</div>
                  ) : filteredSuggestions.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                          {filteredSuggestions.map(s => (
                              <Button key={s.name} variant="outline" size="sm" onClick={() => addOrderItem(s.name, s.suggestedQuantity)} className="lift-button">
                                  <Package className="mr-2 h-4 w-4"/>
                                  {s.name} {s.suggestedQuantity && `(${s.suggestedQuantity})`}
                              </Button>
                          ))}
                      </div>
                  ) : (
                      <p className="text-sm text-muted-foreground">{selectedJobId ? 'No frequent items found for this job.' : 'Select a job to see suggestions.'}</p>
                  )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Order Items</CardTitle>
                <CardDescription>Add the materials and quantities you need. You can type to add a new item to the master list.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50%]">Item Name</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orderItems.map((item) => (
                        <TableRow key={item.internalId} className={`transition-all duration-500 ${item.isClosing ? "opacity-0" : "opacity-100"}`}>
                          <TableCell>
                            <Combobox
                              creatable
                              options={getAvailableEquipmentOptions(item.name)}
                              value={item.name}
                              onValueChange={(value) => handleItemChange(item.internalId, 'name', value)}
                              placeholder="Select or create item..."
                              searchPlaceholder="Search or type to add..."
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleItemChange(item.internalId, 'quantity', e.target.valueAsNumber || 1)}
                              className="w-24"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              placeholder="Optional notes..."
                              value={item.notes || ""}
                              onChange={(e) => handleItemChange(item.internalId, 'notes', e.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => removeOrderItem(item.internalId)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <Button variant="outline" onClick={() => addOrderItem()} className="mt-4 w-full">
                  <Plus className="mr-2 h-4 w-4" /> Add Item
                </Button>
              </CardContent>
            </Card>

             <Card>
              <CardHeader>
                <CardTitle>Additional Notes</CardTitle>
                <CardDescription>Add any overall notes for this material order.</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="e.g., Please deliver to the 3rd floor entrance..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={handleSubmit} disabled={isSubmitting} size="lg">
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Submit Order
              </Button>
            </div>
            
            <TextParsingModal 
              isOpen={isParsingModalOpen} 
              onOpenChange={setParsingModalOpen} 
              onParse={(parsedItems) => {
                  parsedItems.forEach(item => addOrderItem(item.name, item.quantity, item.notes || ''));
              }}
            />
          </div>
        </main>
    </div>
  );
}


type TextParsingModalProps = {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    onParse: (items: MaterialOrderItem[]) => void;
}

function TextParsingModal({ isOpen, onOpenChange, onParse }: TextParsingModalProps) {
    const { toast } = useToast();
    const [text, setText] = useState("");
    const [isParsing, setIsParsing] = useState(false);

    const handleParse = async () => {
        if (!text.trim()) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please paste some text to parse.' });
            return;
        }
        setIsParsing(true);
        try {
            const parsedItems = await parseMaterialOrderFromText(text);
            if (parsedItems && parsedItems.length > 0) {
              onParse(parsedItems);
              toast({ title: "Items Parsed", description: `${parsedItems.length} items were added to your order.` });
              onOpenChange(false);
              setText("");
            } else {
              toast({ variant: 'destructive', title: 'Parsing Failed', description: 'Could not find any items in the text.' });
            }
        } catch (error) {
            console.error("Error parsing text:", error);
            toast({ variant: 'destructive', title: 'Parsing Failed', description: 'Could not parse the provided text.' });
        } finally {
            setIsParsing(false);
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Parse Order from Text</DialogTitle>
                    <DialogDescription>
                        Paste a list of materials from a chat or notes, and the AI will attempt to add them to your order.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Textarea
                        placeholder="e.g.
                        20x Switch Box
                        a few wire rolls, maybe 5?
                        Paint roller (large)
                        etc..."
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        className="h-48"
                    />
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="secondary" disabled={isParsing}>Cancel</Button>
                    </DialogClose>
                    <Button onClick={handleParse} disabled={isParsing}>
                        {isParsing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                        Parse and Add Items
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
