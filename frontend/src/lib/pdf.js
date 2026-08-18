import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getAcademy } from "@/lib/academy";

const RED = [229, 9, 20];

export async function createPdf(title, subtitle, academyOverride) {
  const academy = academyOverride || (await getAcademy()) || {};
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.width;

  // Top red band
  doc.setFillColor(...RED);
  doc.rect(0, 0, W, 6, "F");

  // Optional logo
  let leftPad = 40;
  if (academy.logo_url && typeof academy.logo_url === "string" && academy.logo_url.startsWith("data:image")) {
    try {
      const fmt = academy.logo_url.includes("image/jpeg") ? "JPEG" : "PNG";
      doc.addImage(academy.logo_url, fmt, 40, 18, 46, 46);
      leftPad = 100;
    } catch { /* ignore */ }
  }

  const name = (academy.name || "CT WARRIOR").toUpperCase();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(20, 20, 20);
  doc.text(name, leftPad, 50);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  const meta = [];
  if (academy.cnpj) meta.push(`CNPJ ${academy.cnpj}`);
  if (academy.phone) meta.push(academy.phone);
  if (academy.email) meta.push(academy.email);
  doc.text(meta.length ? meta.join(" · ") : (academy.tagline || "Sistema de Gestão de Academia"), leftPad, 65);

  const dateStr = new Date().toLocaleString("pt-BR");
  doc.text(dateStr, W - 40, 65, { align: "right" });

  doc.setDrawColor(220, 220, 220);
  doc.line(40, 90, W - 40, 90);

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

  doc.__academy = academy;
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
  const academy = doc.__academy || {};
  const footer = [academy.name, academy.address, academy.city && `${academy.city}${academy.state ? "/" + academy.state : ""}`]
    .filter(Boolean).join(" · ");
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    const h = doc.internal.pageSize.height;
    const W = doc.internal.pageSize.width;
    doc.setFillColor(...RED);
    doc.rect(0, h - 6, W, 6, "F");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    if (footer) doc.text(footer, 40, h - 15);
    doc.text(`Página ${i} de ${pages}`, W - 40, h - 15, { align: "right" });
  }
}

export function savePdf(doc, filename) {
  addFooterBand(doc);
  doc.save(filename);
}

export const brl = (v) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const dtBR = (d) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";
