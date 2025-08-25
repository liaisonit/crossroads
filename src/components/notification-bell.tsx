"use client";

import React, { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { collection, query, orderBy, onSnapshot, doc, writeBatch, limit } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Bell, BellRing, Check, Mail, X } from 'lucide-react';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Separator } from './ui/separator';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

type InboxNotification = {
    id: string;
    text: string;
    read: boolean;
    createdAt: { seconds: number; nanoseconds: number; };
    notificationId: string;
}

export default function NotificationBell() {
    const [user] = useAuthState(auth);
    const [notifications, setNotifications] = useState<InboxNotification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const isMobile = useIsMobile();

    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, `users/${user.uid}/inbox`),
            orderBy('createdAt', 'desc'),
            limit(50)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InboxNotification));
            setNotifications(notifs);
            setUnreadCount(notifs.filter(n => !n.read).length);
        });

        return () => unsubscribe();
    }, [user]);

    const handleMarkAllAsRead = async () => {
        if (!user || unreadCount === 0) return;

        const batch = writeBatch(db);
        const unreadNotifs = notifications.filter(n => !n.read);

        unreadNotifs.forEach(n => {
            const notifRef = doc(db, `users/${user.uid}/inbox`, n.id);
            batch.update(notifRef, { read: true });
        });

        await batch.commit();
    }
    
    const handleMarkAsRead = async (id: string) => {
        if (!user) return;
        const notifRef = doc(db, `users/${user.uid}/inbox`, id);
        await writeBatch(db).update(notifRef, { read: true }).commit();
    }

    const NotificationContent = () => (
        <div className="flex flex-col h-full">
            <SheetHeader className="p-4 border-b flex-shrink-0">
                 <div className="flex justify-between items-center">
                    <SheetTitle>Notifications</SheetTitle>
                    {unreadCount > 0 && (
                        <Button variant="link" size="sm" onClick={handleMarkAllAsRead}>Mark all as read</Button>
                    )}
                 </div>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto">
                {notifications.length === 0 ? (
                    <div className="text-center text-muted-foreground p-8">
                        <Mail className="mx-auto h-12 w-12" />
                        <p className="mt-4">You have no notifications yet.</p>
                    </div>
                ) : (
                    <div className="divide-y">
                        {notifications.map(n => (
                            <div key={n.id} className={cn("p-4 flex gap-4 items-start hover:bg-secondary/50", !n.read && "bg-primary/5")}>
                                <div className="mt-1">
                                    <div className={cn("h-2.5 w-2.5 rounded-full", n.read ? "bg-muted" : "bg-primary animate-pulse")}/>
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm">{n.text}</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {formatDistanceToNow(new Date(n.createdAt.seconds * 1000), { addSuffix: true })}
                                    </p>
                                </div>
                                {!n.read && (
                                     <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => handleMarkAsRead(n.id)}>
                                         <Check className="h-4 w-4"/>
                                     </Button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );

    const TriggerButton = (
        <Button variant="ghost" size="icon" className="relative lift-button">
            {unreadCount > 0 ? <BellRing className="h-5 w-5 text-primary" /> : <Bell className="h-5 w-5" />}
            {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-xs text-destructive-foreground">
                    {unreadCount}
                </span>
            )}
            <span className="sr-only">Toggle notifications</span>
        </Button>
    )

    if (isMobile) {
        return (
             <Sheet open={isOpen} onOpenChange={setIsOpen}>
                <SheetTrigger asChild>
                    {TriggerButton}
                </SheetTrigger>
                <SheetContent className="w-full max-w-sm p-0">
                    <NotificationContent />
                </SheetContent>
            </Sheet>
        )
    }

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                {TriggerButton}
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
                 <div className="max-h-[60vh] flex flex-col">
                    <NotificationContent />
                </div>
            </PopoverContent>
        </Popover>
    )

}
