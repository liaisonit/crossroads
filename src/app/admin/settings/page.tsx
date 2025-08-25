
"use client";

import React, { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import SettingsClientPage from "./client-page";
import type { SystemSettings } from "@/lib/types";
import { Loader2 } from "lucide-react";

export default function SettingsPage() {
  const [initialSettings, setInitialSettings] = useState<SystemSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const docRef = doc(db, "systemSettings", "integrations");
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setInitialSettings({ id: docSnap.id, ...docSnap.data() } as SystemSettings);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return <SettingsClientPage initialSettings={initialSettings} />;
}
