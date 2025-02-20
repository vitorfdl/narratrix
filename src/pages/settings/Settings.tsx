import { useState } from "react";
import { 
    Bell, 
    ChevronDown, 
    MessageSquare, 
    EyeOff, 
    UserCircle, 
    Palette, 
    Languages, 
    Download, 
    Folder, 
    Info
} from "lucide-react";
import { AppSettings, mockSettings } from "../../types/settings";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import "./styles/settings.css";

export default function Settings() {
    const [settings, setSettings] = useState<AppSettings>(mockSettings);

    const handleSettingChange = (section: keyof AppSettings, key: string, value: any) => {
        setSettings(prev => ({
            ...prev,
            [section]: {
                ...prev[section],
                [key]: value
            }
        }));
    };

    return (
        <div className="flex flex-col h-full bg-background text-foreground p-6">
            <h1 className="text-2xl font-semibold mb-6">Settings</h1>

            <div className="space-y-1">
                <h2 className="text-lg text-muted-foreground">General</h2>
                
                <Collapsible className="w-full">
                    <CollapsibleTrigger className="settings-section">
                        <Bell className="w-4 h-4 mr-2" />
                        <span className="flex-1 text-left">Notifications</span>
                        <ChevronDown className="w-4 h-4" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="p-3">
                        {/* Notification settings content */}
                    </CollapsibleContent>
                </Collapsible>

                <Collapsible className="w-full">
                    <CollapsibleTrigger className="settings-section">
                        <MessageSquare className="w-4 h-4 mr-2" />
                        <span className="flex-1 text-left">Chat / Messages</span>
                        <ChevronDown className="w-4 h-4" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="p-3">
                        {/* Chat settings content */}
                    </CollapsibleContent>
                </Collapsible>

                <Collapsible className="w-full">
                    <CollapsibleTrigger className="settings-section">
                        <EyeOff className="w-4 h-4 mr-2" />
                        <span className="flex-1 text-left">Censorship Settings</span>
                        <ChevronDown className="w-4 h-4" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="p-3">
                        {/* Censorship settings content */}
                    </CollapsibleContent>
                </Collapsible>
            </div>

            <div className="mt-6 space-y-1">
                <h2 className="text-lg text-muted-foreground">Integrations</h2>
                
                <Collapsible className="w-full">
                    <CollapsibleTrigger className="settings-section group">
                        <UserCircle className="w-4 h-4 mr-2" />
                        <span className="flex-1 text-left">Accounts</span>
                        <div className="bg-destructive text-destructive-foreground text-xs px-2 py-1 rounded">
                            Move to page Settings {'>>'} Accounts
                        </div>
                    </CollapsibleTrigger>
                </Collapsible>
            </div>

            <div className="mt-6 space-y-1">
                <h2 className="text-lg text-muted-foreground">Appearance</h2>
                
                <div className="settings-section-option">
                    <Palette className="w-4 h-4 mr-2" />
                    <span className="flex-1">Theme</span>
                    <Select
                        value={settings.appearance.theme}
                        onValueChange={(value) => handleSettingChange('appearance', 'theme', value)}
                    >
                        <SelectTrigger className="w-32 bg-popover border-border">
                            <SelectValue placeholder="Select theme" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="dark">Dark</SelectItem>
                            <SelectItem value="light">Light</SelectItem>
                            <SelectItem value="system">System</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="settings-section-option">
                    <Languages className="w-4 h-4 mr-2" />
                    <span className="flex-1">Language</span>
                    <Select
                        value={settings.general.language}
                        onValueChange={(value) => handleSettingChange('general', 'language', value)}
                    >
                        <SelectTrigger className="w-32 bg-popover border-border">
                            <SelectValue placeholder="Select language" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="en">English</SelectItem>
                            <SelectItem value="es">Español</SelectItem>
                            <SelectItem value="fr">Français</SelectItem>
                            <SelectItem value="de">Deutsch</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="mt-6 space-y-1">
                <h2 className="text-lg text-muted-foreground">System</h2>
                
                <Collapsible className="w-full">
                    <CollapsibleTrigger className="settings-section group">
                        <Download className="w-4 h-4 mr-2" />
                        <span className="flex-1 text-left">Updates</span>
                        <div className="bg-destructive text-destructive-foreground text-xs px-2 py-1 rounded">
                            Move to page Settings {'>>'} Updates
                        </div>
                    </CollapsibleTrigger>
                </Collapsible>

                <div className="flex flex-col w-full p-3 bg-muted rounded-lg space-y-2">
                    <div className="flex items-center">
                        <Folder className="w-4 h-4 mr-2" />
                        <span className="flex-1">Select new Expression Pack Directory</span>
                    </div>
                    <div className="flex items-center space-x-2">
                        <div className="flex-1 text-sm text-muted-foreground">
                            Current Directory: {settings.system.expressionPackDirectory}
                        </div>
                        <Button variant="secondary" className="bg-secondary hover:bg-secondary/80">
                            Select Directory
                        </Button>
                    </div>
                    <div className="text-sm text-muted-foreground">
                        Doesn't move current data.
                    </div>
                </div>
            </div>

            <div className="mt-6 space-y-1">
                <div className="flex flex-col items-center justify-center p-6 space-y-2">
                    <div className="w-16 h-16 bg-card rounded-lg flex items-center justify-center">
                        Logo
                    </div>
                    <div className="text-lg">Narratrix</div>
                    <div className="text-sm text-muted-foreground">Version: 1.0.0</div>
                </div>
            </div>
        </div>
    );
}
