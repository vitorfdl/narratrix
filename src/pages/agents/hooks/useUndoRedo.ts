import type { Edge, Node } from "@xyflow/react";
import type { Dispatch, SetStateAction } from "react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

interface Snapshot<N extends Node = Node, E extends Edge = Edge> {
  nodes: N[];
  edges: E[];
}

interface UseUndoRedoOptions {
  maxHistory?: number;
  resetKey?: string;
}

interface UseUndoRedoResult {
  takeSnapshot: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const MAX_HISTORY_DEFAULT = 15;

export function useUndoRedo<N extends Node = Node, E extends Edge = Edge>(
  nodes: N[],
  edges: E[],
  setNodes: Dispatch<SetStateAction<N[]>>,
  setEdges: Dispatch<SetStateAction<E[]>>,
  options?: UseUndoRedoOptions,
): UseUndoRedoResult {
  const maxHistory = options?.maxHistory ?? MAX_HISTORY_DEFAULT;
  const resetKey = options?.resetKey;

  const pastRef = useRef<Snapshot<N, E>[]>([]);
  const futureRef = useRef<Snapshot<N, E>[]>([]);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);

  nodesRef.current = nodes;
  edgesRef.current = edges;

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const syncFlags = useCallback(() => {
    setCanUndo(pastRef.current.length > 0);
    setCanRedo(futureRef.current.length > 0);
  }, []);

  useEffect(() => {
    pastRef.current = [];
    futureRef.current = [];
    syncFlags();
  }, [resetKey, syncFlags]);

  const takeSnapshot = useCallback(() => {
    const snapshot: Snapshot<N, E> = {
      nodes: structuredClone(nodesRef.current),
      edges: structuredClone(edgesRef.current),
    };
    pastRef.current = [...pastRef.current.slice(-(maxHistory - 1)), snapshot];
    futureRef.current = [];
    syncFlags();
  }, [maxHistory, syncFlags]);

  const undo = useCallback(() => {
    const past = pastRef.current;
    if (past.length === 0) {
      return;
    }

    const previous = past[past.length - 1];
    pastRef.current = past.slice(0, -1);

    futureRef.current = [
      ...futureRef.current,
      {
        nodes: structuredClone(nodesRef.current),
        edges: structuredClone(edgesRef.current),
      },
    ];

    setNodes(previous.nodes);
    setEdges(previous.edges);
    syncFlags();
  }, [setNodes, setEdges, syncFlags]);

  const redo = useCallback(() => {
    const future = futureRef.current;
    if (future.length === 0) {
      return;
    }

    const next = future[future.length - 1];
    futureRef.current = future.slice(0, -1);

    pastRef.current = [
      ...pastRef.current,
      {
        nodes: structuredClone(nodesRef.current),
        edges: structuredClone(edgesRef.current),
      },
    ];

    setNodes(next.nodes);
    setEdges(next.edges);
    syncFlags();
  }, [setNodes, setEdges, syncFlags]);

  return { takeSnapshot, undo, redo, canUndo, canRedo };
}

const UndoRedoContext = createContext<(() => void) | null>(null);

export const UndoRedoProvider = UndoRedoContext.Provider;

export function useTakeSnapshot(): () => void {
  const takeSnapshot = useContext(UndoRedoContext);
  if (!takeSnapshot) {
    throw new Error("useTakeSnapshot must be used within an UndoRedoProvider");
  }
  return takeSnapshot;
}
