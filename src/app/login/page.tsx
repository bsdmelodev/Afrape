import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-foreground">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-4 py-10">
        <div className="mb-10 text-center text-white">
          <p className="mb-2 text-sm uppercase tracking-[0.3em] text-slate-300">
            Gestão Escolar
          </p>
          <h1 className="text-4xl font-semibold">Painel Administrativo</h1>
          <p className="text-slate-300">
            Acesse com seu e-mail institucional para continuar
          </p>
        </div>

        <Card className="w-full max-w-xl shadow-2xl border-slate-100/50">
          <CardHeader>
            <CardTitle>Entrar</CardTitle>
            <CardDescription>
              Use seu e-mail e senha cadastrados pelo administrador
            </CardDescription>
          </CardHeader>
          <Separator />
          <CardContent className="pt-6">
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
