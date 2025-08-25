
"use client";

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Loader2, ArrowLeft, UploadCloud, Wand2, Check, X, AlertTriangle } from 'lucide-react';
import type { Equipment, MaterialOrderItem } from '@/lib/types';
import { parseInvoice } from '@/ai/flows/invoice-parser-flow';
import { Combobox } from '@/components/ui/combobox';


type ParsedItem = MaterialOrderItem & {
    id: number;
    mappedTo: string; // The ID of the equipment item in Firestore
    status: 'mapped' | 'unmapped' | 'new';
};

export default function ReceiveStockPage() {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [isParsing, setIsParsing] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
    const [invoicePreview, setInvoicePreview] = useState<string | null>(null);
    
    const [masterEquipmentList, setMasterEquipmentList] = useState<Equipment[]>([]);
    const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
    
    React.useEffect(() => {
        const fetchEquipment = async () => {
            setIsLoading(true);
            const equipSnap = await getDocs(collection(db, 'equipment'));
            const equipmentData = equipSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as Equipment }));
            setMasterEquipmentList(equipmentData);
            setIsLoading(false);
        };
        fetchEquipment();
    }, []);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setInvoiceFile(file);
            const reader = new FileReader();
            reader.onloadend = () => setInvoicePreview(reader.result as string);
            reader.readAsDataURL(file);
            setParsedItems([]);
        }
    };
    
    const equipmentOptions = useMemo(() => {
        return masterEquipmentList.map(e => ({ value: e.id, label: e.name }));
    }, [masterEquipmentList]);

    const handleParseInvoice = async () => {
        if (!invoicePreview) {
            toast({ variant: 'destructive', title: 'No file selected' });
            return;
        }
        setIsParsing(true);
        try {
            const results = await parseInvoice({ photoDataUri: invoicePreview });
            
            const processedItems = results.map((item, index) => {
                // Simple mapping strategy: find first item in master list whose name or alias includes the parsed name
                const lowerCaseName = item.name.toLowerCase();
                const matchedItem = masterEquipmentList.find(e => 
                    e.name.toLowerCase().includes(lowerCaseName) ||
                    (e.aliases && e.aliases.some(alias => alias.toLowerCase().includes(lowerCaseName)))
                );
                
                return {
                    ...item,
                    id: Date.now() + index,
                    mappedTo: matchedItem ? matchedItem.id : '',
                    status: matchedItem ? 'mapped' : 'unmapped',
                } as ParsedItem;
            });
            setParsedItems(processedItems);
            toast({ title: "Invoice Parsed", description: `Found ${processedItems.length} items. Please review and map them.` });
        } catch (error) {
            console.error("Error parsing invoice", error);
            toast({ variant: 'destructive', title: 'Parsing Failed', description: 'The AI could not read the invoice.' });
        } finally {
            setIsParsing(false);
        }
    };

    const handleItemUpdate = (id: number, field: keyof ParsedItem, value: string | number) => {
        setParsedItems(prev => prev.map(item => {
            if (item.id === id) {
                if (field === 'mappedTo') {
                    return { ...item, mappedTo: value as string, status: 'mapped' };
                }
                return { ...item, [field]: value };
            }
            return item;
        }));
    };
    
    const handleAddToInventory = async () => {
        const itemsToUpdate = parsedItems.filter(item => item.status === 'mapped');
        if (itemsToUpdate.length === 0) {
            toast({ variant: 'destructive', title: 'No Mapped Items', description: 'Please map items to your inventory before submitting.' });
            return;
        }
        setIsSubmitting(true);
        try {
            const batch = writeBatch(db);
            const equipmentRef = collection(db, 'equipment');
            
            for (const item of itemsToUpdate) {
                const docRef = doc(equipmentRef, item.mappedTo);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const currentData = docSnap.data() as Equipment;
                    if(currentData.category === 'Consumable') {
                        const newQuantity = (currentData.quantityOnHand ?? 0) + item.quantity;
                        batch.update(docRef, { quantityOnHand: newQuantity });
                    }
                }
            }
            await batch.commit();
            toast({ title: 'Inventory Updated', description: `${itemsToUpdate.length} items have been added to your inventory.` });
            setParsedItems([]);
            setInvoiceFile(null);
            setInvoicePreview(null);
        } catch (error) {
            console.error('Error updating inventory', error);
            toast({ variant: 'destructive', title: 'Update Failed', description: 'Could not update inventory.' });
        } finally {
            setIsSubmitting(false);
        }
    }


    if(isLoading) {
        return <div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin"/></div>
    }

    return (
        <div className="space-y-6 animate-fade-in p-4 md:p-6 lg:p-8">
            <div className="flex items-center gap-4">
                <Button asChild variant="outline">
                    <Link href="/admin/equipment"><ArrowLeft/> Back to Inventory</Link>
                </Button>
            </div>
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Receive New Stock</h1>
                <p className="text-muted-foreground">
                    Upload an invoice or receipt to automatically update your inventory.
                </p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>1. Upload Invoice</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="relative border-2 border-dashed border-muted-foreground/50 rounded-lg p-6 text-center h-64 flex flex-col justify-center items-center">
                            {invoicePreview ? (
                                <Image src={invoicePreview} alt="Invoice Preview" layout="fill" objectFit="contain" className="rounded-md"/>
                            ) : (
                                <>
                                    <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground" />
                                    <p className="mt-2 text-sm text-muted-foreground">Click to upload or drag & drop</p>
                                </>
                            )}
                            <Input 
                                type="file" 
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                accept="image/png, image/jpeg, image/webp"
                                onChange={handleFileChange}
                            />
                        </div>
                    </CardContent>
                    <CardFooter>
                         <Button onClick={handleParseInvoice} disabled={!invoiceFile || isParsing}>
                            {isParsing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Wand2 className="mr-2 h-4 w-4" />}
                            Parse with AI
                        </Button>
                    </CardFooter>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>2. Review & Map Items</CardTitle>
                        <CardDescription>
                            Review the items parsed by the AI. Map any unrecognized items to your master inventory list.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="border rounded-lg max-h-96 overflow-y-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Parsed Name</TableHead>
                                        <TableHead>Qty</TableHead>
                                        <TableHead>Mapped To</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isParsing ? (
                                        <TableRow><TableCell colSpan={3} className="text-center h-24"><Loader2 className="h-6 w-6 animate-spin mx-auto"/></TableCell></TableRow>
                                    ) : parsedItems.length > 0 ? (
                                        parsedItems.map(item => (
                                            <TableRow key={item.id}>
                                                <TableCell className="font-medium flex items-center gap-2">
                                                    {item.status === 'mapped' ? <Check className="text-green-500"/> : <AlertTriangle className="text-yellow-500"/>}
                                                    {item.name}
                                                </TableCell>
                                                <TableCell>
                                                    <Input 
                                                        type="number" 
                                                        value={item.quantity}
                                                        onChange={(e) => handleItemUpdate(item.id, 'quantity', e.target.valueAsNumber || 0)}
                                                        className="w-20"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Combobox 
                                                        options={equipmentOptions}
                                                        value={item.mappedTo}
                                                        onValueChange={value => handleItemUpdate(item.id, 'mappedTo', value)}
                                                        placeholder="Map to item..."
                                                        searchPlaceholder="Search inventory..."
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow><TableCell colSpan={3} className="text-center h-24 text-muted-foreground">Upload and parse an invoice to see results.</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button onClick={handleAddToInventory} disabled={parsedItems.length === 0 || isSubmitting}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                            Add to Inventory
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        </div>
    )
}
