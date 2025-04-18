// src/types/grid.ts
export interface CardProps {
  id: string;
  title: string;
  children?: React.ReactNode;
  onClose?: () => void;
  buttons?: React.ReactNode[];
  dragHandleClassName?: string;
}

interface GridPositionXYWH {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}
export interface GridPosition {
  sm?: GridPositionXYWH;
  md?: GridPositionXYWH;
  lg?: GridPositionXYWH;
  xs?: GridPositionXYWH;
  xxs?: GridPositionXYWH;
  id: string;
  hidden?: boolean;
  decorated?: boolean;
}

export const defaultPositions: GridPosition[] = [
  {
    id: "messages",
    hidden: false,
    decorated: true,
    sm: { x: 0, y: 0, w: 12, h: 15 },
    md: { x: 0, y: 0, w: 7, h: 18 },
    lg: { x: 0, y: 0, w: 10, h: 20 },
  },
  {
    id: "config",
    hidden: false,
    decorated: true,
    sm: { x: 0, y: 15, w: 12, h: 6 },
    md: { x: 7, y: 0, w: 3, h: 15 },
    lg: { x: 10, y: 0, w: 2, h: 15 },
  },
  {
    id: "generate",
    hidden: false,
    decorated: true,
    sm: { x: 0, y: 21, w: 12, h: 5 },
    md: { x: 0, y: 18, w: 7, h: 6 },
    lg: { x: 0, y: 20, w: 10, h: 5 },
  },
  {
    id: "participants",
    hidden: false,
    decorated: true,
    sm: { x: 0, y: 26, w: 12, h: 6 },
    md: { x: 7, y: 15, w: 3, h: 9 },
    lg: { x: 10, y: 15, w: 2, h: 10 },
  },
  { id: "scripts", hidden: true, decorated: true },
  { id: "character_sheet", hidden: true, decorated: true },
  { id: "memory", hidden: true, decorated: true },
  { id: "database", hidden: true, decorated: true },
  { id: "chapters", hidden: true, decorated: true },
  { id: "expressions", hidden: true, decorated: true },
  { id: "help", hidden: true, decorated: true },
];
