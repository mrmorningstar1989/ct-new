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
import { Badge } from "@/components/ui/badge";

const empty = { full_name: "", email: "", phone: "", cpf: "", bio: "", specialties: [], status: "active", create_login: true, password: "" };

export default function Teachers() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);

  const load = async () => { const { data } = await api.get("/teachers"); setItems(data); };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (t) => { setEditing(t); setForm({ ...empty, ...t, create_login: false, password: "" }); setOpen(true); };

  const submit = async () => {
    try {
      if (editing) {
        const { create_login, password, id, ...payload } = form;
        await api.patch(`/teachers/${editing.id}`, payload);
        toast.success("Professor atualizado");
      } else {
        await api.post("/teachers", { ...form, specialties: (form.specialties_str || "").split(",").map(s => s.trim()).filter(Boolean) });
        toast.success("Professor cadastrado");
      }
      setOpen(false); load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const remove = async (t) => {
    if (!window.confirm(`Excluir ${t.full_name}?`)) return;
    await api.delete(`/teachers/${t.id}`); toast.success("Removido"); load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-red-500 mb-1">Equipe</div>
          <h1 className="font-heading text-4xl leading-none">PROFESSORES</h1>
        </div>
        <Button onClick={openNew} data-testid="add-teacher-button" className="bg-red-600 hover:bg-red-700 rounded-none">
          <Plus className="w-4 h-4 mr-2" /> Novo Professor
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.length === 0 && <div className="text-zinc-500 col-span-full py-8">Nenhum professor cadastrado</div>}
        {items.map((t) => (
          <div key={t.id} className="card-flat p-5" data-testid={`teacher-card-${t.id}`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="font-heading text-xl">{t.full_name}</div>
                <div className="text-xs text-zinc-500 mt-1">{t.email || "—"}</div>
              </div>
              <Badge variant="outline" className="rounded-none border-zinc-700 text-emerald-500">{t.status === "active" ? "Ativo" : t.status}</Badge>
            </div>
            <div className="text-sm text-zinc-400">{t.phone || "Sem telefone"}</div>
            {t.specialties?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {t.specialties.map((s, i) => <Badge key={i} variant="secondary" className="rounded-none bg-zinc-800 text-zinc-300">{s}</Badge>)}
              </div>
            )}
            <div className="flex gap-3 mt-4 pt-4 border-t border-zinc-900">
              <button onClick={() => openEdit(t)} data-testid={`edit-teacher-${t.id}`} className="text-xs text-zinc-400 hover:text-white flex items-center gap-1"><Edit className="w-3.5 h-3.5" /> Editar</button>
              <button onClick={() => remove(t)} data-testid={`delete-teacher-${t.id}`} className="text-xs text-zinc-400 hover:text-red-500 flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" /> Excluir</button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#121212] border-zinc-800 text-white rounded-none max-w-xl">
          <DialogHeader><DialogTitle className="font-heading text-2xl">{editing ? "EDITAR" : "NOVO"} PROFESSOR</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <F label="Nome completo *"><Input data-testid="teacher-name-input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></F>
            <F label="Email"><Input data-testid="teacher-email-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></F>
            <F label="Telefone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></F>
            <F label="CPF"><Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} /></F>
            <F label="Especialidades (separadas por vírgula)" className="md:col-span-2">
              <Input value={form.specialties_str ?? (form.specialties || []).join(", ")} onChange={(e) => setForm({ ...form, specialties_str: e.target.value })} />
            </F>
            <F label="Bio" className="md:col-span-2"><Textarea rows={2} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></F>
            <F label="Status">
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className="bg-transparent border-zinc-800 rounded-none"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#121212] border-zinc-800 text-white rounded-none">
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </F>
            {!editing && form.email && (
              <F label="Senha inicial (login professor)"><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></F>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-none border-zinc-700">Cancelar</Button>
            <Button onClick={submit} data-testid="save-teacher-button" className="bg-red-600 hover:bg-red-700 rounded-none">Salvar</Button>
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
      <div className="mt-1.5 [&_input]:bg-transparent [&_input]:border-zinc-800 [&_input]:rounded-none [&_textarea]:bg-transparent [&_textarea]:border-zinc-800 [&_textarea]:rounded-none">{children}</div>
    </div>
  );
}
