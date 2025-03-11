import React, { useState } from 'react';
import { useProfile } from '../../../contexts/ProfileContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '../../../components/ui/dialog';
import { UserCircleIcon } from 'lucide-react';

interface NewProfileDialogProps {
  open: boolean;
  onClose: () => void;
}

const NewProfileDialog: React.FC<NewProfileDialogProps> = ({ open, onClose }) => {
  const { addProfile } = useProfile();
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('');
  const [hasPassword, setHasPassword] = useState(true);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    if (hasPassword && !password.trim()) {
      setError('Password is required when password protection is enabled');
      return;
    }

    // Add profile and close dialog
    const actualPassword = hasPassword ? password : undefined;

    // Use async/await to handle the addProfile Promise
    addProfile(name, avatar, actualPassword)
      .then(() => {
        handleClose();
      })
      .catch((err) => {
        console.error('Error creating profile:', err);
        setError('Failed to create profile. Please try again.');
      });
  };

  const handleClose = () => {
    // Reset form state
    setName('');
    setAvatar('');
    setPassword('');
    setError('');
    onClose();
  };

  const generateRandomAvatar = () => {
    const seed = Math.random().toString(36).substring(2, 8);
    setAvatar(`https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`);
  };

  return (
    <Dialog open={open} onOpenChange={open => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Profile</DialogTitle>
          <DialogDescription>
            Add a new profile to access your personal settings and content.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {/* Avatar Preview */}
          <div className="flex justify-center mb-4">
            {avatar ? (
              <img
                src={avatar}
                alt="Profile Avatar"
                className="w-24 h-24 rounded-full"
              />
            ) : (
              <UserCircleIcon className="w-24 h-24 text-muted-foreground" />
            )}
          </div>

          {/* Avatar Generation */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={generateRandomAvatar}
              className="px-3 py-1 text-sm rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80"
            >
              Generate Random Avatar
            </button>
          </div>

          {/* Name Input */}
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              Profile Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border rounded-md border-input bg-background text-foreground"
              placeholder="Enter profile name"
              maxLength={30}
              required
            />
          </div>

          {/* Password Protection */}
          <div className="flex items-center space-x-2">
            <input
              id="hasPassword"
              type="checkbox"
              checked={hasPassword}
              onChange={(e) => setHasPassword(e.target.checked)}
              className="rounded border-input"
            />
            <label htmlFor="hasPassword" className="text-sm font-medium">
              Password protect this profile
            </label>
          </div>

          {/* Password Input (conditional) */}
          {hasPassword && (
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Password <span className="text-red-500">*</span>
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border rounded-md border-input bg-background text-foreground"
                placeholder="Enter password"
                required
              />
            </div>
          )}

          {/* Error Message */}
          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          <DialogFooter className="mt-6">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 rounded-md border border-input bg-background text-foreground hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Create Profile
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default NewProfileDialog; 