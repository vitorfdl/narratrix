import { ProfileListItem } from "@/schema/profiles-schema";
import { Loader2, LockIcon, PlusCircleIcon, TrashIcon, UserCircleIcon } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "../../components/ui/avatar.tsx";
import { Button } from "../../components/ui/button.tsx";
import { Card, CardContent } from "../../components/ui/card.tsx";
import { MAX_PROFILES, useProfileActions, useProfileLoading, useProfiles } from "../../hooks/ProfileStore.tsx";
import { useMultipleImageUrls } from "../../hooks/useImageUrl";
import NewProfileDialog from "./components/NewProfileDialog.tsx";
import PasswordDialog from "./components/PasswordDialog.tsx";

const ProfilePicker: React.FC = () => {
  const { login, removeProfile } = useProfileActions();
  const profiles = useProfiles();
  const isProfileLoading = useProfileLoading();
  const [showNewProfileDialog, setShowNewProfileDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [isManageMode, setIsManageMode] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [profileToDelete, setProfileToDelete] = useState<string | null>(null);
  const [isProfilesLoaded, setIsProfilesLoaded] = useState(false);

  // Memoize the getter functions with correct types
  const getProfileAvatarPath = useCallback((profile: ProfileListItem) => profile.avatar_path, []);
  const getProfileId = useCallback((profile: ProfileListItem) => profile.id, []);

  const { urlMap } = useMultipleImageUrls(
    profiles,
    getProfileAvatarPath, // Use memoized function
    getProfileId, // Use memoized function
  );

  useEffect(() => {
    if (profiles.length === 0 && isProfilesLoaded) {
      setShowNewProfileDialog(true);
      setIsManageMode(false);
    }
  }, [profiles.length, isProfilesLoaded]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsProfilesLoaded(true);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  const handleProfileClick = (id: string) => {
    if (isManageMode) {
      return;
    }

    const profile = profiles.find((p) => p.id === id);

    if (!profile) {
      return;
    }

    if (profile.hasPassword) {
      setSelectedProfileId(id);
      setShowPasswordDialog(true);
    } else {
      login(id);
    }
  };

  const handlePasswordSubmit = (password: string): Promise<void> => {
    if (!selectedProfileId) {
      return Promise.reject("No profile selected");
    }

    return login(selectedProfileId, password)
      .then((success) => {
        if (!success) {
          throw "Incorrect password. Please try again.";
        }
        setShowPasswordDialog(false);
      })
      .catch((error) => {
        console.error("Error during login:", error);
        throw typeof error === "string" ? error : "Login failed. Please try again.";
      });
  };

  const initiateProfileDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setProfileToDelete(id);
    setShowDeleteDialog(true);
  };

  const confirmDeleteProfile = () => {
    if (profileToDelete) {
      removeProfile(profileToDelete)
        .then(() => {
          setProfileToDelete(null);
          setShowDeleteDialog(false);
        })
        .catch((error) => {
          console.error("Error deleting profile:", error);
          toast.error("Failed to delete profile. Please try again.");
        });
    }
  };

  return (
    <div className="flex flex-col h-screen w-full items-center justify-center bg-background select-none">
      {isProfileLoading ? (
        <div className="text-foreground text-xl flex flex-col items-center">
          <Loader2 className="w-10 h-10 animate-spin" />
          <h1 className="text-2xl font-bold">Loading profiles...</h1>
        </div>
      ) : (
        <div className="w-full max-w-5xl p-8 flex flex-col items-center">
          <h1 className="text-4xl font-bold mb-10 text-foreground">Who's the Game Master?</h1>

          <div className="flex flex-wrap justify-center gap-8 mb-12">
            {profiles.map((profile) => (
              <div key={profile.id} className="relative">
                <Card
                  className={`w-32 border-none transition-all ${isManageMode ? "cursor-default opacity-80" : "hover:shadow hover:shadow-primary/20 hover:scale-105 hover:cursor-pointer"}`}
                  onClick={() => handleProfileClick(profile.id)}
                >
                  <CardContent className="flex flex-col items-center p-3 pt-3">
                    <Avatar className="w-24 h-24 mb-3 rounded-full">
                      <AvatarImage src={urlMap[profile.id] || ""} alt={profile.name} />
                      <AvatarFallback>
                        <UserCircleIcon className="w-full h-full text-muted-foreground" />
                      </AvatarFallback>
                    </Avatar>

                    <span className="text-foreground text-center break-words w-full">{profile.name}</span>

                    {profile.hasPassword && !isManageMode && (
                      <span className="absolute -top-0 -right-2 rounded-full w-8 h-8 p-0">
                        <LockIcon size={20} className="inline text-primary" />
                      </span>
                    )}
                  </CardContent>
                </Card>

                {isManageMode && (
                  <Button
                    size="icon"
                    variant="destructive"
                    className="absolute -top-2 -right-2 rounded-full w-8 h-8 p-0"
                    onClick={(e) => initiateProfileDelete(profile.id, e)}
                    aria-label={`Delete ${profile.name}`}
                  >
                    <TrashIcon size={20} />
                  </Button>
                )}
              </div>
            ))}

            {profiles.length < MAX_PROFILES && isManageMode && (
              <Card className={"w-32 border-none transition-all hover:shadow hover:shadow-primary/20 hover:scale-105 hover:cursor-pointer"} onClick={() => setShowNewProfileDialog(true)}>
                <CardContent className="flex flex-col items-center p-3 pt-3">
                  <div className="w-24 h-24 mb-3 rounded-full flex items-center justify-center">
                    <PlusCircleIcon className="w-12 h-12 text-primary" />
                  </div>
                  <span className="text-foreground text-center break-words w-full">New Profile</span>
                </CardContent>
              </Card>
            )}
          </div>

          <Button onClick={() => setIsManageMode(!isManageMode)} variant={isManageMode ? "default" : "outline"} size="lg" className={"px-8"}>
            {isManageMode ? "Done" : "Manage Profiles"}
          </Button>
        </div>
      )}

      {/* New Profile Dialog */}
      <NewProfileDialog open={showNewProfileDialog} onClose={() => setShowNewProfileDialog(false)} canClose={profiles.length > 0} />

      {/* Password Dialog */}
      <PasswordDialog
        avatar_path={urlMap[selectedProfileId || ""] || ""}
        open={showPasswordDialog}
        onClose={() => setShowPasswordDialog(false)}
        onSubmit={handlePasswordSubmit}
        profileName={selectedProfileId ? profiles.find((p) => p.id === selectedProfileId)?.name || "" : ""}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this profile and all associated data. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteProfile}>Delete Profile</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProfilePicker;
