import { useEffect, useRef } from "react";

/** Selectores de contenido flotante (Radix) que NO cuentan como "afuera". */
const FLOATING_SELECTORS = [
  "[data-radix-popper-content-wrapper]",
  "[data-radix-portal]",
  "[role='dialog']",
  "[role='listbox']",
  "[role='menu']",
  "[data-sonner-toaster]",
].join(",");

function isFloating(el: Element | null): boolean {
  return !!el?.closest(FLOATING_SELECTORS);
}

/**
 * Confirma una edición inline cuando el usuario hace click fuera de ella.
 *
 * El contenedor en edición debe llevar `data-inline-editing="<key>"`. Mientras
 * `activeKey` no sea null, cualquier pointerdown fuera de ese contenedor (y
 * fuera de menús/popovers flotantes de Radix) dispara `onOutside()`.
 */
export function useCommitOnClickOutside(
  activeKey: string | null,
  onOutside: () => void,
): void {
  const handlerRef = useRef(onOutside);
  handlerRef.current = onOutside;

  useEffect(() => {
    if (!activeKey || typeof document === "undefined") return;

    const onPointerDown = (event: PointerEvent | MouseEvent) => {
      const target = event.target as Element | null;
      if (!target || !target.isConnected) return;
      if (isFloating(target)) return;
      const container = target.closest("[data-inline-editing]");
      if (container?.getAttribute("data-inline-editing") === activeKey) return;
      handlerRef.current();
    };

    // Se registra en el próximo tick para no capturar el mismo click que
    // abrió la edición.
    const id = setTimeout(() => {
      document.addEventListener("pointerdown", onPointerDown, true);
    }, 0);

    return () => {
      clearTimeout(id);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [activeKey]);
}
