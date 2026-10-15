import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Compass, Mail, Lock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { invite?: string; email?: string } => ({
    invite: typeof search.invite === "string" && search.invite ? search.invite : undefined,
    email: typeof search.email === "string" && search.email ? search.email : undefined,
  }),
  component: AuthPage,
});

/** Token de invitación: prioridad al parámetro de URL, respaldo en sessionStorage. */
function readInviteToken(fromUrl?: string): string | null {
  if (fromUrl) return fromUrl;
  try {
    return sessionStorage.getItem("pending_invite_token");
  } catch {
    return null;
  }
}

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">(search.invite ? "signup" : "signin");
  const [email, setEmail] = useState(search.email ?? "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);

  const inviteToken = readInviteToken(search.invite);

  // Persistimos el token del enlace en sessionStorage por si el usuario navega
  // dentro de la app antes de terminar el registro.
  useEffect(() => {
    if (search.invite) {
      try {
        sessionStorage.setItem("pending_invite_token", search.invite);
      } catch {}
    }
  }, [search.invite]);

  /** URL de retorno (email de confirmación / OAuth) que conserva la invitación. */
  function returnUrl() {
    const base = `${window.location.origin}/auth`;
    const params = new URLSearchParams();
    if (inviteToken) params.set("invite", inviteToken);
    if (email) params.set("email", email);
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  }

  // Si el usuario llegó desde un link de invitación, retomamos ese flujo tras el login.
  function redirectAfterAuth() {
    const token = readInviteToken(search.invite);
    if (token) {
      navigate({ to: "/invitacion/$token", params: { token }, replace: true });
    } else {
      navigate({ to: "/", replace: true });
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) redirectAfterAuth();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: returnUrl() },
        });
        if (error) throw error;
        // Con confirmación de email activa, signUp NO devuelve sesión.
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          redirectAfterAuth();
        } else {
          setAwaitingConfirm(true);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        redirectAfterAuth();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error de autenticación");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    try {
      // Supabase redirige a Google y vuelve a /auth con la sesión en la URL;
      // el cliente la detecta al iniciar y el efecto de arriba completa la redirección.
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: returnUrl() },
      });
      if (error) toast.error(error.message || "No se pudo iniciar sesión con Google");
    } finally {
      setLoading(false);
    }
  }

  async function handleReset() {
    if (!email) {
      toast.error("Ingresá tu email primero");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(error.message);
    else toast.success("Te enviamos un email para restablecer la contraseña.");
  }

  if (awaitingConfirm) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md">
          <Card>
            <CardContent className="p-6 text-center space-y-3">
              <Mail className="h-8 w-8 mx-auto text-primary" />
              <h1 className="font-display text-xl font-semibold">Confirmá tu correo</h1>
              <p className="text-sm text-muted-foreground">
                Te enviamos un enlace a <b>{email}</b>. Al abrirlo volvés acá
                {inviteToken ? " y tu acceso al viaje se activa automáticamente." : "."}
              </p>
              <p className="text-xs text-muted-foreground">
                Podés abrir el enlace en cualquier dispositivo: la invitación se conserva.
              </p>
              <Button variant="outline" onClick={() => setAwaitingConfirm(false)}>
                Volver
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2.5 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <Compass className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-2xl font-semibold tracking-tight">PLANEI OS</span>
        </Link>

        <Card>
          <CardContent className="p-6">
            <div className="mb-6 text-center">
              <h1 className="font-display text-xl font-semibold">
                {mode === "signup" ? "Crear cuenta" : "Ingresar"}
              </h1>
              <p className="text-xs text-muted-foreground mt-1">
                {inviteToken
                  ? "Usá el correo al que te enviaron la invitación: tu acceso al viaje se activa al entrar."
                  : mode === "signup"
                    ? "Registrate con el email al que fue enviada la invitación"
                    : "Acceso restringido al equipo organizador"}
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full mb-4"
              onClick={handleGoogle}
              disabled={loading}
            >
              Continuar con Google
            </Button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-card px-2 text-muted-foreground">o con email</span>
              </div>
            </div>

            <form onSubmit={handleEmail} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9"
                    minLength={6}
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === "signup" ? "Crear cuenta" : "Ingresar"}
              </Button>

              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {mode === "signup" ? "¿Ya tenés cuenta? Ingresar" : "¿Sos nueva? Crear cuenta"}
                </button>
                {mode === "signin" && (
                  <button
                    type="button"
                    onClick={handleReset}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Olvidé mi contraseña
                  </button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground text-center mt-4">
          {inviteToken
            ? "Tu invitación ya está guardada: se activa sola en cuanto entres con el correo invitado."
            : "El acceso a los viajes lo habilita la administradora con una invitación."}
        </p>
      </div>
    </div>
  );
}
