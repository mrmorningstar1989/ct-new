import { useEffect, useState } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Send, Check, X, RefreshCw, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const brl = (v) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dtBR = (d) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";

export default function Reminders() {
  const [items, setItems] = useState([]);
  const [lastRun, setLastRun] = useState(null);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/reminders");
      setItems(data.items || []);
      setLastRun(data.last_run);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const runNow = async () => {
    setRunning(true);
    try {
      const { data } = await api.post("/reminders/generate-now");
      toast.success(`${data.created} novo(s) lembrete(s) preparado(s)`);
      load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
    finally { setRunning(false); }
  };

  const send = async (r) => {
    window.open(r.wa_url, "_blank");
    try {
      await api.post(`/reminders/${r.id}/mark-sent`);
      toast.success("Marcado como enviado");
      load();
    } catch { /* ignore */ }
  };

  const markSent = async (r) => {
    try {
      await api.post(`/reminders/${r.id}/mark-sent`);
      toast.success("Marcado como enviado");
      load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const dismiss = async (r) => {
    if (!window.confirm("Descartar este lembrete?")) return;
    try {
      await api.delete(`/reminders/${r.id}`);
      toast.success("Removido");
      load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const today = items.filter(x => x.kind === "due_today");
  const tomorrow = items.filter(x => x.kind === "due_tomorrow");
  const pendingTotal = items.filter(x => x.status === "pending").length;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-red-500 mb-1">Automação · Cron diário 08h</div>
          <h1 className="font-heading text-4xl leading-none">LEMBRETES</h1>
          <p className="text-sm text-zinc-500 mt-2 max-w-2xl">
            O sistema identifica automaticamente todos os dias às 08h os alunos com mensalidade vencendo hoje ou amanhã e prepara a mensagem personalizada. Clique em enviar para abrir a conversa no WhatsApp.
          </p>
        </div>
        <Button onClick={runNow} disabled={running} data-testid="run-reminders-now" className="bg-red-600 hover:bg-red-700 rounded-none">
          <RefreshCw className={`w-4 h-4 mr-2 ${running ? "animate-spin" : ""}`} /> {running ? "Processando..." : "Rodar Agora"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Kpi label="Vence hoje" value={today.length} tone="text-red-500" icon={AlertCircle} testId="kpi-today" />
        <Kpi label="Vence amanhã" value={tomorrow.length} tone="text-yellow-500" icon={Clock} testId="kpi-tomorrow" />
        <Kpi label="Pendentes" value={pendingTotal} tone="text-white" icon={Send} testId="kpi-pending" />
      </div>

      {lastRun?.last_run_at && (
        <div className="text-xs text-zinc-500 font-mono">
          Última execução automática: {new Date(lastRun.last_run_at).toLocaleString("pt-BR")} · {lastRun.created_count ?? 0} novo(s)
        </div>
      )}

      <Section title="Vencendo HOJE" items={today} onSend={send} onMark={markSent} onDismiss={dismiss} accent="text-red-500" testKind="today" />
      <Section title="Vencendo AMANHÃ" items={tomorrow} onSend={send} onMark={markSent} onDismiss={dismiss} accent="text-yellow-500" testKind="tomorrow" />

      {!loading && items.length === 0 && (
        <div className="card-flat p-10 text-center text-zinc-500">
          Sem lembretes no momento. Clique em "Rodar Agora" para reprocessar ou aguarde a execução automática das 08h.
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, tone, icon: Icon, testId }) {
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

function Section({ title, items, onSend, onMark, onDismiss, accent, testKind }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className={`text-[10px] uppercase tracking-widest mb-3 ${accent}`}>{title} ({items.length})</div>
      <div className="card-flat overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-800 text-left">
            <tr className="text-[10px] uppercase tracking-widest text-zinc-500">
              <th className="px-5 py-3">Aluno</th>
              <th className="px-5 py-3">Telefone</th>
              <th className="px-5 py-3">Competência</th>
              <th className="px-5 py-3 text-right">Valor</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id} className={`border-b border-zinc-900 ${r.status === "sent" ? "opacity-60" : "hover:bg-zinc-900/50"}`} data-testid={`reminder-row-${testKind}-${r.id}`}>
                <td className="px-5 py-3 font-medium">{r.student_name}</td>
                <td className="px-5 py-3 text-zinc-400 font-mono text-xs">{r.phone || "—"}</td>
                <td className="px-5 py-3 font-mono text-xs">{r.competency} · {dtBR(r.due_date)}</td>
                <td className="px-5 py-3 text-right font-mono">{brl(r.value)}</td>
                <td className="px-5 py-3">
                  {r.status === "sent" ? (
                    <span className="text-xs uppercase text-emerald-500 flex items-center gap-1"><Check className="w-3 h-3" /> Enviado</span>
                  ) : (
                    <span className="text-xs uppercase text-yellow-500">Pendente</span>
                  )}
                </td>
                <td className="px-5 py-3 text-right space-x-2">
                  {r.status !== "sent" && (
                    <>
                      <button onClick={() => onSend(r)} data-testid={`send-reminder-${r.id}`} className="text-xs bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 inline-flex items-center gap-1">
                        <Send className="w-3 h-3" /> WhatsApp
                      </button>
                      <button onClick={() => onMark(r)} data-testid={`mark-sent-${r.id}`} className="text-xs border border-zinc-700 hover:border-emerald-600 hover:text-emerald-500 text-zinc-400 px-3 py-1.5 inline-flex items-center gap-1">
                        <Check className="w-3 h-3" /> Só marcar
                      </button>
                    </>
                  )}
                  <button onClick={() => onDismiss(r)} data-testid={`dismiss-${r.id}`} className="text-zinc-500 hover:text-red-500 px-2 py-1.5"><X className="w-3.5 h-3.5" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
