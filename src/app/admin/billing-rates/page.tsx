
"use client";

import React, { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import BillingRatesClientPage from "./client-page";
import type { BillingRate } from "@/lib/types";
import { Loader2 } from "lucide-react";

export default function BillingRatesPage() {
  const [initialRates, setInitialRates] = useState<BillingRate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "billingRates"), (snapshot) => {
      const ratesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        rate: Number(doc.data().rate) || 0
      } as BillingRate));
      setInitialRates(ratesData);
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

  return <BillingRatesClientPage initialRates={initialRates} />;
}
