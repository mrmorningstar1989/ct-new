import { useEffect, useState } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export default function Enrollments() {
  const [items, setItems] = useState([]);
  const [students, setStudents] = useState([]);
  const [modalities, setModalities] = useState([]);
  const [classes, setClasses] = useState([]);
  const [plans, setPlans] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ student_id: "", modality_id: "", class_id: "", plan_id: "", status: "active" });

  const load = async () => {
    const [e, s, m, c, p] = await Promise.all([
      api.get("/enrollments"), api.get("/students"), api.get("/modalities"), api.get("/classes"), api.get("/plans")
    ]);
    setItems(e.data); setStudents(s.data); setModalities(m.data); setClasses(c.data); setPlans(p.data);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm({ student_id: "", modality_id: "", class_id: "", plan_id: "", status: "active" }); setOpen(true); };

  const submit = async () => {
    try {
      await api.post("/enrollments", form);
      toast.success("Matrícula criada");
      setOpen(false); load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const remove = async (e) => {
    if (!window.confirm("Excluir matrícula?")) return;
    await api.delete(`/enrollments/${e.id}`); toast.success("Removida"); load();
  };

  const name = (arr, id, key = "full_name") => arr.find(x => x.id === id)?.[key] || "—";
  const modalityClasses = classes.filter(c => c.modality_id === form.modality_id);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-red-500 mb-1">Vínculo</div>
          <h1 className="font-heading text-4xl leading-none">MATRÍCULAS</h1>
        </div>
        <Button onClick={openNew} data-testid="add-enrollment-button" className="bg-red-600 hover:bg-red-700 rounded-none">
          <Plus className="w-4 h-4 mr-2" /> Nova Matrícula
        </Button>
      </div>

      <div className="card-flat overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-800 text-left">
            <tr className="text-[10px] uppercase tracking-widest text-zinc-500">
              <th className="px-5 py-3">Aluno</th>
              <th className="px-5 py-3">Modalidade</th>
              <th className="px-5 py-3">Turma</th>
              <th className="px-5 py-3">Plano</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan="6" className="px-5 py-10 text-center text-zinc-500">Nenhuma matrícula</td></tr>}
            {items.map((e) => (
              <tr key={e.id} className="border-b border-zinc-900 hover:bg-zinc-900/50" data-testid={`enrollment-row-${e.id}`}>
                <td className="px-5 py-3 font-medium">{name(students, e.student_id)}</td>
                <td className="px-5 py-3 text-zinc-400">{name(modalities, e.modality_id, "name")}</td>
                <td className="px-5 py-3 text-zinc-400">{name(classes, e.class_id, "name")}</td>
                <td className="px-5 py-3 text-zinc-400">{name(plans, e.plan_id, "name")}</td>
                <td className="px-5 py-3">
                  <Badge variant="outline" className={`rounded-none border-zinc-700 ${e.status === "active" ? "text-emerald-500" : "text-zinc-500"}`}>{e.status}</Badge>
                </td>
                <td className="px-5 py-3 text-right">
                  <button onClick={() => remove(e)} data-testid={`delete-enrollment-${e.id}`} className="text-zinc-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#121212] border-zinc-800 text-white rounded-none max-w-lg">
          <DialogHeader><DialogTitle className="font-heading text-2xl">NOVA MATRÍCULA</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <F label="Aluno *">
              <Select value={form.student_id} onValueChange={(v) => setForm({ ...form, student_id: v })}>
                <SelectTrigger className="bg-transparent border-zinc-800 rounded-none" data-testid="enrollment-student-select"><SelectValue placeholder="Selecionar aluno" /></SelectTrigger>
                <SelectContent className="bg-[#121212] border-zinc-800 text-white rounded-none">
                  {students.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name} · {s.matricula}</SelectItem>)}
                </SelectContent>
              </Select>
            </F>
            <F label="Modalidade *">
              <Select value={form.modality_id} onValueChange={(v) => setForm({ ...form, modality_id: v, class_id: "" })}>
                <SelectTrigger className="bg-transparent border-zinc-800 rounded-none"><SelectValue placeholder="Selecionar modalidade" /></SelectTrigger>
                <SelectContent className="bg-[#121212] border-zinc-800 text-white rounded-none">
                  {modalities.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </F>
            <F label="Turma">
              <Select value={form.class_id || ""} onValueChange={(v) => setForm({ ...form, class_id: v })}>
                <SelectTrigger className="bg-transparent border-zinc-800 rounded-none"><SelectValue placeholder={form.modality_id ? "Selecionar turma" : "Escolha a modalidade"} /></SelectTrigger>
                <SelectContent className="bg-[#121212] border-zinc-800 text-white rounded-none">
                  {modalityClasses.map(c => <SelectItem key={c.id} value={c.id}>{c.name} · {c.start_time}</SelectItem>)}
                </SelectContent>
              </Select>
            </F>
            <F label="Plano">
              <Select value={form.plan_id || ""} onValueChange={(v) => setForm({ ...form, plan_id: v })}>
                <SelectTrigger className="bg-transparent border-zinc-800 rounded-none"><SelectValue placeholder="Selecionar plano" /></SelectTrigger>
                <SelectContent className="bg-[#121212] border-zinc-800 text-white rounded-none">
                  {plans.map(p => <SelectItem key={p.id} value={p.id}>{p.name} · R$ {p.value.toFixed(2)}</SelectItem>)}
                </SelectContent>
              </Select>
            </F>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-none border-zinc-700">Cancelar</Button>
            <Button onClick={submit} data-testid="save-enrollment-button" className="bg-red-600 hover:bg-red-700 rounded-none">Matricular</Button>
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
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
