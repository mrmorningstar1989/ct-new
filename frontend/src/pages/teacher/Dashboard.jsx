import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Users, ClipboardCheck, CalendarDays } from "lucide-react";

export default function TeacherDashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/dashboard/teacher").then(r => setData(r.data));
  }, []);

  if (!data) return <div className="text-zinc-400">Carregando...</div>;

  return (
    <div className="space-y-8">
      <div>
        <div className="text-xs uppercase tracking-widest text-red-500 mb-1">Painel do Professor</div>
        <h1 className="font-heading text-4xl leading-none">BEM-VINDO, MESTRE.</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="card-flat p-5">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500">Minhas Turmas</div>
          <div className="font-heading text-4xl mt-2">{data.total_classes}</div>
        </div>
        <div className="card-flat p-5">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500">Alunos Ativos</div>
          <div className="font-heading text-4xl mt-2">{data.total_students}</div>
        </div>
        <div className="card-flat p-5">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500">Chamada</div>
          <Link to="/professor/chamada" className="mt-4 inline-flex items-center gap-2 text-red-500 hover:text-red-400">
            <ClipboardCheck className="w-5 h-5" /> Iniciar
          </Link>
        </div>
      </div>

      <div>
        <h3 className="font-heading text-xl tracking-wide mb-4">MINHAS TURMAS</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.classes?.length === 0 && <div className="text-zinc-500 col-span-full">Nenhuma turma atribuída</div>}
          {data.classes?.map(c => (
            <div key={c.id} className="card-flat p-5" data-testid={`teacher-class-${c.id}`}>
              <div className="font-heading text-xl">{c.name}</div>
              <div className="text-xs text-zinc-500 font-mono mt-2">{c.start_time} - {c.end_time}</div>
              <div className="flex items-center gap-2 mt-3 text-sm text-zinc-400">
                <Users className="w-4 h-4" /> {c.student_count} alunos
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
