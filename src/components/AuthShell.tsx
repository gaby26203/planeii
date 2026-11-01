// Marco de las pantallas de acceso (ingreso, nueva contraseña, invitación): foto de marca
// al costado en escritorio y como franja superior en el teléfono, con el formulario al lado.
// La frase de marca solo va sobre la foto en escritorio, encima de un velo oscuro de alto fijo
// que garantiza contraste con cualquier foto; en el teléfono la franja es muy baja para texto,
// así que la frase pasa bajo el logo, sobre el fondo liso.

import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Compass } from "lucide-react";
import { brandPhoto, type BrandPhotoId } from "@/lib/brand-photos";

const TAGLINE = "Organiza y vende tus viajes grupales desde un solo lugar.";

interface Props {
  photo: BrandPhotoId;
  children: ReactNode;
}

export function AuthShell({ photo, children }: Props) {
  const p = brandPhoto(photo);
  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-2">
      <aside className="relative h-40 overflow-hidden sm:h-56 lg:h-auto lg:min-h-screen">
        <img
          src={p.src}
          alt={p.alt}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: p.position }}
        />
        <div className="absolute inset-x-0 bottom-0 hidden h-[28rem] bg-gradient-to-t from-black/85 via-black/65 via-55% to-transparent lg:block" />
        <p className="absolute inset-x-12 bottom-12 hidden max-w-md font-display text-4xl font-semibold leading-tight text-white lg:block">
          {TAGLINE}
        </p>
      </aside>

      <main className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-3 flex items-center justify-center gap-2.5 lg:mb-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <Compass className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-2xl font-semibold tracking-tight">PLANEI OS</span>
          </Link>
          <p className="mx-auto mb-8 max-w-xs text-balance text-center text-sm text-muted-foreground lg:hidden">
            {TAGLINE}
          </p>
          {children}
        </div>
      </main>
    </div>
  );
}
