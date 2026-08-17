import { useEffect, useState } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Check, MessageCircle } from "lucide-react";
import { toast } from "sonner";

const brl = (v) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const statusLabels = { paid: "Pago", pending: "Pendente", overdue: "Vencido" };
const statusColors = { paid: "text-emerald-500", pending: "text-yellow-500", overdue: "text-red-500" };

export default function Financial() {
  const [invoices, setInvoices] = useState([]);
  const [overdue, setOverdue] = useState([]);
  const [students, setStudents] = useState([]);
  const [payDialog, setPayDialog] = useState(null);
  const [payMethod, setPayMethod] = useState("pix");

  const load = async () => {
    const [i, o, s] = await Promise.all([api.get("/invoices"), api.get("/invoices/overdue/list"), api.get("/students")]);
    setInvoices(i.data); setOverdue(o.data); setStudents(s.data);
  };
  useEffect(() => { load(); }, []);

  const studentName = (id) => students.find(s => s.id === id)?.full_name || "—";
  const studentPhone = (id) => students.find(s => s.id === id)?.phone || students.find(s => s.id === id)?.whatsapp || "";

  const registerPayment = async () => {
    if (!payDialog) return;
    try {
      await api.post(`/invoices/${payDialog.id}/pay`, { payment_method: payMethod });
      toast.success("Pagamento registrado");
      setPayDialog(null);
      load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const sendWhatsapp = (inv) => {
    const s = students.find(st => st.id === inv.student_id);
    const phone = (s?.whatsapp || s?.phone || "").replace(/\D/g, "");
    const msg = encodeURIComponent(
      `Olá ${s?.full_name || ""}, tudo bem? Passando para lembrar da mensalidade referente a ${inv.competency} no valor de ${brl(inv.final_value || inv.value)}, com vencimento em ${new Date(inv.due_date).toLocaleDateString("pt-BR")}. Qualquer dúvida estamos à disposição! - CT Warrior`
    );
    window.open(`https://wa.me/55${phone}?text=${msg}`, "_blank");
  };

  const totals = {
    paid: invoices.filter(i => i.status === "paid").reduce((a, b) => a + (b.amount_paid || 0), 0),
    pending: invoices.filter(i => i.status === "pending").reduce((a, b) => a + (b.final_value || b.value), 0),
    overdue: overdue.reduce((a, b) => a + (b.final_value || b.value), 0),
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-widest text-red-500 mb-1">Gestão</div>
        <h1 className="font-heading text-4xl leading-none">FINANCEIRO</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card-flat p-5">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500">Recebido</div>
          <div className="font-heading text-3xl text-emerald-500 mt-2">{brl(totals.paid)}</div>
        </div>
        <div className="card-flat p-5">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500">A Receber</div>
          <div className="font-heading text-3xl text-yellow-500 mt-2">{brl(totals.pending)}</div>
        </div>
        <div className="card-flat p-5">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500">Inadimplência</div>
          <div className="font-heading text-3xl text-red-500 mt-2">{brl(totals.overdue)}</div>
        </div>
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
                  <th className="px-5 py-3">Competência</th>
                  <th className="px-5 py-3">Vencimento</th>
                  <th className="px-5 py-3 text-right">Valor</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 && <tr><td colSpan="6" className="px-5 py-10 text-center text-zinc-500">Nenhuma mensalidade emitida</td></tr>}
                {invoices.map(i => (
                  <tr key={i.id} className="border-b border-zinc-900 hover:bg-zinc-900/50" data-testid={`invoice-row-${i.id}`}>
                    <td className="px-5 py-3">{studentName(i.student_id)}</td>
                    <td className="px-5 py-3 font-mono text-xs">{i.competency}</td>
                    <td className="px-5 py-3 font-mono text-xs">{new Date(i.due_date).toLocaleDateString("pt-BR")}</td>
                    <td className="px-5 py-3 text-right font-mono">{brl(i.final_value || i.value)}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs uppercase tracking-wider font-medium ${statusColors[i.status]}`}>{statusLabels[i.status]}</span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {i.status !== "paid" && (
                        <Button size="sm" onClick={() => { setPayDialog(i); setPayMethod("pix"); }} data-testid={`pay-invoice-${i.id}`} className="rounded-none bg-emerald-700 hover:bg-emerald-800 text-white h-7 text-xs">
                          <Check className="w-3 h-3 mr-1" /> Pagar
                        </Button>
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
                  <th className="px-5 py-3">Competência</th>
                  <th className="px-5 py-3 text-right">Valor</th>
                  <th className="px-5 py-3">Dias em atraso</th>
                  <th className="px-5 py-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {overdue.length === 0 && <tr><td colSpan="6" className="px-5 py-10 text-center text-emerald-500">Nenhuma inadimplência! 🥋</td></tr>}
                {overdue.map(i => (
                  <tr key={i.id} className="border-b border-zinc-900 hover:bg-zinc-900/50">
                    <td className="px-5 py-3">{i.student?.full_name}</td>
                    <td className="px-5 py-3 text-zinc-400 font-mono text-xs">{studentPhone(i.student_id)}</td>
                    <td className="px-5 py-3 font-mono text-xs">{i.competency}</td>
                    <td className="px-5 py-3 text-right font-mono">{brl(i.final_value || i.value)}</td>
                    <td className="px-5 py-3"><span className="text-red-500 font-heading text-lg">{i.days_late}</span></td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => sendWhatsapp(i)} data-testid={`whatsapp-${i.id}`} className="text-xs bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 inline-flex items-center gap-1">
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
          <DialogHeader><DialogTitle className="font-heading text-2xl">REGISTRAR PAGAMENTO</DialogTitle></DialogHeader>
          {payDialog && (
            <div className="space-y-4">
              <div className="p-4 border border-zinc-800 bg-black">
                <div className="text-sm text-zinc-400">{studentName(payDialog.student_id)}</div>
                <div className="font-heading text-3xl mt-1">{brl(payDialog.final_value || payDialog.value)}</div>
                <div className="text-xs text-zinc-500 font-mono mt-1">Competência {payDialog.competency}</div>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-zinc-400">Forma de pagamento</Label>
                <Select value={payMethod} onValueChange={setPayMethod}>
                  <SelectTrigger className="bg-transparent border-zinc-800 rounded-none mt-2"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#121212] border-zinc-800 text-white rounded-none">
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="cash">Dinheiro</SelectItem>
                    <SelectItem value="debit_card">Cartão de Débito</SelectItem>
                    <SelectItem value="credit_card">Cartão de Crédito</SelectItem>
                    <SelectItem value="transfer">Transferência</SelectItem>
                    <SelectItem value="boleto">Boleto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialog(null)} className="rounded-none border-zinc-700">Cancelar</Button>
            <Button onClick={registerPayment} data-testid="confirm-payment-button" className="bg-emerald-700 hover:bg-emerald-800 rounded-none">Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
