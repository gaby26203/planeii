// Picker de foto de cover: permite subir un archivo o pegar una URL.
// Devuelve el `coverImage` final (string interno `storage:...` o URL http/https)
// vía `onChange`. No persiste — el caller decide dónde guardarlo.

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Upload, Link as LinkIcon, X, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ACCEPTED_COVER_TYPES,
  deleteTripCoverRef,
  isStoragePath,
  uploadTripCover,
} from "@/lib/trip-cover-storage";
import { useTripCoverUrl } from "@/hooks/use-trip-cover-url";

interface Props {
  /** Trip ID necesario para el path del storage. */
  tripId: string;
  /** Valor actual: `storage:...` o URL http/https, o null. */
  value: string | null | undefined;
  /** Se llama con el nuevo valor (o null para quitar). */
  onChange: (next: string | null) => void;
  /** Cuando true, muestra la UI compacta (para el header del viaje). */
  compact?: boolean;
}

export function TripCoverPicker({ tripId, value, onChange, compact = false }: Props) {
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrl = useTripCoverUrl(value);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      // Sube el nuevo archivo antes de borrar el viejo para no dejar al viaje sin foto si falla.
      const newRef = await uploadTripCover(file, tripId);
      const oldRef = value;
      onChange(newRef);
      if (isStoragePath(oldRef)) {
        deleteTripCoverRef(oldRef).catch(() => {});
      }
      toast.success("Foto de portada actualizada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo subir la imagen.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleUrlSubmit() {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    if (!/^https?:\/\//i.test(trimmed)) {
      toast.error("La URL debe empezar con http:// o https://");
      return;
    }
    const oldRef = value;
    onChange(trimmed);
    if (isStoragePath(oldRef)) {
      deleteTripCoverRef(oldRef).catch(() => {});
    }
    setUrlInput("");
    toast.success("Foto de portada actualizada");
  }

  function handleRemove() {
    const oldRef = value;
    onChange(null);
    if (isStoragePath(oldRef)) {
      deleteTripCoverRef(oldRef).catch(() => {});
    }
  }

  const preview = (
    <div className="relative aspect-[16/6] w-full overflow-hidden rounded-lg border border-border/60 bg-secondary/40">
      {previewUrl ? (
        <img src={previewUrl} alt="Preview" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
          <ImageIcon className="h-6 w-6" />
        </div>
      )}
      {value && (
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="absolute right-2 top-2 h-7 w-7 shadow"
          onClick={handleRemove}
          aria-label="Quitar foto"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
      {uploading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/70">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {preview}
      <Tabs defaultValue="upload">
        <TabsList className="grid w-full grid-cols-2 h-8">
          <TabsTrigger value="upload" className="text-xs gap-1.5">
            <Upload className="h-3 w-3" /> Subir
          </TabsTrigger>
          <TabsTrigger value="url" className="text-xs gap-1.5">
            <LinkIcon className="h-3 w-3" /> URL
          </TabsTrigger>
        </TabsList>
        <TabsContent value="upload" className="mt-2">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_COVER_TYPES.join(",")}
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full gap-2"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            Elegir archivo (JPG, PNG, WebP · máx 5 MB)
          </Button>
        </TabsContent>
        <TabsContent value="url" className="mt-2 space-y-2">
          <Label htmlFor={`cover-url-${tripId}`} className="text-xs text-muted-foreground">
            Pegá una URL pública de imagen
          </Label>
          <div className="flex gap-2">
            <Input
              id={`cover-url-${tripId}`}
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://…"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleUrlSubmit();
                }
              }}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleUrlSubmit}
              disabled={!urlInput.trim()}
            >
              Usar
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
