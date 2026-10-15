import { useState, useRef } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";
import { createDialogShortcuts } from "@/hooks/use-submit-on-enter";

const MAX_BYTES = 25 * 1024 * 1024; // 25MB

interface UploadDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  onUploaded: (values: {
    title: string;
    short_description: string | null;
    storage_path: string;
    file_name: string;
    mime_type: string | null;
    size_bytes: number;
  }) => Promise<void>;
}

export function UploadDocumentDialog({ open, onOpenChange, tripId, onUploaded }: UploadDocumentDialogProps) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setTitle(""); setDesc(""); setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleFile = (f: File | null) => {
    if (!f) return setFile(null);
    if (f.size > MAX_BYTES) {
      toast.error("El archivo supera los 25MB.");
      return;
    }
    setFile(f);
    if (!title.trim()) setTitle(f.name.replace(/\.[^.]+$/, ""));
  };

  const submit = async () => {
    if (!file || !title.trim() || uploading) return;
    setUploading(true);
    try {
      const ext = file.name.includes(".") ? file.name.split(".").pop() : "";
      const path = `${tripId}/${crypto.randomUUID()}${ext ? "." + ext : ""}`;
      const { error: upErr } = await supabase.storage
        .from("trip-notes-docs")
        .upload(path, file, { contentType: file.type || undefined, upsert: false });
      if (upErr) throw upErr;
      await onUploaded({
        title: title.trim(),
        short_description: desc.trim() ? desc.trim() : null,
        storage_path: path,
        file_name: file.name,
        mime_type: file.type || null,
        size_bytes: file.size,
      });
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo subir el archivo.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent
        onKeyDown={createDialogShortcuts({
          onSubmit: submit,
          onCancel: () => { reset(); onOpenChange(false); },
          canSubmit: !!file && !!title.trim() && !uploading,
        })}
      >
        <DialogHeader>
          <DialogTitle>Subir doc</DialogTitle>
          <DialogDescription>Documentos, imágenes o videos. Máximo 25MB por archivo.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Archivo</Label>
            <div className="flex items-center gap-2">
              <Input
                ref={inputRef}
                type="file"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
            </div>
            {file && (
              <p className="text-xs text-muted-foreground">
                {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ud-title">Título</Label>
            <Input id="ud-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Cotización hotel" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ud-desc">Descripción corta (opcional)</Label>
            <Textarea id="ud-desc" rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!file || !title.trim() || uploading} onClick={submit}>
            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Subir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
