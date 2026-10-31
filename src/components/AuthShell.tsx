// Marco de las pantallas de acceso (ingreso, nueva contraseña, invitación): foto de marca
// al costado en escritorio y como franja superior en el teléfono, con el formulario al lado.

import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Compass } from "lucide-react";
import { brandPhoto, type BrandPhotoId } from "@/lib/brand-photos";

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
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
        <p className="absolute inset-x-6 bottom-5 max-w-md font-display text-xl font-semibold leading-tight text-white sm:text-2xl lg:inset-x-12 lg:bottom-12 lg:text-4xl">
          Organiza y vende tus viajes grupales desde un solo lugar.
        </p>
      </aside>

      <main className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-8 flex items-center justify-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <Compass className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-2xl font-semibold tracking-tight">PLANEI OS</span>
          </Link>
          {children}
        </div>
      </main>
    </div>
  );
}
