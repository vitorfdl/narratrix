import { Avatar } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import { AvatarFallback, AvatarImage } from "@radix-ui/react-avatar";

// Extracted MessageAvatar component
export const MessageAvatar = ({ avatarPath, messageType, isStreaming }: { avatarPath?: string; messageType: string; isStreaming: boolean }) => (
  <div className="flex-shrink-0 select-none">
    <Dialog>
      <DialogTrigger asChild>
        <button className="transition-transform rounded-lg" title="View Full Size Avatar">
          <Avatar className={cn("w-24 h-24 ring-2 ring-border overflow-hidden rounded-full hover:ring-primary", isStreaming && "ring-primary")}>
            <AvatarImage src={avatarPath} alt={`${messageType} avatar`} className="hover:cursor-pointer" />
            <AvatarFallback className="bg-secondary text-secondary-foreground">
              <AvatarImage src="/avatars/default.jpg" alt={`Default ${messageType} avatar`} />
            </AvatarFallback>
          </Avatar>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl w-fit p-2">
        {avatarPath && <img src={avatarPath} alt={`${messageType} avatar full size`} className="w-auto max-h-[80vh] object-contain rounded-lg" />}
      </DialogContent>
    </Dialog>
  </div>
);
