import { useEffect, useState } from "react";
import { LuCheck, LuTrash2 } from "react-icons/lu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ConfirmDeleteButtonProps {
  onDelete: () => void;
  title?: string;
  className?: string;
  iconClassName?: string;
  disabled?: boolean;
}

/**
 * Two-phase inline delete: first click arms it (check icon, destructive variant),
 * second click confirms. Auto-disarms after a short delay.
 */
export function ConfirmDeleteButton({ onDelete, title = "Delete", className, iconClassName = "h-3 w-3", disabled = false }: ConfirmDeleteButtonProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    if (disabled) {
      setIsConfirming(false);
      return;
    }
    if (isConfirming) {
      const timeout = setTimeout(() => setIsConfirming(false), 2500);
      return () => clearTimeout(timeout);
    }
  }, [disabled, isConfirming]);

  const handleClick = () => {
    if (isConfirming) {
      setIsConfirming(false);
      onDelete();
    } else {
      setIsConfirming(true);
    }
  };

  return (
    <Button
      type="button"
      variant={isConfirming ? "destructive" : "ghost"}
      size="icon"
      className={cn("hover:text-destructive", isConfirming && "hover:text-destructive-foreground", className)}
      title={isConfirming ? "Click again to confirm" : title}
      disabled={disabled}
      onClick={handleClick}
    >
      {isConfirming ? <LuCheck className={iconClassName} /> : <LuTrash2 className={iconClassName} />}
    </Button>
  );
}
