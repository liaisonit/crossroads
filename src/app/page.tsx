
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebase';
import { Loader2 } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const [user, loading] = useAuthState(auth);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace('/login');
      return;
    }
    
    // Redirect based on role after checking auth
    const userRole = localStorage.getItem("userRole");
    if (userRole === 'Super Admin' || userRole === 'Admin') {
      router.replace('/admin');
    } else if (userRole === 'Foreman') {
        router.replace('/dashboard');
    } else if (userRole === 'Billing Team') {
        router.replace('/submissions');
    } else {
      // Default redirect for other roles or if role is not set
      router.replace('/login');
    }

  }, [user, loading, router]);

  return (
    <div className="flex items-center justify-center h-screen bg-background">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-primary"></div>
    </div>
  );
}
