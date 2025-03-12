export interface ChatTab {
  id: string;
  name: string;
  isActive: boolean;
}

export interface GridItem {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  content: string;
}

export interface ChatTab {
  id: string;
  name: string;
  isActive: boolean;
  gridItems: GridItem[];
}
