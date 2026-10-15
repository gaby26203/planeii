import type React from "react";

/**
 * Devuelve un handler onKeyDown para usar en <DialogContent> (o wrappers de
 * formularios inline) que dispara `onSubmit` con Enter y `onCancel` con Escape.
 *
 * - Ignora Enter dentro de <textarea>, contenteditable, o cuando ya fue
 *   preventDefault (ej. Radix Select abierto, combobox, botones).
 * - Shift+Enter / Alt+Enter / Ctrl+Enter no disparan submit (para salto de
 *   línea en editores).
 * - Radix Dialog ya cierra con Escape via onEscapeKeyDown; el handler de Esc
 *   aquí es opcional y sólo se llama si se pasa.
 */
export function createDialogShortcuts(opts: {
  onSubmit?: () => void;
  onCancel?: () => void;
  canSubmit?: boolean;
}) {
  const { onSubmit, onCancel, canSubmit = true } = opts;
  return (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.defaultPrevented) return;
    const target = e.target as HTMLElement | null;
    const tag = target?.tagName;
    const isTextarea = tag === "TEXTAREA";
    const isEditable = !!target?.isContentEditable;
    const isButton = tag === "BUTTON";

    if (e.key === "Enter" && !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey) {
      if (isTextarea || isEditable || isButton) return;
      // Radix Select / combobox marca role=combobox; deja que maneje Enter
      const role = target?.getAttribute("role");
      if (role === "combobox" || role === "listbox" || role === "option") return;
      if (!onSubmit || !canSubmit) return;
      e.preventDefault();
      onSubmit();
      return;
    }

    if (e.key === "Escape" && onCancel) {
      // No preventDefault: dejamos que Radix también cierre si aplica.
      onCancel();
    }
  };
}
