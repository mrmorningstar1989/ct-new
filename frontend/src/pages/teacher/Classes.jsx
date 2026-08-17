import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Users, Clock } from "lucide-react";

const WEEKDAYS = { mon: "Seg", tue: "Ter", wed: "Qua", thu: "Qui", fri: "Sex", sat: "Sáb", sun: "Dom" };

export default function TeacherClasses() {
  const [classes, setClasses] = useState([]);
  const [studentsByClass, setStudentsByClass] = useState({});

  useEffect(() => {
    (async () => {
      const { data } = await api.get("/classes");
      setClasses(data);
      const byClass = {};
      for (const c of data) {
        const r = await api.get(`/classes/${c.id}/students`);
        byClass[c.id] = r.data;
      }
      setStudentsByClass(byClass);
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-widest text-red-500 mb-1">Programação</div>
        <h1 className="font-heading text-4xl leading-none">MINHAS TURMAS</h1>
      </div>

      <div className="space-y-4">
        {classes.length === 0 && <div className="text-zinc-500 card-flat p-8 text-center">Nenhuma turma atribuída</div>}
        {classes.map(c => (
          <div key={c.id} className="card-flat p-5" data-testid={`teacher-class-detail-${c.id}`}>
            <div className="flex items-start justify-between mb-3 flex-wrap gap-3">
              <div>
                <div className="font-heading text-2xl">{c.name}</div>
                <div className="flex items-center gap-3 mt-1 text-sm text-zinc-400">
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {c.start_time} - {c.end_time}</span>
                  <span className="flex gap-1">{(c.weekdays || []).map(w => <span key={w} className="text-xs uppercase tracking-widest">{WEEKDAYS[w]}</span>)}</span>
                </div>
              </div>
              <div className="text-sm text-zinc-400 flex items-center gap-2">
                <Users className="w-4 h-4" /> {studentsByClass[c.id]?.length || 0} alunos
              </div>
            </div>
            {studentsByClass[c.id]?.length > 0 && (
              <div className="pt-4 mt-4 border-t border-zinc-900">
                <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Alunos matriculados</div>
                <div className="flex flex-wrap gap-2">
                  {studentsByClass[c.id].map(s => (
                    <span key={s.id} className="text-xs px-2 py-1 border border-zinc-800">{s.full_name}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
