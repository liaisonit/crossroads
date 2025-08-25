
"use client";

import React, { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import EmployeesClientPage from "./client-page";
import type { Employee, Role } from "@/lib/types";
import { Loader2 } from "lucide-react";

export default function EmployeesPage() {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const unsubEmployees = onSnapshot(collection(db, "employees"), (snapshot) => {
            setEmployees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
        });

        const unsubRoles = onSnapshot(collection(db, "roles"), (snapshot) => {
            setRoles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Role)));
        });

        // A simple timeout to prevent flicker on fast connections
        setTimeout(() => setIsLoading(false), 300);

        return () => {
            unsubEmployees();
            unsubRoles();
        };
    }, []);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    return <EmployeesClientPage initialEmployees={employees} initialRoles={roles} />;
}
