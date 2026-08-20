import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { biometricFeatureEnabled } from "@/lib/features";

export default function StudentProfile() {
  const { user } = useAuth();
  const [student, setStudent] = useState(null);

  useEffect(() => {
    if (!user?.linked_id) return;
    api.get(`/students/${user.linked_id}`).then(r => setStudent(r.data));
  }, [user]);

  if (!student) return <div className="p-6 text-zinc-400">Carregando...</div>;

  const revokeBiometricConsent = async () => {
    try {
      await api.delete(`/biometrics/students/${student.id}/consent`);
      setStudent({ ...student, biometric_consent: { ...(student.biometric_consent || {}), granted: false } });
      toast.success("Consentimento biométrico revogado. A presença manual continua disponível.");
    } catch (e) { toast.error(e.response?.data?.detail || "Não foi possível revogar o consentimento."); }
  };

  const rows = [
    ["Nome completo", student.full_name],
    ["Matrícula", student.matricula],
    ["CPF", student.cpf],
    ["Email", student.email],
    ["Telefone", student.phone],
    ["Data de nascimento", student.birth_date && new Date(student.birth_date).toLocaleDateString("pt-BR")],
    ["Endereço", [student.address, student.city, student.state].filter(Boolean).join(" · ")],
    ["Responsável", student.guardian_name],
    ["Contato responsável", student.guardian_phone],
  ].filter(([, v]) => v);

  return (
    <div className="p-5 space-y-6">
      <div>
        <div className="text-[10px] uppercase tracking-widest text-red-500 mb-1">Meu Perfil</div>
        <h1 className="font-heading text-4xl leading-none">{student.full_name.toUpperCase()}</h1>
      </div>

      <div className="card-flat p-5">
        <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-4">Dados pessoais</div>
        <div className="space-y-3">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between border-b border-zinc-900 pb-3 last:border-0">
              <div className="text-xs text-zinc-500">{k}</div>
              <div className="text-sm text-white text-right ml-4 truncate">{v}</div>
            </div>
          ))}
        </div>
      </div>

      {biometricFeatureEnabled && <div className="card-flat p-5">
        <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Reconhecimento facial</div>
        {student.biometric_consent?.granted ? <><p className="text-sm text-zinc-300 mb-4">Você autorizou o uso para sugestão de presença, sempre com confirmação do professor.</p><Button onClick={revokeBiometricConsent} variant="outline" className="rounded-none border-red-900 text-red-400 hover:bg-red-950">Revogar consentimento</Button></> : <p className="text-sm text-zinc-500">Você não autorizou reconhecimento facial. Sua presença é registrada manualmente.</p>}
      </div>}

      <div className="card-flat p-5">
        <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-4">Conta</div>
        <div className="text-xs text-zinc-500">Login</div>
        <div className="text-sm text-white mt-1">{user?.email}</div>
        <div className="text-[10px] text-zinc-600 mt-4">Para atualizar seus dados, procure a recepção da academia.</div>
      </div>
    </div>
  );
}
