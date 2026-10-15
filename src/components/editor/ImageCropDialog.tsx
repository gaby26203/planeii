import { useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";

async function cropToBlob(src: string, area: Area): Promise<Blob> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
  const maxWidth = 1800;
  const scale = Math.min(1, maxWidth / area.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(area.width * scale);
  canvas.height = Math.round(area.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas no disponible");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((value) => resolve(value), "image/jpeg", 0.82));
  if (!blob) throw new Error("No se pudo procesar la imagen");
  return blob;
}

export function ImageCropDialog({ src, aspect, title, onCancel, onConfirm }: {
  src: string | null;
  aspect: number;
  title: string;
  onCancel: () => void;
  onConfirm: (image: Blob) => void;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    if (!src || !area) return;
    setBusy(true);
    try {
      onConfirm(await cropToBlob(src, area));
      setZoom(1);
      setCrop({ x: 0, y: 0 });
    } catch (error) {
      console.error("No se pudo recortar la foto", error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!src} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Recortar imagen · {title}</DialogTitle></DialogHeader>
        <div className="relative h-[55vh] min-h-[280px] w-full bg-muted">
          {src && (
            <Cropper image={src} crop={crop} zoom={zoom} aspect={aspect} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={(_, pixels) => setArea(pixels)} />
          )}
        </div>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Arrastra para encuadrar y usa el control para acercar.</p>
          <Slider value={[zoom]} min={1} max={3} step={0.05} onValueChange={([value]) => setZoom(value ?? 1)} aria-label="Zoom" />
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
          <Button type="button" onClick={confirm} disabled={busy || !area}>{busy ? "Procesando…" : "Usar imagen"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
