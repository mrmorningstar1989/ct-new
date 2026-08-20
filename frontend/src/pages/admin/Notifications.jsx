import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MessageCircle, AlertTriangle, TrendingDown, Award, Clock, Send } from "lucide-react";
import { toast } from "sonner";
import { brl, dtBR } from "@/lib/pdf";

const templates = {
  overdue: (n) => `Olá ${n}! Aqui é da sua academia 🥋\n\nVimos que sua mensalidade de ${"{competency}"} (${"{value}"}) está em atraso há ${"{days_late}"} dias. Podemos combinar o pagamento? Estamos à disposição!\n\nEquipe da academia`,
  upcoming: (n) => `Olá ${n}! Passando para lembrar da sua mensalidade 🥋\n\nCompetência: ${"{competency}"}\nValor: ${"{value}"}\nVencimento: ${"{due_date}"}\n\nQualquer dúvida estamos por aqui!`,
  low_freq: (n) => `E aí ${n}, sentimos sua falta no tatame! 🥋\n\nSua frequência do último mês está em ${"{frequency_pct}"}%. Bora voltar? Nos avisa se está tudo bem por aí.\n\nEquipe da academia`,
  graduation: (n) => `Parabéns ${n}! 🥋\n\nVocê já está há ${"{days_on_belt}"} dias na faixa ${"{belt_name}"} de ${"{modality_name}"} e pode estar próximo da próxima graduação. Fale com o professor!\n\nEquipe da academia`,
};

export default function Notifications() {
  const [data, setData] = useState(null);
  const [dialog, setDialog] = useState(null); // {item, template, message}

  const load = async () => { const r = await api.get("/notifications/summary"); setData(r.data); };
  useEffect(() => { load(); }, []);

  const buildMsg = (kind, item) => {
    const raw = templates[kind](item.student_name?.split(" ")[0] || "aluno");
    return raw
      .replace("{competency}", item.competency || "")
      .replace("{value}", brl(item.value))
      .replace("{days_late}", item.days_late)
      .replace("{days_until}", item.days_until)
      .replace("{due_date}", dtBR(item.due_date))
      .replace("{frequency_pct}", item.frequency_pct)
      .replace("{belt_name}", item.belt_name)
      .replace("{modality_name}", item.modality_name)
      .replace("{days_on_belt}", item.days_on_belt);
  };

  const openDialog = (kind, item) => {
    setDialog({ kind, item, message: buildMsg(kind, item) });
  };

  const sendWhatsapp = () => {
    if (!dialog) return;
    const phone = (dialog.item.phone || "").replace(/\D/g, "");
    if (!phone) { toast.error("Aluno sem telefone cadastrado"); return; }
    const p = phone.startsWith("55") ? phone : `55${phone}`;
    window.open(`https://wa.me/${p}?text=${encodeURIComponent(dialog.message)}`, "_blank");
    setDialog(null);
    toast.success("Mensagem aberta no WhatsApp");
  };

  if (!data) return <div className="text-zinc-400">Carregando...</div>;
  const t = data.totals;

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-widest text-red-500 mb-1">Central de Notificações</div>
        <h1 className="font-heading text-4xl leading-none">WHATSAPP</h1>
        <p className="text-sm text-zinc-500 mt-2">Alertas automáticos identificados. Edite a mensagem antes de enviar.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="Inadimplência" value={t.overdue} icon={AlertTriangle} tone="text-red-500" testId="notif-kpi-overdue" />
        <Kpi label="A vencer (7 dias)" value={t.upcoming_invoices} icon={Clock} tone="text-yellow-500" testId="notif-kpi-upcoming" />
        <Kpi label="Baixa frequência" value={t.low_frequency} icon={TrendingDown} tone="text-orange-500" testId="notif-kpi-lowfreq" />
        <Kpi label="Perto de graduar" value={t.upcoming_graduations} icon={Award} tone="text-emerald-500" testId="notif-kpi-graduation" />
      </div>

      <Tabs defaultValue="overdue">
        <TabsList className="bg-transparent border-b border-zinc-800 rounded-none w-full justify-start h-auto p-0 flex-wrap">
          <TabTrig v="overdue" label={`Inadimplência (${t.overdue})`} testId="tab-overdue" />
          <TabTrig v="upcoming" label={`A vencer (${t.upcoming_invoices})`} testId="tab-upcoming" />
          <TabTrig v="lowfreq" label={`Baixa freq. (${t.low_frequency})`} testId="tab-lowfreq" />
          <TabTrig v="grad" label={`Graduação (${t.upcoming_graduations})`} testId="tab-grad" />
        </TabsList>

        <TabsContent value="overdue" className="mt-6">
          <List items={data.overdue} empty="Sem inadimplência 🎯" columns={[
            { key: "student_name", label: "Aluno" },
            { key: "competency", label: "Comp.", mono: true },
            { key: "value", label: "Valor", format: brl, mono: true },
            { key: "days_late", label: "Atraso", format: (v) => `${v} dias`, className: "text-red-500 font-heading" },
          ]} onSend={(it) => openDialog("overdue", it)} testKind="overdue" />
        </TabsContent>

        <TabsContent value="upcoming" className="mt-6">
          <List items={data.upcoming_invoices} empty="Nenhuma cobrança próxima" columns={[
            { key: "student_name", label: "Aluno" },
            { key: "competency", label: "Comp.", mono: true },
            { key: "value", label: "Valor", format: brl, mono: true },
            { key: "days_until", label: "Vence em", format: (v) => v === 0 ? "hoje" : `${v} dias` },
          ]} onSend={(it) => openDialog("upcoming", it)} testKind="upcoming" />
        </TabsContent>

        <TabsContent value="lowfreq" className="mt-6">
          <List items={data.low_frequency} empty="Todos os alunos estão em dia com a frequência 🥋" columns={[
            { key: "student_name", label: "Aluno" },
            { key: "frequency_pct", label: "Freq.", format: (v) => `${v}%`, className: "text-orange-500 font-heading" },
            { key: "present", label: "Presenças", mono: true },
            { key: "absent", label: "Faltas", mono: true },
          ]} onSend={(it) => openDialog("low_freq", it)} testKind="lowfreq" />
        </TabsContent>

        <TabsContent value="grad" className="mt-6">
          <List items={data.upcoming_graduations} empty="Nenhum aluno próximo de graduação" columns={[
            { key: "student_name", label: "Aluno" },
            { key: "modality_name", label: "Modalidade" },
            { key: "belt_name", label: "Faixa atual" },
            { key: "days_on_belt", label: "Dias na faixa", format: (v) => `${v}`, className: "font-heading text-emerald-500" },
          ]} onSend={(it) => openDialog("graduation", it)} testKind="graduation" />
        </TabsContent>
      </Tabs>

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="bg-[#121212] border-zinc-800 text-white rounded-none max-w-lg">
          <DialogHeader><DialogTitle className="font-heading text-2xl">MENSAGEM WHATSAPP</DialogTitle></DialogHeader>
          {dialog && (
            <div className="space-y-3">
              <div className="text-xs text-zinc-500">
                Para: <span className="text-white">{dialog.item.student_name}</span>
                <span className="ml-3 font-mono">{dialog.item.phone || "sem telefone"}</span>
              </div>
              <Textarea
                data-testid="whatsapp-message-textarea"
                rows={10}
                value={dialog.message}
                onChange={(e) => setDialog({ ...dialog, message: e.target.value })}
                className="bg-transparent border-zinc-800 rounded-none font-mono text-sm"
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)} className="rounded-none border-zinc-700">Cancelar</Button>
            <Button onClick={sendWhatsapp} data-testid="send-whatsapp-button" className="bg-emerald-700 hover:bg-emerald-800 rounded-none">
              <Send className="w-4 h-4 mr-2" /> Abrir WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({ label, value, icon: Icon, tone, testId }) {
  return (
    <div className="card-flat p-5" data-testid={testId}>
      <div className="flex items-start justify-between">
        <div className="text-[10px] uppercase tracking-widest text-zinc-500">{label}</div>
        {Icon && <Icon className="w-4 h-4 text-zinc-600" />}
      </div>
      <div className={`font-heading text-4xl mt-3 ${tone}`}>{value}</div>
    </div>
  );
}

function TabTrig({ v, label, testId }) {
  return (
    <TabsTrigger value={v} data-testid={testId} className="rounded-none data-[state=active]:bg-transparent data-[state=active]:text-red-500 data-[state=active]:border-b-2 data-[state=active]:border-red-600 px-4 py-3 uppercase text-xs tracking-widest text-zinc-500">
      {label}
    </TabsTrigger>
  );
}

function List({ items, columns, empty, onSend, testKind }) {
  if (!items?.length) {
    return <div className="card-flat p-10 text-center text-zinc-500">{empty}</div>;
  }
  return (
    <div className="card-flat overflow-hidden">
      <table className="w-full text-sm">
        <thead className="border-b border-zinc-800 text-left">
          <tr className="text-[10px] uppercase tracking-widest text-zinc-500">
            {columns.map(c => <th key={c.key} className="px-5 py-3">{c.label}</th>)}
            <th className="px-5 py-3 text-right">Ação</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => (
            <tr key={idx} className="border-b border-zinc-900 hover:bg-zinc-900/50" data-testid={`notif-row-${testKind}-${idx}`}>
              {columns.map(c => (
                <td key={c.key} className={`px-5 py-3 ${c.mono ? "font-mono text-xs" : ""} ${c.className || ""}`}>
                  {c.format ? c.format(it[c.key]) : it[c.key]}
                </td>
              ))}
              <td className="px-5 py-3 text-right">
                <button
                  onClick={() => onSend(it)}
                  data-testid={`notif-send-${testKind}-${idx}`}
                  className="text-xs bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 inline-flex items-center gap-1"
                >
                  <MessageCircle className="w-3 h-3" /> WhatsApp
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
