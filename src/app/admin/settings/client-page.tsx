
"use client";

import React, { useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getFunctions, httpsCallable } from "firebase/functions";
import { useToast } from "@/hooks/use-toast";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader2, Mail, MessageSquare, Sun, Eye, EyeOff, CheckCircle, XCircle } from "lucide-react";
import type { SystemSettings } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


type SettingsState = {
    whatsApp: Partial<SystemSettings['whatsApp']>;
    smtp: Partial<SystemSettings['smtp']>;
    weather: Partial<SystemSettings['weather']>;
}

type TestStatus = 'idle' | 'loading' | 'success' | 'error';

export default function SettingsClientPage({ initialSettings }: { initialSettings: SystemSettings | null }) {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    
    // Visibility states
    const [showTwilioToken, setShowTwilioToken] = useState(false);
    const [showSmtpPassword, setShowSmtpPassword] = useState(false);
    const [showWeatherKey, setShowWeatherKey] = useState(false);
    
    // Test states
    const [smtpTestStatus, setSmtpTestStatus] = useState<TestStatus>('idle');
    const [smtpTestMessage, setSmtpTestMessage] = useState('');


    const [settings, setSettings] = useState<SettingsState>({
        whatsApp: initialSettings?.whatsApp || { enabled: false, twilioAccountSid: '', twilioAuthToken: '', twilioWaNumber: '' },
        smtp: initialSettings?.smtp || { enabled: false, host: '', port: 587, secure: true, username: '', password: '', fromName: 'Crossroads Timesheet', fromEmail: '' },
        weather: initialSettings?.weather || { apiKey: '' }
    });

    const handleChange = (category: keyof SettingsState, field: string, value: string | boolean | number) => {
        setSmtpTestStatus('idle'); // Reset test status on change
        setSettings(prev => ({
            ...prev,
            [category]: {
                ...prev[category],
                [field]: value
            }
        }));
    };

    const handleSave = async () => {
        setIsLoading(true);
        try {
            const docRef = doc(db, "systemSettings", "integrations");
            await setDoc(docRef, settings, { merge: true });
            toast({ title: "Settings Saved", description: "Your system settings have been updated successfully." });
        } catch (error) {
            console.error("Error saving settings:", error);
            toast({ variant: 'destructive', title: "Save Failed", description: "Could not save system settings." });
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleTestSmtp = async () => {
        setSmtpTestStatus('loading');
        setSmtpTestMessage('');

        const functions = getFunctions();
        const testSmtp = httpsCallable(functions, 'testSmtp');

        try {
            const result: any = await testSmtp(settings.smtp);
            if(result.data.success) {
                setSmtpTestStatus('success');
                setSmtpTestMessage(result.data.message);
            } else {
                 setSmtpTestStatus('error');
                 setSmtpTestMessage(result.data.error || 'An unknown error occurred.');
            }
        } catch (error: any) {
            console.error("SMTP Test Error:", error);
            setSmtpTestStatus('error');
            setSmtpTestMessage(error.message || "Failed to connect. Check function logs.");
        }
    };


    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">System Settings</h1>
                <p className="text-muted-foreground">
                    Manage global system settings and third-party integrations.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><MessageSquare /> WhatsApp Integration (Twilio)</CardTitle>
                    <CardDescription>
                        Enable or disable WhatsApp notifications and configure your Twilio credentials.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center space-x-4 rounded-md border p-4">
                        <div className="flex-1 space-y-1">
                            <p className="text-sm font-medium leading-none">Enable WhatsApp Notifications</p>
                            <p className="text-sm text-muted-foreground">
                                When enabled, the system will attempt to send notifications via WhatsApp.
                            </p>
                        </div>
                        <Switch
                            checked={settings.whatsApp.enabled}
                            onCheckedChange={(checked) => handleChange('whatsApp', 'enabled', checked)}
                        />
                    </div>
                    
                    <div className="space-y-2">
                        <Label htmlFor="twilioAccountSid">Twilio Account SID</Label>
                        <Input
                            id="twilioAccountSid"
                            value={settings.whatsApp.twilioAccountSid}
                            onChange={(e) => handleChange('whatsApp', 'twilioAccountSid', e.target.value)}
                            placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                            disabled={!settings.whatsApp.enabled}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="twilioAuthToken">Twilio Auth Token</Label>
                        <div className="relative">
                            <Input
                                id="twilioAuthToken"
                                type={showTwilioToken ? "text" : "password"}
                                value={settings.whatsApp.twilioAuthToken}
                                onChange={(e) => handleChange('whatsApp', 'twilioAuthToken', e.target.value)}
                                placeholder="••••••••••••••••••••••••••••••••"
                                disabled={!settings.whatsApp.enabled}
                                className="pr-10"
                            />
                            <Button type="button" variant="ghost" size="icon" className="absolute inset-y-0 right-0" onClick={() => setShowTwilioToken(p => !p)}>
                                {showTwilioToken ? <EyeOff /> : <Eye />}
                            </Button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="twilioWaNumber">Twilio WhatsApp Number</Label>
                        <Input
                            id="twilioWaNumber"
                            value={settings.whatsApp.twilioWaNumber}
                            onChange={(e) => handleChange('whatsApp', 'twilioWaNumber', e.target.value)}
                            placeholder="whatsapp:+14155238886"
                            disabled={!settings.whatsApp.enabled}
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                 <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Mail /> Email Integration (SMTP)</CardTitle>
                    <CardDescription>
                        Enable or disable Email notifications and configure your SMTP credentials.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                     <div className="flex items-center space-x-4 rounded-md border p-4">
                        <div className="flex-1 space-y-1">
                            <p className="text-sm font-medium leading-none">Enable Email Notifications</p>
                            <p className="text-sm text-muted-foreground">
                                When enabled, the system will attempt to send notifications via SMTP.
                            </p>
                        </div>
                        <Switch
                            checked={settings.smtp.enabled}
                            onCheckedChange={(checked) => handleChange('smtp', 'enabled', checked)}
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="smtpHost">SMTP Host</Label>
                            <Input id="smtpHost" value={settings.smtp.host} onChange={(e) => handleChange('smtp', 'host', e.target.value)} disabled={!settings.smtp.enabled} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="smtpPort">SMTP Port</Label>
                            <Input id="smtpPort" type="number" value={settings.smtp.port} onChange={(e) => handleChange('smtp', 'port', e.target.valueAsNumber)} disabled={!settings.smtp.enabled} />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="smtpUser">Username</Label>
                            <Input id="smtpUser" value={settings.smtp.username} onChange={(e) => handleChange('smtp', 'username', e.target.value)} disabled={!settings.smtp.enabled} />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="smtpPass">Password</Label>
                             <div className="relative">
                                <Input
                                    id="smtpPass"
                                    type={showSmtpPassword ? "text" : "password"}
                                    value={settings.smtp.password}
                                    onChange={(e) => handleChange('smtp', 'password', e.target.value)}
                                    placeholder="••••••••••••••••"
                                    disabled={!settings.smtp.enabled}
                                    className="pr-10"
                                />
                                <Button type="button" variant="ghost" size="icon" className="absolute inset-y-0 right-0" onClick={() => setShowSmtpPassword(p => !p)}>
                                    {showSmtpPassword ? <EyeOff /> : <Eye />}
                                </Button>
                            </div>
                        </div>
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="fromName">From Name</Label>
                            <Input id="fromName" value={settings.smtp.fromName} onChange={(e) => handleChange('smtp', 'fromName', e.target.value)} disabled={!settings.smtp.enabled} />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="fromEmail">From Email</Label>
                            <Input id="fromEmail" type="email" value={settings.smtp.fromEmail} onChange={(e) => handleChange('smtp', 'fromEmail', e.target.value)} disabled={!settings.smtp.enabled} />
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Switch id="smtpSecure" checked={settings.smtp.secure} onCheckedChange={(checked) => handleChange('smtp', 'secure', checked)} disabled={!settings.smtp.enabled} />
                        <Label htmlFor="smtpSecure">Use Secure Connection (SSL/TLS)</Label>
                    </div>
                    
                    <div className="border-t pt-4 space-y-4">
                        <Button type="button" variant="outline" onClick={handleTestSmtp} disabled={smtpTestStatus === 'loading' || !settings.smtp.enabled}>
                            {smtpTestStatus === 'loading' && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Test Connection
                        </Button>

                        {smtpTestStatus === 'success' && (
                            <Alert variant="default" className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                <AlertTitle className="text-green-800 dark:text-green-300">Success</AlertTitle>
                                <AlertDescription className="text-green-700 dark:text-green-400">
                                    {smtpTestMessage}
                                </AlertDescription>
                            </Alert>
                        )}
                        {smtpTestStatus === 'error' && (
                            <Alert variant="destructive">
                                <XCircle className="h-4 w-4" />
                                <AlertTitle>Connection Failed</AlertTitle>
                                <AlertDescription>
                                    {smtpTestMessage}
                                </AlertDescription>
                            </Alert>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card>
                 <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Sun /> Weather API Integration</CardTitle>
                    <CardDescription>
                        Configure your API key from weatherapi.com for automatic weather lookups.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="weatherApiKey">Weather API Key</Label>
                         <div className="relative">
                            <Input
                                id="weatherApiKey"
                                type={showWeatherKey ? "text" : "password"}
                                value={settings.weather?.apiKey}
                                onChange={(e) => handleChange('weather', 'apiKey', e.target.value)}
                                placeholder="••••••••••••••••••••••••••••"
                                className="pr-10"
                            />
                            <Button type="button" variant="ghost" size="icon" className="absolute inset-y-0 right-0" onClick={() => setShowWeatherKey(p => !p)}>
                                {showWeatherKey ? <EyeOff /> : <Eye />}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-start">
                <Button onClick={handleSave} disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save All Settings
                </Button>
            </div>
        </div>
    );
}
