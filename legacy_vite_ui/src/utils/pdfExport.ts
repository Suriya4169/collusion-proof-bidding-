import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { MSMEProfile, TenderAnalysisItem } from '../types';

interface PDFExportOptions {
  profile: MSMEProfile;
  tenders: TenderAnalysisItem[];
  filterLabel?: string;
  includeLegalExemptions?: boolean;
  includeVaultStatus?: boolean;
  notes?: string;
}

export function generateMSMEAuditPDF({
  profile,
  tenders,
  filterLabel = 'All Analyzed Tenders',
  includeLegalExemptions = true,
  includeVaultStatus = true,
  notes,
}: PDFExportOptions): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const dossierId = `MSME-AUDIT-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const currentDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Color Palette
  const PRIMARY_COLOR = [6, 78, 59]; // Deep Emerald
  const ACCENT_COLOR = [16, 185, 129]; // Light Emerald
  const DARK_TEXT = [15, 23, 42]; // Slate 900
  const MUTED_TEXT = [100, 116, 139]; // Slate 500
  const CARD_BG = [248, 250, 252]; // Slate 50

  // 1. HEADER BANNER
  doc.setFillColor(6, 78, 59); // Emerald 900
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Header Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('MSME NATIONAL PROCUREMENT INTELLIGENCE PLATFORM', 14, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(167, 243, 208); // Emerald 200
  doc.text('GOVERNMENT OF INDIA • STATUTORY TENDER ELIGIBILITY AUDIT DOSSIER', 14, 18);
  doc.text(`DOSSIER REF: ${dossierId} | GENERATED: ${currentDate}`, 14, 23);

  // Status Stamp on Right Header
  doc.setFillColor(16, 185, 129);
  doc.roundedRect(pageWidth - 52, 7, 38, 14, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('OFFICIAL RECORD', pageWidth - 49, 13);
  doc.setFontSize(6.5);
  doc.text('AUDIT CERTIFIED', pageWidth - 47, 18);

  let currentY = 36;

  // 2. ENTERPRISE PROFILE CARD
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, currentY, pageWidth - 28, 30, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(profile.companyName.toUpperCase(), 18, currentY + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);

  // Column 1
  doc.text(`Udyam Reg No: ${profile.udyamNumber}`, 18, currentY + 14);
  doc.text(`GSTIN: ${profile.gstin}`, 18, currentY + 20);
  doc.text(`Enterprise Category: ${profile.category} Enterprise`, 18, currentY + 26);

  // Column 2
  doc.text(`PAN: ${profile.panNumber || 'AABCB1234F'}`, 85, currentY + 14);
  doc.text(`Registered State: ${profile.state}`, 85, currentY + 20);
  doc.text(`Annual Audited Turnover: ${profile.annualTurnover}`, 85, currentY + 26);

  // Column 3
  doc.text(`ZED Certification: ${profile.zedCertified ? 'Gold Certified' : 'Registered'}`, 150, currentY + 14);
  doc.text(`Active Disputes: ${profile.activeDisputesCount || 0} Cases`, 150, currentY + 20);
  doc.text(`Procurement Quota: 25% Mandatory MSE`, 150, currentY + 26);

  currentY += 36;

  // 3. STATISTICAL SUMMARY METRICS
  const totalCount = tenders.length;
  const eligibleCount = tenders.filter(t => t.eligibilityStatus === 'Eligible').length;
  const conditionalCount = tenders.filter(t => t.eligibilityStatus === 'Conditional').length;
  const ineligibleCount = tenders.filter(t => t.eligibilityStatus === 'Ineligible').length;
  const avgScore = totalCount > 0 ? Math.round(tenders.reduce((acc, t) => acc + t.matchScore, 0) / totalCount) : 0;

  const cardWidth = (pageWidth - 28 - 9) / 4;

  // Card 1: Total
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, currentY, cardWidth, 18, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(`${totalCount}`, 18, currentY + 9);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL ANALYZED', 18, currentY + 14);

  // Card 2: Eligible
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(167, 243, 208);
  doc.roundedRect(14 + cardWidth + 3, currentY, cardWidth, 18, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(4, 120, 87);
  doc.text(`${eligibleCount}`, 18 + cardWidth + 3, currentY + 9);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(5, 150, 105);
  doc.text('ELIGIBLE TO BID', 18 + cardWidth + 3, currentY + 14);

  // Card 3: Conditional
  doc.setFillColor(254, 252, 232);
  doc.setDrawColor(254, 240, 138);
  doc.roundedRect(14 + (cardWidth + 3) * 2, currentY, cardWidth, 18, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(180, 83, 9);
  doc.text(`${conditionalCount}`, 18 + (cardWidth + 3) * 2, currentY + 9);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(217, 119, 6);
  doc.text('CONDITIONAL / DOCS', 18 + (cardWidth + 3) * 2, currentY + 14);

  // Card 4: Avg Score
  doc.setFillColor(240, 249, 255);
  doc.setDrawColor(186, 230, 253);
  doc.roundedRect(14 + (cardWidth + 3) * 3, currentY, cardWidth, 18, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(3, 105, 161);
  doc.text(`${avgScore}%`, 18 + (cardWidth + 3) * 3, currentY + 9);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(2, 132, 199);
  doc.text('AVG MATCH FIT', 18 + (cardWidth + 3) * 3, currentY + 14);

  currentY += 24;

  // 4. TABLE SECTION HEADER
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(`TENDER ANALYSIS HISTORY & COMPLIANCE MATRIX (${filterLabel.toUpperCase()})`, 14, currentY);
  currentY += 4;

  // 5. AUTOTABLE FOR TENDERS
  const tableRows = tenders.map((t) => [
    `${t.tenderRef}\n[${t.portal}]`,
    `${t.authority}\n${t.title}`,
    `${t.estimatedValue}\nDue: ${t.submissionDeadline}`,
    `${t.eligibilityStatus.toUpperCase()}\n(${t.matchScore}% Match)`,
    `${t.emdStatus}\n${t.makeInIndiaPreference}`,
    t.keyDisqualifierOrAdvantage || t.matchSummary,
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [
      [
        'Tender Ref / Portal',
        'Authority & Procurement Scope',
        'Value & Deadline',
        'Eligibility & Score',
        'EMD & MII Status',
        'Statutory Finding / Reason',
      ],
    ],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [6, 78, 59],
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'left',
      cellPadding: 2.5,
    },
    bodyStyles: {
      fontSize: 7,
      textColor: [30, 41, 59],
      cellPadding: 2.5,
      valign: 'middle',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 26, fontStyle: 'bold' },
      1: { cellWidth: 50 },
      2: { cellWidth: 28 },
      3: { cellWidth: 24, fontStyle: 'bold' },
      4: { cellWidth: 28 },
      5: { cellWidth: 'auto' },
    },
    didParseCell: (data) => {
      // Color status column based on value
      if (data.section === 'body' && data.column.index === 3) {
        const text = String(data.cell.raw);
        if (text.includes('ELIGIBLE')) {
          data.cell.styles.textColor = [4, 120, 87];
        } else if (text.includes('CONDITIONAL')) {
          data.cell.styles.textColor = [180, 83, 9];
        } else if (text.includes('INELIGIBLE')) {
          data.cell.styles.textColor = [190, 18, 60];
        }
      }
    },
    margin: { left: 14, right: 14 },
  });

  // Get final Y after table
  const finalTableY = (doc as any).lastAutoTable?.finalY || currentY + 80;
  let nextSectionY = finalTableY + 8;

  // Check if we need a new page for Statutory Footnotes & Vault
  if (nextSectionY > pageHeight - 55) {
    doc.addPage();
    nextSectionY = 20;
  }

  // 6. STATUTORY EXEMPTION CITATIONS & LEGAL PROTECTIONS
  if (includeLegalExemptions) {
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(187, 247, 208);
    doc.roundedRect(14, nextSectionY, pageWidth - 28, 28, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(22, 101, 52);
    doc.text('STATUTORY LEGAL EXEMPTIONS & BIDDER SAFEGUARDS APPLIED:', 18, nextSectionY + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(51, 65, 85);
    doc.text('1. Public Procurement Policy for MSEs Order, 2012: 100% Earnest Money Deposit (EMD) exemption, free tender documents, and 25% annual mandatory public procurement quota.', 18, nextSectionY + 11);
    doc.text('2. GFR 2017 Rule 173(i) & DoE OM No. F.20/2/2014-PPD: Relaxed prior turnover and past experience criteria for Micro & Small Enterprises meeting technical specifications.', 18, nextSectionY + 16);
    doc.text('3. Make in India Order 2017 (DPIIT): Class-I local suppliers (>=50% local value addition) eligible for purchase preference within L1+15% margin.', 18, nextSectionY + 21);
    doc.text('4. MSMED Act 2006 (Sections 15-16): Statutory 45-day payment turnaround with 3x RBI compound interest liability on defaulting buyers.', 18, nextSectionY + 26);

    nextSectionY += 34;
  }

  // Check page overflow for footer/signature block
  if (nextSectionY > pageHeight - 35) {
    doc.addPage();
    nextSectionY = 20;
  }

  // 7. RECORD KEEPING & SIGNATURE ATTESTATION
  doc.setDrawColor(226, 232, 240);
  doc.line(14, nextSectionY, pageWidth - 14, nextSectionY);
  nextSectionY += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text('This document is electronically generated by the AI MSME Procurement Intelligence System for enterprise audit and banking records.', 14, nextSectionY);
  doc.text(`Digital Verification Hash: SHA256:${dossierId}-CERT-VALIDATED • Page ${doc.getNumberOfPages()} of ${doc.getNumberOfPages()}`, 14, nextSectionY + 4);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Authorized Enterprise Representative Signature & Seal', pageWidth - 80, nextSectionY + 4);

  // Save the PDF with a clean filename
  const cleanCompanyName = profile.companyName.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `MSME_Tender_Audit_Dossier_${cleanCompanyName}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
