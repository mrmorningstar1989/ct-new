import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Users, TrendingUp, AlertTriangle, DollarSign, Trophy, GraduationCap, CalendarDays, UserCheck } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line, CartesianGrid,
} from "recharts";

const brl = (v) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Kpi({ label, value, sub, icon: Icon, tone = "default", testId }) {
  const tones = {
    default: "text-white",
    danger: "text-red-500",
    warning: "text-yellow-500",
    success: "text-emerald-500",
  };
  return (
    <div className="card-flat p-5 flex flex-col justify-between min-h-[130px]" data-testid={testId}>
      <div className="flex items-start justify-between">
        <div className="text-[10px] uppercase tracking-widest text-zinc-500">{label}</div>
        {Icon && <Icon className="w-4 h-4 text-zinc-600" />}
      </div>
      <div>
        <div className={`font-heading text-4xl leading-none ${tones[tone]}`}>{value}</div>
        {sub && <div className="text-xs text-zinc-500 mt-1">{sub}</div>}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/dashboard/admin").then((r) => setData(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-zinc-400">Carregando...</div>;
  if (!data) return null;
  const k = data.kpis;

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-red-500 mb-1">Painel de comando</div>
          <h1 className="font-heading text-4xl lg:text-5xl leading-none">DASHBOARD</h1>
        </div>
        <div className="text-xs text-zinc-500 font-mono">
          {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="Alunos ativos" value={k.active_students} sub={`${k.new_this_month} novos este mês`} icon={Users} testId="kpi-active-students" />
        <Kpi label="Presentes hoje" value={k.present_today} icon={UserCheck} tone="success" testId="kpi-present-today" />
        <Kpi label="Professores" value={k.total_teachers} icon={GraduationCap} testId="kpi-teachers" />
        <Kpi label="Turmas" value={k.total_classes} icon={CalendarDays} testId="kpi-classes" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="Receita recebida" value={brl(k.revenue_received)} sub="Mês vigente" icon={DollarSign} tone="success" testId="kpi-revenue-received" />
        <Kpi label="A receber" value={brl(k.revenue_pending)} icon={TrendingUp} tone="warning" testId="kpi-revenue-pending" />
        <Kpi label="Inadimplência" value={brl(k.overdue_total)} sub={`${k.overdue_count} títulos`} icon={AlertTriangle} tone="danger" testId="kpi-overdue" />
        <Kpi label="Modalidades" value={k.total_modalities} icon={Trophy} testId="kpi-modalities" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card-flat p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-heading text-xl tracking-wide">RECEITA · ÚLTIMOS 6 MESES</h3>
            <span className="text-xs text-zinc-500 font-mono">BRL</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.revenue_series}>
                <CartesianGrid stroke="#27272A" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" stroke="#71717A" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#71717A" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: "#121212", border: "1px solid #27272A", borderRadius: 0 }}
                  labelStyle={{ color: "#a1a1aa" }}
                  formatter={(v) => brl(v)}
                />
                <Line type="monotone" dataKey="value" stroke="#E50914" strokeWidth={2} dot={{ fill: "#E50914", r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card-flat p-6">
          <h3 className="font-heading text-xl tracking-wide mb-6">ALUNOS POR MODALIDADE</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.students_by_modality} layout="vertical">
                <XAxis type="number" stroke="#71717A" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis dataKey="name" type="category" stroke="#71717A" fontSize={11} width={90} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: "#121212", border: "1px solid #27272A", borderRadius: 0 }}
                  labelStyle={{ color: "#a1a1aa" }}
                />
                <Bar dataKey="count" fill="#E50914" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
