import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import BeltDisplay from "@/components/BeltDisplay";
import { Calendar, TrendingUp, Award, Bell, ChevronRight } from "lucide-react";

const brl = (v) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function StudentDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [belts, setBelts] = useState([]);
  const [announcements, setAnnouncements] = useState([]);

  useEffect(() => {
    (async () => {
      const dash = await api.get("/dashboard/student");
      setData(dash.data);
      const ann = await api.get("/announcements");
      setAnnouncements(ann.data.slice(0, 3));

      // Load current belt per modality
      if (dash.data.student && dash.data.enrollments?.length) {
        const results = [];
        for (const e of dash.data.enrollments) {
          if (e.modality_id) {
            try {
              const b = await api.get(`/graduations/student/${dash.data.student.id}/current/${e.modality_id}`);
              if (b.data) results.push({ ...b.data, modality: e.modality });
            } catch {}
          }
        }
        setBelts(results);
      }
    })();
  }, []);

  if (!data || !data.student) {
    return <div className="p-6 text-zinc-400">Carregando seu perfil...</div>;
  }

  const s = data.student;
  const att = data.attendance;
  const inv = data.next_invoice;

  return (
    <div className="p-5 space-y-6">
      <div>
        <div className="text-xs uppercase tracking-widest text-red-500">Olá,</div>
        <h1 className="font-heading text-4xl leading-none mt-1">{s.full_name.split(" ")[0].toUpperCase()}.</h1>
        <div className="text-xs text-zinc-500 font-mono mt-1">Matrícula {s.matricula}</div>
      </div>

      {/* Belts */}
      {belts.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Sua graduação</div>
          <div className="space-y-4">
            {belts.map((b, i) => (
              <div key={i} className="card-flat p-5" data-testid={`student-belt-${i}`}>
                <div className="text-xs uppercase tracking-widest text-red-500 mb-3">{b.modality?.name}</div>
                <BeltDisplay color={b.belt_color} name={b.belt_name} stripes={b.stripes} size="lg" />
                <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <div className="text-zinc-500 uppercase tracking-widest">Desde</div>
                    <div className="text-white font-mono mt-1">{new Date(b.graduation_date).toLocaleDateString("pt-BR")}</div>
                  </div>
                  <div>
                    <div className="text-zinc-500 uppercase tracking-widest">Tempo na faixa</div>
                    <div className="text-white font-mono mt-1">{b.days_on_belt} dias</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Attendance */}
      <div className="card-flat p-5" data-testid="student-attendance-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-red-500" />
            <div className="text-[10px] uppercase tracking-widest text-zinc-500">Frequência</div>
          </div>
          <div className="font-heading text-3xl">{att.frequency_pct}%</div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Presenças" value={att.counts.present} color="text-emerald-500" />
          <Stat label="Faltas" value={att.counts.absent} color="text-red-500" />
          <Stat label="Total aulas" value={att.total} color="text-white" />
        </div>
      </div>

      {/* Enrollments */}
      {data.enrollments?.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Minhas turmas</div>
          {data.enrollments.map(e => (
            <div key={e.id} className="card-flat p-5 mb-3" data-testid={`student-enrollment-${e.id}`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-heading text-xl">{e.modality?.name}</div>
                  {e.class && (
                    <div className="text-sm text-zinc-400 mt-1">
                      {e.class.name} · <span className="font-mono">{e.class.start_time} - {e.class.end_time}</span>
                    </div>
                  )}
                </div>
                {e.plan && <div className="text-xs text-red-500 font-mono">{brl(e.plan.value)}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Next invoice */}
      {inv && (
        <Link to="/aluno/financeiro" className="block card-flat p-5" data-testid="student-next-invoice">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Próximo vencimento</div>
              <div className="font-heading text-2xl">{brl(inv.final_value || inv.value)}</div>
              <div className="text-xs text-zinc-500 font-mono mt-1">
                {new Date(inv.due_date).toLocaleDateString("pt-BR")} · {inv.competency}
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-zinc-500" />
          </div>
        </Link>
      )}

      {/* Announcements */}
      {announcements.length > 0 && (
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-zinc-500 mb-3">
            <Bell className="w-3 h-3" /> Avisos
          </div>
          <div className="space-y-3">
            {announcements.map(a => (
              <div key={a.id} className="card-flat p-4">
                <div className="font-heading text-lg">{a.title}</div>
                <div className="text-sm text-zinc-400 mt-1">{a.message}</div>
                <div className="text-[10px] text-zinc-600 mt-2 font-mono">{new Date(a.created_at).toLocaleDateString("pt-BR")}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-zinc-500">{label}</div>
      <div className={`font-heading text-2xl mt-1 ${color}`}>{value}</div>
    </div>
  );
}
