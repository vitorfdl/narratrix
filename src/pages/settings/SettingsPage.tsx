import { getVersion } from "@tauri-apps/api/app";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LuSave } from "react-icons/lu";
import { toast } from "sonner";
import { useCurrentProfile, useProfileActions } from "@/hooks/ProfileStore";
import { useThemeStore } from "@/hooks/ThemeContext";
import { defaultSettings } from "@/schema/default-settings";
import { AppSettings } from "@/schema/profiles-schema";
import { updateProfileSettings } from "@/services/profile-service";
import { AppearanceSection } from "./components/AppearanceSection";
import { GeneralSection } from "./components/GeneralSection";
import { ProfileSection } from "./components/ProfileSection";
import { SystemSection } from "./components/SystemSection";
import "./styles/settings.css";

export default function Settings() {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const { setTheme, setFontSize } = useThemeStore();
  const [appVersion, setAppVersion] = useState<string>("Loading...");

  const currentProfile = useCurrentProfile();
  const { fetchProfiles: refreshProfiles, setCurrentProfile } = useProfileActions();

  const [isSaving, setIsSaving] = useState(false);

  // Create a debounce timer ref
  const saveTimeoutRef = useRef<number | null>(null);

  // Debounced save function
  const debouncedSave = useCallback(
    async (settingsToSave: AppSettings) => {
      if (!currentProfile) {
        return;
      }

      try {
        setIsSaving(true);
        const updatedProfile = await updateProfileSettings(currentProfile.id, settingsToSave);
        console.log("Updated profile", updatedProfile);
        // Update the current profile in context directly with the updated profile
        setCurrentProfile(updatedProfile);
        await refreshProfiles();
      } catch (error) {
        console.error("Failed to save settings:", error);
        toast.error("Failed to save settings");
      } finally {
        setIsSaving(false);
      }
    },
    [currentProfile, refreshProfiles, setCurrentProfile],
  );

  // Load settings from profile on mount
  useEffect(() => {
    if (currentProfile?.settings) {
      setSettings(currentProfile.settings);
      // Also sync the theme to ThemeStore
      setTheme(currentProfile.settings.appearance.theme);
    } else {
      setSettings(defaultSettings);
    }
  }, [currentProfile, setTheme]);

  // Get app version on component mount
  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const version = await getVersion();
        setAppVersion(version);
      } catch (error) {
        console.error("Failed to get app version:", error);
        setAppVersion("Unknown");
      }
    };

    fetchVersion();
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const handleSettingChange = useCallback(
    (section: keyof AppSettings, key: string, value: any) => {
      const updatedSettings = {
        ...settings,
        [section]: {
          ...settings[section],
          [key]: value,
        },
      };

      setSettings(updatedSettings);

      // Sync theme changes with ThemeStore immediately for preview
      if (section === "appearance" && key === "theme") {
        setTheme(value);
      }
      // Sync fontSize changes with ThemeStore immediately for preview
      if (section === "appearance" && key === "fontSize") {
        setFontSize(value);
      }

      // Clear any existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Set a new timeout for debounced save (800ms)
      saveTimeoutRef.current = setTimeout(() => {
        debouncedSave(updatedSettings);
      }, 800) as unknown as number;
    },
    [settings, setTheme, setFontSize, debouncedSave],
  );

  // const selectDirectory = useCallback(async () => {
  //   try {
  //     const selected = await open({
  //       directory: true,
  //       multiple: false,
  //       title: "Select Expression Pack Directory",
  //     });
  //     if (selected && typeof selected === "string") {
  //       handleSettingChange("system", "expressionPackDirectory", selected);
  //     }
  //   } catch (error) {
  //     console.error("Failed to select directory:", error);
  //     toast.error("Failed to select directory");
  //   }
  // }, [handleSettingChange]);

  // Memoize footer component to prevent unnecessary re-renders
  const FooterSection = useMemo(
    () => (
      <div className="mt-auto pt-6 pb-5 border-t border-border flex flex-col items-center justify-center text-center">
        <img
          src="/favicon.svg"
          alt="Narratrix Logo"
          className="w-10 h-10 mb-2"
          onError={(e) => {
            e.currentTarget.src = "/favicon.ico";
            e.currentTarget.onerror = null;
          }}
        />
        <div>
          <h3 className="text-sm font-medium">Narratrix</h3>
          <p className="text-xs text-muted-foreground">Version {appVersion}</p>
        </div>
      </div>
    ),
    [appVersion, currentProfile],
  );

  return (
    <div className="flex flex-col h-full text-foreground relative">
      <div className="w-full page-container">
        <div className="flex items-center justify-between mb-6">
          <h1 className="title">Settings</h1>
          {isSaving && (
            <div className="text-sm text-muted-foreground animate-pulse flex items-center gap-2">
              <LuSave className="w-4 h-4" />
              Saving...
            </div>
          )}
        </div>

        <div className="space-y-8">
          {currentProfile && <ProfileSection currentProfile={currentProfile} refreshProfiles={refreshProfiles} />}

          <GeneralSection settings={settings} onSettingChange={handleSettingChange} />

          {/* <div className="space-y-3">
            <h2 className="text-lg font-medium">Integrations</h2>
            <Card>
              <CardContent className="p-4">
                <Collapsible className="w-full">
                  <CollapsibleTrigger className="flex items-center justify-between w-full py-2">
                    <div className="flex items-center space-x-2">
                      <UserCircle className="w-4 h-4" />
                      <Label>Accounts</Label>
                    </div>
                    <div className="bg-destructive text-destructive-foreground text-xs px-2 py-1 rounded">Move to page Settings {">>"} Accounts</div>
                  </CollapsibleTrigger>
                </Collapsible>
              </CardContent>
            </Card>
          </div> */}

          <AppearanceSection settings={settings} onSettingChange={handleSettingChange} />

          <SystemSection settings={settings} onSettingChange={handleSettingChange} />
        </div>

        {FooterSection}
      </div>
    </div>
  );
}
