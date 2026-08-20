import { useEffect, useState } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Check, MessageCircle, Download, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { createPdf, addTable, savePdf, brl as fmtBrl, dtBR } from "@/lib/pdf";

const brl = (v) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const statusLabels = { paid: "Pago", pending: "Pendente", overdue: "Vencido" };
const statusColors = { paid: "text-emerald-500", pending: "text-yellow-500", overdue: "text-red-500" };

export default function Financial() {
  const [invoices, setInvoices] = useState([]);
  const [overdue, setOverdue] = useState([]);
  const [students, setStudents] = useState([]);
  const [payDialog, setPayDialog] = useState(null);
  const [payForm, setPayForm] = useState({ method: "pix", date: "", amount: "", notes: "" });

  const load = async () => {
    const [i, o, s] = await Promise.all([api.get("/invoices"), api.get("/invoices/overdue/list"), api.get("/students")]);
    setInvoices(i.data); setOverdue(o.data); setStudents(s.data);
  };
  useEffect(() => { load(); }, []);

  const studentName = (id) => students.find(s => s.id === id)?.full_name || "—";
  const studentPhone = (id) => students.find(s => s.id === id)?.phone || students.find(s => s.id === id)?.whatsapp || "";

  const openPay = (inv) => {
    const today = new Date().toISOString().slice(0, 10);
    const due = inv.due_date;
    const useEarly = inv.early_value != null && today <= due;
    const suggested = useEarly ? inv.early_value : (inv.final_value || inv.value);
    setPayDialog(inv);
    setPayForm({ method: "pix", date: today, amount: suggested?.toString() || "", notes: "" });
  };

  const onDateChange = (newDate) => {
    if (!payDialog) return;
    const inv = payDialog;
    const useEarly = inv.early_value != null && newDate <= inv.due_date;
    const suggested = useEarly ? inv.early_value : (inv.final_value || inv.value);
    setPayForm({ ...payForm, date: newDate, amount: suggested?.toString() || "" });
  };

  const registerPayment = async () => {
    if (!payDialog) return;
    try {
      await api.post(`/invoices/${payDialog.id}/pay`, {
        payment_method: payForm.method,
        paid_at: payForm.date,
        amount_paid: parseFloat(payForm.amount),
        notes: payForm.notes || null,
      });
      toast.success("Pagamento registrado");
      setPayDialog(null);
      load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const reopenPayment = async (inv) => {
    if (!window.confirm(`Estornar pagamento da mensalidade ${inv.competency}?`)) return;
    try {
      await api.post(`/invoices/${inv.id}/reopen`);
      toast.success("Pagamento estornado");
      load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const sendWhatsapp = (inv) => {
    const s = students.find(st => st.id === inv.student_id);
    const phone = (s?.whatsapp || s?.phone || "").replace(/\D/g, "");
    const value = inv.early_value != null ? `Até ${dtBR(inv.due_date)}: ${brl(inv.early_value)} | Após: ${brl(inv.final_value || inv.value)}` : brl(inv.final_value || inv.value);
    const msg = encodeURIComponent(
      `Olá ${s?.full_name || ""}! Passando para lembrar da mensalidade referente a ${inv.competency}: ${value}. Vencimento: ${new Date(inv.due_date).toLocaleDateString("pt-BR")}. - Equipe da academia`
    );
    window.open(`https://wa.me/55${phone}?text=${msg}`, "_blank");
  };

  const totals = {
    paid: invoices.filter(i => i.status === "paid").reduce((a, b) => a + (b.amount_paid || 0), 0),
    pending: invoices.filter(i => i.status === "pending").reduce((a, b) => a + (b.final_value || b.value), 0),
    overdue: overdue.reduce((a, b) => a + (b.final_value || b.value), 0),
  };

  const exportInvoicesPdf = async () => {
    const doc = await createPdf("Relatório de Mensalidades", `${invoices.length} mensalidades emitidas`);
    const rows = invoices.map(i => [
      studentName(i.student_id), i.competency, dtBR(i.due_date),
      fmtBrl(i.final_value || i.value),
      statusLabels[i.status] || i.status,
      i.paid_at ? dtBR(i.paid_at) : "-",
      i.payment_method || "-",
    ]);
    let y = addTable(doc, ["Aluno", "Competência", "Vencimento", "Valor", "Status", "Pago em", "Forma"], rows);
    y += 20;
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    doc.text(`Recebido: ${fmtBrl(totals.paid)}    A receber: ${fmtBrl(totals.pending)}    Inadimplência: ${fmtBrl(totals.overdue)}`, 40, y);
    savePdf(doc, `mensalidades-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success("PDF gerado");
  };

  const exportOverduePdf = async () => {
    const doc = await createPdf("Relatório de Inadimplência", `${overdue.length} títulos em atraso`);
    const rows = overdue.map(i => [
      i.student?.full_name || "-", studentPhone(i.student_id), i.competency,
      dtBR(i.due_date), fmtBrl(i.final_value || i.value), `${i.days_late} dias`,
    ]);
    addTable(doc, ["Aluno", "Telefone", "Competência", "Vencimento", "Valor", "Atraso"], rows);
    savePdf(doc, `inadimplencia-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success("PDF gerado");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-red-500 mb-1">Gestão</div>
          <h1 className="font-heading text-4xl leading-none">FINANCEIRO</h1>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportInvoicesPdf} data-testid="export-invoices-pdf" variant="outline" className="rounded-none border-zinc-700 hover:border-red-600 hover:text-red-500">
            <Download className="w-4 h-4 mr-2" /> Mensalidades PDF
          </Button>
          <Button onClick={exportOverduePdf} data-testid="export-overdue-pdf" variant="outline" className="rounded-none border-zinc-700 hover:border-red-600 hover:text-red-500">
            <Download className="w-4 h-4 mr-2" /> Inadimplência PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card-flat p-5"><div className="text-[10px] uppercase tracking-widest text-zinc-500">Recebido</div><div className="font-heading text-3xl text-emerald-500 mt-2">{brl(totals.paid)}</div></div>
        <div className="card-flat p-5"><div className="text-[10px] uppercase tracking-widest text-zinc-500">A Receber</div><div className="font-heading text-3xl text-yellow-500 mt-2">{brl(totals.pending)}</div></div>
        <div className="card-flat p-5"><div className="text-[10px] uppercase tracking-widest text-zinc-500">Inadimplência</div><div className="font-heading text-3xl text-red-500 mt-2">{brl(totals.overdue)}</div></div>
      </div>

      <Tabs defaultValue="invoices">
        <TabsList className="bg-transparent border-b border-zinc-800 rounded-none w-full justify-start h-auto p-0">
          <TabsTrigger value="invoices" data-testid="tab-invoices" className="rounded-none data-[state=active]:bg-transparent data-[state=active]:text-red-500 data-[state=active]:border-b-2 data-[state=active]:border-red-600 px-4 py-3 uppercase text-xs tracking-widest text-zinc-500">Mensalidades</TabsTrigger>
          <TabsTrigger value="overdue" data-testid="tab-overdue" className="rounded-none data-[state=active]:bg-transparent data-[state=active]:text-red-500 data-[state=active]:border-b-2 data-[state=active]:border-red-600 px-4 py-3 uppercase text-xs tracking-widest text-zinc-500">Inadimplência ({overdue.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" className="mt-6">
          <div className="card-flat overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-800 text-left">
                <tr className="text-[10px] uppercase tracking-widest text-zinc-500">
                  <th className="px-5 py-3">Aluno</th>
                  <th className="px-5 py-3">Comp.</th>
                  <th className="px-5 py-3">Vencimento</th>
                  <th className="px-5 py-3 text-right">c/ desc.</th>
                  <th className="px-5 py-3 text-right">s/ desc.</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 && <tr><td colSpan="7" className="px-5 py-10 text-center text-zinc-500">Nenhuma mensalidade emitida</td></tr>}
                {invoices.map(i => (
                  <tr key={i.id} className="border-b border-zinc-900 hover:bg-zinc-900/50" data-testid={`invoice-row-${i.id}`}>
                    <td className="px-5 py-3">{studentName(i.student_id)}</td>
                    <td className="px-5 py-3 font-mono text-xs">{i.competency}</td>
                    <td className="px-5 py-3 font-mono text-xs">{new Date(i.due_date).toLocaleDateString("pt-BR")}</td>
                    <td className="px-5 py-3 text-right font-mono text-emerald-400">{i.early_value != null ? brl(i.early_value) : "—"}</td>
                    <td className="px-5 py-3 text-right font-mono">{brl(i.final_value || i.value)}</td>
                    <td className="px-5 py-3"><span className={`text-xs uppercase tracking-wider font-medium ${statusColors[i.status]}`}>{statusLabels[i.status]}</span></td>
                    <td className="px-5 py-3 text-right">
                      {i.status !== "paid" ? (
                        <Button size="sm" onClick={() => openPay(i)} data-testid={`pay-invoice-${i.id}`} className="rounded-none bg-emerald-700 hover:bg-emerald-800 text-white h-7 text-xs">
                          <Check className="w-3 h-3 mr-1" /> Dar baixa
                        </Button>
                      ) : (
                        <button onClick={() => reopenPayment(i)} data-testid={`reopen-invoice-${i.id}`} className="text-zinc-500 hover:text-red-500 text-xs inline-flex items-center gap-1">
                          <Undo2 className="w-3 h-3" /> Estornar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="overdue" className="mt-6">
          <div className="card-flat overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-800 text-left">
                <tr className="text-[10px] uppercase tracking-widest text-zinc-500">
                  <th className="px-5 py-3">Aluno</th>
                  <th className="px-5 py-3">Telefone</th>
                  <th className="px-5 py-3">Comp.</th>
                  <th className="px-5 py-3 text-right">Valor</th>
                  <th className="px-5 py-3">Atraso</th>
                  <th className="px-5 py-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {overdue.length === 0 && <tr><td colSpan="6" className="px-5 py-10 text-center text-emerald-500">Sem inadimplência 🥋</td></tr>}
                {overdue.map(i => (
                  <tr key={i.id} className="border-b border-zinc-900 hover:bg-zinc-900/50">
                    <td className="px-5 py-3">{i.student?.full_name}</td>
                    <td className="px-5 py-3 text-zinc-400 font-mono text-xs">{studentPhone(i.student_id)}</td>
                    <td className="px-5 py-3 font-mono text-xs">{i.competency}</td>
                    <td className="px-5 py-3 text-right font-mono">{brl(i.final_value || i.value)}</td>
                    <td className="px-5 py-3"><span className="text-red-500 font-heading text-lg">{i.days_late}</span></td>
                    <td className="px-5 py-3 text-right space-x-2">
                      <button onClick={() => openPay(i)} data-testid={`pay-overdue-${i.id}`} className="text-xs bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 inline-flex items-center gap-1">
                        <Check className="w-3 h-3" /> Baixa
                      </button>
                      <button onClick={() => sendWhatsapp(i)} data-testid={`whatsapp-${i.id}`} className="text-xs bg-emerald-800/40 border border-emerald-700 hover:bg-emerald-700 text-emerald-300 hover:text-white px-3 py-1.5 inline-flex items-center gap-1">
                        <MessageCircle className="w-3 h-3" /> WhatsApp
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!payDialog} onOpenChange={(o) => !o && setPayDialog(null)}>
        <DialogContent className="bg-[#121212] border-zinc-800 text-white rounded-none max-w-md">
          <DialogHeader><DialogTitle className="font-heading text-2xl">DAR BAIXA MANUAL</DialogTitle></DialogHeader>
          {payDialog && (
            <div className="space-y-4">
              <div className="p-4 border border-zinc-800 bg-black">
                <div className="text-sm text-zinc-400">{studentName(payDialog.student_id)}</div>
                <div className="text-xs text-zinc-500 font-mono mt-1">Competência {payDialog.competency} · Vence {dtBR(payDialog.due_date)}</div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  {payDialog.early_value != null && (
                    <div className="border-l-2 border-emerald-600 pl-2">
                      <div className="text-emerald-500 uppercase tracking-widest text-[9px]">Até 5º dia útil</div>
                      <div className="font-mono text-emerald-400 mt-0.5">{brl(payDialog.early_value)}</div>
                    </div>
                  )}
                  <div className="border-l-2 border-zinc-700 pl-2">
                    <div className="text-zinc-500 uppercase tracking-widest text-[9px]">Após vencimento</div>
                    <div className="font-mono text-white mt-0.5">{brl(payDialog.final_value || payDialog.value)}</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <F label="Data do pagamento">
                  <Input type="date" data-testid="payment-date-input" value={payForm.date} onChange={(e) => onDateChange(e.target.value)} />
                </F>
                <F label="Valor recebido (R$)">
                  <Input type="number" step="0.01" data-testid="payment-amount-input" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} />
                </F>
              </div>

              <F label="Forma de pagamento">
                <Select value={payForm.method} onValueChange={(v) => setPayForm({ ...payForm, method: v })}>
                  <SelectTrigger className="bg-transparent border-zinc-800 rounded-none" data-testid="payment-method-select"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#121212] border-zinc-800 text-white rounded-none">
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="cash">Dinheiro</SelectItem>
                    <SelectItem value="debit_card">Cartão de Débito</SelectItem>
                    <SelectItem value="credit_card">Cartão de Crédito</SelectItem>
                    <SelectItem value="transfer">Transferência</SelectItem>
                    <SelectItem value="boleto">Boleto</SelectItem>
                    <SelectItem value="other">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </F>

              <F label="Observação (opcional)">
                <Textarea rows={2} data-testid="payment-notes-input" value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} className="bg-transparent border-zinc-800 rounded-none" />
              </F>

              <div className="text-[11px] text-zinc-500">
                O valor é sugerido automaticamente conforme a data escolhida (desconto até o 5º dia útil), mas você pode editar manualmente.
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialog(null)} className="rounded-none border-zinc-700">Cancelar</Button>
            <Button onClick={registerPayment} data-testid="confirm-payment-button" className="bg-emerald-700 hover:bg-emerald-800 rounded-none">Confirmar Baixa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function F({ label, children }) {
  return (
    <div>
      <Label className="text-xs uppercase tracking-wider text-zinc-400">{label}</Label>
      <div className="mt-1.5 [&_input]:bg-transparent [&_input]:border-zinc-800 [&_input]:rounded-none">{children}</div>
    </div>
  );
}
