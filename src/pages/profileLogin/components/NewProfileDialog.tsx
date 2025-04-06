import React, { useState } from "react";
import { AvatarCrop } from "../../../components/shared/AvatarCrop.tsx";
import { Button } from "../../../components/ui/button.tsx";
import { Checkbox } from "../../../components/ui/checkbox.tsx";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../../components/ui/dialog.tsx";
import { Input } from "../../../components/ui/input.tsx";
import { Label } from "../../../components/ui/label.tsx";
import { useProfile } from "../../../hooks/ProfileContext.tsx";
import { saveAvatarImage } from "../../../services/file-system-service.ts";

interface NewProfileDialogProps {
  open: boolean;
  canClose?: boolean;
  onClose: () => void;
}

const NewProfileDialog: React.FC<NewProfileDialogProps> = ({ open, onClose, canClose = true }) => {
  const { addProfile } = useProfile();
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [hasPassword, setHasPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    try {
      if (!name.trim()) {
        setError("Name is required");
        setIsProcessing(false);
        return;
      }

      if (hasPassword && !password.trim()) {
        setError("Password is required when password protection is enabled");
        setIsProcessing(false);
        return;
      }

      // The actual password value or undefined if password protection is disabled
      const actualPassword = hasPassword ? password : undefined;

      // If avatar exists, save it to the filesystem
      let avatarPath = undefined;
      if (avatar) {
        try {
          // Generate a normalized ID from the profile name for better identification
          const nameID = name.toLowerCase().replace(/[^a-z0-9]/g, "_");
          avatarPath = await saveAvatarImage(avatar, nameID);
        } catch (err) {
          console.error("Error saving avatar:", err);
          // Continue without avatar if there's an error
        }
      }

      // Create profile with the avatar path
      await addProfile(name, avatarPath, actualPassword);
      handleClose(true);
    } catch (err) {
      console.error("Error creating profile:", err);
      setError("Failed to create profile. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = (force = false) => {
    // Only close if allowed and not processing
    if ((canClose || force) && !isProcessing) {
      // Reset form state
      setName("");
      setAvatar("");
      setPassword("");
      setError("");
      setIsProcessing(false);
      onClose();
    }
  };

  const handleCropComplete = (croppedImage: string) => {
    setAvatar(croppedImage);
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        className="sm:max-w-md"
        onInteractOutside={(e) => {
          if (isProcessing) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Create New Profile</DialogTitle>
          <DialogDescription>Add a new profile to access your personal settings and content.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {/* Avatar Upload & Crop */}
          <div className="space-y-2 text-center">
            <Label htmlFor="avatar" className="mb-2">
              Avatar
            </Label>
            <div className="flex justify-center">
              <div className="w-24 h-24 rounded-full overflow-hidden">
                <AvatarCrop onCropComplete={handleCropComplete} existingImage={avatar} cropShape="round" className="w-full h-full" />
              </div>
            </div>
          </div>

          {/* Name Input */}
          <div className="space-y-2">
            <Label htmlFor="name">
              Profile Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter profile name"
              maxLength={30}
              required
              disabled={isProcessing}
            />
          </div>

          {/* Password Protection */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="hasPassword"
              checked={hasPassword}
              onCheckedChange={(checked) => setHasPassword(checked as boolean)}
              disabled={isProcessing}
            />
            <Label htmlFor="hasPassword" className="text-sm font-medium">
              Password protect this profile
            </Label>
          </div>

          {/* Password Input (conditional) */}
          {hasPassword && (
            <div className="space-y-2">
              <Label htmlFor="password">
                Password <span className="text-red-500">*</span>
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                disabled={isProcessing}
              />
            </div>
          )}

          {/* Error Message */}
          {error && <p className="text-sm text-red-500">{error}</p>}

          <DialogFooter className="mt-6">
            {canClose && (
              <Button type="button" onClick={() => handleClose()} variant="outline" disabled={isProcessing}>
                Cancel
              </Button>
            )}

            <Button type="submit" disabled={isProcessing}>
              {isProcessing ? "Creating..." : "Create Profile"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default NewProfileDialog;
