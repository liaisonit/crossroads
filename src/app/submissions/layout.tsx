
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebase';
import Logo from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { LogOut, Loader2, LayoutDashboard, FileText, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import Footer from '@/components/footer';
import NotificationBell from '@/components/notification-bell';
import Link from 'next/link';

const getNavItems = (role: string | null) => {
    const items = [];
    if (role === 'Admin' || role === 'Super Admin') {
        items.push({ href: "/admin", icon: LayoutDashboard, label: "Admin Panel" });
    } else if (role === 'Foreman') {
        items.push({ href: "/dashboard", icon: LayoutDashboard, label: "My Dashboard" });
    }
    items.push({ href: "/submissions", icon: FileText, label: "Submissions" });
    return items;
}


export default function SubmissionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const [user, loading, error] = useAuthState(auth);
  const [userName, setUserName] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);

   useEffect(() => {
    if (loading) return; 

    if (!user) {
      router.push('/login');
      return;
    }

    const storedName = localStorage.getItem('userName');
    const storedRole = localStorage.getItem('userRole');
    
    setUserName(storedName);
    setUserRole(storedRole);
    
    // Admins, Billing, and Foremen can access this section.
    if (storedRole === 'Admin' || storedRole === 'Super Admin' || storedRole === 'Billing Team' || storedRole === 'Foreman') {
        setIsAuthorized(true);
    } else {
        toast({ variant: 'destructive', title: 'Unauthorized', description: 'You do not have permission to access this page.' });
        router.push('/login');
    }
  }, [user, loading, router, toast]);

  const handleLogout = async () => {
    await auth.signOut();
    localStorage.removeItem("userName");
    localStorage.removeItem("userRole");
    router.push("/login");
  };

  const getHomePath = () => {
    const role = localStorage.getItem('userRole');
    if (role === 'Foreman') return '/dashboard';
    if (role === 'Admin' || role === 'Super Admin') return '/admin';
    return '/submissions';
  }

  if (loading || !isAuthorized) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // Do not use the sidebar layout for the submission detail page
  if (pathname.startsWith('/submissions/')) {
      return <>{children}</>;
  }

  // Foreman sees the submission list as a full-page view without sidebar
  if (userRole === 'Foreman' && pathname === '/submissions') {
      return (
        <div className="flex flex-col min-h-screen bg-background text-foreground">
            <header className="flex items-center justify-between p-4 border-b shrink-0 h-16 z-20 bg-background/50 backdrop-blur-sm sticky top-0">
                <div className="flex items-center gap-4">
                    <Button asChild variant="outline">
                        <Link href="/dashboard">
                            <ArrowLeft className="mr-2" />
                            Back to Dashboard
                        </Link>
                    </Button>
                </div>
                <div className="flex items-center gap-4 animate-fade-in">
                    <NotificationBell />
                    <div className="text-right hidden sm:block">
                        <p className="font-semibold text-sm">{userName}</p>
                        <p className="text-xs text-muted-foreground">{userRole}</p>
                    </div>
                    <ThemeToggle />
                    <Button variant="ghost" size="icon" onClick={handleLogout} className="lift-button">
                        <LogOut className="h-5 w-5" />
                    </Button>
                </div>
            </header>
            <main className="flex-1 p-4 md:p-6 lg:p-8">
                {children}
            </main>
            <Footer />
        </div>
      )
  }
  
  const navItems = getNavItems(userRole);

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
            <Button variant="ghost" size="icon" onClick={handleLogout} className="lift-button">
                <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </header>

         <div className="flex flex-1 pt-16">
           <Sidebar>
            <SidebarContent>
              <SidebarMenu>
                {navItems.map((item) => (
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
                ))}
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
