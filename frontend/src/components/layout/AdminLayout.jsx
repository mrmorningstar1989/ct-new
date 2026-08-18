import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, GraduationCap, Dumbbell,
  CalendarDays, ClipboardCheck, Receipt, Wallet,
  Bell, Settings, LogOut, Menu, X, Award, MessageCircle, Calendar,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/calendario", label: "Calendário", icon: Calendar },
  { to: "/admin/alunos", label: "Alunos", icon: Users },
  { to: "/admin/professores", label: "Professores", icon: GraduationCap },
  { to: "/admin/modalidades", label: "Modalidades", icon: Dumbbell },
  { to: "/admin/turmas", label: "Turmas", icon: CalendarDays },
  { to: "/admin/matriculas", label: "Matrículas", icon: ClipboardCheck },
  { to: "/admin/presenca", label: "Presença", icon: ClipboardCheck },
  { to: "/admin/graduacoes", label: "Graduações", icon: Award },
  { to: "/admin/planos", label: "Planos", icon: Wallet },
  { to: "/admin/financeiro", label: "Financeiro", icon: Receipt },
  { to: "/admin/notificacoes", label: "WhatsApp", icon: MessageCircle },
  { to: "/admin/avisos", label: "Avisos", icon: Bell },
  { to: "/admin/configuracoes", label: "Configurações", icon: Settings },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex bg-[#0A0A0A] text-white">
      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-[#0A0A0A] border-r border-zinc-800 flex flex-col transform transition-transform lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-16 px-6 flex items-center border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-red-600 flex items-center justify-center">
              <span className="font-heading text-white text-xl leading-none">W</span>
            </div>
            <div>
              <div className="font-heading text-xl leading-none tracking-tight" data-testid="brand-name">CT WARRIOR</div>
              <div className="text-[10px] uppercase tracking-widest text-zinc-500">Admin Panel</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setOpen(false)}
              data-testid={`nav-${label.toLowerCase()}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-red-600/10 text-red-500 border-l-2 border-red-600"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-900 border-l-2 border-transparent"
                }`
              }
            >
              <Icon className="w-4 h-4" strokeWidth={2} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-zinc-800">
          <div className="px-3 py-2 text-xs text-zinc-500 truncate">{user?.email}</div>
          <button
            onClick={handleLogout}
            data-testid="logout-button"
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-400 hover:text-red-500 hover:bg-zinc-900 transition-colors"
          >
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={() => setOpen(false)} />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-zinc-800 bg-[#0A0A0A] flex items-center px-4 lg:px-8 sticky top-0 z-20">
          <button className="lg:hidden text-white mr-3" onClick={() => setOpen(!open)} data-testid="menu-toggle">
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex-1" />
          <div className="text-sm text-zinc-400 hidden sm:block">
            Olá, <span className="text-white font-medium">{user?.name}</span>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
