import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, formatApiErrorDetail } from "@/lib/api";

export default function AdminInvite() {
  const [params] = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setError("");
    if (!params.get("token")) return setError("Convite inválido.");
    if (password.length < 8) return setError("A senha deve ter ao menos 8 caracteres.");
    if (password !== confirm) return setError("As senhas não conferem.");
    setSaving(true);
    try { const { data } = await api.post("/platform/admin-invites/accept", { token: params.get("token"), password }); setMessage(data.message); }
    catch (e) { setError(formatApiErrorDetail(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };
  return <main className="grid min-h-screen place-items-center bg-zinc-950 p-6 text-white"><form onSubmit={submit} className="w-full max-w-md space-y-5 rounded border border-zinc-800 bg-zinc-900 p-6"><div><img src="/brand/zenkaios-logo.png" alt="ZenkaiOS" className="h-16 w-auto"/><h1 className="mt-3 font-heading text-4xl">Ativar acesso</h1><p className="mt-2 text-sm text-zinc-400">Defina sua senha para administrar a academia.</p></div>{message ? <div className="space-y-3"><p className="rounded bg-emerald-500/15 p-3 text-sm text-emerald-200">{message}</p><Link to="/login" className="inline-block border border-zinc-700 px-3 py-2 text-sm hover:border-red-600">Ir para login</Link></div> : <><input type="password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Crie uma senha" className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"/><input type="password" required value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Confirme a senha" className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"/>{error && <p className="text-sm text-red-300">{error}</p>}<button disabled={saving} className="w-full bg-red-600 py-2 font-semibold disabled:opacity-50">{saving ? "Ativando…" : "Ativar acesso"}</button></>}</form></main>;
}
