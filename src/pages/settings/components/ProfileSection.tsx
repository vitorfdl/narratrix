import { AvatarCrop } from "@/components/shared/AvatarCrop";
import { Button } from "@/components/ui/button";
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
import { Separator } from "@/components/ui/separator";
import { useProfileActions } from "@/hooks/ProfileStore";
import { useImageUrl } from "@/hooks/useImageUrl";
import { ProfileListItem, ProfileResponse } from "@/schema/profiles-schema";
import { saveImage } from "@/services/file-system-service";
import { deleteProfile as deleteProfileService, updateProfile, updateProfilePassword } from "@/services/profile-service";
import { useSessionProfile } from "@/utils/session-storage";
import { KeyIcon, LogOut, Trash, User, UserCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SettingItem, SettingSection } from "./ui/setting-section";

interface ProfileSectionProps {
  currentProfile: ProfileResponse;
  refreshProfiles: () => Promise<ProfileListItem[]>;
}

// Extract sections into separate components for better organization
export const ProfileSection = ({ currentProfile, refreshProfiles }: ProfileSectionProps) => {
  const [newProfileName, setNewProfileName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingName, setIsChangingName] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isRemovingPassword, setIsRemovingPassword] = useState(false);
  const [_isChangingAvatar, setIsChangingAvatar] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { logout, setCurrentProfile } = useProfileActions();
  const { url: currentProfileAvatarUrl, reload: reloadAvatarImage } = useImageUrl(currentProfile?.avatar_path);
  const [_savedProfile, setSessionProfile] = useSessionProfile();

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
      let updatedProfile: ProfileResponse;
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

  const handleRemovePassword = async () => {
    if (!currentProfile) {
      toast.error("No profile selected");
      return;
    }
    if (!currentProfile.hasPassword) {
      toast.error("Profile does not have a password to remove.");
      return;
    }
    if (!currentPassword) {
      toast.error("Please enter your current password to remove it.");
      return;
    }

    try {
      setIsRemovingPassword(true);
      const updatedProfile = await updateProfilePassword(currentProfile.id, currentPassword, null);

      setCurrentProfile(updatedProfile);
      await refreshProfiles();
      toast.success("Password removed successfully");

      // Reset form
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      setIsPasswordDialogOpen(false); // Close the dialog on success
    } catch (error) {
      console.error("Failed to remove password:", error);
      toast.error("Failed to remove password. Please check your current password.");
    } finally {
      setIsRemovingPassword(false);
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
      await reloadAvatarImage();
      toast.success("Avatar updated successfully");
      setIsAvatarDialogOpen(false);
    } catch (error) {
      console.error("Failed to update avatar:", error);
      toast.error("Failed to update avatar");
    } finally {
      setIsChangingAvatar(false);
    }
  };

  const handleLogout = () => {
    logout();
    setSessionProfile(undefined);
    setIsLogoutDialogOpen(false);
    toast.info("Logged out successfully.");
  };

  const deleteProfile = async () => {
    if (!currentProfile) {
      toast.error("No profile selected");
      return;
    }

    try {
      setIsDeleting(true);
      await deleteProfileService(currentProfile.id);
      await refreshProfiles();
      toast.success("Profile deleted successfully");
      logout();
      setSessionProfile(undefined);
    } catch (error) {
      console.error("Failed to delete profile:", error);
      toast.error("Failed to delete profile.");
      setIsDeleteDialogOpen(false);
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
      if (currentProfile?.hasPassword && currentPassword && !newPassword && !confirmPassword && !isRemovingPassword && !isChangingPassword) {
        // Note: This doesn't directly trigger removal, but Enter on the current password field
        // might feel like it should. We keep the explicit button for clarity.
        // Perhaps focus the remove button? For now, do nothing specific on Enter here for removal.
      } else if (!isChangingPassword && newPassword && newPassword === confirmPassword && (!currentProfile?.hasPassword || currentPassword)) {
        handlePasswordChange();
      }
    }
  };

  return (
    <SettingSection title="Profile">
      <SettingItem icon={<User className="w-4 h-4" />} label={`Profile: ${currentProfile.name}`}>
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
      </SettingItem>

      <Separator />

      <SettingItem icon={<UserCircle className="w-4 h-4" />} label="Avatar">
        <div className="flex items-center gap-2">
          {currentProfileAvatarUrl && (
            <div className="w-8 h-8 rounded-full overflow-hidden border border-border">
              <img src={currentProfileAvatarUrl} alt={`${currentProfile.name}'s avatar`} className="w-full h-full object-cover" />
            </div>
          )}
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
      </SettingItem>

      <Separator />

      <SettingItem icon={<KeyIcon className="w-4 h-4" />} label="Password">
        <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">{currentProfile?.hasPassword ? "Change" : "Set"} Password</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{currentProfile?.hasPassword ? "Change" : "Set"} Password</DialogTitle>
              <DialogDescription>
                {currentProfile?.hasPassword
                  ? "Enter your current password to change it or remove it entirely."
                  : "Create a new password for your profile."}
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
                  placeholder={currentProfile?.hasPassword ? "New password (leave blank to remove)" : "New password"}
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
                  placeholder="Confirm new password"
                  onKeyDown={handlePasswordKeyDown}
                  disabled={!newPassword}
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:justify-between">
              <div>
                {currentProfile?.hasPassword && (
                  <Button
                    variant="destructive"
                    onClick={handleRemovePassword}
                    disabled={isRemovingPassword || isChangingPassword || !currentPassword}
                    className="flex items-center gap-1"
                  >
                    {isRemovingPassword ? (
                      <>
                        <Trash className="w-4 h-4 animate-spin" /> Removing...
                      </>
                    ) : (
                      <>
                        <Trash className="w-4 h-4" /> Remove Password
                      </>
                    )}
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <DialogClose asChild>
                  <Button variant="secondary">Cancel</Button>
                </DialogClose>
                <Button
                  onClick={handlePasswordChange}
                  disabled={
                    isChangingPassword ||
                    isRemovingPassword ||
                    !newPassword ||
                    newPassword !== confirmPassword ||
                    (currentProfile?.hasPassword && !currentPassword)
                  }
                >
                  {isChangingPassword ? "Saving..." : "Save"}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SettingItem>

      <Separator />

      <SettingItem icon={<LogOut className="w-4 h-4" />} label="Log out from your profile">
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
      </SettingItem>

      <Separator />

      <SettingItem icon={<Trash className="w-4 h-4" />} label="Delete your profile">
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
      </SettingItem>
    </SettingSection>
  );
};
