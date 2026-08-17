import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (user) {
    if (user.role === "admin") return <Navigate to="/admin" replace />;
    if (user.role === "teacher") return <Navigate to="/professor" replace />;
    return <Navigate to="/aluno" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await login(email, password);
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      toast.error(res.error);
      return;
    }
    toast.success("Bem-vindo!");
    if (res.user.role === "admin") navigate("/admin");
    else if (res.user.role === "teacher") navigate("/professor");
    else navigate("/aluno");
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-[#0A0A0A] text-white">
      <div className="hidden lg:flex relative bg-black">
        <img
          src="https://images.unsplash.com/photo-1708723636238-e4c384d5d428?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NzF8MHwxfHNlYXJjaHwyfHxtYXJ0aWFsJTIwYXJ0cyUyMGd5bXxlbnwwfHx8fDE3ODcwMDM1ODZ8MA&ixlib=rb-4.1.0&q=85"
          alt="Academia"
          className="absolute inset-0 w-full h-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        <div className="relative z-10 flex flex-col justify-end p-12">
          <div className="w-12 h-12 bg-red-600 flex items-center justify-center mb-6">
            <span className="font-heading text-white text-3xl leading-none">W</span>
          </div>
          <h1 className="font-heading text-6xl leading-none mb-4">
            FORJAMOS<br />CAMPEÕES.
          </h1>
          <p className="text-zinc-300 max-w-md">
            Plataforma de gestão do CT Warrior. Alunos, professores, faixas, presença e financeiro em um só lugar.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 lg:p-16">
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6" data-testid="login-form">
          <div>
            <div className="flex items-center gap-3 lg:hidden mb-8">
              <div className="w-10 h-10 bg-red-600 flex items-center justify-center">
                <span className="font-heading text-white text-2xl leading-none">W</span>
              </div>
              <div className="font-heading text-2xl">CT WARRIOR</div>
            </div>
            <div className="text-xs uppercase tracking-widest text-red-500 mb-2">Acesso Restrito</div>
            <h2 className="font-heading text-4xl mb-2">Entrar</h2>
            <p className="text-sm text-zinc-400">Use seu email e senha para acessar o painel</p>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-xs uppercase tracking-wider text-zinc-400">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                data-testid="login-email-input"
                className="mt-2 bg-transparent border-zinc-800 focus:border-red-600 focus:ring-red-600 rounded-none h-11"
                placeholder="voce@email.com"
              />
            </div>
            <div>
              <Label htmlFor="password" className="text-xs uppercase tracking-wider text-zinc-400">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                data-testid="login-password-input"
                className="mt-2 bg-transparent border-zinc-800 focus:border-red-600 focus:ring-red-600 rounded-none h-11"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && <div className="text-sm text-red-500" data-testid="login-error">{error}</div>}

          <Button
            type="submit"
            disabled={loading}
            data-testid="login-submit-button"
            className="w-full h-11 bg-red-600 hover:bg-red-700 text-white rounded-none font-heading text-lg tracking-wider"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "ENTRAR"}
          </Button>

          <div className="pt-4 text-xs text-zinc-500 border-t border-zinc-900">
            Dica: use as credenciais de administrador definidas no ambiente para primeiro acesso.
          </div>
        </form>
      </div>
    </div>
  );
}
