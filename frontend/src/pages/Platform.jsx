import { useEffect, useState } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Navigate } from "react-router-dom";

const empty = { name: "", admin_name: "", admin_email: "", admin_password: "", cnpj: "" };

export default function Platform() {
  const { user } = useAuth();
  const [academies, setAcademies] = useState([]);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState("");

  const load = async () => {
    try { setAcademies((await api.get("/platform/academies")).data); }
    catch (e) { setError(formatApiErrorDetail(e.response?.data?.detail)); }
  };
  useEffect(() => { if (user?.role === "superadmin") load(); }, [user]);
  if (user && user.role !== "superadmin") return <Navigate to="/login" replace />;

  const submit = async (e) => {
    e.preventDefault(); setError("");
    try { await api.post("/platform/academies", form); setForm(empty); await load(); }
    catch (err) { setError(formatApiErrorDetail(err.response?.data?.detail)); }
  };
  const toggle = async (academy) => {
    try { await api.patch(`/platform/academies/${academy.id}/status`, { status: academy.status === "active" ? "inactive" : "active" }); await load(); }
    catch (err) { setError(formatApiErrorDetail(err.response?.data?.detail)); }
  };

  return <main className="min-h-screen bg-zinc-950 text-white p-6 max-w-5xl mx-auto">
    <h1 className="text-3xl font-bold mb-2">Administração da plataforma</h1>
    <p className="text-zinc-400 mb-6">Crie academias e controle seus acessos.</p>
    {error && <p className="bg-red-950 text-red-200 p-3 rounded mb-4">{error}</p>}
    <form onSubmit={submit} className="grid md:grid-cols-2 gap-3 bg-zinc-900 p-4 rounded mb-8">
      {[["name", "Nome da academia"], ["cnpj", "CNPJ"], ["admin_name", "Nome do administrador"], ["admin_email", "E-mail do administrador"], ["admin_password", "Senha inicial (mín. 8)"]].map(([key, label]) =>
        <label key={key} className="text-sm">{label}<input required={key !== "cnpj"} type={key === "admin_password" ? "password" : key === "admin_email" ? "email" : "text"} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} className="block w-full mt-1 p-2 rounded bg-zinc-800" /></label>)}
      <button className="md:col-span-2 bg-red-700 rounded p-2 font-semibold">Criar academia</button>
    </form>
    <div className="space-y-2">{academies.map(a => <div key={a.id} className="flex justify-between items-center bg-zinc-900 p-4 rounded"><span><strong>{a.name}</strong><small className="block text-zinc-400">{a.cnpj || "Sem CNPJ"}</small></span><button onClick={() => toggle(a)} className="border rounded px-3 py-1">{a.status === "active" ? "Desativar" : "Ativar"}</button></div>)}</div>
  </main>;
}
