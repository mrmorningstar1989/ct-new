import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const brl = (v) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const statusLabels = { paid: "Pago", pending: "Pendente", overdue: "Vencido" };
const statusColors = { paid: "text-emerald-500", pending: "text-yellow-500", overdue: "text-red-500" };

export default function StudentFinancial() {
  const [invoices, setInvoices] = useState([]);

  useEffect(() => {
    api.get("/invoices").then(r => setInvoices(r.data));
  }, []);

  const pending = invoices.filter(i => i.status !== "paid");
  const paid = invoices.filter(i => i.status === "paid");

  return (
    <div className="p-5 space-y-6">
      <div>
        <div className="text-[10px] uppercase tracking-widest text-red-500 mb-1">Financeiro</div>
        <h1 className="font-heading text-4xl leading-none">MENSALIDADES</h1>
      </div>

      {pending.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Pendentes</div>
          <div className="space-y-3">
            {pending.map(i => (
              <div key={i.id} className="card-flat p-5" data-testid={`student-invoice-${i.id}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-heading text-2xl">{brl(i.final_value || i.value)}</div>
                    <div className="text-xs text-zinc-500 font-mono mt-1">Competência {i.competency}</div>
                  </div>
                  <div className={`text-xs uppercase tracking-widest ${statusColors[i.status]}`}>{statusLabels[i.status]}</div>
                </div>
                <div className="mt-3 pt-3 border-t border-zinc-900 text-xs text-zinc-500">
                  Vencimento: <span className="font-mono text-white">{new Date(i.due_date).toLocaleDateString("pt-BR")}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {paid.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Histórico</div>
          <div className="space-y-2">
            {paid.map(i => (
              <div key={i.id} className="card-flat p-4 flex items-center justify-between">
                <div>
                  <div className="text-sm">{i.competency}</div>
                  <div className="text-xs text-zinc-500 font-mono">Pago em {i.paid_at ? new Date(i.paid_at).toLocaleDateString("pt-BR") : "—"}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-emerald-500">{brl(i.amount_paid || i.final_value)}</div>
                  <div className="text-[10px] uppercase text-zinc-500">{i.payment_method}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {invoices.length === 0 && <div className="card-flat p-8 text-center text-zinc-500">Sem cobranças no momento</div>}
    </div>
  );
}
