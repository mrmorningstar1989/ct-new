import { useEffect, useState } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { invalidateAcademy } from "@/lib/academy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Save, Upload, X, RefreshCw, Building2, Repeat } from "lucide-react";
import { toast } from "sonner";

const empty = {
  name: "", cnpj: "", email: "", phone: "", whatsapp: "",
  address: "", city: "", state: "", zip_code: "",
  logo_url: "", instagram: "", facebook: "", website: "",
  business_hours: "", tagline: "", auto_renew_enabled: true,
};

export default function Settings() {
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [lastGen, setLastGen] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/academy/settings");
      setForm({ ...empty, ...(data || {}), auto_renew_enabled: data?.auto_renew_enabled !== false });
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.patch("/academy/settings", form);
      invalidateAcademy();
      toast.success("Configurações salvas");
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };

  const onLogoFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) { toast.error("Logo deve ter até 500KB"); return; }
    const reader = new FileReader();
    reader.onload = () => setForm({ ...form, logo_url: reader.result });
    reader.readAsDataURL(file);
  };

  const removeLogo = () => setForm({ ...form, logo_url: "" });

  const generateNow = async () => {
    setGenerating(true);
    try {
      const { data } = await api.post("/invoices/generate-month");
      setLastGen(data);
      toast.success(`${data.created} mensalidade(s) geradas para ${data.competency}`);
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
    finally { setGenerating(false); }
  };

  if (loading) return <div className="text-zinc-400">Carregando...</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <div className="text-xs uppercase tracking-widest text-red-500 mb-1">Sistema</div>
        <h1 className="font-heading text-4xl leading-none">CONFIGURAÇÕES</h1>
      </div>

      {/* Academy identity */}
      <div className="card-flat p-6">
        <div className="flex items-center gap-2 mb-5">
          <Building2 className="w-5 h-5 text-red-500" />
          <h3 className="font-heading text-xl tracking-wide">IDENTIDADE DA ACADEMIA</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-6 mb-6">
          <div>
            <Label className="text-xs uppercase tracking-wider text-zinc-400 block mb-2">Logo</Label>
            <div className="w-32 h-32 border border-zinc-800 flex items-center justify-center bg-black overflow-hidden">
              {form.logo_url ? (
                <img src={form.logo_url} alt="Logo" className="max-w-full max-h-full object-contain" data-testid="academy-logo-preview" />
              ) : (
                <div className="text-[10px] uppercase tracking-widest text-zinc-600">Sem logo</div>
              )}
            </div>
            <div className="flex gap-2 mt-2">
              <label className="cursor-pointer inline-flex items-center gap-1 px-2 py-1 border border-zinc-700 text-xs text-zinc-300 hover:border-red-600 hover:text-red-500" data-testid="upload-logo-label">
                <Upload className="w-3 h-3" /> Enviar
                <input type="file" accept="image/*" onChange={onLogoFile} className="hidden" data-testid="upload-logo-input" />
              </label>
              {form.logo_url && (
                <button onClick={removeLogo} data-testid="remove-logo" className="inline-flex items-center gap-1 px-2 py-1 border border-zinc-700 text-xs text-zinc-500 hover:border-red-600 hover:text-red-500">
                  <X className="w-3 h-3" /> Remover
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <F label="Nome da academia *"><Input data-testid="settings-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></F>
            <F label="Slogan / Tagline"><Input data-testid="settings-tagline" value={form.tagline} placeholder="ex: Forjando campeões" onChange={(e) => setForm({ ...form, tagline: e.target.value })} /></F>
            <F label="CNPJ"><Input data-testid="settings-cnpj" value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} /></F>
            <F label="Email"><Input data-testid="settings-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></F>
            <F label="Telefone"><Input data-testid="settings-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></F>
            <F label="WhatsApp"><Input data-testid="settings-whatsapp" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></F>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <F label="Endereço" className="md:col-span-2"><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></F>
          <F label="CEP"><Input value={form.zip_code} onChange={(e) => setForm({ ...form, zip_code: e.target.value })} /></F>
          <F label="Cidade"><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></F>
          <F label="Estado"><Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></F>
          <F label="Horário de funcionamento"><Input value={form.business_hours} placeholder="Seg-Sex 6h-22h · Sáb 8h-14h" onChange={(e) => setForm({ ...form, business_hours: e.target.value })} /></F>
          <F label="Instagram"><Input value={form.instagram} placeholder="@ctwarrior" onChange={(e) => setForm({ ...form, instagram: e.target.value })} /></F>
          <F label="Website"><Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></F>
        </div>
      </div>

      {/* Auto-renew */}
      <div className="card-flat p-6">
        <div className="flex items-center gap-2 mb-5">
          <Repeat className="w-5 h-5 text-red-500" />
          <h3 className="font-heading text-xl tracking-wide">MENSALIDADES AUTOMÁTICAS</h3>
        </div>

        <div className="flex items-start justify-between gap-6 border-b border-zinc-800 pb-5 mb-5">
          <div className="flex-1">
            <div className="text-sm text-white">Renovar automaticamente todo dia 1 do mês</div>
            <div className="text-xs text-zinc-500 mt-1">
              O sistema gera as mensalidades do mês vigente para todos os alunos com matrícula ativa e plano mensal.
              O vencimento é o 5º dia útil do mês. Descontos personalizados são preservados.
            </div>
          </div>
          <Switch
            data-testid="auto-renew-switch"
            checked={form.auto_renew_enabled}
            onCheckedChange={(v) => setForm({ ...form, auto_renew_enabled: v })}
            className="data-[state=checked]:bg-red-600"
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm text-white">Gerar mensalidades do mês agora</div>
            <div className="text-xs text-zinc-500 mt-1">Ação manual — cria as pendentes que ainda não existem para o mês atual.</div>
            {lastGen && (
              <div className="text-xs text-emerald-500 mt-2 font-mono">
                ✓ {lastGen.created} criada(s) em {lastGen.competency}
              </div>
            )}
          </div>
          <Button onClick={generateNow} disabled={generating} data-testid="generate-month-button" className="bg-red-600 hover:bg-red-700 rounded-none">
            <RefreshCw className={`w-4 h-4 mr-2 ${generating ? "animate-spin" : ""}`} />
            {generating ? "Gerando..." : "Gerar Agora"}
          </Button>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} data-testid="save-settings-button" className="bg-red-600 hover:bg-red-700 rounded-none">
          <Save className="w-4 h-4 mr-2" /> {saving ? "Salvando..." : "Salvar Configurações"}
        </Button>
      </div>
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
