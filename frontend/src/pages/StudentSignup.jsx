import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { biometricFeatureEnabled } from "@/lib/features";

const questions = [
  ["q1_heart_condition", "Algum médico já informou problema cardíaco ou recomendou exercício só com supervisão?"],
  ["q2_chest_pain_activity", "Sente dor no peito durante atividade física?"],
  ["q3_chest_pain_month", "No último mês, sentiu dor no peito em repouso?"],
  ["q4_balance_loss", "Perde equilíbrio por tontura ou já perdeu a consciência?"],
  ["q5_bone_joint", "Tem problema ósseo ou articular que pode piorar com atividade física?"],
  ["q6_medication", "Usa medicamento para pressão arterial ou coração?"],
  ["q7_other_reason", "Há outra razão para não praticar atividade física?"],
];

const emptyParq = Object.fromEntries(questions.map(([key]) => [key, null]));
const emptyAna = { height_cm: "", weight_kg: "", blood_type: "", diseases: "", allergies: "", medications: "", surgeries: "", injuries: "", family_history: "", smoker: null, alcohol: null, exercise_frequency: "", goals: "", doctor_clearance: null };

function YesNo({ value, onChange }) {
  return <div className="flex gap-2"><Button type="button" size="sm" variant="outline" onClick={() => onChange(false)} className={value === false ? "border-emerald-500 text-emerald-400" : "border-zinc-700"}>Não</Button><Button type="button" size="sm" variant="outline" onClick={() => onChange(true)} className={value === true ? "border-red-500 text-red-400" : "border-zinc-700"}>Sim</Button></div>;
}

export default function StudentSignup({ adminMode = false }) {
  const { academySlug } = useParams();
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [academy, setAcademy] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [selfie, setSelfie] = useState("");
  const [form, setForm] = useState({ full_name: "", email: "", password: "", cpf: "", birth_date: "", phone: "", address: "", city: "", state: "", emergency_name: "", emergency_relationship: "", emergency_phone: "" });
  const [parq, setParq] = useState(emptyParq);
  const [ana, setAna] = useState(emptyAna);
  const isMinor = form.birth_date && ((Date.now() - new Date(`${form.birth_date}T00:00:00`).getTime()) / 31557600000 < 18);

  useEffect(() => {
    if (adminMode) return;
    api.get(`/auth/public/academies/${academySlug}`).then(({ data }) => setAcademy(data)).catch((e) => setError(formatApiErrorDetail(e.response?.data?.detail)));
  }, [academySlug, adminMode]);
  const parqComplete = useMemo(() => questions.every(([key]) => typeof parq[key] === "boolean"), [parq]);

  const readSelfie = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 2 * 1024 * 1024) { setError("A selfie deve ser uma imagem de até 2 MB."); return; }
    const reader = new FileReader(); reader.onload = () => setSelfie(String(reader.result)); reader.readAsDataURL(file);
  };
  const set = (key, value) => setForm((old) => ({ ...old, [key]: value }));
  const submit = async (event) => {
    event.preventDefault(); setError("");
    if (!parqComplete || !selfie || [ana.smoker, ana.alcohol, ana.doctor_clearance].some((v) => typeof v !== "boolean")) { setError("Conclua o PAR-Q, a anamnese e a selfie para continuar."); return; }
    setSaving(true);
    try {
      const payload = { ...form, emergency_contact: { name: form.emergency_name, relationship: form.emergency_relationship, phone: form.emergency_phone }, parq, anamnesis: { ...ana, height_cm: Number(ana.height_cm), weight_kg: Number(ana.weight_kg) } };
      if (adminMode) {
        await api.post("/students", { ...payload, photo_url: selfie, whatsapp: form.phone, status: "active", create_login: true });
        toast.success("Aluno cadastrado com sucesso!"); navigate("/admin/alunos");
      } else {
        await api.post(`/auth/public/academies/${academySlug}/register`, { ...payload, selfie_data_url: selfie });
        await refresh(); toast.success("Matrícula enviada com sucesso!"); navigate("/aluno");
      }
    } catch (e) { setError(formatApiErrorDetail(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };
  if (error && !academy && !adminMode) return <div className="min-h-screen grid place-items-center bg-[#0A0A0A] text-red-400 p-6">{error}</div>;
  return <main className="min-h-screen bg-[#0A0A0A] text-white p-5 md:p-10"><form onSubmit={submit} className="max-w-3xl mx-auto space-y-8">
    <header><div className="text-xs uppercase tracking-widest text-red-500">{adminMode ? "Cadastro interno" : academy?.name || "Carregando academia..."}</div><h1 className="font-heading text-4xl mt-2">{adminMode ? "NOVO ALUNO" : "CADASTRE-SE"}</h1><p className="text-zinc-400 mt-2">Preencha a ficha completa. Todos os itens abaixo são obrigatórios.</p>{adminMode ? <Button type="button" variant="link" onClick={() => navigate("/admin/alunos")} className="px-0 text-red-400 hover:text-red-300">Voltar para alunos</Button> : <Link to={`/a/${academySlug}/login`} className="text-sm text-red-400 hover:text-red-300">Já tem conta? Entrar</Link>}</header>
    <Section title="Dados pessoais"><Grid><Field label="Nome completo"><Input required value={form.full_name} onChange={(e) => set("full_name", e.target.value)} /></Field><Field label="E-mail"><Input required type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></Field><Field label="Senha (mínimo 8 caracteres)"><Input required minLength={8} type="password" value={form.password} onChange={(e) => set("password", e.target.value)} /></Field><Field label="CPF"><Input required value={form.cpf} onChange={(e) => set("cpf", e.target.value)} /></Field><Field label="Data de nascimento"><Input required type="date" value={form.birth_date} onChange={(e) => set("birth_date", e.target.value)} /></Field><Field label="Telefone"><Input required value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field><Field label="Endereço"><Input required value={form.address} onChange={(e) => set("address", e.target.value)} /></Field><Field label="Cidade"><Input required value={form.city} onChange={(e) => set("city", e.target.value)} /></Field><Field label="UF"><Input required maxLength={2} value={form.state} onChange={(e) => set("state", e.target.value)} /></Field></Grid></Section>
    <Section title="Contato de emergência"><Grid><Field label="Nome"><Input required value={form.emergency_name} onChange={(e) => set("emergency_name", e.target.value)} /></Field><Field label="Parentesco"><Input required value={form.emergency_relationship} onChange={(e) => set("emergency_relationship", e.target.value)} /></Field><Field label="Telefone"><Input required value={form.emergency_phone} onChange={(e) => set("emergency_phone", e.target.value)} /></Field></Grid></Section>
    <Section title="Selfie para identificação"><Input required type="file" accept="image/*" capture="user" onChange={readSelfie} />{selfie && <img src={selfie} alt="Prévia da selfie" className="w-28 h-28 object-cover mt-3 border border-zinc-700" />}</Section>
    {biometricFeatureEnabled && <Section title="Reconhecimento facial para presença (opcional)"><div className="text-sm text-zinc-400 space-y-3"><p>A selfie é usada na sua identificação cadastral. O reconhecimento facial em foto de turma é opcional, gera apenas sugestão de presença e sempre depende da confirmação do professor.</p><label className="flex gap-3 items-start"><input type="checkbox" checked={Boolean(form.biometric_consent)} onChange={(e) => set("biometric_consent", e.target.checked)} className="mt-1" /><span>Autorizo de forma livre, específica e destacada o uso da minha biometria facial exclusivamente para sugestão de presença nesta academia. Sei que posso revogar a autorização gratuitamente.</span></label>{isMinor && form.biometric_consent && <label className="flex gap-3 items-start text-yellow-300"><input type="checkbox" checked={Boolean(form.guardian_biometric_consent)} onChange={(e) => set("guardian_biometric_consent", e.target.checked)} className="mt-1" /><span>Confirmo que sou responsável legal e autorizo o uso descrito acima em nome do menor.</span></label>}</div></Section>}
    <Section title="PAR-Q"><p className="text-sm text-zinc-400">Responda todas as perguntas.</p>{questions.map(([key, label], index) => <div key={key} className="border-t border-zinc-800 pt-4 flex flex-col md:flex-row md:items-center gap-3 justify-between"><span>{index + 1}. {label}</span><YesNo value={parq[key]} onChange={(value) => setParq({ ...parq, [key]: value })} /></div>)}</Section>
    <Section title="Anamnese"><Grid><Field label="Altura (cm)"><Input required type="number" min="1" value={ana.height_cm} onChange={(e) => setAna({ ...ana, height_cm: e.target.value })} /></Field><Field label="Peso (kg)"><Input required type="number" min="1" step="0.1" value={ana.weight_kg} onChange={(e) => setAna({ ...ana, weight_kg: e.target.value })} /></Field><Field label="Tipo sanguíneo"><Input required value={ana.blood_type} onChange={(e) => setAna({ ...ana, blood_type: e.target.value })} /></Field></Grid>{[["diseases","Doenças pré-existentes (escreva ‘Nenhuma’ se aplicável)"],["allergies","Alergias"],["medications","Medicamentos em uso"],["surgeries","Cirurgias anteriores"],["injuries","Lesões atuais ou recentes"],["family_history","Histórico familiar relevante"],["exercise_frequency","Frequência atual de atividade física"],["goals","Objetivos com a prática"]].map(([key,label]) => <Field key={key} label={label}><Textarea required value={ana[key]} onChange={(e) => setAna({ ...ana, [key]: e.target.value })} /></Field>)}<div className="grid md:grid-cols-3 gap-4"><Choice label="Tabagista?" field="smoker" /><Choice label="Consome álcool?" field="alcohol" /><Choice label="Possui liberação médica?" field="doctor_clearance" /></div></Section>
    {error && <p className="text-red-400">{error}</p>}<Button disabled={saving} className="w-full h-12 bg-red-600 hover:bg-red-700 rounded-none">{saving ? <Loader2 className="animate-spin" /> : adminMode ? "CADASTRAR ALUNO" : "ENVIAR MATRÍCULA"}</Button>
  </form></main>;
  function Choice({ label, field }) { return <div><Label>{label}</Label><div className="mt-2"><YesNo value={ana[field]} onChange={(value) => setAna({ ...ana, [field]: value })} /></div></div>; }
}
function Section({ title, children }) { return <section className="border border-zinc-800 p-5 space-y-4"><h2 className="font-heading text-2xl text-red-500">{title}</h2>{children}</section>; }
function Grid({ children }) { return <div className="grid md:grid-cols-2 gap-4">{children}</div>; }
function Field({ label, children }) { return <label className="block text-sm text-zinc-300 space-y-1"><Label>{label}</Label>{children}</label>; }
