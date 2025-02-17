import { useState } from "react";
import { ChevronDown, Lock } from "lucide-react";
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
        <div className="flex flex-col bg-[#1E1E1E] text-white p-6">
            <h1 className="text-2xl mb-6">Settings</h1>

            <div className="space-y-1">
                <h2 className="text-lg text-zinc-400">General</h2>
                
                <Collapsible className="w-full">
                    <CollapsibleTrigger className="flex items-center w-full p-3 hover:bg-zinc-800 rounded-lg">
                        <Lock className="w-4 h-4 mr-2" />
                        <span className="flex-1 text-left">Notifications</span>
                        <ChevronDown className="w-4 h-4" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="p-3">
                        {/* Notification settings content */}
                    </CollapsibleContent>
                </Collapsible>

                <Collapsible className="w-full">
                    <CollapsibleTrigger className="flex items-center w-full p-3 hover:bg-zinc-800 rounded-lg">
                        <Lock className="w-4 h-4 mr-2" />
                        <span className="flex-1 text-left">Chat / Messages</span>
                        <ChevronDown className="w-4 h-4" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="p-3">
                        {/* Chat settings content */}
                    </CollapsibleContent>
                </Collapsible>

                <Collapsible className="w-full">
                    <CollapsibleTrigger className="flex items-center w-full p-3 hover:bg-zinc-800 rounded-lg">
                        <Lock className="w-4 h-4 mr-2" />
                        <span className="flex-1 text-left">Censorship Settings</span>
                        <ChevronDown className="w-4 h-4" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="p-3">
                        {/* Censorship settings content */}
                    </CollapsibleContent>
                </Collapsible>
            </div>

            <div className="mt-6 space-y-1">
                <h2 className="text-lg text-zinc-400">Integrations</h2>
                
                <Collapsible className="w-full">
                    <CollapsibleTrigger className="flex items-center w-full p-3 hover:bg-zinc-800 rounded-lg group">
                        <Lock className="w-4 h-4 mr-2" />
                        <span className="flex-1 text-left">Accounts</span>
                        <div className="bg-[#9B1C1C] text-white text-xs px-2 py-1 rounded">
                            Move to page Settings {'>>'} Accounts
                        </div>
                    </CollapsibleTrigger>
                </Collapsible>
            </div>

            <div className="mt-6 space-y-1">
                <h2 className="text-lg text-zinc-400">Appearance</h2>
                
                <div className="flex items-center w-full p-3 hover:bg-zinc-800 rounded-lg">
                    <Lock className="w-4 h-4 mr-2" />
                    <span className="flex-1">Theme</span>
                    <Select
                        value={settings.appearance.theme}
                        onValueChange={(value) => handleSettingChange('appearance', 'theme', value)}
                    >
                        <SelectTrigger className="w-32 bg-zinc-800 border-none">
                            <SelectValue placeholder="Select theme" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="dark">Dark</SelectItem>
                            <SelectItem value="light">Light</SelectItem>
                            <SelectItem value="system">System</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex items-center w-full p-3 hover:bg-zinc-800 rounded-lg">
                    <Lock className="w-4 h-4 mr-2" />
                    <span className="flex-1">Language</span>
                    <Select
                        value={settings.general.language}
                        onValueChange={(value) => handleSettingChange('general', 'language', value)}
                    >
                        <SelectTrigger className="w-32 bg-zinc-800 border-none">
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
                <h2 className="text-lg text-zinc-400">System</h2>
                
                <Collapsible className="w-full">
                    <CollapsibleTrigger className="flex items-center w-full p-3 hover:bg-zinc-800 rounded-lg group">
                        <Lock className="w-4 h-4 mr-2" />
                        <span className="flex-1 text-left">Updates</span>
                        <div className="bg-[#9B1C1C] text-white text-xs px-2 py-1 rounded">
                            Move to page Settings {'>>'} Updates
                        </div>
                    </CollapsibleTrigger>
                </Collapsible>

                <div className="flex flex-col w-full p-3 hover:bg-zinc-800 rounded-lg space-y-2">
                    <div className="flex items-center">
                        <Lock className="w-4 h-4 mr-2" />
                        <span className="flex-1">Select new Expression Pack Directory</span>
                    </div>
                    <div className="flex items-center space-x-2">
                        <div className="flex-1 text-sm text-zinc-500">
                            Current Directory: {settings.system.expressionPackDirectory}
                        </div>
                        <Button variant="secondary" className="bg-zinc-800 hover:bg-zinc-700">
                            Select Directory
                        </Button>
                    </div>
                    <div className="text-sm text-zinc-500">
                        Doesn't move current data.
                    </div>
                </div>
            </div>

            <div className="mt-6 space-y-1">
                <h2 className="text-lg text-zinc-400">About</h2>
                <div className="flex flex-col items-center justify-center p-6 space-y-2">
                    <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center">
                        Logo
                    </div>
                    <div className="text-lg">Narratrix</div>
                    <div className="text-sm text-zinc-500">Version: 1.0.0</div>
                </div>
            </div>
        </div>
    );
}
