import { useEffect, useState } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";

const empty = {
  full_name: "", email: "", phone: "", whatsapp: "", cpf: "", rg: "",
  birth_date: "", gender: "", address: "", city: "", state: "",
  guardian_name: "", guardian_phone: "", notes: "",
  status: "active", create_login: true, password: "",
};

export default function Students() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const params = {};
    if (q) params.q = q;
    const { data } = await api.get("/students", { params });
    setItems(data);
  };

  useEffect(() => { load(); }, [q]);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (s) => { setEditing(s); setForm({ ...empty, ...s, create_login: false, password: "" }); setOpen(true); };

  const submit = async () => {
    setLoading(true);
    try {
      if (editing) {
        const { create_login, password, id, matricula, ...payload } = form;
        await api.patch(`/students/${editing.id}`, payload);
        toast.success("Aluno atualizado");
      } else {
        await api.post("/students", form);
        toast.success("Aluno cadastrado");
      }
      setOpen(false);
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setLoading(false); }
  };

  const remove = async (s) => {
    if (!window.confirm(`Excluir ${s.full_name}?`)) return;
    await api.delete(`/students/${s.id}`);
    toast.success("Aluno removido");
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-red-500 mb-1">Cadastros</div>
          <h1 className="font-heading text-4xl leading-none">ALUNOS</h1>
        </div>
        <Button onClick={openNew} data-testid="add-student-button" className="bg-red-600 hover:bg-red-700 rounded-none">
          <Plus className="w-4 h-4 mr-2" /> Novo Aluno
        </Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            data-testid="search-students-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome, CPF, matrícula, email..."
            className="pl-10 bg-transparent border-zinc-800 rounded-none h-10"
          />
        </div>
      </div>

      <div className="card-flat overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-800 text-left">
            <tr className="text-[10px] uppercase tracking-widest text-zinc-500">
              <th className="px-5 py-3">Matrícula</th>
              <th className="px-5 py-3">Nome</th>
              <th className="px-5 py-3">Contato</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan="5" className="px-5 py-10 text-center text-zinc-500">Nenhum aluno cadastrado</td></tr>
            )}
            {items.map((s) => (
              <tr key={s.id} className="border-b border-zinc-900 hover:bg-zinc-900/50" data-testid={`student-row-${s.id}`}>
                <td className="px-5 py-3 font-mono text-xs">{s.matricula}</td>
                <td className="px-5 py-3 font-medium">{s.full_name}</td>
                <td className="px-5 py-3 text-zinc-400">{s.phone || s.email || "—"}</td>
                <td className="px-5 py-3">
                  <Badge variant="outline" className={`rounded-none border-zinc-700 ${s.status === "active" ? "text-emerald-500" : "text-zinc-500"}`}>
                    {s.status === "active" ? "Ativo" : s.status}
                  </Badge>
                </td>
                <td className="px-5 py-3 text-right">
                  <button onClick={() => openEdit(s)} data-testid={`edit-student-${s.id}`} className="text-zinc-400 hover:text-white mr-3"><Edit className="w-4 h-4" /></button>
                  <button onClick={() => remove(s)} data-testid={`delete-student-${s.id}`} className="text-zinc-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#121212] border-zinc-800 text-white rounded-none max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-heading text-2xl">{editing ? "EDITAR" : "NOVO"} ALUNO</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Nome completo *" required><Input data-testid="student-name-input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
            <Field label="CPF"><Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} /></Field>
            <Field label="Email"><Input data-testid="student-email-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Telefone / WhatsApp"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value, whatsapp: e.target.value })} /></Field>
            <Field label="Data de nascimento"><Input type="date" value={form.birth_date || ""} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} /></Field>
            <Field label="Sexo">
              <Select value={form.gender || ""} onValueChange={(v) => setForm({ ...form, gender: v })}>
                <SelectTrigger className="bg-transparent border-zinc-800 rounded-none"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent className="bg-[#121212] border-zinc-800 text-white rounded-none">
                  <SelectItem value="M">Masculino</SelectItem>
                  <SelectItem value="F">Feminino</SelectItem>
                  <SelectItem value="O">Outro</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Cidade"><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
            <Field label="Estado"><Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></Field>
            <Field label="Endereço" className="md:col-span-2"><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
            <Field label="Responsável (se menor)"><Input value={form.guardian_name} onChange={(e) => setForm({ ...form, guardian_name: e.target.value })} /></Field>
            <Field label="Telefone do responsável"><Input value={form.guardian_phone} onChange={(e) => setForm({ ...form, guardian_phone: e.target.value })} /></Field>
            <Field label="Status">
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className="bg-transparent border-zinc-800 rounded-none"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#121212] border-zinc-800 text-white rounded-none">
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                  <SelectItem value="paused">Trancado</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Observações" className="md:col-span-2"><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
            {!editing && form.email && (
              <>
                <Field label="Criar acesso ao portal">
                  <Select value={form.create_login ? "yes" : "no"} onValueChange={(v) => setForm({ ...form, create_login: v === "yes" })}>
                    <SelectTrigger className="bg-transparent border-zinc-800 rounded-none"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-[#121212] border-zinc-800 text-white rounded-none">
                      <SelectItem value="yes">Sim</SelectItem>
                      <SelectItem value="no">Não</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                {form.create_login && (
                  <Field label="Senha inicial"><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-none border-zinc-700">Cancelar</Button>
            <Button onClick={submit} disabled={loading} data-testid="save-student-button" className="bg-red-600 hover:bg-red-700 rounded-none">
              {loading ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children, className = "" }) {
  return (
    <div className={className}>
      <Label className="text-xs uppercase tracking-wider text-zinc-400">{label}</Label>
      <div className="mt-1.5 [&_input]:bg-transparent [&_input]:border-zinc-800 [&_input]:rounded-none [&_textarea]:bg-transparent [&_textarea]:border-zinc-800 [&_textarea]:rounded-none">
        {children}
      </div>
    </div>
  );
}
