// Diálogo de archivos de una viajera: boletos, tarjetas de seguro, pasaporte.
// Sube al bucket privado y guarda la referencia en trip.data (logistics).

import { useRef, useState } from "react";
import { FileText, Loader2, Paperclip, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ACCEPTED_ATTACHMENT_TYPES,
  deleteEnrolleeFile,
  formatFileSize,
  getEnrolleeFileUrl,
  uploadEnrolleeFile,
} from "@/lib/enrollee-files-storage";
import { ATTACHMENT_KINDS, ATTACHMENT_KIND_LABELS } from "@/lib/enrollee-logistics";
import type { AttachmentKind, EnrolleeAttachment } from "@/lib/finance-types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  enrolleeId: string;
  enrolleeName: string;
  attachments: EnrolleeAttachment[];
  canEdit: boolean;
  onAdd: (a: Omit<EnrolleeAttachment, "id" | "uploadedAt">) => void;
  onRemove: (id: string) => void;
}

export function EnrolleeAttachments({
  open,
  onOpenChange,
  tripId,
  enrolleeId,
  enrolleeName,
  attachments,
  canEdit,
  onAdd,
  onRemove,
}: Props) {
  const [kind, setKind] = useState<AttachmentKind>("boleto_ida");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const meta = await uploadEnrolleeFile(file, tripId, enrolleeId);
      onAdd({
        kind,
        title: `${ATTACHMENT_KIND_LABELS[kind]} · ${file.name}`,
        storagePath: meta.storagePath,
        fileName: meta.fileName,
        mimeType: meta.mimeType,
        sizeBytes: meta.sizeBytes,
      });
      toast.success("Archivo agregado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo subir el archivo");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const openFile = async (a: EnrolleeAttachment) => {
    try {
      const url = await getEnrolleeFileUrl(a.storagePath);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("No se pudo abrir el archivo");
    }
  };

  const remove = async (a: EnrolleeAttachment) => {
    onRemove(a.id);
    await deleteEnrolleeFile(a.storagePath);
    toast.success("Archivo eliminado");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Paperclip className="h-4 w-4 text-primary" />
            Archivos de la viajera
          </DialogTitle>
          <DialogDescription>{enrolleeName}</DialogDescription>
        </DialogHeader>

        {canEdit && (
          <div className="flex flex-col gap-2 rounded-lg bg-secondary/60 p-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Tipo de archivo</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as AttachmentKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ATTACHMENT_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {ATTACHMENT_KIND_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => inputRef.current?.click()} disabled={busy}>
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Subir
            </Button>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept={ACCEPTED_ATTACHMENT_TYPES.join(",")}
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </div>
        )}

        <div className="space-y-1.5">
          {attachments.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Sin archivos todavía.
            </p>
          ) : (
            attachments.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2"
              >
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <button
                  type="button"
                  onClick={() => openFile(a)}
                  className="min-w-0 flex-1 truncate text-left text-sm hover:underline"
                  title={a.title}
                >
                  {a.title}
                </button>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatFileSize(a.sizeBytes)}
                </span>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => remove(a)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
