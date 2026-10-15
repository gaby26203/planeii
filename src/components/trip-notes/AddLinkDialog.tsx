import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { createDialogShortcuts } from "@/hooks/use-submit-on-enter";

interface AddLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: { title: string; url: string; short_description: string | null }) => Promise<void>;
  initial?: { title: string; url: string; short_description: string | null };
}

export function AddLinkDialog({ open, onOpenChange, onSubmit, initial }: AddLinkDialogProps) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(initial?.title ?? "");
      setUrl(initial?.url ?? "");
      setDesc(initial?.short_description ?? "");
    }
  }, [open, initial]);

  const valid = title.trim() && /^https?:\/\//i.test(url.trim());

  const submit = async () => {
    if (!valid || saving) return;
    setSaving(true);
    try {
      await onSubmit({
        title: title.trim(),
        url: url.trim(),
        short_description: desc.trim() ? desc.trim() : null,
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
          canSubmit: !!valid && !saving,
        })}
      >
        <DialogHeader>
          <DialogTitle>{initial ? "Editar enlace" : "Agregar enlace"}</DialogTitle>
          <DialogDescription>
            Guardá una URL relacionada con el viaje (docs, reservas, referencias).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="al-title">Título</Label>
            <Input id="al-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Confirmación hotel" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="al-url">URL</Label>
            <Input id="al-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="al-desc">Descripción corta (opcional)</Label>
            <Textarea id="al-desc" rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!valid || saving} onClick={submit}>
            {initial ? "Guardar" : "Agregar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
