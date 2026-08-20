import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Home, IdCard, Receipt, User, LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const NAV = [
  { to: "/aluno", label: "Início", icon: Home, end: true },
  { to: "/aluno/carteirinha", label: "Carteirinha", icon: IdCard },
  { to: "/aluno/financeiro", label: "Financeiro", icon: Receipt },
  { to: "/aluno/perfil", label: "Perfil", icon: User },
];

export default function StudentLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col">
      <header className="h-16 border-b border-zinc-800 flex items-center px-5">
        <div className="flex items-center gap-3">
          <img src="/brand/zenkaios-logo.png" alt="ZenkaiOS" className="h-10 w-auto" />
          <div>
            <div className="font-heading text-lg leading-none">ZENKAIOS</div>
            <div className="text-[10px] uppercase tracking-widest text-zinc-500">Área do Aluno</div>
          </div>
        </div>
        <div className="flex-1" />
        <button
          onClick={handleLogout}
          data-testid="logout-button"
          className="text-zinc-400 hover:text-red-500"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      <main className="flex-1 pb-24">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 inset-x-0 border-t border-zinc-800 bg-[#0A0A0A] z-30">
        <div className="grid grid-cols-4 max-w-xl mx-auto">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              data-testid={`student-nav-${label.toLowerCase()}`}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-3 text-xs transition-colors ${
                  isActive ? "text-red-500" : "text-zinc-500 hover:text-white"
                }`
              }
            >
              <Icon className="w-5 h-5" />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
