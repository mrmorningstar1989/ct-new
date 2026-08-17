import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const RED = [229, 9, 20];

export function createPdf(title, subtitle) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

  // Header band
  doc.setFillColor(...RED);
  doc.rect(0, 0, 595, 6, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(20, 20, 20);
  doc.text("CT WARRIOR", 40, 50);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text("Sistema de Gestão de Academia", 40, 65);

  const dateStr = new Date().toLocaleString("pt-BR");
  doc.text(dateStr, 555, 65, { align: "right" });

  // Title band
  doc.setDrawColor(220, 220, 220);
  doc.line(40, 90, 555, 90);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(20, 20, 20);
  doc.text(title.toUpperCase(), 40, 115);

  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text(subtitle, 40, 132);
  }

  return doc;
}

export function addTable(doc, columns, rows, startY = 155) {
  autoTable(doc, {
    startY,
    head: [columns],
    body: rows,
    styles: { font: "helvetica", fontSize: 9, cellPadding: 6, lineColor: [230, 230, 230], lineWidth: 0.5 },
    headStyles: { fillColor: RED, textColor: [255, 255, 255], fontStyle: "bold", halign: "left" },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    theme: "grid",
    margin: { left: 40, right: 40 },
  });
  return doc.lastAutoTable.finalY;
}

export function addFooterBand(doc) {
  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    const h = doc.internal.pageSize.height;
    doc.setFillColor(...RED);
    doc.rect(0, h - 6, 595, 6, "F");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Página ${i} de ${pages}`, 555, h - 15, { align: "right" });
  }
}

export function savePdf(doc, filename) {
  addFooterBand(doc);
  doc.save(filename);
}

export const brl = (v) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const dtBR = (d) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";
