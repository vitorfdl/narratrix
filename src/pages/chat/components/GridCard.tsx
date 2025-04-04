// src/components/GridCard.tsx
import { CardProps } from "@/schema/grid";
import { EyeOffIcon, Grip, PinOffIcon } from "lucide-react";

export const GridCard: React.FC<CardProps> = ({ id, title, children, onClose, buttons = [], dragHandleClassName }) => {
  return (
    <div className="flex flex-col bg-background border overflow-hidden rounded-lg h-full w-full" id={id}>
      {/* Title bar */}
      <div className="flex items-center justify-between px-3 py-0.5 bg-card border-b">
        <div className={`flex items-center gap-2 cursor-grab active:cursor-grabbing w-full ${dragHandleClassName || ""}`}>
          <Grip className="w-3 h-3 mr-2 text-muted-foreground" />
          <span className="font-medium text-xs">{title}</span>
        </div>

        <div className="flex items-center gap-2">
          {buttons.map((button, index) => (
            <div key={index}>{button}</div>
          ))}
          <button onClick={onClose} className="p-1 hover:bg-accent rounded" title="Hide Borders">
            <EyeOffIcon className="w-3 h-3" />
          </button>
          {onClose && (
            <button onClick={onClose} className="p-1 hover:bg-accent rounded" title="Pin Card to Sidebar">
              <PinOffIcon className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-1 overflow-auto h-full custom-scrollbar">{children}</div>

      {/* Custom resize indicator */}
      <div className="absolute bottom-0 right-0 w-4 h-4 pointer-events-none">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M22 14L18 14L18 18L14 18L14 22L22 22L22 14Z" className="fill-muted-foreground" />
        </svg>
      </div>
    </div>
  );
};
