import { useEffect, useState } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";

const empty = { name: "", value: 0, periodicity: "monthly", description: "", status: "active" };
const PERIODICITY = { monthly: "Mensal", quarterly: "Trimestral", semestral: "Semestral", yearly: "Anual", single: "Aula Avulsa" };

export default function Plans() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);

  const load = async () => { const { data } = await api.get("/plans"); setItems(data); };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (p) => { setEditing(p); setForm({ ...empty, ...p }); setOpen(true); };

  const submit = async () => {
    try {
      const payload = { ...form, value: parseFloat(form.value) };
      if (editing) {
        const { id, ...rest } = payload;
        await api.patch(`/plans/${editing.id}`, rest);
        toast.success("Plano atualizado");
      } else {
        await api.post("/plans", payload);
        toast.success("Plano criado");
      }
      setOpen(false); load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const remove = async (p) => {
    if (!window.confirm(`Excluir ${p.name}?`)) return;
    await api.delete(`/plans/${p.id}`); toast.success("Removido"); load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-red-500 mb-1">Financeiro</div>
          <h1 className="font-heading text-4xl leading-none">PLANOS</h1>
        </div>
        <Button onClick={openNew} data-testid="add-plan-button" className="bg-red-600 hover:bg-red-700 rounded-none">
          <Plus className="w-4 h-4 mr-2" /> Novo Plano
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {items.map(p => (
          <div key={p.id} className="card-flat p-6" data-testid={`plan-card-${p.id}`}>
            <div className="text-[10px] uppercase tracking-widest text-red-500 mb-2">{PERIODICITY[p.periodicity] || p.periodicity}</div>
            <div className="font-heading text-2xl leading-none mb-1">{p.name.toUpperCase()}</div>
            <div className="font-heading text-4xl text-white mt-4">
              R$ <span className="font-mono">{p.value.toFixed(2)}</span>
            </div>
            <div className="text-xs text-zinc-500 mt-2 min-h-[32px]">{p.description}</div>
            <div className="flex gap-3 mt-4 pt-4 border-t border-zinc-900">
              <button onClick={() => openEdit(p)} data-testid={`edit-plan-${p.id}`} className="text-xs text-zinc-400 hover:text-white flex items-center gap-1"><Edit className="w-3.5 h-3.5" /> Editar</button>
              <button onClick={() => remove(p)} data-testid={`delete-plan-${p.id}`} className="text-xs text-zinc-400 hover:text-red-500 flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" /> Excluir</button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#121212] border-zinc-800 text-white rounded-none max-w-md">
          <DialogHeader><DialogTitle className="font-heading text-2xl">{editing ? "EDITAR" : "NOVO"} PLANO</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <F label="Nome *"><Input data-testid="plan-name-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></F>
            <F label="Valor (R$) *"><Input data-testid="plan-value-input" type="number" step="0.01" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></F>
            <F label="Periodicidade">
              <Select value={form.periodicity} onValueChange={(v) => setForm({ ...form, periodicity: v })}>
                <SelectTrigger className="bg-transparent border-zinc-800 rounded-none"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#121212] border-zinc-800 text-white rounded-none">
                  {Object.entries(PERIODICITY).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </F>
            <F label="Descrição"><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></F>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-none border-zinc-700">Cancelar</Button>
            <Button onClick={submit} data-testid="save-plan-button" className="bg-red-600 hover:bg-red-700 rounded-none">Salvar</Button>
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
