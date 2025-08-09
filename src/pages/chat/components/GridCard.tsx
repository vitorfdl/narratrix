// src/components/GridCard.tsx

import { EyeIcon, EyeOffIcon, Grip, PinOffIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { CardProps } from "@/schema/grid";
import { useLocalGridLayout } from "@/utils/local-storage";

export const GridCard: React.FC<CardProps> = ({ id, title, children, onClose, buttons = [], dragHandleClassName }) => {
  const [positions, setPositions] = useLocalGridLayout();
  const [isDecorated, setIsDecorated] = useState(true);

  // Initialize decoration state from local storage
  useEffect(() => {
    const position = positions.find((pos) => pos.id === id);
    if (position && position.decorated !== undefined) {
      setIsDecorated(position.decorated);
    }
  }, [id, positions]);

  const toggleDecorations = () => {
    const newDecoratedState = !isDecorated;
    setIsDecorated(newDecoratedState);

    // Update in local storage
    setPositions((prev) => prev.map((pos) => (pos.id === id ? { ...pos, decorated: newDecoratedState } : pos)));
  };

  return (
    <div className={`group flex flex-col overflow-hidden h-full w-full ${isDecorated ? "bg-background border rounded-lg" : ""}`} id={id}>
      {/* Title bar */}
      <div
        className={
          isDecorated
            ? "flex items-center justify-between px-3 py-0.5 bg-card border-b transition-all duration-200 ease-in-out"
            : "hidden group-hover:flex items-center justify-between px-3 py-0.5 transition-all duration-300 ease-in-out"
        }
      >
        <div className={`flex items-center gap-2 cursor-grab active:cursor-grabbing w-full ${dragHandleClassName || ""}`}>
          <Grip className="w-3 h-3 mr-2 text-muted-foreground" />
          <span className="font-medium text-xs">{title}</span>
        </div>

        <div className="flex items-center gap-2">
          {buttons.map((button, index) => (
            <div key={index}>{button}</div>
          ))}
          <button tabIndex={-1} onClick={toggleDecorations} className="p-1 hover:bg-accent rounded" title={isDecorated ? "Hide Decorations" : "Show Decorations"}>
            {isDecorated ? <EyeOffIcon className="w-3 h-3" /> : <EyeIcon className="w-3 h-3" />}
          </button>
          {onClose && (
            <button tabIndex={-1} onClick={onClose} className="p-1 hover:bg-accent rounded" title="Pin Card to Sidebar">
              <PinOffIcon className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-1 overflow-auto h-full custom-scrollbar">{children}</div>

      {/* Custom resize indicator */}
      {isDecorated && (
        <div className="absolute bottom-0 right-0 w-4 h-4 pointer-events-none">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22 14L18 14L18 18L14 18L14 22L22 22L22 14Z" className="fill-muted-foreground" />
          </svg>
        </div>
      )}
    </div>
  );
};
