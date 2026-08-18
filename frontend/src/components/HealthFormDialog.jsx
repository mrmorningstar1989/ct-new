import { useEffect, useState } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Printer, Save, HeartPulse } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getAcademy } from "@/lib/academy";

const PARQ_QUESTIONS = [
  { key: "q1_heart_condition", label: "Algum médico já disse que você possui problema cardíaco e recomendou atividade física somente sob supervisão médica?" },
  { key: "q2_chest_pain_activity", label: "Você sente dor no peito quando pratica atividade física?" },
  { key: "q3_chest_pain_month", label: "No último mês, sentiu dor no peito sem estar fazendo atividade física?" },
  { key: "q4_balance_loss", label: "Você perde o equilíbrio devido a tonturas ou já perdeu a consciência?" },
  { key: "q5_bone_joint", label: "Possui algum problema ósseo ou articular que poderia piorar com atividade física?" },
  { key: "q6_medication", label: "Toma atualmente algum medicamento para pressão arterial ou coração?" },
  { key: "q7_other_reason", label: "Sabe de alguma outra razão pela qual não deveria praticar atividade física?" },
];

const emptyParq = () => {
  const p = {};
  PARQ_QUESTIONS.forEach(q => (p[q.key] = null));
  p.notes = "";
  return p;
};

const emptyAna = () => ({
  height_cm: "", weight_kg: "", blood_type: "",
  diseases: "", allergies: "", medications: "", surgeries: "", injuries: "",
  family_history: "", smoker: null, alcohol: null,
  exercise_frequency: "", prior_martial_arts: "", goals: "",
  doctor_clearance: null, doctor_name: "", notes: "",
});

export default function HealthFormDialog({ student, open, onOpenChange, onSaved }) {
  const [parq, setParq] = useState(emptyParq());
  const [ana, setAna] = useState(emptyAna());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !student) return;
    (async () => {
      try {
        const { data } = await api.get(`/students/${student.id}`);
        setParq({ ...emptyParq(), ...(data.parq || {}) });
        setAna({ ...emptyAna(), ...(data.anamnesis || {}) });
      } catch { /* ignore */ }
    })();
  }, [open, student]);

  const save = async () => {
    if (!student) return;
    setSaving(true);
    try {
      await api.patch(`/students/${student.id}`, {
        parq: { ...parq, filled_at: new Date().toISOString().slice(0, 10) },
        anamnesis: {
          ...ana,
          height_cm: ana.height_cm === "" ? null : parseFloat(ana.height_cm),
          weight_kg: ana.weight_kg === "" ? null : parseFloat(ana.weight_kg),
          filled_at: new Date().toISOString().slice(0, 10),
        },
      });
      toast.success("Ficha de saúde salva");
      onSaved && onSaved();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };

  const printPdf = async () => {
    if (!student) return;
    const academy = (await getAcademy()) || {};
    generateHealthPdf(student, parq, ana, academy);
    toast.success("PDF gerado");
  };

  const Yn = ({ value, onChange, testId }) => (
    <div className="flex gap-2">
      <button type="button" onClick={() => onChange(false)} data-testid={`${testId}-no`}
        className={`px-4 py-1.5 text-xs uppercase tracking-widest border transition-colors ${value === false ? "bg-emerald-600 border-emerald-600 text-white" : "bg-transparent border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}>Não</button>
      <button type="button" onClick={() => onChange(true)} data-testid={`${testId}-yes`}
        className={`px-4 py-1.5 text-xs uppercase tracking-widest border transition-colors ${value === true ? "bg-red-600 border-red-600 text-white" : "bg-transparent border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}>Sim</button>
    </div>
  );

  const parqYesCount = PARQ_QUESTIONS.filter(q => parq[q.key] === true).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#121212] border-zinc-800 text-white rounded-none max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl flex items-center gap-2">
            <HeartPulse className="w-5 h-5 text-red-500" /> FICHA DE SAÚDE
          </DialogTitle>
          {student && (
            <div className="text-xs text-zinc-500 mt-1">
              {student.full_name} · <span className="font-mono">{student.matricula}</span>
            </div>
          )}
        </DialogHeader>

        <Tabs defaultValue="parq">
          <TabsList className="bg-transparent border-b border-zinc-800 rounded-none w-full justify-start h-auto p-0">
            <TabsTrigger value="parq" data-testid="health-tab-parq" className="rounded-none data-[state=active]:bg-transparent data-[state=active]:text-red-500 data-[state=active]:border-b-2 data-[state=active]:border-red-600 px-4 py-3 uppercase text-xs tracking-widest text-zinc-500">
              PAR-Q
            </TabsTrigger>
            <TabsTrigger value="anamnese" data-testid="health-tab-anamnese" className="rounded-none data-[state=active]:bg-transparent data-[state=active]:text-red-500 data-[state=active]:border-b-2 data-[state=active]:border-red-600 px-4 py-3 uppercase text-xs tracking-widest text-zinc-500">
              Anamnese
            </TabsTrigger>
          </TabsList>

          <TabsContent value="parq" className="mt-5 space-y-4">
            <div className="text-xs text-zinc-500">Questionário de Prontidão para Atividade Física (PAR-Q). Responda com atenção — em caso afirmativo, recomenda-se avaliação médica antes de iniciar.</div>
            {PARQ_QUESTIONS.map((q, i) => (
              <div key={q.key} className="border border-zinc-800 p-4" data-testid={`parq-question-${i + 1}`}>
                <div className="flex items-start gap-3">
                  <div className="font-heading text-2xl text-red-500 leading-none min-w-[24px]">{i + 1}</div>
                  <div className="flex-1 text-sm text-zinc-200">{q.label}</div>
                </div>
                <div className="mt-3 flex justify-end">
                  <Yn value={parq[q.key]} onChange={(v) => setParq({ ...parq, [q.key]: v })} testId={`parq-${i + 1}`} />
                </div>
              </div>
            ))}
            <div>
              <Label className="text-xs uppercase tracking-wider text-zinc-400">Observações</Label>
              <Textarea rows={3} data-testid="parq-notes" value={parq.notes || ""} onChange={(e) => setParq({ ...parq, notes: e.target.value })}
                className="mt-1.5 bg-transparent border-zinc-800 rounded-none" />
            </div>
            {parqYesCount > 0 && (
              <div className="border-l-2 border-yellow-500 pl-4 py-2 bg-yellow-500/5 text-yellow-500 text-xs">
                {parqYesCount} resposta(s) afirmativa(s). Recomenda-se avaliação médica antes de iniciar as atividades.
              </div>
            )}
          </TabsContent>

          <TabsContent value="anamnese" className="mt-5 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <F label="Altura (cm)"><Input data-testid="ana-height" type="number" value={ana.height_cm} onChange={(e) => setAna({ ...ana, height_cm: e.target.value })} /></F>
              <F label="Peso (kg)"><Input data-testid="ana-weight" type="number" step="0.1" value={ana.weight_kg} onChange={(e) => setAna({ ...ana, weight_kg: e.target.value })} /></F>
              <F label="Tipo sanguíneo"><Input data-testid="ana-blood" placeholder="ex: O+" value={ana.blood_type} onChange={(e) => setAna({ ...ana, blood_type: e.target.value })} /></F>
            </div>
            <F label="Doenças pré-existentes / crônicas"><Textarea rows={2} data-testid="ana-diseases" value={ana.diseases} onChange={(e) => setAna({ ...ana, diseases: e.target.value })} /></F>
            <F label="Alergias"><Textarea rows={2} data-testid="ana-allergies" value={ana.allergies} onChange={(e) => setAna({ ...ana, allergies: e.target.value })} /></F>
            <F label="Medicamentos em uso"><Textarea rows={2} data-testid="ana-medications" value={ana.medications} onChange={(e) => setAna({ ...ana, medications: e.target.value })} /></F>
            <div className="grid grid-cols-2 gap-3">
              <F label="Cirurgias anteriores"><Textarea rows={2} data-testid="ana-surgeries" value={ana.surgeries} onChange={(e) => setAna({ ...ana, surgeries: e.target.value })} /></F>
              <F label="Lesões (atuais / recentes)"><Textarea rows={2} data-testid="ana-injuries" value={ana.injuries} onChange={(e) => setAna({ ...ana, injuries: e.target.value })} /></F>
            </div>
            <F label="Histórico familiar relevante"><Textarea rows={2} data-testid="ana-family" placeholder="Doença cardíaca, diabetes, hipertensão, etc." value={ana.family_history} onChange={(e) => setAna({ ...ana, family_history: e.target.value })} /></F>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs uppercase tracking-wider text-zinc-400">Tabagista?</Label>
                <div className="mt-2"><Yn value={ana.smoker} onChange={(v) => setAna({ ...ana, smoker: v })} testId="ana-smoker" /></div>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-zinc-400">Consome bebida alcoólica?</Label>
                <div className="mt-2"><Yn value={ana.alcohol} onChange={(v) => setAna({ ...ana, alcohol: v })} testId="ana-alcohol" /></div>
              </div>
            </div>
            <F label="Frequência atual de atividade física">
              <Input data-testid="ana-exercise" placeholder="ex: 2x por semana - musculação" value={ana.exercise_frequency} onChange={(e) => setAna({ ...ana, exercise_frequency: e.target.value })} />
            </F>
            <F label="Já praticou artes marciais antes?">
              <Input data-testid="ana-prior" placeholder="Modalidade / graduação / tempo" value={ana.prior_martial_arts} onChange={(e) => setAna({ ...ana, prior_martial_arts: e.target.value })} />
            </F>
            <F label="Objetivos com a prática"><Textarea rows={2} data-testid="ana-goals" value={ana.goals} onChange={(e) => setAna({ ...ana, goals: e.target.value })} /></F>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs uppercase tracking-wider text-zinc-400">Possui liberação médica?</Label>
                <div className="mt-2"><Yn value={ana.doctor_clearance} onChange={(v) => setAna({ ...ana, doctor_clearance: v })} testId="ana-clearance" /></div>
              </div>
              <F label="Nome do médico"><Input data-testid="ana-doctor" value={ana.doctor_name} onChange={(e) => setAna({ ...ana, doctor_name: e.target.value })} /></F>
            </div>
            <F label="Observações gerais"><Textarea rows={3} data-testid="ana-notes" value={ana.notes} onChange={(e) => setAna({ ...ana, notes: e.target.value })} /></F>
          </TabsContent>
        </Tabs>

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={printPdf} data-testid="print-health-pdf" className="rounded-none border-zinc-700 hover:border-red-600 hover:text-red-500">
            <Printer className="w-4 h-4 mr-2" /> Imprimir / PDF
          </Button>
          <Button onClick={save} disabled={saving} data-testid="save-health-form" className="bg-red-600 hover:bg-red-700 rounded-none">
            <Save className="w-4 h-4 mr-2" /> {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function F({ label, children }) {
  return (
    <div>
      <Label className="text-xs uppercase tracking-wider text-zinc-400">{label}</Label>
      <div className="mt-1.5 [&_input]:bg-transparent [&_input]:border-zinc-800 [&_input]:rounded-none [&_textarea]:bg-transparent [&_textarea]:border-zinc-800 [&_textarea]:rounded-none">{children}</div>
    </div>
  );
}

function generateHealthPdf(student, parq, ana, academy = {}) {
  const RED = [229, 9, 20];
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.width;
  const H = doc.internal.pageSize.height;
  const M = 40;

  // Header band
  doc.setFillColor(...RED); doc.rect(0, 0, W, 6, "F");

  // Optional logo
  let leftPad = M;
  if (academy.logo_url && typeof academy.logo_url === "string" && academy.logo_url.startsWith("data:image")) {
    try {
      const fmt = academy.logo_url.includes("image/jpeg") ? "JPEG" : "PNG";
      doc.addImage(academy.logo_url, fmt, M, 18, 46, 46);
      leftPad = M + 60;
    } catch { /* ignore */ }
  }

  const name = (academy.name || "CT WARRIOR").toUpperCase();
  doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.setTextColor(20, 20, 20);
  doc.text(name, leftPad, 50);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(120, 120, 120);
  const meta = [];
  if (academy.cnpj) meta.push(`CNPJ ${academy.cnpj}`);
  if (academy.phone) meta.push(academy.phone);
  doc.text(meta.length ? meta.join(" · ") : "Ficha de Saúde do Aluno · PAR-Q & Anamnese", leftPad, 65);
  doc.text(new Date().toLocaleDateString("pt-BR"), W - M, 65, { align: "right" });

  doc.setDrawColor(220, 220, 220); doc.line(M, 90, W - M, 90);

  // Student block
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(20, 20, 20);
  doc.text("IDENTIFICAÇÃO DO ALUNO", M, 112);

  const info = [
    ["Nome", student.full_name],
    ["Matrícula", student.matricula || "—"],
    ["CPF", student.cpf || "—"],
    ["RG", student.rg || "—"],
    ["Data de nascimento", student.birth_date ? new Date(student.birth_date).toLocaleDateString("pt-BR") : "—"],
    ["Telefone", student.phone || "—"],
    ["Email", student.email || "—"],
    ["Endereço", [student.address, student.city, student.state].filter(Boolean).join(", ") || "—"],
    ["Responsável (se menor)", student.guardian_name ? `${student.guardian_name} · ${student.guardian_phone || ""}` : "—"],
  ];
  autoTable(doc, {
    startY: 122,
    body: info,
    styles: { font: "helvetica", fontSize: 9, cellPadding: 5, lineColor: [230, 230, 230], lineWidth: 0.5 },
    columnStyles: { 0: { cellWidth: 130, fontStyle: "bold", fillColor: [248, 248, 248] } },
    theme: "grid",
    margin: { left: M, right: M },
  });

  // PAR-Q section
  let y = doc.lastAutoTable.finalY + 22;
  doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text("QUESTIONÁRIO PAR-Q", M, y);
  y += 6;
  const parqRows = PARQ_QUESTIONS.map((q, i) => [
    (i + 1).toString(),
    q.label,
    parq[q.key] === true ? "SIM" : parq[q.key] === false ? "Não" : "—",
  ]);
  autoTable(doc, {
    startY: y + 4,
    head: [["#", "Pergunta", "Resposta"]],
    body: parqRows,
    styles: { font: "helvetica", fontSize: 9, cellPadding: 6, lineColor: [230, 230, 230], lineWidth: 0.5 },
    headStyles: { fillColor: RED, textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 24, halign: "center" }, 2: { cellWidth: 60, halign: "center", fontStyle: "bold" } },
    theme: "grid",
    margin: { left: M, right: M },
    didParseCell: (data) => {
      if (data.column.index === 2 && data.cell.raw === "SIM") { data.cell.styles.textColor = RED; }
    },
  });
  if (parq.notes) {
    y = doc.lastAutoTable.finalY + 10;
    doc.setFont("helvetica", "italic"); doc.setFontSize(9); doc.setTextColor(80, 80, 80);
    doc.text("Observações PAR-Q:", M, y);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(parq.notes, W - 2 * M);
    doc.text(lines, M, y + 12);
  }

  // Anamnese
  y = doc.lastAutoTable.finalY + (parq.notes ? 40 : 20);
  if (y > H - 250) { doc.addPage(); y = 60; }
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(20, 20, 20);
  doc.text("ANAMNESE", M, y);

  const anaRows = [
    ["Altura", ana.height_cm ? `${ana.height_cm} cm` : "—"],
    ["Peso", ana.weight_kg ? `${ana.weight_kg} kg` : "—"],
    ["Tipo sanguíneo", ana.blood_type || "—"],
    ["Doenças pré-existentes", ana.diseases || "—"],
    ["Alergias", ana.allergies || "—"],
    ["Medicamentos em uso", ana.medications || "—"],
    ["Cirurgias anteriores", ana.surgeries || "—"],
    ["Lesões atuais/recentes", ana.injuries || "—"],
    ["Histórico familiar", ana.family_history || "—"],
    ["Tabagista", ana.smoker === true ? "Sim" : ana.smoker === false ? "Não" : "—"],
    ["Consome álcool", ana.alcohol === true ? "Sim" : ana.alcohol === false ? "Não" : "—"],
    ["Atividade física atual", ana.exercise_frequency || "—"],
    ["Artes marciais anteriores", ana.prior_martial_arts || "—"],
    ["Objetivos", ana.goals || "—"],
    ["Liberação médica", ana.doctor_clearance === true ? "Sim" : ana.doctor_clearance === false ? "Não" : "—"],
    ["Médico responsável", ana.doctor_name || "—"],
    ["Observações", ana.notes || "—"],
  ];
  autoTable(doc, {
    startY: y + 8,
    body: anaRows,
    styles: { font: "helvetica", fontSize: 9, cellPadding: 5, lineColor: [230, 230, 230], lineWidth: 0.5, valign: "top" },
    columnStyles: { 0: { cellWidth: 150, fontStyle: "bold", fillColor: [248, 248, 248] } },
    theme: "grid",
    margin: { left: M, right: M },
  });

  // Declaration + signature
  y = doc.lastAutoTable.finalY + 24;
  if (y > H - 160) { doc.addPage(); y = 60; }
  doc.setFont("helvetica", "italic"); doc.setFontSize(8.5); doc.setTextColor(70, 70, 70);
  const decl = "Declaro que as informações prestadas neste formulário são verdadeiras e assumo total responsabilidade pelas mesmas. Estou ciente dos riscos inerentes à prática de artes marciais e autorizo minha participação nas aulas do CT Warrior.";
  const declLines = doc.splitTextToSize(decl, W - 2 * M);
  doc.text(declLines, M, y);

  y += declLines.length * 11 + 40;
  doc.setDrawColor(80, 80, 80);
  doc.line(M, y, M + 240, y);
  doc.line(W - M - 200, y, W - M, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(20, 20, 20);
  doc.text("Assinatura do aluno / responsável", M, y + 14);
  doc.text("Data", W - M - 200, y + 14);

  // Footer band on all pages
  const pages = doc.internal.getNumberOfPages();
  const footer = [academy.name, academy.address, academy.city && `${academy.city}${academy.state ? "/" + academy.state : ""}`].filter(Boolean).join(" · ");
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFillColor(...RED); doc.rect(0, H - 6, W, 6, "F");
    doc.setFontSize(8); doc.setTextColor(120, 120, 120);
    if (footer) doc.text(footer, M, H - 15);
    doc.text(`Ficha de saúde · ${student.full_name} · Página ${i}/${pages}`, W - M, H - 15, { align: "right" });
  }

  doc.save(`ficha-saude-${(student.matricula || "aluno").toString().toLowerCase()}.pdf`);
}
