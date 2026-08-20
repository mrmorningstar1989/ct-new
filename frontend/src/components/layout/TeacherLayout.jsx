import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, ClipboardCheck, LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const NAV = [
  { to: "/professor", label: "Início", icon: LayoutDashboard, end: true },
  { to: "/professor/turmas", label: "Minhas Turmas", icon: Users },
  { to: "/professor/chamada", label: "Chamada", icon: ClipboardCheck },
];

export default function TeacherLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex bg-[#0A0A0A] text-white">
      <aside className="w-60 border-r border-zinc-800 flex flex-col">
        <div className="h-16 px-5 flex items-center border-b border-zinc-800">
          <img src="/brand/zenkaios-logo.png" alt="ZenkaiOS" className="h-10 w-auto mr-3" />
          <div>
            <div className="font-heading text-lg leading-none">ZENKAIOS</div>
            <div className="text-[10px] uppercase tracking-widest text-zinc-500">Professor</div>
          </div>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-0.5">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              data-testid={`teacher-nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-red-600/10 text-red-500 border-l-2 border-red-600"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-900 border-l-2 border-transparent"
                }`
              }
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-zinc-800">
          <div className="px-3 py-2 text-xs text-zinc-500 truncate">{user?.email}</div>
          <button
            onClick={handleLogout}
            data-testid="logout-button"
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-400 hover:text-red-500 hover:bg-zinc-900"
          >
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </aside>
      <main className="flex-1 p-4 lg:p-8 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
