import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search, Edit, Trash2, KeyRound, HeartPulse } from "lucide-react";
import { toast } from "sonner";
import HealthFormDialog from "@/components/HealthFormDialog";

const empty = {
  full_name: "", email: "", phone: "", whatsapp: "", cpf: "", rg: "",
  birth_date: "", gender: "", address: "", city: "", state: "",
  guardian_name: "", guardian_phone: "", notes: "",
  status: "active", create_login: true, password: "",
};

export default function Students() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(false);
  const [loginStatus, setLoginStatus] = useState(null); // {has_login, email}
  const [pwDialog, setPwDialog] = useState(null); // student
  const [pwForm, setPwForm] = useState({ password: "", email: "" });
  const [healthStudent, setHealthStudent] = useState(null);

  const load = useCallback(async () => {
    const params = {};
    if (q) params.q = q;
    const { data } = await api.get("/students", { params });
    setItems(data);
  }, [q]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditing(null); setForm(empty); setLoginStatus(null); setOpen(true); };
  const openEdit = async (s) => {
    setEditing(s);
    setForm({ ...empty, ...s, create_login: false, password: "" });
    setLoginStatus(null);
    setOpen(true);
    try {
      const { data } = await api.get(`/students/${s.id}/login-status`);
      setLoginStatus(data);
    } catch {}
  };

  const openResetPassword = (s) => {
    setPwDialog(s);
    setPwForm({ password: "", email: s.email || "" });
  };

  const submitResetPassword = async () => {
    if (!pwDialog) return;
    if ((pwForm.password || "").length < 4) { toast.error("A senha deve ter ao menos 4 caracteres"); return; }
    try {
      const { data } = await api.post(`/students/${pwDialog.id}/reset-password`, {
        password: pwForm.password,
        email: pwForm.email || null,
      });
      toast.success(data.action === "created" ? `Acesso criado para ${data.email}` : `Senha atualizada`);
      setPwDialog(null);
      if (editing && editing.id === pwDialog.id) {
        // refresh login status if editing this student
        const { data: ls } = await api.get(`/students/${pwDialog.id}/login-status`);
        setLoginStatus(ls);
      }
      load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

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
        <Button onClick={() => navigate("/admin/alunos/novo")} data-testid="add-student-button" className="bg-red-600 hover:bg-red-700 rounded-none">
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
            placeholder="Buscar por nome, CPF ou e-mail..."
            className="pl-10 bg-transparent border-zinc-800 rounded-none h-10"
          />
        </div>
      </div>

      <div className="card-flat overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-800 text-left">
            <tr className="text-[10px] uppercase tracking-widest text-zinc-500">
              <th className="px-5 py-3">Nome</th>
              <th className="px-5 py-3">Contato</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan="4" className="px-5 py-10 text-center text-zinc-500">Nenhum aluno cadastrado</td></tr>
            )}
            {items.map((s) => (
              <tr key={s.id} className="border-b border-zinc-900 hover:bg-zinc-900/50" data-testid={`student-row-${s.id}`}>
                <td className="px-5 py-3 font-medium">{s.full_name}</td>
                <td className="px-5 py-3 text-zinc-400">{s.phone || s.email || "—"}</td>
                <td className="px-5 py-3">
                  <Badge variant="outline" className={`rounded-none border-zinc-700 ${s.status === "active" ? "text-emerald-500" : "text-zinc-500"}`}>
                    {s.status === "active" ? "Ativo" : s.status}
                  </Badge>
                </td>
                <td className="px-5 py-3 text-right">
                  <button onClick={() => setHealthStudent(s)} data-testid={`health-form-${s.id}`} className="text-zinc-400 hover:text-red-500 mr-3" title="Ficha de Saúde (PAR-Q & Anamnese)"><HeartPulse className="w-4 h-4" /></button>
                  <button onClick={() => openResetPassword(s)} data-testid={`reset-password-${s.id}`} className="text-zinc-400 hover:text-yellow-500 mr-3" title="Redefinir senha"><KeyRound className="w-4 h-4" /></button>
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
            {editing && (
              <div className="md:col-span-2 pt-3 mt-2 border-t border-zinc-800">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-zinc-400">Acesso do aluno</div>
                    {loginStatus == null ? (
                      <div className="text-xs text-zinc-500 mt-1">Verificando...</div>
                    ) : loginStatus.has_login ? (
                      <div className="text-sm text-emerald-500 mt-1">✓ Login ativo: <span className="font-mono">{loginStatus.email}</span></div>
                    ) : (
                      <div className="text-sm text-yellow-500 mt-1">Sem acesso ao portal ainda</div>
                    )}
                  </div>
                  <Button type="button" size="sm" onClick={() => { setOpen(false); openResetPassword(editing); }} data-testid="open-reset-from-edit" className="rounded-none border border-yellow-600/40 bg-transparent hover:bg-yellow-600/10 text-yellow-500 h-8 text-xs">
                    <KeyRound className="w-3 h-3 mr-1" /> {loginStatus?.has_login ? "Redefinir senha" : "Criar acesso"}
                  </Button>
                </div>
              </div>
            )}
            {editing && (
              <div className="md:col-span-2 pt-3 border-t border-zinc-800">
                <EnrollmentManager studentId={editing.id} />
              </div>
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

      {/* Reset password dialog */}
      <Dialog open={!!pwDialog} onOpenChange={(o) => !o && setPwDialog(null)}>
        <DialogContent className="bg-[#121212] border-zinc-800 text-white rounded-none max-w-md">
          <DialogHeader><DialogTitle className="font-heading text-2xl">REDEFINIR SENHA</DialogTitle></DialogHeader>
          {pwDialog && (
            <div className="space-y-4">
              <div className="p-3 border border-zinc-800 bg-black">
                <div className="text-sm">{pwDialog.full_name}</div>
                <div className="text-xs text-zinc-500 mt-1">{pwDialog.email || "E-mail não informado"}</div>
              </div>
              <Field label="Email do login (obrigatório se não houver acesso ainda)">
                <Input
                  type="email"
                  data-testid="reset-email-input"
                  value={pwForm.email}
                  onChange={(e) => setPwForm({ ...pwForm, email: e.target.value })}
                  placeholder="aluno@exemplo.com"
                />
              </Field>
              <Field label="Nova senha *">
                <Input
                  type="password"
                  data-testid="reset-password-input"
                  value={pwForm.password}
                  onChange={(e) => setPwForm({ ...pwForm, password: e.target.value })}
                  placeholder="Mínimo 4 caracteres"
                />
              </Field>
              <div className="text-[11px] text-zinc-500">
                Se o aluno ainda não tem acesso ao portal, um login será criado com este email. Informe a nova senha ao aluno.
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwDialog(null)} className="rounded-none border-zinc-700">Cancelar</Button>
            <Button onClick={submitResetPassword} data-testid="confirm-reset-password" className="bg-yellow-600 hover:bg-yellow-700 rounded-none text-black">
              <KeyRound className="w-4 h-4 mr-2" /> Salvar Senha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <HealthFormDialog
        student={healthStudent}
        open={!!healthStudent}
        onOpenChange={(o) => !o && setHealthStudent(null)}
      />
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

const enrollmentEmpty = { modality_id: "", class_id: "", plan_id: "", custom_discount: "0" };

function EnrollmentManager({ studentId }) {
  const [enrollments, setEnrollments] = useState([]);
  const [modalities, setModalities] = useState([]);
  const [classes, setClasses] = useState([]);
  const [plans, setPlans] = useState([]);
  const [form, setForm] = useState(enrollmentEmpty);
  const [adding, setAdding] = useState(false);
  const brl = (value) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const loadEnrollments = useCallback(async () => {
    try {
      const [e, m, c, p] = await Promise.all([
        api.get("/enrollments", { params: { student_id: studentId } }),
        api.get("/modalities"), api.get("/classes"), api.get("/plans"),
      ]);
      setEnrollments(e.data); setModalities(m.data); setClasses(c.data); setPlans(p.data);
    } catch (error) { toast.error(formatApiErrorDetail(error.response?.data?.detail)); }
  }, [studentId]);
  useEffect(() => { loadEnrollments(); }, [loadEnrollments]);
  const name = (items, id) => items.find((item) => item.id === id)?.name || "—";
  const add = async () => {
    if (!form.modality_id) return toast.error("Selecione uma modalidade.");
    setAdding(true);
    try {
      await api.post("/enrollments", { student_id: studentId, modality_id: form.modality_id, class_id: form.class_id || null, plan_id: form.plan_id || null, custom_discount: Number(form.custom_discount) || 0, status: "active" });
      setForm(enrollmentEmpty); toast.success("Vínculo adicionado ao aluno."); loadEnrollments();
    } catch (error) { toast.error(formatApiErrorDetail(error.response?.data?.detail)); }
    finally { setAdding(false); }
  };
  const removeEnrollment = async (enrollment) => {
    if (!window.confirm(`Remover ${name(modalities, enrollment.modality_id)} deste aluno?`)) return;
    try { await api.delete(`/enrollments/${enrollment.id}`); toast.success("Vínculo removido."); loadEnrollments(); }
    catch (error) { toast.error(formatApiErrorDetail(error.response?.data?.detail)); }
  };
  const availableClasses = classes.filter((item) => item.modality_id === form.modality_id);

  return <section>
    <div className="flex items-center justify-between gap-3">
      <div><div className="text-xs uppercase tracking-wider text-zinc-400">Turmas e plano</div><p className="mt-1 text-xs text-zinc-500">Gerencie os vínculos deste aluno sem sair do cadastro.</p></div>
    </div>
    <div className="mt-3 space-y-2">
      {enrollments.map((enrollment) => <div key={enrollment.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-zinc-800 bg-black/30 px-3 py-2 text-sm">
        <span><strong>{name(modalities, enrollment.modality_id)}</strong><span className="text-zinc-500"> · {name(classes, enrollment.class_id)} · {name(plans, enrollment.plan_id)}</span>{Number(enrollment.custom_discount) > 0 && <span className="text-zinc-500"> · desconto {brl(enrollment.custom_discount)}</span>}</span>
        <button type="button" onClick={() => removeEnrollment(enrollment)} className="text-zinc-500 hover:text-red-500" title="Remover vínculo"><Trash2 className="h-4 w-4"/></button>
      </div>)}
      {!enrollments.length && <p className="text-sm text-zinc-500">Este aluno ainda não está vinculado a uma modalidade ou turma.</p>}
    </div>
    <div className="mt-3 grid grid-cols-1 gap-2 rounded border border-dashed border-zinc-700 p-3 md:grid-cols-4">
      <Select value={form.modality_id} onValueChange={(value) => setForm({ ...form, modality_id: value, class_id: "" })}><SelectTrigger className="bg-transparent border-zinc-800 rounded-none"><SelectValue placeholder="Modalidade *"/></SelectTrigger><SelectContent className="bg-[#121212] border-zinc-800 text-white rounded-none">{modalities.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select>
      <Select value={form.class_id} onValueChange={(value) => setForm({ ...form, class_id: value })}><SelectTrigger className="bg-transparent border-zinc-800 rounded-none"><SelectValue placeholder="Turma"/></SelectTrigger><SelectContent className="bg-[#121212] border-zinc-800 text-white rounded-none">{availableClasses.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select>
      <Select value={form.plan_id} onValueChange={(value) => setForm({ ...form, plan_id: value })}><SelectTrigger className="bg-transparent border-zinc-800 rounded-none"><SelectValue placeholder="Plano"/></SelectTrigger><SelectContent className="bg-[#121212] border-zinc-800 text-white rounded-none">{plans.map((item) => <SelectItem key={item.id} value={item.id}>{item.name} · {brl(item.value)}</SelectItem>)}</SelectContent></Select>
      <div className="flex gap-2"><Input type="number" min="0" step="0.01" value={form.custom_discount} onChange={(e) => setForm({ ...form, custom_discount: e.target.value })} placeholder="Desconto R$" className="bg-transparent border-zinc-800 rounded-none"/><Button type="button" onClick={add} disabled={adding} className="bg-red-600 hover:bg-red-700 rounded-none"><Plus className="h-4 w-4"/></Button></div>
    </div>
  </section>;
}
