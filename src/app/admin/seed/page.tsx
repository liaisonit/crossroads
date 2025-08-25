"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { seedDatabase, wipeCollections, backupDatabase, restoreDatabase } from "./actions";
import { collectionsToSeed } from "@/lib/seed-data";
import { Loader2, Download, Upload } from "lucide-react";


export default function SeedPage() {
  const { toast } = useToast();
  const [isSeeding, setIsSeeding] = React.useState(false);
  const [isWiping, setIsWiping] = React.useState(false);
  const [isBackingUp, setIsBackingUp] = React.useState(false);
  const [isRestoring, setIsRestoring] = React.useState(false);
  const [results, setResults] = React.useState<any[]>([]);
  const [collectionsToWipe, setCollectionsToWipe] = React.useState<string[]>([]);
  const [restoreFile, setRestoreFile] = React.useState<File | null>(null);

  const allCollectionNames = collectionsToSeed.map(c => c.name);

  const handleSeed = async () => {
    setIsSeeding(true);
    setResults([]);
    try {
      const res = await seedDatabase();
      setResults(res);
      toast({
        title: "Database Seeding Complete",
        description: "Your Firestore database has been populated with the initial data.",
      });
    } catch (error) {
      console.error("Seeding failed:", error);
      toast({
        variant: "destructive",
        title: "Seeding Failed",
        description: "Could not seed the database. Check the console for more details.",
      });
    } finally {
      setIsSeeding(false);
    }
  };

  const handleWipe = async () => {
    setIsWiping(true);
    setResults([]);
    try {
      const res = await wipeCollections(collectionsToWipe);
      setResults(res);
      toast({
        title: "Database Wipe Complete",
        description: `${collectionsToWipe.join(", ")} have been cleared.`,
      });
    } catch (error) {
      console.error("Wiping failed:", error);
      toast({
        variant: "destructive",
        title: "Wipe Failed",
        description: "Could not wipe collections. Check the console for details.",
      });
    } finally {
      setIsWiping(false);
      setCollectionsToWipe([]);
    }
  }

  const handleBackup = async () => {
    setIsBackingUp(true);
    setResults([]);
    try {
        const backupData = await backupDatabase();
        const jsonString = JSON.stringify(backupData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const date = new Date().toISOString().split('T')[0];
        link.download = `crossroads-backup-${date}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast({ title: "Backup Successful", description: "Database backup has been downloaded." });
    } catch (error) {
        console.error("Backup failed:", error);
        toast({ variant: "destructive", title: "Backup Failed", description: "Could not create database backup." });
    } finally {
        setIsBackingUp(false);
    }
  }
  
  const handleRestore = async () => {
    if (!restoreFile) {
        toast({ variant: "destructive", title: "No File", description: "Please select a backup file to restore." });
        return;
    }
    setIsRestoring(true);
    setResults([]);
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        const content = e.target?.result as string;
        try {
            const res = await restoreDatabase(content);
            setResults(res);
            toast({ title: "Restore Successful", description: "Database has been restored from backup." });
        } catch (error) {
            console.error("Restore failed:", error);
            toast({ variant: "destructive", title: "Restore Failed", description: "Could not restore from backup file." });
        } finally {
            setIsRestoring(false);
            setRestoreFile(null);
        }
    };
    reader.readAsText(restoreFile);
  }

  const handleCheckboxChange = (collectionName: string) => {
    setCollectionsToWipe(prev =>
        prev.includes(collectionName)
        ? prev.filter(c => c !== collectionName)
        : [...prev, collectionName]
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Data Management</h1>
        <p className="text-muted-foreground">
          Backup, restore, seed, or wipe your Firestore database collections.
        </p>
      </div>

      <Card>
        <CardHeader>
            <CardTitle>Backup &amp; Restore</CardTitle>
            <CardDescription>Create a full backup of your database or restore it from a previously saved backup file. Restoring will first wipe all data.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
                <Button onClick={handleBackup} disabled={isBackingUp} className="w-full sm:w-auto">
                    {isBackingUp ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Creating...</> : <><Download className="mr-2 h-4 w-4"/>Create Backup</>}
                </Button>
            </div>
            <div className="space-y-2">
                <Label htmlFor="restoreFile">Restore from Backup File (.json)</Label>
                <div className="flex flex-col sm:flex-row gap-4">
                    <Input id="restoreFile" type="file" accept=".json" onChange={(e) => setRestoreFile(e.target.files?.[0] || null)} className="max-w-xs"/>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button disabled={isRestoring || !restoreFile} className="w-full sm:w-auto">
                                {isRestoring ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Restoring...</> : <><Upload className="mr-2 h-4 w-4"/>Restore Database</>}
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                This action is highly destructive. It will first WIPE all current data and then restore the database from the selected backup file. This cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleRestore}>Yes, Wipe and Restore</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Seed Firestore Collections (Default Data)</CardTitle>
          <CardDescription>
            <p>This will reset the database to the initial default state defined in the code. <span className="text-destructive font-bold">Warning: This is a destructive operation that will delete all current data.</span></p>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleSeed} disabled={isSeeding} className="w-full max-w-xs">
            {isSeeding ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Seeding...</> : "Seed Database"}
          </Button>
        </CardContent>
      </Card>
      
       <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Wipe Data Collections</CardTitle>
          <CardDescription>
            <p>Select specific collections to permanently delete all data from. <span className="text-destructive font-bold">Warning: This action cannot be undone.</span></p>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {allCollectionNames.map(name => (
                    <div key={name} className="flex items-center space-x-2">
                        <Checkbox
                            id={`wipe-${name}`}
                            onCheckedChange={() => handleCheckboxChange(name)}
                            checked={collectionsToWipe.includes(name)}
                        />
                        <Label htmlFor={`wipe-${name}`} className="capitalize">{name}</Label>
                    </div>
                ))}
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isWiping || collectionsToWipe.length === 0} className="w-full max-w-xs">
                    {isWiping ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Wiping...</> : `Wipe ${collectionsToWipe.length} Collection(s)`}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all documents in the following collections: <span className="font-bold text-destructive">{collectionsToWipe.join(", ")}</span>. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleWipe}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    Yes, Wipe Data
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
      
      {results.length > 0 && (
        <Card>
            <CardHeader>
                <CardTitle>Last Operation Results</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="mt-4 p-4 border rounded-lg bg-secondary/50">
                    <ul className="list-disc pl-5 space-y-1 text-sm">
                        {results.map((result, index) => (
                            <li key={index}>
                                <span className="font-medium">{result.collection}:</span>
                                {result.status === 'success' ?
                                    ` Successfully processed ${result.count} documents.` :
                                    <span className="text-destructive"> Error: {result.error}</span>
                                }
                            </li>
                        ))}
                    </ul>
                </div>
            </CardContent>
        </Card>
      )}
    </div>
  );
}
