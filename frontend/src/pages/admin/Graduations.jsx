import { useEffect, useState } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Award } from "lucide-react";
import { toast } from "sonner";
import BeltDisplay from "@/components/BeltDisplay";

export default function Graduations() {
  const [students, setStudents] = useState([]);
  const [modalities, setModalities] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [history, setHistory] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ modality_id: "", belt_order: 0, stripes: 0, graduation_date: new Date().toISOString().slice(0, 10), teacher_id: "", notes: "" });

  const load = async () => {
    const [s, m, t] = await Promise.all([api.get("/students"), api.get("/modalities"), api.get("/teachers")]);
    setStudents(s.data); setModalities(m.data); setTeachers(t.data);
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!selectedStudent) { setHistory([]); return; }
    api.get(`/graduations/student/${selectedStudent}`).then(r => setHistory(r.data));
  }, [selectedStudent]);

  const selectedModality = modalities.find(m => m.id === form.modality_id);
  const selectedBelt = selectedModality?.belt_system?.[form.belt_order];

  const submit = async () => {
    if (!selectedStudent) { toast.error("Selecione um aluno"); return; }
    if (!selectedBelt) { toast.error("Selecione modalidade e faixa"); return; }
    try {
      await api.post("/graduations", {
        student_id: selectedStudent,
        modality_id: form.modality_id,
        belt_order: form.belt_order,
        belt_name: selectedBelt.name,
        belt_color: selectedBelt.color,
        stripes: form.stripes,
        graduation_date: form.graduation_date,
        teacher_id: form.teacher_id || null,
        notes: form.notes,
      });
      toast.success("Graduação registrada");
      setOpen(false);
      const r = await api.get(`/graduations/student/${selectedStudent}`);
      setHistory(r.data);
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-red-500 mb-1">Progressão</div>
          <h1 className="font-heading text-4xl leading-none">GRADUAÇÕES</h1>
        </div>
        <Button onClick={() => setOpen(true)} disabled={!selectedStudent} data-testid="add-graduation-button" className="bg-red-600 hover:bg-red-700 rounded-none">
          <Plus className="w-4 h-4 mr-2" /> Registrar Graduação
        </Button>
      </div>

      <div className="card-flat p-5">
        <Label className="text-xs uppercase tracking-wider text-zinc-400">Selecionar aluno</Label>
        <div className="mt-2">
          <Select value={selectedStudent} onValueChange={setSelectedStudent}>
            <SelectTrigger className="bg-transparent border-zinc-800 rounded-none" data-testid="graduation-student-select"><SelectValue placeholder="Selecione um aluno" /></SelectTrigger>
            <SelectContent className="bg-[#121212] border-zinc-800 text-white rounded-none">
              {students.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name} · {s.matricula}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedStudent && (
        <div className="card-flat p-6">
          <div className="flex items-center gap-3 mb-6">
            <Award className="w-5 h-5 text-red-500" />
            <h3 className="font-heading text-xl tracking-wide">HISTÓRICO DE GRADUAÇÕES</h3>
          </div>
          {history.length === 0 && <div className="text-zinc-500 py-6 text-center">Sem registros de graduação</div>}
          <div className="space-y-4">
            {history.map(g => (
              <div key={g.id} className="border border-zinc-800 p-4" data-testid={`graduation-item-${g.id}`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-red-500">{modalities.find(m => m.id === g.modality_id)?.name}</div>
                    <div className="text-xs text-zinc-500 font-mono mt-0.5">{new Date(g.graduation_date).toLocaleDateString("pt-BR")}</div>
                  </div>
                  <div className="text-xs text-zinc-400">{teachers.find(t => t.id === g.teacher_id)?.full_name || ""}</div>
                </div>
                <BeltDisplay color={g.belt_color} name={g.belt_name} stripes={g.stripes} />
                {g.notes && <div className="text-xs text-zinc-500 mt-3 pt-3 border-t border-zinc-900">{g.notes}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#121212] border-zinc-800 text-white rounded-none max-w-lg">
          <DialogHeader><DialogTitle className="font-heading text-2xl">NOVA GRADUAÇÃO</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <F label="Modalidade *">
              <Select value={form.modality_id} onValueChange={(v) => setForm({ ...form, modality_id: v, belt_order: 0 })}>
                <SelectTrigger className="bg-transparent border-zinc-800 rounded-none"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent className="bg-[#121212] border-zinc-800 text-white rounded-none">
                  {modalities.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </F>
            {selectedModality && (
              <F label="Faixa *">
                <Select value={String(form.belt_order)} onValueChange={(v) => setForm({ ...form, belt_order: parseInt(v) })}>
                  <SelectTrigger className="bg-transparent border-zinc-800 rounded-none"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#121212] border-zinc-800 text-white rounded-none">
                    {selectedModality.belt_system.map((b, i) => <SelectItem key={i} value={String(i)}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </F>
            )}
            {selectedBelt && (
              <div className="p-4 bg-black border border-zinc-800">
                <BeltDisplay color={selectedBelt.color} name={selectedBelt.name} stripes={form.stripes} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <F label="Grau (stripes)"><Input type="number" min="0" max="4" value={form.stripes} onChange={(e) => setForm({ ...form, stripes: parseInt(e.target.value) || 0 })} /></F>
              <F label="Data"><Input type="date" value={form.graduation_date} onChange={(e) => setForm({ ...form, graduation_date: e.target.value })} /></F>
            </div>
            <F label="Professor responsável">
              <Select value={form.teacher_id || ""} onValueChange={(v) => setForm({ ...form, teacher_id: v })}>
                <SelectTrigger className="bg-transparent border-zinc-800 rounded-none"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent className="bg-[#121212] border-zinc-800 text-white rounded-none">
                  {teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </F>
            <F label="Observações"><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></F>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-none border-zinc-700">Cancelar</Button>
            <Button onClick={submit} data-testid="save-graduation-button" className="bg-red-600 hover:bg-red-700 rounded-none">Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function F({ label, children }) {
  return (
    <div>
      <Label className="text-xs uppercase tracking-wider text-zinc-400">{label}</Label>
      <div className="mt-1.5 [&_input]:bg-transparent [&_input]:border-zinc-800 [&_input]:rounded-none [&_textarea]:bg-transparent [&_textarea]:border-zinc-800 [&_textarea]:rounded-none">{children}</div>
    </div>
  );
}
