
"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/lib/firebase";

import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import Logo from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  LogOut,
  Users,
  Briefcase,
  Shield,
  DollarSign,
  ClipboardList,
  Database,
  BarChart,
  History,
  FileLock2,
  Truck,
  Package,
  Settings,
  FileText,
  Archive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import Footer from "@/components/footer";
import NotificationBell from "@/components/notification-bell";

const navItems = [
    { href: "/admin/employees", icon: Users, label: "Employees" },
    { href: "/admin/jobs", icon: Briefcase, label: "Jobs" },
    { href: "/admin/equipment", icon: Package, label: "Inventory" },
    { href: "/admin/material-orders", icon: Truck, label: "Material Orders" },
    { href: "/admin/roles", icon: Shield, label: "Roles & Permissions" },
    { href: "/admin/billing-rates", icon: DollarSign, label: "Billing Rates" },
    { href: "/admin/job-types", icon: ClipboardList, label: "Job Types" },
    { href: "/admin/reporting", icon: BarChart, label: "Reporting" },
    { href: "/admin/historical-reports", icon: History, label: "Historical Reports" },
    { href: "/submissions", icon: FileText, label: "Submissions Inbox", adminOnly: true},
    { href: "/admin/storage", icon: Archive, label: "Storage" },
    { href: "/admin/audit-log", icon: FileLock2, label: "Audit Log", superAdminOnly: true },
    { href: "/admin/seed", icon: Database, label: "Data Management", superAdminOnly: true },
    { href: "/admin/settings", icon: Settings, label: "System Settings", superAdminOnly: true },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const pathname = usePathname();
  const [user, loading, error] = useAuthState(auth);
  const [userName, setUserName] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    if (loading) return; // Wait until user auth state is loaded

    if (!user) {
      router.push("/login");
      return;
    }

    const storedName = localStorage.getItem("userName");
    const storedRole = localStorage.getItem("userRole");

    const authorizedRoles = ["Super Admin", "Admin", "Warehouse", "Billing Team"];
    if (authorizedRoles.includes(storedRole || '')) {
        setUserName(storedName);
        setUserRole(storedRole);
        setIsAuthorized(true);
    } else {
        toast({ variant: 'destructive', title: "Unauthorized", description: "You do not have permission to access this page." });
        router.push("/login");
    }
    
  }, [user, loading, router, toast]);

  const handleLogout = async () => {
    await auth.signOut();
    localStorage.removeItem("userName");
    localStorage.removeItem("userRole");
    router.push("/login");
  };

  if (loading || !isAuthorized) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  const isSuperAdmin = userRole === 'Super Admin';
  const isAdmin = userRole === 'Admin';
  const isWarehouse = userRole === 'Warehouse';
  const isBilling = userRole === 'Billing Team';

  const canView = (item: typeof navItems[number]) => {
      if (isSuperAdmin) return true; // Super Admin sees everything
      if (item.superAdminOnly) return false; // Only Super Admin can see this

      if (isWarehouse) {
          return ['/admin/material-orders', '/admin/equipment', '/admin/storage'].includes(item.href);
      }
      if (isBilling) {
          return ['/submissions', '/admin/reporting', '/admin/historical-reports'].includes(item.href);
      }
      if (isAdmin) { // Regular Admin
          return !item.superAdminOnly;
      }
      return false;
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="relative h-screen bg-background text-foreground overflow-y-auto flex flex-col">
        <header className="flex items-center justify-between p-4 border-b shrink-0 h-16 z-20 bg-background/50 backdrop-blur-sm fixed top-0 left-0 right-0">
          <div className="flex items-center gap-4">
            <SidebarTrigger className="lg:hidden" />
             <div className="hidden lg:block w-[250px] animate-fade-in">
              <Logo />
            </div>
          </div>
          <div className="flex items-center gap-4 animate-fade-in">
             <NotificationBell />
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

        <div className="flex flex-1 pt-16">
           <Sidebar>
            <SidebarContent>
              <SidebarMenu>
                {navItems.map((item) => 
                  canView(item) && (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        href={item.href}
                        isActive={pathname.startsWith(item.href)}
                        tooltip={item.label}
                      >
                        <item.icon />
                        {item.label}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                )}
              </SidebarMenu>
            </SidebarContent>
          </Sidebar>
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 lg:pt-8 transition-all duration-200 ease-in-out lg:ml-[calc(var(--sidebar-width)_+_4vw)] animate-fade-in">
            {children}
          </main>
        </div>
        <Footer />
      </div>
    </SidebarProvider>
  );
}
