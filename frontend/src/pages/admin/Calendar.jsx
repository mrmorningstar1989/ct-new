import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { ChevronLeft, ChevronRight, Users, Calendar as CalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

const WEEKDAYS = [
  { key: "mon", label: "Segunda", short: "Seg", dayIdx: 1 },
  { key: "tue", label: "Terça", short: "Ter", dayIdx: 2 },
  { key: "wed", label: "Quarta", short: "Qua", dayIdx: 3 },
  { key: "thu", label: "Quinta", short: "Qui", dayIdx: 4 },
  { key: "fri", label: "Sexta", short: "Sex", dayIdx: 5 },
  { key: "sat", label: "Sábado", short: "Sáb", dayIdx: 6 },
  { key: "sun", label: "Domingo", short: "Dom", dayIdx: 0 },
];

function startOfWeek(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day; // week starts Monday
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(d, n) {
  const x = new Date(d); x.setDate(x.getDate() + n); return x;
}

const parseTime = (t) => {
  const [h, m] = (t || "0:0").split(":").map(Number);
  return h * 60 + m;
};

export default function CalendarPage() {
  const [classes, setClasses] = useState([]);
  const [modalities, setModalities] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));

  useEffect(() => {
    (async () => {
      const [c, m, t] = await Promise.all([api.get("/classes"), api.get("/modalities"), api.get("/teachers")]);
      setClasses(c.data); setModalities(m.data); setTeachers(t.data);
    })();
  }, []);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = useMemo(() => WEEKDAYS.map((w, i) => ({ ...w, date: addDays(weekStart, i) })), [weekStart]);

  const byDay = useMemo(() => {
    const map = {};
    for (const w of WEEKDAYS) map[w.key] = [];
    classes.forEach(c => {
      (c.weekdays || []).forEach(w => {
        if (map[w]) map[w].push(c);
      });
    });
    Object.values(map).forEach(list => list.sort((a, b) => parseTime(a.start_time) - parseTime(b.start_time)));
    return map;
  }, [classes]);

  const modalityName = (id) => modalities.find(m => m.id === id)?.name || "";
  const teacherName = (id) => teachers.find(t => t.id === id)?.full_name || "";

  const isToday = (d) => d.getTime() === today.getTime();
  const weekLabel = `${days[0].date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} — ${days[6].date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`;
  const todayClasses = classes.filter(c => (c.weekdays || []).includes(WEEKDAYS.find(w => w.dayIdx === today.getDay())?.key));

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-red-500 mb-1">Agenda</div>
          <h1 className="font-heading text-4xl leading-none">CALENDÁRIO</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setWeekStart(addDays(weekStart, -7))} data-testid="calendar-prev" className="rounded-none border-zinc-700"><ChevronLeft className="w-4 h-4" /></Button>
          <div className="text-sm font-mono min-w-[190px] text-center px-3">{weekLabel}</div>
          <Button variant="outline" onClick={() => setWeekStart(addDays(weekStart, 7))} data-testid="calendar-next" className="rounded-none border-zinc-700"><ChevronRight className="w-4 h-4" /></Button>
          <Button variant="outline" onClick={() => setWeekStart(startOfWeek(new Date()))} data-testid="calendar-today" className="rounded-none border-zinc-700 ml-2">Hoje</Button>
        </div>
      </div>

      {/* Today highlight */}
      <div className="card-flat p-5 border-l-2 border-l-red-600">
        <div className="flex items-center gap-2 mb-3">
          <CalIcon className="w-4 h-4 text-red-500" />
          <div className="text-[10px] uppercase tracking-widest text-red-500">Aulas de hoje · {today.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</div>
        </div>
        {todayClasses.length === 0 ? (
          <div className="text-sm text-zinc-500">Sem aulas programadas para hoje</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {todayClasses.sort((a, b) => parseTime(a.start_time) - parseTime(b.start_time)).map(c => (
              <div key={c.id} className="border border-zinc-800 p-3" data-testid={`today-class-${c.id}`}>
                <div className="text-[10px] uppercase tracking-widest text-red-500">{modalityName(c.modality_id)}</div>
                <div className="font-heading text-lg mt-1">{c.name}</div>
                <div className="text-xs text-zinc-400 font-mono mt-1">{c.start_time} · {c.end_time}</div>
                <div className="text-xs text-zinc-500 mt-1">{teacherName(c.teacher_id)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Weekly grid */}
      <div className="card-flat overflow-hidden">
        <div className="grid grid-cols-7 border-b border-zinc-800">
          {days.map(d => (
            <div key={d.key} className={`p-3 border-r border-zinc-800 last:border-r-0 ${isToday(d.date) ? "bg-red-950/30" : ""}`}>
              <div className="text-[10px] uppercase tracking-widest text-zinc-500">{d.short}</div>
              <div className={`font-heading text-2xl mt-1 ${isToday(d.date) ? "text-red-500" : "text-white"}`}>
                {d.date.getDate().toString().padStart(2, "0")}
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 min-h-[400px]">
          {days.map(d => (
            <div key={d.key} className={`border-r border-zinc-800 last:border-r-0 p-2 space-y-2 ${isToday(d.date) ? "bg-red-950/10" : ""}`} data-testid={`day-column-${d.key}`}>
              {byDay[d.key].length === 0 && <div className="text-xs text-zinc-700 text-center pt-4">—</div>}
              {byDay[d.key].map(c => (
                <div key={c.id} className="border border-zinc-800 bg-black/40 p-2 hover:border-red-600 transition-colors" data-testid={`calendar-class-${c.id}-${d.key}`}>
                  <div className="text-[9px] uppercase tracking-widest text-red-500 truncate">{modalityName(c.modality_id)}</div>
                  <div className="text-xs text-white font-medium truncate mt-0.5">{c.name}</div>
                  <div className="text-[10px] text-zinc-400 font-mono mt-1">{c.start_time}-{c.end_time}</div>
                  {c.teacher_id && <div className="text-[10px] text-zinc-500 truncate mt-0.5 flex items-center gap-1"><Users className="w-2.5 h-2.5" />{teacherName(c.teacher_id).split(" ")[0]}</div>}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
