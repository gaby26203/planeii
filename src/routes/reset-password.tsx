import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock, Loader2, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { AuthShell } from "@/components/AuthShell";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

type LinkStatus = "checking" | "ready" | "invalid";

/** Supabase devuelve los errores del enlace (vencido, ya usado) en el hash o en la query. */
function linkErrorFromUrl(): string | null {
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return hash.get("error_code") ?? query.get("error_code") ?? hash.get("error") ?? query.get("error");
}

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<LinkStatus>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const markInvalid = () => setStatus((s) => (s === "checking" ? "invalid" : s));
    if (linkErrorFromUrl()) {
      setStatus("invalid");
      return;
    }
    // Supabase procesa el enlace al iniciar el cliente y dispara PASSWORD_RECOVERY. getSession
    // espera ese proceso: sin sesión al terminar, el enlace venció, ya se usó o no hay enlace.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setStatus("ready");
    });
    supabase.auth
      .getSession()
      .then(({ data }) => (data.session ? setStatus("ready") : markInvalid()))
      .catch(markInvalid);
    const timer = setTimeout(markInvalid, 10_000);
    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  async function handleResend(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo enviar el enlace.");
    } finally {
      setSending(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Mínimo 6 caracteres");
      return;
    }
    if (password !== confirm) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Contraseña actualizada");
      navigate({ to: "/", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell photo="viajera-cascada">
      <Card>
        <CardContent className="p-6">
          <div className="mb-6 text-center">
            <h1 className="font-display text-xl font-semibold">Nueva contraseña</h1>
            <p className="text-xs text-muted-foreground mt-1">
              {status === "ready"
                ? "Elige una nueva contraseña para tu cuenta"
                : status === "invalid"
                  ? "Este enlace de recuperación no es válido o ya venció."
                  : "Validando el enlace de recuperación…"}
            </p>
          </div>

          {status === "invalid" ? (
            sent ? (
              <p className="py-2 text-center text-sm text-foreground" role="status">
                Te enviamos un enlace nuevo a <span className="font-medium">{email.trim()}</span>.
                Revisa tu correo.
              </p>
            ) : (
              <form onSubmit={handleResend} className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Escribe tu correo y te enviamos uno nuevo.
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="reset-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="reset-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-9"
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={sending}>
                  {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Enviar un enlace nuevo
                </Button>
              </form>
            )
          ) : status === "ready" ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="password">Nueva contraseña</Label>
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

              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirmar contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirm"
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="pl-9"
                    minLength={6}
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar contraseña
              </Button>
            </form>
          ) : (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          <div className="mt-4 text-center">
            <Link to="/auth" className="text-xs text-muted-foreground hover:text-foreground">
              Volver a ingresar
            </Link>
          </div>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
