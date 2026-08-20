import { useEffect, useState } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Check, X, ClipboardCheck, Download, Camera } from "lucide-react";
import { createPdf, addTable, savePdf, dtBR } from "@/lib/pdf";
import { biometricFeatureEnabled } from "@/lib/features";

const STATUSES = [
  { key: "present", label: "P", full: "Presente", color: "bg-emerald-600 border-emerald-600" },
  { key: "absent", label: "F", full: "Falta", color: "bg-red-600 border-red-600" },
  { key: "justified", label: "J", full: "Justificada", color: "bg-yellow-600 border-yellow-600" },
  { key: "trial", label: "E", full: "Experimental", color: "bg-blue-600 border-blue-600" },
  { key: "medical", label: "A", full: "Atestado", color: "bg-purple-600 border-purple-600" },
];

export default function AttendancePage() {
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState("");
  const [dateStr, setDateStr] = useState(new Date().toISOString().slice(0, 10));
  const [students, setStudents] = useState([]);
  const [records, setRecords] = useState({}); // student_id -> status
  const [groupPhoto, setGroupPhoto] = useState("");

  useEffect(() => { api.get("/classes").then(r => setClasses(r.data)); }, []);

  useEffect(() => {
    if (!classId) { setStudents([]); return; }
    (async () => {
      const [sRes, aRes] = await Promise.all([
        api.get(`/classes/${classId}/students`),
        api.get(`/attendance/class/${classId}/date/${dateStr}`),
      ]);
      setStudents(sRes.data);
      const rec = {};
      (aRes.data.records || []).forEach(r => { rec[r.student_id] = r.status; });
      setRecords(rec);
    })();
  }, [classId, dateStr]);

  const setStatus = (sid, status) => setRecords({ ...records, [sid]: status });
  const markAll = (status) => {
    const r = {}; students.forEach(s => { r[s.id] = status; }); setRecords(r);
  };

  const save = async () => {
    try {
      const payload = {
        class_id: classId,
        date: dateStr,
        records: students.map(s => ({ student_id: s.id, status: records[s.id] || "absent" })),
      };
      await api.post("/attendance", payload);
      toast.success("Chamada registrada");
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const readGroupPhoto = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) { toast.error("Use uma imagem de turma de até 5 MB"); return; }
    const reader = new FileReader(); reader.onload = () => setGroupPhoto(String(reader.result)); reader.readAsDataURL(file);
  };
  const requestSuggestions = async () => {
    if (!classId || !groupPhoto) { toast.error("Selecione uma turma e envie a foto do treino"); return; }
    try {
      await api.post("/biometrics/attendance-suggestions", { class_id: classId, date: dateStr, image_data_url: groupPhoto });
      toast.success("Sugestões prontas para revisão");
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const exportPdf = async () => {
    if (!classId || students.length === 0) { toast.error("Selecione uma turma com alunos"); return; }
    const className = classes.find(c => c.id === classId)?.name || "Turma";
    const doc = await createPdf(`Chamada: ${className}`, `Data: ${dtBR(dateStr)} · ${students.length} alunos`);
    const rows = students.map(s => {
      const st = records[s.id];
      const label = STATUSES.find(x => x.key === st)?.full || "—";
      return [s.matricula || "-", s.full_name, label];
    });
    addTable(doc, ["Matrícula", "Aluno", "Status"], rows);
    const counts = {};
    Object.values(records).forEach(v => { counts[v] = (counts[v] || 0) + 1; });
    let summary = "Resumo: ";
    STATUSES.forEach(s => { if (counts[s.key]) summary += `${s.full}: ${counts[s.key]}  `; });
    const finalY = doc.lastAutoTable.finalY + 20;
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    doc.text(summary, 40, finalY);
    savePdf(doc, `chamada-${className.replace(/\s+/g, "_")}-${dateStr}.pdf`);
    toast.success("PDF gerado");
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-widest text-red-500 mb-1">Controle</div>
        <h1 className="font-heading text-4xl leading-none">PRESENÇA</h1>
      </div>

      <div className="card-flat p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
        <F label="Turma">
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger className="bg-transparent border-zinc-800 rounded-none" data-testid="attendance-class-select"><SelectValue placeholder="Selecionar turma" /></SelectTrigger>
            <SelectContent className="bg-[#121212] border-zinc-800 text-white rounded-none">
              {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </F>
        <F label="Data"><Input type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)} data-testid="attendance-date-input" /></F>
        <div className="flex items-end gap-2">
          <Button onClick={() => markAll("present")} variant="outline" className="rounded-none border-emerald-700 text-emerald-500 hover:bg-emerald-950" data-testid="mark-all-present">
            <Check className="w-4 h-4 mr-1" /> Todos presentes
          </Button>
        </div>
        {biometricFeatureEnabled && <div className="md:col-span-3 border-t border-zinc-800 pt-4 flex flex-wrap gap-3 items-end"><F label="Foto da turma (opcional)"><Input type="file" accept="image/*" capture="environment" onChange={readGroupPhoto} /></F><Button onClick={requestSuggestions} variant="outline" className="rounded-none border-zinc-700 hover:border-red-600"><Camera className="w-4 h-4 mr-2" /> Sugerir presença por foto</Button><span className="text-xs text-zinc-500 max-w-md">A foto não é armazenada. Só alunos com consentimento biométrico podem ser sugeridos e o professor sempre confirma.</span></div>}
      </div>

      {classId && (
        <div className="card-flat overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between">
            <div className="font-heading text-lg tracking-wide">{students.length} ALUNOS</div>
            <div className="flex gap-2 text-[10px] uppercase tracking-widest text-zinc-500">
              {STATUSES.map(s => <span key={s.key}>{s.label}={s.full}</span>)}
            </div>
          </div>
          {students.length === 0 && <div className="px-5 py-10 text-center text-zinc-500">Nenhum aluno matriculado nesta turma</div>}
          {students.map(s => (
            <div key={s.id} className="px-5 py-3 border-b border-zinc-900 flex items-center gap-4" data-testid={`attendance-row-${s.id}`}>
              <div className="flex-1">
                <div className="font-medium">{s.full_name}</div>
                <div className="text-xs text-zinc-500 font-mono">{s.matricula}</div>
              </div>
              <div className="flex gap-1">
                {STATUSES.map(st => (
                  <button
                    key={st.key}
                    onClick={() => setStatus(s.id, st.key)}
                    data-testid={`mark-${st.key}-${s.id}`}
                    className={`w-9 h-9 border font-heading text-sm transition-colors ${
                      records[s.id] === st.key ? `${st.color} text-white` : "bg-transparent border-zinc-800 text-zinc-500 hover:border-zinc-600"
                    }`}
                  >{st.label}</button>
                ))}
              </div>
            </div>
          ))}
          {students.length > 0 && (
            <div className="p-5 flex justify-between gap-3 flex-wrap">
              <Button onClick={exportPdf} data-testid="export-attendance-pdf" variant="outline" className="rounded-none border-zinc-700 hover:border-red-600 hover:text-red-500">
                <Download className="w-4 h-4 mr-2" /> Exportar PDF
              </Button>
              <Button onClick={save} data-testid="save-attendance-button" className="bg-red-600 hover:bg-red-700 rounded-none">
                <ClipboardCheck className="w-4 h-4 mr-2" /> Salvar Chamada
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function F({ label, children }) {
  return (
    <div>
      <Label className="text-xs uppercase tracking-wider text-zinc-400">{label}</Label>
      <div className="mt-1.5 [&_input]:bg-transparent [&_input]:border-zinc-800 [&_input]:rounded-none">{children}</div>
    </div>
  );
}
