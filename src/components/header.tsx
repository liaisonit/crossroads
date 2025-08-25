
"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/lib/firebase";
import Logo from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { ArrowLeft, LogOut } from "lucide-react";

export default function Header() {
  const router = useRouter();
  const [user, loading] = useAuthState(auth);
  const [userName, setUserName] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    const storedName = localStorage.getItem("userName");
    const storedRole = localStorage.getItem("userRole");
    setUserName(storedName);
    setUserRole(storedRole);
  }, [user, loading, router]);

  const handleLogout = async () => {
    await auth.signOut();
    localStorage.removeItem("userName");
    localStorage.removeItem("userRole");
    router.push("/login");
  };

  const getDashboardPath = () => {
    if (userRole === "Admin" || userRole === "Super Admin") {
      return "/admin";
    }
    return "/dashboard";
  };

  return (
    <header className="flex items-center justify-between p-4 border-b shrink-0 h-16 sticky top-0 bg-background/80 backdrop-blur-sm z-10">
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="icon" className="lift-button">
          <Link href={getDashboardPath()}>
            <ArrowLeft />
          </Link>
        </Button>
        <Logo />
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right hidden sm:block">
          <p className="font-semibold text-sm">{userName}</p>
          <p className="text-xs text-muted-foreground">{userRole}</p>
        </div>
        <ThemeToggle />
        <Button
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          className="lift-button"
        >
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}
