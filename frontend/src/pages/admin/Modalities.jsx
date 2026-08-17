import { useEffect, useState } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Edit, GripVertical } from "lucide-react";
import { toast } from "sonner";
import BeltDisplay from "@/components/BeltDisplay";

const empty = { name: "", description: "", status: "active", min_age: null, max_age: null, belt_system: [] };

export default function Modalities() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);

  const load = async () => { const { data } = await api.get("/modalities"); setItems(data); };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (m) => { setEditing(m); setForm({ ...empty, ...m }); setOpen(true); };

  const submit = async () => {
    try {
      const payload = { ...form, belt_system: form.belt_system.map((b, i) => ({ ...b, order: i })) };
      if (editing) {
        const { id, ...rest } = payload;
        await api.patch(`/modalities/${editing.id}`, rest);
        toast.success("Modalidade atualizada");
      } else {
        await api.post("/modalities", payload);
        toast.success("Modalidade criada");
      }
      setOpen(false); load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const remove = async (m) => {
    if (!window.confirm(`Excluir ${m.name}?`)) return;
    await api.delete(`/modalities/${m.id}`); toast.success("Removido"); load();
  };

  const addBelt = () => setForm({ ...form, belt_system: [...(form.belt_system || []), { name: "", color: "#FFFFFF", order: (form.belt_system || []).length }] });
  const updateBelt = (i, patch) => setForm({ ...form, belt_system: form.belt_system.map((b, idx) => idx === i ? { ...b, ...patch } : b) });
  const removeBelt = (i) => setForm({ ...form, belt_system: form.belt_system.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-red-500 mb-1">Cadastros</div>
          <h1 className="font-heading text-4xl leading-none">MODALIDADES</h1>
        </div>
        <Button onClick={openNew} data-testid="add-modality-button" className="bg-red-600 hover:bg-red-700 rounded-none">
          <Plus className="w-4 h-4 mr-2" /> Nova Modalidade
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((m) => (
          <div key={m.id} className="card-flat p-6" data-testid={`modality-card-${m.id}`}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="font-heading text-2xl">{m.name.toUpperCase()}</div>
                <div className="text-sm text-zinc-500 mt-1">{m.description}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEdit(m)} data-testid={`edit-modality-${m.id}`} className="text-zinc-400 hover:text-white"><Edit className="w-4 h-4" /></button>
                <button onClick={() => remove(m)} data-testid={`delete-modality-${m.id}`} className="text-zinc-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Sistema de graduação · {m.belt_system?.length || 0} níveis</div>
            <div className="space-y-1.5">
              {(m.belt_system || []).slice(0, 5).map((b, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <div className="w-6 h-3" style={{ background: b.color, border: "1px solid rgba(255,255,255,0.1)" }} />
                  <span className="text-zinc-400">{b.name}</span>
                </div>
              ))}
              {(m.belt_system?.length || 0) > 5 && <div className="text-xs text-zinc-600">+ {m.belt_system.length - 5} outras</div>}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#121212] border-zinc-800 text-white rounded-none max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-heading text-2xl">{editing ? "EDITAR" : "NOVA"} MODALIDADE</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <F label="Nome *"><Input data-testid="modality-name-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></F>
            <F label="Descrição"><Textarea rows={2} value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></F>
            <div className="grid grid-cols-2 gap-4">
              <F label="Idade mínima"><Input type="number" value={form.min_age ?? ""} onChange={(e) => setForm({ ...form, min_age: e.target.value ? parseInt(e.target.value) : null })} /></F>
              <F label="Idade máxima"><Input type="number" value={form.max_age ?? ""} onChange={(e) => setForm({ ...form, max_age: e.target.value ? parseInt(e.target.value) : null })} /></F>
            </div>

            <div className="pt-2 border-t border-zinc-800">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-xs uppercase tracking-wider text-zinc-400">Sistema de graduação</Label>
                <Button type="button" onClick={addBelt} size="sm" variant="outline" className="rounded-none border-zinc-700 h-7 text-xs" data-testid="add-belt-button">
                  <Plus className="w-3 h-3 mr-1" /> Adicionar nível
                </Button>
              </div>
              <div className="space-y-2">
                {(form.belt_system || []).map((b, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <GripVertical className="w-4 h-4 text-zinc-600" />
                    <span className="text-xs font-mono text-zinc-500 w-6">{i + 1}</span>
                    <Input value={b.name} onChange={(e) => updateBelt(i, { name: e.target.value })} placeholder="Nome" className="bg-transparent border-zinc-800 rounded-none flex-1" />
                    <input type="color" value={b.color} onChange={(e) => updateBelt(i, { color: e.target.value })} className="w-10 h-8 bg-transparent border border-zinc-800 cursor-pointer" />
                    <button onClick={() => removeBelt(i)} className="text-zinc-500 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-none border-zinc-700">Cancelar</Button>
            <Button onClick={submit} data-testid="save-modality-button" className="bg-red-600 hover:bg-red-700 rounded-none">Salvar</Button>
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
