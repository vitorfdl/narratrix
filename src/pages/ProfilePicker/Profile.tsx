import React, { useState } from 'react';
import { useProfile } from '../../contexts/ProfileContext';
import { MAX_PROFILES } from '../../types/profiles';
import { PlusCircleIcon, TrashIcon, UserCircleIcon } from 'lucide-react';
import NewProfileDialog from './components/NewProfileDialog';
import PasswordDialog from './components/PasswordDialog';
import { Button } from '../../components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '../../components/ui/avatar';
import { Card, CardContent } from '../../components/ui/card';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog';

const ProfilePicker: React.FC = () => {
  const { profiles, login, removeProfile } = useProfile();
  const [showNewProfileDialog, setShowNewProfileDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [isManageMode, setIsManageMode] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [profileToDelete, setProfileToDelete] = useState<string | null>(null);

  const handleProfileClick = (id: string) => {
    if (isManageMode) return;

    const profile = profiles.find(p => p.id === id);

    if (!profile) return;

    if (profile.hasPassword) {
      setSelectedProfileId(id);
      setShowPasswordDialog(true);
    } else {
      login(id).catch(error => {
        console.error('Error during login:', error);
        toast.error('Login failed. Please try again.');
      });
    }
  };

  const handlePasswordSubmit = (password: string) => {
    if (selectedProfileId) {
      login(selectedProfileId, password)
        .then(success => {
          if (!success) {
            toast.error("Authentication Error", {
              description: "Incorrect password. Please try again."
            });
          } else {
            setShowPasswordDialog(false);
          }
        })
        .catch(error => {
          console.error('Error during login:', error);
          toast.error('Login failed. Please try again.');
        });
    }
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
          toast.success("Profile Deleted", {
            description: "The profile has been successfully removed."
          });
        })
        .catch(error => {
          console.error('Error deleting profile:', error);
          toast.error('Failed to delete profile. Please try again.');
        });
    }
  };

  return (
    <div className="flex flex-col h-screen w-full items-center justify-center bg-background select-none">
      <div className="w-full max-w-5xl p-8 flex flex-col items-center">
        <h1 className="text-4xl font-bold mb-10 text-foreground">Who's the Game Master?</h1>

        <div className="flex flex-wrap justify-center gap-8 mb-12">
          {profiles.map(profile => (
            <div
              key={profile.id}
              className="relative"
            >
              <Card
                className={`w-32 border-none transition-all ${isManageMode ? 'cursor-default opacity-80' : 'hover:shadow-md hover:scale-105 hover:cursor-pointer'
                  }`}
                onClick={() => handleProfileClick(profile.id)}
              >
                <CardContent className="flex flex-col items-center p-3 pt-3">
                  <Avatar className="w-24 h-24 mb-3">
                    {profile.avatar_path ? (
                      <AvatarImage src={profile.avatar_path} alt={profile.name} />
                    ) : (
                      <AvatarFallback>
                        <UserCircleIcon className="w-full h-full text-muted-foreground" />
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <span className="text-foreground text-center break-words w-full">
                    {profile.name}
                  </span>
                  {profile.hasPassword && !isManageMode && (
                    <span className="text-xs text-muted-foreground mt-1">🔒</span>
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
            <Card
              className={`w-32 transition-all hover:shadow-md border-none`}
              onClick={() => setShowNewProfileDialog(true)}
            >
              <CardContent className="flex flex-col items-center p-3 pt-3 hover:scale-105 hover:cursor-pointer">
                <div className="w-24 h-24 mb-3 flex items-center justify-center rounded-md bg-accent hover:bg-primary/20">
                  <PlusCircleIcon className="w-12 h-12 text-primary" />
                </div>
                <span className="text-foreground text-center">
                  New Profile
                </span>
              </CardContent>
            </Card>
          )}
        </div>

        <Button
          onClick={() => setIsManageMode(!isManageMode)}
          variant="outline"
          size="lg"
          className={`px-8 ${isManageMode ? "bg-primary text-destructive-foreground" : ""}`}
        >
          {isManageMode ? "Done" : "Manage Profiles"}
        </Button>
      </div>

      {/* New Profile Dialog */}
      <NewProfileDialog
        open={showNewProfileDialog}
        onClose={() => setShowNewProfileDialog(false)}
      />

      {/* Password Dialog */}
      <PasswordDialog
        open={showPasswordDialog}
        onClose={() => setShowPasswordDialog(false)}
        onSubmit={handlePasswordSubmit}
        profileName={selectedProfileId ? profiles.find(p => p.id === selectedProfileId)?.name || '' : ''}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this profile and all associated data.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteProfile}>
              Delete Profile
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProfilePicker;