// src/types/grid.ts
export interface CardProps {
  id: string;
  title: string;
  children?: React.ReactNode;
  onClose?: () => void;
  buttons?: React.ReactNode[];
}

export interface GridPosition {
  x?: number;
  y?: number;
  w: number;
  h: number;
  id: string;
  title: string;
  hidden?: boolean;
}
