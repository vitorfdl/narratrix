import { AvatarCrop } from "@/components/shared/AvatarCrop";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useProfile } from "@/hooks/ProfileContext";
import { useTheme } from "@/hooks/ThemeContext";
import { defaultSettings } from "@/schema/default-settings";
import { AppSettings } from "@/schema/profiles-schema";
import { saveImage } from "@/services/file-system-service";
import { deleteProfile as deleteProfileService, updateProfile, updateProfilePassword, updateProfileSettings } from "@/services/profile-service";
import { getVersion } from "@tauri-apps/api/app";
import { ChevronDown, Download, KeyIcon, Languages, LogOut, MessageSquare, Palette, Save, Trash, User, UserCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import "./styles/settings.css";

// Extract sections into separate components for better organization
const ProfileSection = ({ currentProfile, refreshProfiles }: { currentProfile: any; refreshProfiles: () => Promise<void> }) => {
  const [newProfileName, setNewProfileName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingName, setIsChangingName] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [_isChangingAvatar, setIsChangingAvatar] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { logout, setCurrentProfile, currentProfileAvatarUrl, refreshAvatar } = useProfile();

  // State for controlling dialog visibility
  const [isNameDialogOpen, setIsNameDialogOpen] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [isAvatarDialogOpen, setIsAvatarDialogOpen] = useState(false);
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  useEffect(() => {
    if (currentProfile?.name) {
      setNewProfileName(currentProfile.name);
    }
  }, [currentProfile?.name]);

  const handleProfileNameChange = async () => {
    if (!currentProfile) {
      toast.error("No profile selected");
      return;
    }

    if (!newProfileName.trim()) {
      toast.error("Profile name cannot be empty");
      return;
    }

    try {
      setIsChangingName(true);
      const updatedProfile = await updateProfile(currentProfile.id, { name: newProfileName.trim() });
      setCurrentProfile(updatedProfile);
      await refreshProfiles();
      toast.success("Profile name updated successfully");
      setIsNameDialogOpen(false); // Close the dialog on success
    } catch (error) {
      console.error("Failed to update profile name:", error);
      toast.error("Failed to update profile name");
    } finally {
      setIsChangingName(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!currentProfile) {
      toast.error("No profile selected");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (newPassword.length < 3) {
      toast.error("Password must be at least 3 characters long");
      return;
    }

    try {
      setIsChangingPassword(true);
      let updatedProfile: any;
      if (currentProfile.hasPassword) {
        updatedProfile = await updateProfilePassword(currentProfile.id, currentPassword, newPassword);
      } else {
        updatedProfile = await updateProfilePassword(currentProfile.id, "", newPassword);
      }

      setCurrentProfile(updatedProfile);
      await refreshProfiles();
      toast.success("Password updated successfully");

      // Reset form
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      setIsPasswordDialogOpen(false); // Close the dialog on success
    } catch (error) {
      console.error("Failed to update password:", error);
      toast.error("Failed to update password. Please check your current password.");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleAvatarChange = async (croppedImage: string) => {
    if (!currentProfile) {
      toast.error("No profile selected");
      return;
    }

    try {
      setIsChangingAvatar(true);
      const avatarPath = await saveImage(croppedImage, currentProfile.id);
      const updatedProfile = await updateProfile(currentProfile.id, { avatar_path: avatarPath });
      setCurrentProfile(updatedProfile);
      await refreshProfiles();
      refreshAvatar();
      toast.success("Avatar updated successfully");
      setIsAvatarDialogOpen(false); // Close the dialog on success
    } catch (error) {
      console.error("Failed to update avatar:", error);
      toast.error("Failed to update avatar");
    } finally {
      setIsChangingAvatar(false);
    }
  };

  const handleLogout = () => {
    logout();
    setIsLogoutDialogOpen(false); // Ensure dialog closes
  };

  const deleteProfile = async () => {
    if (!currentProfile) {
      toast.error("No profile selected");
      return;
    }

    try {
      setIsDeleting(true);
      await deleteProfileService(currentProfile.id);
      toast.success("Profile deleted successfully");
      logout(); // Logout implicitly closes the dialog by navigating away
      // No need to explicitly set setIsDeleteDialogOpen(false) if logout always navigates
    } catch (error) {
      console.error("Failed to delete profile:", error);
      toast.error("Failed to delete profile.");
      setIsDeleteDialogOpen(false); // Close dialog on error
    } finally {
      setIsDeleting(false);
    }
  };

  const handleProfileNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !isChangingName && newProfileName.trim() && newProfileName !== currentProfile?.name) {
      handleProfileNameChange();
    }
  };

  const handlePasswordKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (!isChangingPassword && newPassword && newPassword === confirmPassword && (!currentProfile?.hasPassword || currentPassword)) {
        handlePasswordChange();
      }
    }
  };

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-medium">Profile</h2>
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <User className="w-4 h-4" />
              <Label>Profile: {currentProfile.name}</Label>
            </div>
            <Dialog open={isNameDialogOpen} onOpenChange={setIsNameDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">Change Profile Name</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Change Profile Name</DialogTitle>
                  <DialogDescription>Enter a new name for your profile.</DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <div className="space-y-2">
                    <Label htmlFor="profile-name">Profile Name</Label>
                    <Input
                      id="profile-name"
                      value={newProfileName}
                      onChange={(e) => setNewProfileName(e.target.value)}
                      placeholder="New profile name"
                      onKeyDown={handleProfileNameKeyDown}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="secondary">Cancel</Button>
                  </DialogClose>
                  <Button
                    onClick={handleProfileNameChange}
                    disabled={isChangingName || !newProfileName.trim() || newProfileName === currentProfile?.name}
                  >
                    {isChangingName ? "Saving..." : "Save"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <UserCircle className="w-4 h-4" />
              <Label>Avatar</Label>
              {currentProfile?.avatar_path && currentProfileAvatarUrl && (
                <div className="w-8 h-8 rounded-full overflow-hidden ml-2 border border-border">
                  <img src={currentProfileAvatarUrl} alt={`${currentProfile.name}'s avatar`} className="w-full h-full object-cover" />
                </div>
              )}
            </div>
            <Dialog open={isAvatarDialogOpen} onOpenChange={setIsAvatarDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">Change Avatar</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Change Avatar</DialogTitle>
                  <DialogDescription>Upload a new avatar for your profile.</DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <div className="space-y-2">
                    <div className="flex justify-center">
                      <div className="w-24 h-24 rounded-full overflow-hidden">
                        <AvatarCrop
                          onCropComplete={handleAvatarChange}
                          existingImage={currentProfileAvatarUrl || ""}
                          cropShape="round"
                          className="w-full h-full"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="secondary">Cancel</Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <KeyIcon className="w-4 h-4" />
              <Label>Password</Label>
            </div>
            <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">Change Password</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Change Password</DialogTitle>
                  <DialogDescription>
                    {currentProfile?.hasPassword ? "Enter your current password and a new password." : "Create a new password for your profile."}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  {currentProfile?.hasPassword && (
                    <div className="space-y-2">
                      <Label htmlFor="current-password">Current Password</Label>
                      <Input
                        id="current-password"
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Current password"
                        onKeyDown={handlePasswordKeyDown}
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="New password"
                      onKeyDown={handlePasswordKeyDown}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm Password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm password"
                      onKeyDown={handlePasswordKeyDown}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="secondary">Cancel</Button>
                  </DialogClose>
                  <Button
                    onClick={handlePasswordChange}
                    disabled={
                      isChangingPassword || !newPassword || newPassword !== confirmPassword || (currentProfile?.hasPassword && !currentPassword)
                    }
                  >
                    {isChangingPassword ? "Saving..." : "Save"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <LogOut className="w-4 h-4" />
              <Label>Log out from your profile</Label>
            </div>
            <Dialog open={isLogoutDialogOpen} onOpenChange={setIsLogoutDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="default" className="flex items-center gap-2">
                  <LogOut className="w-4 h-4" />
                  Logout
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Logout</DialogTitle>
                  <DialogDescription>Are you sure you want to log out from your profile? Any unsaved changes will be lost.</DialogDescription>
                </DialogHeader>
                <DialogFooter className="mt-4">
                  <DialogClose asChild>
                    <Button variant="secondary">Cancel</Button>
                  </DialogClose>
                  <Button variant="default" onClick={handleLogout} className="flex items-center gap-2">
                    <LogOut className="w-4 h-4" />
                    Logout
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Trash className="w-4 h-4" />
              <Label>Delete your profile</Label>
            </div>
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive" className="flex items-center gap-2">
                  <Trash className="w-4 h-4" />
                  Delete Profile
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Delete Profile</DialogTitle>
                  <DialogDescription>Are you sure you want to delete your profile? This action cannot be undone.</DialogDescription>
                </DialogHeader>
                <DialogFooter className="mt-4">
                  <DialogClose asChild>
                    <Button variant="secondary">Cancel</Button>
                  </DialogClose>
                  <Button variant="destructive" onClick={deleteProfile} className="flex items-center gap-2" disabled={isDeleting}>
                    {isDeleting ? (
                      <>
                        <Trash className="w-4 h-4 animate-spin" /> Deleting...
                      </>
                    ) : (
                      <>
                        <Trash className="w-4 h-4" /> Delete Profile
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default function Settings() {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const { setTheme } = useTheme();
  const [appVersion, setAppVersion] = useState<string>("Loading...");
  const { currentProfile, refreshProfiles, setCurrentProfile } = useProfile();
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
        toast.success("Settings saved");
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
      // Also sync the theme to ThemeContext
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

      // Sync theme changes with ThemeContext immediately for preview
      if (section === "appearance" && key === "theme") {
        setTheme(value);
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
    [settings, setTheme, debouncedSave],
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
              <Save className="w-4 h-4" />
              Saving...
            </div>
          )}
        </div>

        <div className="space-y-8">
          {currentProfile && <ProfileSection currentProfile={currentProfile} refreshProfiles={refreshProfiles} />}

          <div className="space-y-3">
            <h2 className="text-lg font-medium">General</h2>
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Languages className="w-4 h-4" />
                    <Label>Language</Label>
                  </div>
                  <Select value={settings.general.language} onValueChange={(value) => handleSettingChange("general", "language", value)}>
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      {/* <SelectItem value="es">Español</SelectItem>
                      <SelectItem value="fr">Français</SelectItem>
                      <SelectItem value="de">Deutsch</SelectItem> */}
                    </SelectContent>
                  </Select>
                </div>

                {/* <Separator />

                <Collapsible className="w-full">
                  <CollapsibleTrigger className="flex items-center justify-between w-full py-2">
                    <div className="flex items-center space-x-2">
                      <Bell className="w-4 h-4" />
                      <Label>Notifications</Label>
                    </div>
                    <ChevronDown className="w-4 h-4" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 pt-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="notifications-enabled"
                        checked={settings.notifications.enabled}
                        onCheckedChange={(checked) => handleSettingChange("notifications", "enabled", !!checked)}
                      />
                      <div className="space-y-1 leading-none">
                        <Label htmlFor="notifications-enabled">Enable notifications</Label>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="notifications-sound"
                        checked={settings.notifications.sound}
                        onCheckedChange={(checked) => handleSettingChange("notifications", "sound", !!checked)}
                        disabled={!settings.notifications.enabled}
                      />
                      <div className="space-y-1 leading-none">
                        <Label htmlFor="notifications-sound">Play sounds</Label>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="notifications-desktop"
                        checked={settings.notifications.desktop}
                        onCheckedChange={(checked) => handleSettingChange("notifications", "desktop", !!checked)}
                        disabled={!settings.notifications.enabled}
                      />
                      <div className="space-y-1 leading-none">
                        <Label htmlFor="notifications-desktop">Show desktop notifications</Label>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="notifications-chat"
                        checked={settings.notifications.chatNotifications}
                        onCheckedChange={(checked) => handleSettingChange("notifications", "chatNotifications", !!checked)}
                        disabled={!settings.notifications.enabled}
                      />
                      <div className="space-y-1 leading-none">
                        <Label htmlFor="notifications-chat">Chat notifications</Label>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="notifications-update"
                        checked={settings.notifications.updateNotifications}
                        onCheckedChange={(checked) => handleSettingChange("notifications", "updateNotifications", !!checked)}
                        disabled={!settings.notifications.enabled}
                      />
                      <div className="space-y-1 leading-none">
                        <Label htmlFor="notifications-update">Update notifications</Label>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible> */}

                <Separator />

                <Collapsible className="w-full">
                  <CollapsibleTrigger className="flex items-center justify-between w-full py-2">
                    <div className="flex items-center space-x-2">
                      <MessageSquare className="w-4 h-4" />
                      <Label>Chat / Messages</Label>
                    </div>
                    <ChevronDown className="w-4 h-4" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 pt-2">
                    {/* <div className="flex items-center justify-between">
                      <Label htmlFor="timestamp-format">Timestamp Format</Label>
                      <Select value={settings.chat.timestampFormat} onValueChange={(value) => handleSettingChange("chat", "timestampFormat", value)}>
                        <SelectTrigger className="w-36" id="timestamp-format">
                          <SelectValue placeholder="Format" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="12h">12h</SelectItem>
                          <SelectItem value="24h">24h</SelectItem>
                        </SelectContent>
                      </Select>
                    </div> */}

                    {/* <div className="flex items-center space-x-2">
                      <Checkbox
                        id="chat-avatars"
                        checked={settings.chat.showAvatars}
                        onCheckedChange={(checked) => handleSettingChange("chat", "showAvatars", !!checked)}
                      />
                      <div className="space-y-1 leading-none">
                        <Label htmlFor="chat-avatars">Show avatars</Label>
                      </div>
                    </div> */}

                    <div className="flex items-center justify-between">
                      <Label htmlFor="send-shortcut">Send Shortcut</Label>
                      <Select value={settings.chat.sendShortcut} onValueChange={(value) => handleSettingChange("chat", "sendShortcut", value)}>
                        <SelectTrigger className="w-36" id="send-shortcut">
                          <SelectValue placeholder="Shortcut" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Enter">Enter</SelectItem>
                          <SelectItem value="Ctrl+Enter">Ctrl+Enter</SelectItem>
                          <SelectItem value="Shift+Enter">Shift+Enter</SelectItem>
                          <SelectItem value="CMD+Enter">CMD+Enter</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* <Separator />

                <Collapsible className="w-full">
                  <CollapsibleTrigger className="flex items-center justify-between w-full py-2">
                    <div className="flex items-center space-x-2">
                      <EyeOff className="w-4 h-4" />
                      <Label>Censorship Settings</Label>
                    </div>
                    <ChevronDown className="w-4 h-4" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 pt-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="censorship-enabled"
                        checked={settings.censorship.enabled}
                        onCheckedChange={(checked) => handleSettingChange("censorship", "enabled", !!checked)}
                      />
                      <div className="space-y-1 leading-none">
                        <Label htmlFor="censorship-enabled">Enable censorship</Label>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="censorship-system"
                        checked={settings.censorship.applyToSystemPrompts}
                        onCheckedChange={(checked) => handleSettingChange("censorship", "applyToSystemPrompts", !!checked)}
                        disabled={!settings.censorship.enabled}
                      />
                      <div className="space-y-1 leading-none">
                        <Label htmlFor="censorship-system">Apply to system prompts</Label>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="censorship-user"
                        checked={settings.censorship.applyToUserMessages}
                        onCheckedChange={(checked) => handleSettingChange("censorship", "applyToUserMessages", !!checked)}
                        disabled={!settings.censorship.enabled}
                      />
                      <div className="space-y-1 leading-none">
                        <Label htmlFor="censorship-user">Apply to user messages</Label>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="censorship-assistant"
                        checked={settings.censorship.applyToAssistantMessages}
                        onCheckedChange={(checked) => handleSettingChange("censorship", "applyToAssistantMessages", !!checked)}
                        disabled={!settings.censorship.enabled}
                      />
                      <div className="space-y-1 leading-none">
                        <Label htmlFor="censorship-assistant">Apply to assistant messages</Label>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible> */}
              </CardContent>
            </Card>
          </div>

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

          <div className="space-y-3">
            <h2 className="text-lg font-medium">Appearance</h2>
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Palette className="w-4 h-4" />
                    <Label>Theme</Label>
                  </div>
                  <Select value={settings.appearance.theme} onValueChange={(value) => handleSettingChange("appearance", "theme", value)}>
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder="Select theme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* <Separator />

                <div className="flex items-center justify-between">
                  <Label className="pl-6">Font Size</Label>
                  <Select value={settings.appearance.fontSize} onValueChange={(value) => handleSettingChange("appearance", "fontSize", value)}>
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder="Font size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Small</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="large">Large</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <Label className="pl-6">Font Family</Label>
                  <Select value={settings.appearance.fontFamily} onValueChange={(value) => handleSettingChange("appearance", "fontFamily", value)}>
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder="Font family" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Inter">Inter</SelectItem>
                      <SelectItem value="Roboto">Roboto</SelectItem>
                      <SelectItem value="Arial">Arial</SelectItem>
                    </SelectContent>
                  </Select>
                </div> */}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-medium">System</h2>
            <Card>
              <CardContent className="p-4 space-y-4">
                <Collapsible className="w-full">
                  <CollapsibleTrigger className="flex items-center justify-between w-full py-2">
                    <div className="flex items-center space-x-2">
                      <Download className="w-4 h-4" />
                      <Label>Updates</Label>
                    </div>
                    <div className="bg-destructive text-destructive-foreground text-xs px-2 py-1 rounded">Move to page Settings {">>"} Updates</div>
                  </CollapsibleTrigger>
                </Collapsible>

                {/* <Separator />

                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <Folder className="w-4 h-4" />
                    <Label>Expression Pack Directory</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <p className="text-xs text-muted-foreground flex-1">
                      Current Directory: {settings.system.expressionPackDirectory || "Not set"}
                      <br />
                      Doesn't move current data.
                    </p>
                    <Button variant="outline" onClick={selectDirectory}>
                      Select Directory
                    </Button>
                  </div>
                </div> */}

                <Separator />

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="system-debug"
                    checked={settings.system.debugMode}
                    onCheckedChange={(checked) => handleSettingChange("system", "debugMode", !!checked)}
                  />
                  <div className="space-y-1 leading-none">
                    <Label htmlFor="system-debug">Debug Mode</Label>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="system-autoupdate"
                    checked={settings.system.autoUpdate}
                    onCheckedChange={(checked) => handleSettingChange("system", "autoUpdate", !!checked)}
                  />
                  <div className="space-y-1 leading-none">
                    <Label htmlFor="system-autoupdate">Automatic Updates</Label>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {FooterSection}
      </div>
    </div>
  );
}
