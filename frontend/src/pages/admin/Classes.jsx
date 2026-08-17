import { useEffect, useState } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2, Clock, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";

const WEEKDAYS = [
  { key: "mon", label: "Seg" }, { key: "tue", label: "Ter" }, { key: "wed", label: "Qua" },
  { key: "thu", label: "Qui" }, { key: "fri", label: "Sex" }, { key: "sat", label: "Sáb" }, { key: "sun", label: "Dom" },
];
const brl = (v) => (v == null ? "R$ 0,00" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const empty = { name: "", modality_id: "", teacher_id: "", weekdays: [], start_time: "18:00", end_time: "19:00", capacity: 30, status: "active" };

export default function Classes() {
  const [items, setItems] = useState([]);
  const [modalities, setModalities] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [plans, setPlans] = useState([]);
  const [studentsByClass, setStudentsByClass] = useState({});
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);

  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrollClass, setEnrollClass] = useState(null);
  const [selected, setSelected] = useState({}); // student_id -> bool
  const [enrollPlan, setEnrollPlan] = useState("");
  const [enrollDiscount, setEnrollDiscount] = useState(0);

  const load = async () => {
    const [c, m, t, s, p] = await Promise.all([
      api.get("/classes"), api.get("/modalities"), api.get("/teachers"), api.get("/students"), api.get("/plans"),
    ]);
    setItems(c.data); setModalities(m.data); setTeachers(t.data); setStudents(s.data); setPlans(p.data);
    const byClass = {};
    for (const cls of c.data) {
      const r = await api.get(`/classes/${cls.id}/students`);
      byClass[cls.id] = r.data;
    }
    setStudentsByClass(byClass);
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

  const openEnrollDialog = (cls) => {
    setEnrollClass(cls);
    setSelected({});
    setEnrollPlan("");
    setEnrollDiscount(0);
    setEnrollOpen(true);
  };

  const submitEnroll = async () => {
    if (!enrollClass) return;
    const ids = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);
    if (ids.length === 0) { toast.error("Selecione ao menos um aluno"); return; }
    try {
      const { data } = await api.post(`/classes/${enrollClass.id}/enroll`, {
        student_ids: ids,
        modality_id: enrollClass.modality_id,
        class_id: enrollClass.id,
        plan_id: enrollPlan || null,
        custom_discount: parseFloat(enrollDiscount) || 0,
      });
      toast.success(`${data.created} aluno(s) matriculado(s)`);
      setEnrollOpen(false); load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const modalityName = (id) => modalities.find(m => m.id === id)?.name || "—";
  const teacherName = (id) => teachers.find(t => t.id === id)?.full_name || "—";
  const enrolledIds = enrollClass ? (studentsByClass[enrollClass.id] || []).map(s => s.id) : [];
  const availableStudents = students.filter(s => !enrolledIds.includes(s.id));

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
              <div className="text-xs text-zinc-500 pt-2 border-t border-zinc-900 flex items-center gap-2">
                <Users className="w-3.5 h-3.5" /> {(studentsByClass[c.id] || []).length} / {c.capacity} alunos
              </div>
            </div>
            <button
              onClick={() => openEnrollDialog(c)}
              data-testid={`enroll-in-class-${c.id}`}
              className="w-full mt-4 border border-red-600/40 hover:border-red-600 hover:bg-red-600/10 text-red-500 py-2 text-xs uppercase tracking-widest inline-flex items-center justify-center gap-2 transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" /> Matricular alunos
            </button>
          </div>
        ))}
      </div>

      {/* Class create/edit dialog */}
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

            {editing && (
              <div className="md:col-span-2 pt-3 mt-2 border-t border-zinc-800">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs uppercase tracking-wider text-zinc-400">Alunos matriculados ({(studentsByClass[editing.id] || []).length})</Label>
                  <Button type="button" size="sm" onClick={() => { setOpen(false); openEnrollDialog(editing); }} data-testid="open-enroll-from-edit" className="rounded-none border border-red-600/40 bg-transparent hover:bg-red-600/10 text-red-500 h-7 text-xs">
                    <UserPlus className="w-3 h-3 mr-1" /> Matricular novos
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                  {(studentsByClass[editing.id] || []).length === 0 && <span className="text-xs text-zinc-500">Nenhum aluno matriculado ainda</span>}
                  {(studentsByClass[editing.id] || []).map(s => <span key={s.id} className="text-[11px] px-2 py-1 border border-zinc-800">{s.full_name}</span>)}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-none border-zinc-700">Cancelar</Button>
            <Button onClick={submit} data-testid="save-class-button" className="bg-red-600 hover:bg-red-700 rounded-none">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk-enroll dialog */}
      <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
        <DialogContent className="bg-[#121212] border-zinc-800 text-white rounded-none max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl">MATRICULAR EM {enrollClass?.name?.toUpperCase()}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <F label="Plano">
                <Select value={enrollPlan} onValueChange={setEnrollPlan}>
                  <SelectTrigger className="bg-transparent border-zinc-800 rounded-none" data-testid="bulk-plan-select"><SelectValue placeholder="Selecionar plano" /></SelectTrigger>
                  <SelectContent className="bg-[#121212] border-zinc-800 text-white rounded-none">
                    {plans.map(p => <SelectItem key={p.id} value={p.id}>{p.name} · {brl(p.value)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </F>
              <F label="Desconto R$">
                <Input type="number" step="0.01" min="0" data-testid="bulk-discount-input" value={enrollDiscount} onChange={(e) => setEnrollDiscount(e.target.value)} />
              </F>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-zinc-400">Alunos disponíveis ({availableStudents.length})</Label>
              <div className="mt-2 border border-zinc-800 max-h-72 overflow-y-auto">
                {availableStudents.length === 0 && <div className="p-4 text-sm text-zinc-500 text-center">Todos os alunos já estão nesta turma</div>}
                {availableStudents.map(s => (
                  <label key={s.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-900 last:border-b-0 hover:bg-zinc-900/50 cursor-pointer" data-testid={`bulk-student-${s.id}`}>
                    <Checkbox checked={!!selected[s.id]} onCheckedChange={(v) => setSelected({ ...selected, [s.id]: !!v })} className="rounded-none border-zinc-700 data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600" />
                    <div className="flex-1">
                      <div className="text-sm">{s.full_name}</div>
                      <div className="text-[10px] text-zinc-500 font-mono">{s.matricula}</div>
                    </div>
                  </label>
                ))}
              </div>
              <div className="text-[11px] text-zinc-500 mt-2">{Object.values(selected).filter(Boolean).length} selecionado(s)</div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEnrollOpen(false)} className="rounded-none border-zinc-700">Cancelar</Button>
            <Button onClick={submitEnroll} data-testid="confirm-bulk-enroll" className="bg-red-600 hover:bg-red-700 rounded-none">Matricular selecionados</Button>
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
