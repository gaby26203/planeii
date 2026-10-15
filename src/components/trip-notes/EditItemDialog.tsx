import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { createDialogShortcuts } from "@/hooks/use-submit-on-enter";

export interface EditItemMetaValues {
  title: string;
  short_description: string | null;
}

interface EditItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  initial: EditItemMetaValues;
  onSubmit: (values: EditItemMetaValues) => Promise<void> | void;
  submitLabel?: string;
}

export function EditItemDialog({
  open,
  onOpenChange,
  title,
  initial,
  onSubmit,
  submitLabel = "Guardar",
}: EditItemDialogProps) {
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) setValues(initial);
  }, [open, initial]);

  const submit = async () => {
    if (!values.title.trim() || saving) return;
    setSaving(true);
    try {
      await onSubmit({
        title: values.title.trim(),
        short_description:
          values.short_description?.trim() ? values.short_description.trim() : null,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onKeyDown={createDialogShortcuts({
          onSubmit: submit,
          onCancel: () => onOpenChange(false),
          canSubmit: !!values.title.trim() && !saving,
        })}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Actualizá el título o la descripción corta del elemento.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ei-title">Título</Label>
            <Input
              id="ei-title"
              value={values.title}
              onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
              placeholder="Ej: Reservar transporte al aeropuerto"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ei-desc">Descripción corta (opcional)</Label>
            <Textarea
              id="ei-desc"
              rows={3}
              value={values.short_description ?? ""}
              onChange={(e) =>
                setValues((v) => ({ ...v, short_description: e.target.value }))
              }
              placeholder="Un resumen breve para reconocer el elemento en la lista"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={!values.title.trim() || saving} onClick={submit}>
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
