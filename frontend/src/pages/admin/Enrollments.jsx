import { useEffect, useState } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, HeartPulse } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import HealthFormDialog from "@/components/HealthFormDialog";

const brl = (v) => (v == null ? "R$ 0,00" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const emptyRow = { modality_id: "", class_id: "", plan_id: "", custom_discount: 0 };

export default function Enrollments() {
  const [items, setItems] = useState([]);
  const [students, setStudents] = useState([]);
  const [modalities, setModalities] = useState([]);
  const [classes, setClasses] = useState([]);
  const [plans, setPlans] = useState([]);
  const [open, setOpen] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [rows, setRows] = useState([{ ...emptyRow }]);
  const [saving, setSaving] = useState(false);
  const [healthOpen, setHealthOpen] = useState(false);

  const load = async () => {
    const [e, s, m, c, p] = await Promise.all([
      api.get("/enrollments"), api.get("/students"), api.get("/modalities"), api.get("/classes"), api.get("/plans"),
    ]);
    setItems(e.data); setStudents(s.data); setModalities(m.data); setClasses(c.data); setPlans(p.data);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setStudentId(""); setRows([{ ...emptyRow }]); setOpen(true); };

  const addRow = () => setRows([...rows, { ...emptyRow }]);
  const removeRow = (i) => setRows(rows.length === 1 ? [{ ...emptyRow }] : rows.filter((_, idx) => idx !== i));
  const updateRow = (i, patch) => setRows(rows.map((r, idx) => idx === i ? { ...r, ...patch } : r));

  const submit = async () => {
    if (!studentId) { toast.error("Selecione um aluno"); return; }
    const valid = rows.filter(r => r.modality_id);
    if (valid.length === 0) { toast.error("Adicione pelo menos uma modalidade"); return; }
    setSaving(true);
    try {
      for (const r of valid) {
        await api.post("/enrollments", {
          student_id: studentId,
          modality_id: r.modality_id,
          class_id: r.class_id || null,
          plan_id: r.plan_id || null,
          custom_discount: parseFloat(r.custom_discount) || 0,
          status: "active",
        });
      }
      toast.success(`${valid.length} matrícula(s) criada(s)`);
      setOpen(false); load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };

  const remove = async (e) => {
    if (!window.confirm("Excluir matrícula?")) return;
    await api.delete(`/enrollments/${e.id}`); toast.success("Removida"); load();
  };

  const name = (arr, id, key = "full_name") => arr.find(x => x.id === id)?.[key] || "—";

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
              <th className="px-5 py-3 text-right">Desconto</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan="7" className="px-5 py-10 text-center text-zinc-500">Nenhuma matrícula</td></tr>}
            {items.map((e) => (
              <tr key={e.id} className="border-b border-zinc-900 hover:bg-zinc-900/50" data-testid={`enrollment-row-${e.id}`}>
                <td className="px-5 py-3 font-medium">{name(students, e.student_id)}</td>
                <td className="px-5 py-3 text-zinc-400">{name(modalities, e.modality_id, "name")}</td>
                <td className="px-5 py-3 text-zinc-400">{name(classes, e.class_id, "name")}</td>
                <td className="px-5 py-3 text-zinc-400">{name(plans, e.plan_id, "name")}</td>
                <td className="px-5 py-3 text-right font-mono text-xs">{e.custom_discount ? brl(e.custom_discount) : "—"}</td>
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
        <DialogContent className="bg-[#121212] border-zinc-800 text-white rounded-none max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-heading text-2xl">NOVA MATRÍCULA</DialogTitle></DialogHeader>
          <div className="space-y-5">
            <div>
              <Label className="text-xs uppercase tracking-wider text-zinc-400">Aluno *</Label>
              <div className="mt-1.5">
                <Select value={studentId} onValueChange={setStudentId}>
                  <SelectTrigger className="bg-transparent border-zinc-800 rounded-none" data-testid="enrollment-student-select"><SelectValue placeholder="Selecionar aluno" /></SelectTrigger>
                  <SelectContent className="bg-[#121212] border-zinc-800 text-white rounded-none">
                    {students.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name} · {s.matricula}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {studentId && (
                <button
                  type="button"
                  onClick={() => setHealthOpen(true)}
                  data-testid="open-health-from-enrollment"
                  className="mt-3 inline-flex items-center gap-2 px-3 py-2 border border-red-600/40 hover:border-red-600 hover:bg-red-600/10 text-red-500 text-xs uppercase tracking-widest transition-colors"
                >
                  <HeartPulse className="w-3.5 h-3.5" /> Preencher ficha de saúde (PAR-Q & Anamnese)
                </button>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-xs uppercase tracking-wider text-zinc-400">Modalidades e turmas</Label>
                <Button type="button" size="sm" variant="outline" onClick={addRow} data-testid="add-modality-row" className="rounded-none border-zinc-700 h-7 text-xs">
                  <Plus className="w-3 h-3 mr-1" /> Adicionar modalidade
                </Button>
              </div>
              <div className="space-y-3">
                {rows.map((r, i) => {
                  const modalityClasses = classes.filter(c => c.modality_id === r.modality_id);
                  return (
                    <div key={i} className="border border-zinc-800 p-3 grid grid-cols-1 md:grid-cols-4 gap-3 items-end" data-testid={`enrollment-row-form-${i}`}>
                      <div>
                        <Label className="text-[10px] uppercase text-zinc-500">Modalidade</Label>
                        <Select value={r.modality_id} onValueChange={(v) => updateRow(i, { modality_id: v, class_id: "" })}>
                          <SelectTrigger className="bg-transparent border-zinc-800 rounded-none mt-1" data-testid={`enrollment-modality-select-${i}`}><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent className="bg-[#121212] border-zinc-800 text-white rounded-none">
                            {modalities.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[10px] uppercase text-zinc-500">Turma</Label>
                        <Select value={r.class_id || ""} onValueChange={(v) => updateRow(i, { class_id: v })}>
                          <SelectTrigger className="bg-transparent border-zinc-800 rounded-none mt-1"><SelectValue placeholder={r.modality_id ? "—" : "Escolha modalidade"} /></SelectTrigger>
                          <SelectContent className="bg-[#121212] border-zinc-800 text-white rounded-none">
                            {modalityClasses.map(c => <SelectItem key={c.id} value={c.id}>{c.name} · {c.start_time}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[10px] uppercase text-zinc-500">Plano</Label>
                        <Select value={r.plan_id || ""} onValueChange={(v) => updateRow(i, { plan_id: v })}>
                          <SelectTrigger className="bg-transparent border-zinc-800 rounded-none mt-1"><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent className="bg-[#121212] border-zinc-800 text-white rounded-none">
                            {plans.map(p => <SelectItem key={p.id} value={p.id}>{p.name} · {brl(p.value)}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-end gap-2">
                        <div className="flex-1">
                          <Label className="text-[10px] uppercase text-zinc-500">Desconto R$</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            data-testid={`enrollment-discount-input-${i}`}
                            value={r.custom_discount}
                            onChange={(ev) => updateRow(i, { custom_discount: ev.target.value })}
                            className="bg-transparent border-zinc-800 rounded-none mt-1"
                          />
                        </div>
                        <button onClick={() => removeRow(i)} data-testid={`remove-row-${i}`} className="text-zinc-500 hover:text-red-500 mb-2"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="text-[11px] text-zinc-500 mt-3">Desconto é aplicado sobre o valor do plano ao gerar a mensalidade. Somente admin pode editar.</div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-none border-zinc-700">Cancelar</Button>
            <Button onClick={submit} disabled={saving} data-testid="save-enrollment-button" className="bg-red-600 hover:bg-red-700 rounded-none">
              {saving ? "Matriculando..." : "Matricular"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <HealthFormDialog
        student={students.find(s => s.id === studentId)}
        open={healthOpen}
        onOpenChange={setHealthOpen}
      />
    </div>
  );
}
