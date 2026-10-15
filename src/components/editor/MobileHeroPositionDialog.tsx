import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Move } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ImagePosition } from "@/data/trip";

const CENTER: ImagePosition = { x: 50, y: 50 };

function clamp(value: number) {
  return Math.min(100, Math.max(0, value));
}

export function MobileHeroPositionDialog({ open, imageSrc, value, onOpenChange, onSave }: {
  open: boolean;
  imageSrc: string;
  value?: ImagePosition;
  onOpenChange: (open: boolean) => void;
  onSave: (position: ImagePosition) => void;
}) {
  const [position, setPosition] = useState<ImagePosition>(value ?? CENTER);
  const dragRef = useRef<{ x: number; y: number; position: ImagePosition } | null>(null);

  useEffect(() => {
    if (open) setPosition(value ?? CENTER);
  }, [open, value]);

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, position };
  };

  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = dragRef.current;
    if (!start) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    setPosition({
      x: clamp(start.position.x - ((event.clientX - start.x) / bounds.width) * 100),
      y: clamp(start.position.y - ((event.clientY - start.y) / bounds.height) * 100),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ajustar portada móvil</DialogTitle>
          <DialogDescription>Arrastrá la foto hasta dejar visible la parte más importante.</DialogDescription>
        </DialogHeader>
        <div className="mx-auto w-full max-w-[270px]">
          <div
            className="relative aspect-[9/16] touch-none overflow-hidden rounded-[24px] border-8 border-foreground bg-muted cursor-grab active:cursor-grabbing"
            onPointerDown={startDrag}
            onPointerMove={moveDrag}
            onPointerUp={() => { dragRef.current = null; }}
            onPointerCancel={() => { dragRef.current = null; }}
            role="application"
            aria-label="Arrastrar foto para ajustar el encuadre móvil"
          >
            <img
              src={imageSrc}
              alt="Vista del encuadre móvil"
              className="pointer-events-none h-full w-full select-none object-cover"
              style={{ objectPosition: `${position.x}% ${position.y}%` }}
              draggable={false}
            />
            <div className="pointer-events-none absolute inset-0 grid place-items-center bg-foreground/10 opacity-0 transition-opacity hover:opacity-100">
              <span className="inline-flex items-center gap-2 bg-background/90 px-3 py-2 text-xs font-medium text-foreground shadow"><Move className="h-4 w-4" /> Arrastrá para mover</span>
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="ghost" onClick={() => setPosition(CENTER)}>Restablecer al centro</Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="button" onClick={() => { onSave(position); onOpenChange(false); }}>Guardar encuadre</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}