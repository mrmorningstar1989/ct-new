import { useEffect, useState } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2, Clock } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";

const WEEKDAYS = [
  { key: "mon", label: "Seg" }, { key: "tue", label: "Ter" }, { key: "wed", label: "Qua" },
  { key: "thu", label: "Qui" }, { key: "fri", label: "Sex" }, { key: "sat", label: "Sáb" }, { key: "sun", label: "Dom" },
];

const empty = { name: "", modality_id: "", teacher_id: "", weekdays: [], start_time: "18:00", end_time: "19:00", capacity: 30, status: "active" };

export default function Classes() {
  const [items, setItems] = useState([]);
  const [modalities, setModalities] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);

  const load = async () => {
    const [c, m, t] = await Promise.all([api.get("/classes"), api.get("/modalities"), api.get("/teachers")]);
    setItems(c.data); setModalities(m.data); setTeachers(t.data);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (c) => { setEditing(c); setForm({ ...empty, ...c }); setOpen(true); };

  const submit = async () => {
    try {
      const payload = { ...form, capacity: parseInt(form.capacity) || 30 };
      if (editing) {
        const { id, ...rest } = payload;
        await api.patch(`/classes/${editing.id}`, rest);
        toast.success("Turma atualizada");
      } else {
        await api.post("/classes", payload);
        toast.success("Turma criada");
      }
      setOpen(false); load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const remove = async (c) => {
    if (!window.confirm(`Excluir turma ${c.name}?`)) return;
    await api.delete(`/classes/${c.id}`); toast.success("Removida"); load();
  };

  const toggleWeekday = (key) => {
    const has = form.weekdays.includes(key);
    setForm({ ...form, weekdays: has ? form.weekdays.filter(k => k !== key) : [...form.weekdays, key] });
  };

  const modalityName = (id) => modalities.find(m => m.id === id)?.name || "—";
  const teacherName = (id) => teachers.find(t => t.id === id)?.full_name || "—";

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-red-500 mb-1">Programação</div>
          <h1 className="font-heading text-4xl leading-none">TURMAS</h1>
        </div>
        <Button onClick={openNew} data-testid="add-class-button" className="bg-red-600 hover:bg-red-700 rounded-none">
          <Plus className="w-4 h-4 mr-2" /> Nova Turma
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.length === 0 && <div className="text-zinc-500 col-span-full py-8">Nenhuma turma criada</div>}
        {items.map((c) => (
          <div key={c.id} className="card-flat p-5" data-testid={`class-card-${c.id}`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="font-heading text-xl">{c.name}</div>
                <div className="text-xs uppercase tracking-widest text-red-500 mt-0.5">{modalityName(c.modality_id)}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEdit(c)} data-testid={`edit-class-${c.id}`} className="text-zinc-400 hover:text-white"><Edit className="w-4 h-4" /></button>
                <button onClick={() => remove(c)} data-testid={`delete-class-${c.id}`} className="text-zinc-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="text-zinc-400">Prof. {teacherName(c.teacher_id)}</div>
              <div className="flex items-center gap-2 text-zinc-400">
                <Clock className="w-3.5 h-3.5" />
                <span className="font-mono">{c.start_time} - {c.end_time}</span>
              </div>
              <div className="flex gap-1 flex-wrap">
                {(c.weekdays || []).map(w => (
                  <span key={w} className="text-[10px] px-2 py-0.5 border border-zinc-700 uppercase tracking-widest text-zinc-300">
                    {WEEKDAYS.find(d => d.key === w)?.label}
                  </span>
                ))}
              </div>
              <div className="text-xs text-zinc-500 pt-2 border-t border-zinc-900">Capacidade: {c.capacity} alunos</div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#121212] border-zinc-800 text-white rounded-none max-w-xl">
          <DialogHeader><DialogTitle className="font-heading text-2xl">{editing ? "EDITAR" : "NOVA"} TURMA</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <F label="Nome *" className="md:col-span-2"><Input data-testid="class-name-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></F>
            <F label="Modalidade *">
              <Select value={form.modality_id} onValueChange={(v) => setForm({ ...form, modality_id: v })}>
                <SelectTrigger className="bg-transparent border-zinc-800 rounded-none" data-testid="class-modality-select"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent className="bg-[#121212] border-zinc-800 text-white rounded-none">
                  {modalities.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </F>
            <F label="Professor">
              <Select value={form.teacher_id || ""} onValueChange={(v) => setForm({ ...form, teacher_id: v })}>
                <SelectTrigger className="bg-transparent border-zinc-800 rounded-none"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent className="bg-[#121212] border-zinc-800 text-white rounded-none">
                  {teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </F>
            <F label="Hora início"><Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></F>
            <F label="Hora fim"><Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></F>
            <F label="Capacidade"><Input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></F>
            <F label="Status">
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className="bg-transparent border-zinc-800 rounded-none"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#121212] border-zinc-800 text-white rounded-none">
                  <SelectItem value="active">Ativa</SelectItem>
                  <SelectItem value="inactive">Inativa</SelectItem>
                </SelectContent>
              </Select>
            </F>
            <div className="md:col-span-2">
              <Label className="text-xs uppercase tracking-wider text-zinc-400">Dias da semana</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {WEEKDAYS.map(d => (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => toggleWeekday(d.key)}
                    data-testid={`weekday-${d.key}`}
                    className={`px-4 py-2 text-xs uppercase tracking-widest border transition-colors ${
                      form.weekdays.includes(d.key)
                        ? "bg-red-600 border-red-600 text-white"
                        : "bg-transparent border-zinc-700 text-zinc-400 hover:border-zinc-500"
                    }`}
                  >{d.label}</button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-none border-zinc-700">Cancelar</Button>
            <Button onClick={submit} data-testid="save-class-button" className="bg-red-600 hover:bg-red-700 rounded-none">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function F({ label, children, className = "" }) {
  return (
    <div className={className}>
      <Label className="text-xs uppercase tracking-wider text-zinc-400">{label}</Label>
      <div className="mt-1.5 [&_input]:bg-transparent [&_input]:border-zinc-800 [&_input]:rounded-none">{children}</div>
    </div>
  );
}
