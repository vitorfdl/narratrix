import { LockIcon } from "lucide-react";
import { AlertCircle } from "lucide-react";
import React, { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "../../../components/ui/alert.tsx";
import { Button } from "../../../components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog.tsx";
import { Input } from "../../../components/ui/input.tsx";

interface PasswordDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (password: string) => Promise<void>;
  profileName: string;
}

const PasswordDialog: React.FC<PasswordDialogProps> = ({
  open,
  onClose,
  onSubmit,
  profileName,
}) => {
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password.trim()) {
      setError("Password is required");
      return;
    }

    setIsLoading(true);
    setError("");

    // Make this async/await to properly catch errors
    try {
      await onSubmit(password);
    } catch (error) {
      console.error("Authentication error:", error);
      setError(typeof error === "string" ? error : "An error occurred during authentication");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    // Reset form state
    setPassword("");
    setError("");
    setIsLoading(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LockIcon className="w-6 h-6 text-muted-foreground" /> Enter Password
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center" />
          </div>

          <p className="text-center text-sm text-muted-foreground">
            Enter password for <span className="font-medium text-foreground">{profileName}</span>
          </p>

          <div className="space-y-2">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              autoFocus
              disabled={isLoading}
            />

            {error && (
              <Alert variant="destructive" className="py-2">
                <AlertCircle className="h-4 w-4 mr-1" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Authenticating..." : "Unlock"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PasswordDialog;
