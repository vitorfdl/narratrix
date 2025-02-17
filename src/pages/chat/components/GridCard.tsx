// src/components/GridCard.tsx
import { CardProps } from "@/types/grid";
import { Grip, PinOffIcon } from "lucide-react";

export const GridCard: React.FC<CardProps> = ({ 
  id, 
  title, 
  children, 
  onClose,
  buttons = []
}) => {
  return (
    <div className="grid-stack-item-content flex flex-col bg-background border rounded-sm overflow-hidden" id={id}>
      {/* Title bar */}
      <div 
        className="flex items-center px-3 py-0.5 bg-card border-b cursor-move"
        data-gs-drag-handle
      >
        <Grip className="w-3 h-3 mr-2 text-muted-foreground" />
        <span className="flex-1 font-medium text-xs">{title}</span>
        <div className="flex items-center gap-2">
          {buttons.map((button, index) => (
            <div key={index}>{button}</div>
          ))}
          {onClose && (
            <button 
              onClick={onClose}
              className="p-1 hover:bg-accent rounded"
            >
              <PinOffIcon className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
      
      {/* Content */}
      <div className="p-1 overflow-auto">
        {children}
      </div>
    </div>
  );
};
