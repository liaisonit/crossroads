
"use client";

import React, { useState, useEffect } from 'react';
import { getStorage, ref, listAll, getDownloadURL, getMetadata, deleteObject } from "firebase/storage";
import { storage } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Loader2, Trash2, HardDrive, Download, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import Image from 'next/image';
import { format } from 'date-fns';

type StorageFile = {
  name: string;
  path: string;
  url: string;
  size: number;
  type: string;
  createdAt: string;
};

export default function StoragePage() {
  const { toast } = useToast();
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchFiles = async () => {
    setIsLoading(true);
    try {
      const storageRef = ref(storage);
      const res = await listAll(storageRef);
      
      const allFiles: StorageFile[] = [];
      
      const processItems = async (items: any[]) => {
        for (const itemRef of items) {
          try {
            const url = await getDownloadURL(itemRef);
            const metadata = await getMetadata(itemRef);
            allFiles.push({
              name: metadata.name,
              path: metadata.fullPath,
              url: url,
              size: metadata.size,
              type: metadata.contentType || 'unknown',
              createdAt: metadata.timeCreated
            });
          } catch(e) {
            console.warn("Could not fetch metadata for item:", itemRef.fullPath, e);
          }
        }
      }

      await Promise.all(res.prefixes.map(async (folderRef) => {
        const folderItems = await listAll(folderRef);
        await processItems(folderItems.items);
      }));

      await processItems(res.items);

      allFiles.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setFiles(allFiles);

    } catch (error) {
      console.error("Error fetching files:", error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not fetch files from storage.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, [toast]);
  
  const handleDelete = async (filePath: string) => {
    try {
        const fileRef = ref(storage, filePath);
        await deleteObject(fileRef);
        toast({ title: "File Deleted", description: `${filePath} has been permanently deleted.` });
        fetchFiles(); // Refresh the list
    } catch(error) {
        console.error("Error deleting file:", error);
        toast({ variant: 'destructive', title: "Deletion Failed", description: "Could not delete the file." });
    }
  }
  
  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Storage Explorer</h1>
        <p className="text-muted-foreground">
          Browse and manage all user-uploaded files.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><HardDrive /> Uploaded Files</CardTitle>
          <CardDescription>
            This list shows all files currently stored in your Firebase Storage bucket.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Preview</TableHead>
                  <TableHead>File Path</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[100px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-48 text-center">
                      <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                    </TableCell>
                  </TableRow>
                ) : files.length > 0 ? (
                  files.map((file) => (
                    <TableRow key={file.path}>
                      <TableCell>
                        {file.type.startsWith('image/') ? (
                          <Image src={file.url} alt={file.name} width={64} height={64} className="rounded-md object-cover h-16 w-16"/>
                        ) : (
                          <div className="h-16 w-16 bg-secondary rounded-md flex items-center justify-center text-muted-foreground">
                            <span>.{file.type.split('/')[1]}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs max-w-xs truncate">
                        <a href={file.url} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
                          {file.path} <ExternalLink className="h-3 w-3"/>
                        </a>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatBytes(file.size)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{format(new Date(file.createdAt), 'PPpp')}</TableCell>
                      <TableCell className="text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete the file <span className="font-mono bg-secondary p-1 rounded-sm">{file.name}</span>. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(file.path)} className="bg-destructive hover:bg-destructive/90">
                                Delete File
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      No files found in storage.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
