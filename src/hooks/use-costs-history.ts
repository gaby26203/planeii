import { useCallback, useEffect, useRef, useState } from "react";
import type { CostItem } from "@/lib/finance-types";

const MAX_HISTORY = 50;

/**
 * Historial de undo/redo para el arreglo de costos de un viaje.
 *
 * - `snapshot(prev)` debe llamarse ANTES de aplicar cualquier mutación,
 *   pasando el estado actual (previo a la mutación) para poder revertirlo.
 * - `undo()` devuelve el snapshot a restaurar o `null` si no hay más historial;
 *   internamente empuja el estado actual al stack de redo.
 * - `redo()` hace la operación inversa.
 *
 * El historial se resetea al cambiar de viaje.
 */
export function useCostsHistory(tripId: string, currentCosts: CostItem[]) {
  const undoStack = useRef<CostItem[][]>([]);
  const redoStack = useRef<CostItem[][]>([]);
  const currentRef = useRef<CostItem[]>(currentCosts);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    currentRef.current = currentCosts;
  }, [currentCosts]);

  // Reset al cambiar de viaje
  useEffect(() => {
    undoStack.current = [];
    redoStack.current = [];
    setVersion((v) => v + 1);
  }, [tripId]);

  const snapshot = useCallback((prev: CostItem[]) => {
    undoStack.current.push(prev.map((c) => ({ ...c })));
    if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift();
    // Cualquier nueva mutación invalida el redo
    if (redoStack.current.length) redoStack.current = [];
    setVersion((v) => v + 1);
  }, []);

  const undo = useCallback((): CostItem[] | null => {
    const prev = undoStack.current.pop();
    if (!prev) return null;
    redoStack.current.push(currentRef.current.map((c) => ({ ...c })));
    if (redoStack.current.length > MAX_HISTORY) redoStack.current.shift();
    setVersion((v) => v + 1);
    return prev;
  }, []);

  const redo = useCallback((): CostItem[] | null => {
    const next = redoStack.current.pop();
    if (!next) return null;
    undoStack.current.push(currentRef.current.map((c) => ({ ...c })));
    if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift();
    setVersion((v) => v + 1);
    return next;
  }, []);

  return {
    snapshot,
    undo,
    redo,
    canUndo: undoStack.current.length > 0,
    canRedo: redoStack.current.length > 0,
    // exposed only to keep re-renders working correctly
    _version: version,
  };
}
