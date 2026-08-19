import { useEffect, useState } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Navigate } from "react-router-dom";

const academyEmpty = { name: "", admin_name: "", admin_email: "", admin_password: "", cnpj: "" };
const planEmpty = { name: "", value: "", periodicity: "monthly", description: "" };
const money = (n) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Platform() {
  const { user, logout } = useAuth();
  const [academies, setAcademies] = useState([]), [plans, setPlans] = useState([]), [billing, setBilling] = useState({ subscriptions: [], invoices: [] });
  const [academyForm, setAcademyForm] = useState(academyEmpty), [planForm, setPlanForm] = useState(planEmpty), [error, setError] = useState("");
  const load = async () => { try {
    const [a, p, b] = await Promise.all([api.get("/platform/academies"), api.get("/platform/academies/plans"), api.get("/platform/academies/billing")]);
    setAcademies(a.data); setPlans(p.data); setBilling(b.data);
  } catch (e) { setError(formatApiErrorDetail(e.response?.data?.detail)); } };
  useEffect(() => { if (user?.role === "superadmin") load(); }, [user]);
  if (user && user.role !== "superadmin") return <Navigate to="/login" replace />;
  const createAcademy = async (e) => { e.preventDefault(); try { await api.post("/platform/academies", academyForm); setAcademyForm(academyEmpty); await load(); } catch (e) { setError(formatApiErrorDetail(e.response?.data?.detail)); } };
  const createPlan = async (e) => { e.preventDefault(); try { await api.post("/platform/academies/plans", { ...planForm, value: Number(planForm.value) }); setPlanForm(planEmpty); await load(); } catch (e) { setError(formatApiErrorDetail(e.response?.data?.detail)); } };
  const setPlan = async (academyId, planId) => { if (!planId) return; try { await api.put(`/platform/academies/${academyId}/subscription`, { plan_id: planId }); await load(); } catch (e) { setError(formatApiErrorDetail(e.response?.data?.detail)); } };
  const pay = async (id) => { try { await api.post(`/platform/academies/billing/${id}/pay`, {}); await load(); } catch (e) { setError(formatApiErrorDetail(e.response?.data?.detail)); } };
  const toggle = async (a) => { await api.patch(`/platform/academies/${a.id}/status`, { status: a.status === "active" ? "inactive" : "active" }); await load(); };
  return <main className="min-h-screen bg-zinc-950 text-white p-6 max-w-6xl mx-auto">
    <header className="flex justify-between items-start mb-6"><div><h1 className="text-3xl font-bold">Administração da plataforma</h1><p className="text-zinc-400">Academias, assinaturas e cobranças.</p></div><button onClick={logout} className="border rounded px-4 py-2">Sair</button></header>
    {error && <p className="bg-red-950 text-red-200 p-3 rounded mb-4">{error}</p>}
    <section className="grid lg:grid-cols-2 gap-5 mb-8"><form onSubmit={createAcademy} className="grid gap-2 bg-zinc-900 p-4 rounded"><h2 className="font-bold">Nova academia</h2>{[["name","Academia"],["cnpj","CNPJ"],["admin_name","Administrador"],["admin_email","E-mail"],["admin_password","Senha inicial"]].map(([k,l]) => <input key={k} required={k !== "cnpj"} placeholder={l} type={k === "admin_password" ? "password" : k === "admin_email" ? "email" : "text"} value={academyForm[k]} onChange={e=>setAcademyForm({...academyForm,[k]:e.target.value})} className="p-2 rounded bg-zinc-800"/>)}<button className="bg-red-700 rounded p-2">Criar academia</button></form>
      <form onSubmit={createPlan} className="grid gap-2 bg-zinc-900 p-4 rounded"><h2 className="font-bold">Novo plano de assinatura</h2><input required placeholder="Nome do plano" value={planForm.name} onChange={e=>setPlanForm({...planForm,name:e.target.value})} className="p-2 rounded bg-zinc-800"/><input required type="number" min="0" step="0.01" placeholder="Valor mensal" value={planForm.value} onChange={e=>setPlanForm({...planForm,value:e.target.value})} className="p-2 rounded bg-zinc-800"/><select value={planForm.periodicity} onChange={e=>setPlanForm({...planForm,periodicity:e.target.value})} className="p-2 rounded bg-zinc-800"><option value="monthly">Mensal</option><option value="quarterly">Trimestral</option><option value="yearly">Anual</option></select><input placeholder="Descrição" value={planForm.description} onChange={e=>setPlanForm({...planForm,description:e.target.value})} className="p-2 rounded bg-zinc-800"/><button className="bg-red-700 rounded p-2">Cadastrar plano</button></form></section>
    <section className="mb-8"><h2 className="text-xl font-bold mb-3">Academias e assinaturas</h2><div className="space-y-2">{academies.map(a => <div key={a.id} className="grid md:grid-cols-[1fr_220px_110px] gap-3 items-center bg-zinc-900 p-4 rounded"><span><strong>{a.name}</strong><small className="block text-zinc-400">{a.cnpj || "Sem CNPJ"}</small></span><select defaultValue={billing.subscriptions.find(s=>s.academy_id===a.id)?.plan_id || ""} onChange={e=>setPlan(a.id,e.target.value)} className="p-2 rounded bg-zinc-800"><option value="">Sem plano</option>{plans.filter(p=>p.status === "active").map(p=><option value={p.id} key={p.id}>{p.name} — {money(p.value)}</option>)}</select><button onClick={()=>toggle(a)} className="border rounded p-2">{a.status === "active" ? "Desativar" : "Ativar"}</button></div>)}</div></section>
    <section><h2 className="text-xl font-bold mb-3">Cobranças das academias</h2><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-zinc-400 text-left"><tr><th>Academia</th><th>Plano</th><th>Competência</th><th>Vencimento</th><th>Valor</th><th>Status</th><th></th></tr></thead><tbody>{billing.invoices.map(i=><tr key={i.id} className="border-t border-zinc-800"><td className="py-3">{i.academy?.name || "—"}</td><td>{i.plan?.name || "—"}</td><td>{i.competency}</td><td>{i.due_date}</td><td>{money(i.value)}</td><td>{i.status === "paid" ? "Pago" : i.status === "overdue" ? "Vencido" : "Pendente"}</td><td>{i.status !== "paid" && <button onClick={()=>pay(i.id)} className="border rounded px-2 py-1">Registrar pagamento</button>}</td></tr>)}</tbody></table></div></section>
  </main>;
}
