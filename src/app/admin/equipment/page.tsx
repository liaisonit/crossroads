
"use client";

import React, { useState, useEffect } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import EquipmentClientPage from "./client-page";
import type { Equipment } from "@/lib/types";
import { Loader2 } from "lucide-react";

export default function EquipmentPage() {
  const [initialEquipment, setInitialEquipment] = useState<Equipment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "equipment"), orderBy("name"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const equipmentData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Equipment));
      setInitialEquipment(equipmentData);
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

  return <EquipmentClientPage initialEquipment={initialEquipment} />;
}
