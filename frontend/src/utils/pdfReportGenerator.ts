import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { AnalysisReport } from "./analysisReport";

/**
 * Generate and download a corporate, publication-grade, selectable-text PDF report.
 * Uses a compact, cohesive multi-section layout that minimizes blank space
 * while keeping professional corporate styling, typography, and clear visual hierarchy.
 */
export async function downloadPdfReport(
  report: AnalysisReport,
  comparisonCandidates?: AnalysisReport[]
): Promise<void> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 36;
  const contentWidth = pageWidth - margin * 2;
  const bottomThreshold = pageHeight - 48; // Space reserved for footer

  // Corporate Color Palette (Navy, Teal, Slate, Subtle fills)
  const colors = {
    primary: [15, 23, 42],       // Slate 900
    navy: [10, 25, 47],          // UrbanIQ Deep Navy
    navyLight: [15, 35, 65],     // Header Navy
    teal: [13, 148, 136],        // Teal 600
    accentBlue: [37, 99, 235],   // Blue 600
    slate: [71, 85, 105],        // Slate 600
    slateLight: [148, 163, 184], // Slate 400
    lightBg: [248, 250, 252],    // Slate 50
    cardBg: [255, 255, 255],     // Pure White
    border: [226, 232, 240],     // Slate 200
    green: [22, 163, 74],        // Green 600
    greenBg: [240, 253, 244],    // Green 50
    greenBorder: [187, 247, 208],// Green 200
    amber: [217, 119, 6],        // Amber 600
    amberBg: [255, 251, 235],    // Amber 50
    amberBorder: [254, 243, 199],// Amber 200
    red: [220, 38, 38],          // Red 600
    redBg: [254, 242, 242],      // Red 50
    redBorder: [254, 202, 202],  // Red 200
  };

  /**
   * Check if adding content of estimatedHeight would overflow the page.
   * If so, adds a new page and resets curY to top margin.
   */
  const ensureSpace = (currentY: number, estimatedHeight: number): number => {
    if (currentY + estimatedHeight > bottomThreshold) {
      doc.addPage();
      return margin + 10;
    }
    return currentY;
  };

  /**
   * Helper to draw clean corporate section headers
   */
  const drawSectionHeading = (y: number, title: string, subtitle?: string): number => {
    const requiredH = subtitle ? 28 : 20;
    y = ensureSpace(y, requiredH + 20);

    // Subtle left accent bar
    doc.setFillColor(colors.teal[0], colors.teal[1], colors.teal[2]);
    doc.rect(margin, y, 3, subtitle ? 24 : 16, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(colors.navy[0], colors.navy[1], colors.navy[2]);
    doc.text(title, margin + 8, y + 12);

    if (subtitle) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(colors.slate[0], colors.slate[1], colors.slate[2]);
      doc.text(subtitle, margin + 8, y + 23);
      return y + 30;
    }
    return y + 22;
  };

  let curY = 0;

  // ==========================================
  // SECTION A: COMPACT CORPORATE HEADER
  // ==========================================
  const headerH = 64;
  doc.setFillColor(colors.navy[0], colors.navy[1], colors.navy[2]);
  doc.rect(0, 0, pageWidth, headerH, "F");

  // UrbanIQ Brand Wordmark
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text("UrbanIQ", margin, 28);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(45, 212, 191); // Teal accent
  doc.text("LOCATION INTELLIGENCE & BUSINESS FEASIBILITY REPORT", margin + 82, 27);

  // Metadata ribbon in header
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  const formattedDate = new Date(report.generatedAt).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  doc.text(`Generated: ${formattedDate}   ·   Target Category: ${report.businessType}`, margin, 48);

  const locInfo = `${report.areaName || report.city} (${report.latitude.toFixed(4)}, ${report.longitude.toFixed(4)}) · Radius: ${(report.radiusMeters / 1000).toFixed(1)} km`;
  doc.text(locInfo, pageWidth - margin - doc.getTextWidth(locInfo), 48);

  curY = headerH + 16;

  // ==========================================
  // SECTION B: EXECUTIVE SUMMARY
  // ==========================================
  curY = drawSectionHeading(curY, "EXECUTIVE SUMMARY", "Key performance metrics and commercial viability synthesis");

  // 4 Aligned Summary Metric Cards
  const gap = 8;
  const numCards = 4;
  const cardW = (contentWidth - gap * (numCards - 1)) / numCards;
  const cardH = 54;

  const scoreColor = report.score >= 70 ? colors.green : (report.score >= 50 ? colors.amber : colors.red);

  // Card 1: Overall Opportunity Score
  doc.setFillColor(colors.lightBg[0], colors.lightBg[1], colors.lightBg[2]);
  doc.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
  doc.roundedRect(margin, curY, cardW, cardH, 3, 3, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(colors.slate[0], colors.slate[1], colors.slate[2]);
  doc.text("OPPORTUNITY SCORE", margin + 8, curY + 13);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2]);
  doc.text(`${report.score}`, margin + 8, curY + 34);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(colors.slate[0], colors.slate[1], colors.slate[2]);
  doc.text("/ 100", margin + 35, curY + 34);

  doc.setFontSize(7.5);
  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.text(report.suitabilityLabel || report.level, margin + 8, curY + 47);

  // Card 2: Competitors Count
  const c2X = margin + (cardW + gap) * 1;
  doc.setFillColor(colors.lightBg[0], colors.lightBg[1], colors.lightBg[2]);
  doc.roundedRect(c2X, curY, cardW, cardH, 3, 3, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(colors.slate[0], colors.slate[1], colors.slate[2]);
  doc.text("DIRECT COMPETITORS", c2X + 8, curY + 13);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.text(`${report.competitors.length}`, c2X + 8, curY + 34);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(colors.slate[0], colors.slate[1], colors.slate[2]);
  doc.text(`In ${(report.radiusMeters / 1000).toFixed(1)} km radius`, c2X + 8, curY + 47);

  // Card 3: Market Viability Label
  const c3X = margin + (cardW + gap) * 2;
  doc.setFillColor(colors.lightBg[0], colors.lightBg[1], colors.lightBg[2]);
  doc.roundedRect(c3X, curY, cardW, cardH, 3, 3, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(colors.slate[0], colors.slate[1], colors.slate[2]);
  doc.text("VIABILITY STATUS", c3X + 8, curY + 13);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(colors.teal[0], colors.teal[1], colors.teal[2]);
  const viabilityText = report.score >= 70 ? "Favorable" : (report.score >= 50 ? "Moderate" : "Elevated Risk");
  doc.text(viabilityText, c3X + 8, curY + 31);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(colors.slate[0], colors.slate[1], colors.slate[2]);
  doc.text("Composite assessment", c3X + 8, curY + 47);

  // Card 4: Data Quality & Coverage
  const c4X = margin + (cardW + gap) * 3;
  doc.setFillColor(colors.lightBg[0], colors.lightBg[1], colors.lightBg[2]);
  doc.roundedRect(c4X, curY, cardW, cardH, 3, 3, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(colors.slate[0], colors.slate[1], colors.slate[2]);
  doc.text("PRIMARY DATA SOURCE", c4X + 8, curY + 13);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  const sourceName = report.dataSource === "google_places" ? "Google Places API" : "OpenStreetMap";
  doc.text(sourceName, c4X + 8, curY + 30);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(colors.slate[0], colors.slate[1], colors.slate[2]);
  doc.text(report.isProvisional ? "Provisional survey" : "Verified catchment", c4X + 8, curY + 47);

  curY += cardH + 10;

  // Executive Narrative Box
  const narrativeText = report.practicalRecommendation ||
    `Analysis indicates a ${report.suitabilityLabel || report.level} suitability rating (${report.score}/100) for establishing a ${report.businessType} in ${report.areaName || report.city}. Local commercial dynamics show ${report.competitors.length} existing competitors within the ${(report.radiusMeters / 1000).toFixed(1)} km catchment area.`;

  const narrativeLines = doc.splitTextToSize(narrativeText, contentWidth - 16);
  const narrativeH = Math.max(34, narrativeLines.length * 11 + 14);

  doc.setFillColor(colors.lightBg[0], colors.lightBg[1], colors.lightBg[2]);
  doc.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
  doc.roundedRect(margin, curY, contentWidth, narrativeH, 3, 3, "FD");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.text(narrativeLines, margin + 8, curY + 14);

  curY += narrativeH + 14;

  // ==========================================
  // SECTION C: FEASIBILITY FACTOR ANALYSIS
  // ==========================================
  curY = drawSectionHeading(curY, "FEASIBILITY FACTOR ANALYSIS (6-FACTOR MCDA MODEL)", "Multi-Criteria Decision Analysis calibrated with Mamdani fuzzy logic evaluation");

  const factorTableRows = report.factors.map((f) => {
    const contr = f.weightedContribution !== undefined
      ? `+${f.weightedContribution} pts`
      : `+${(f.value * (f.weight / 100)).toFixed(1)} pts`;
    const state = f.dataState || f.status;
    const statusLabel = (state === "unavailable" || f.isEstimated)
      ? "Estimated / Proxy"
      : (state === "confirmed_zero" ? "Confirmed 0" : (state === "partial" ? "Partially Verified" : "Observed"));

    return [
      f.name,
      `${f.value}/100`,
      `${f.weight}%`,
      contr,
      statusLabel,
      f.description || "Evaluates local category feasibility based on spatial infrastructure records.",
    ];
  });

  autoTable(doc, {
    startY: curY,
    head: [["Factor Criterion", "Score", "Weight", "Contribution", "Data Status", "Evaluation Insight"]],
    body: factorTableRows,
    theme: "striped",
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
      cellPadding: 4,
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [51, 65, 85],
      cellPadding: 4,
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 95 },
      1: { halign: "center", fontStyle: "bold", cellWidth: 44 },
      2: { halign: "center", cellWidth: 40 },
      3: { halign: "center", fontStyle: "bold", textColor: [22, 101, 52], cellWidth: 58 },
      4: { halign: "center", cellWidth: 72 },
      5: { cellWidth: "auto" },
    },
    margin: { left: margin, right: margin },
    didDrawCell: (data) => {
      // Draw a subtle visual progress bar in the score column
      if (data.section === "body" && data.column.index === 1) {
        const rawScore = parseInt(data.cell.text[0], 10) || 50;
        const barW = 32;
        const barH = 2.5;
        const barX = data.cell.x + (data.cell.width - barW) / 2;
        const barY = data.cell.y + data.cell.height - 4.5;
        // Background
        doc.setFillColor(226, 232, 240);
        doc.rect(barX, barY, barW, barH, "F");
        // Fill
        const barColor = rawScore >= 70 ? colors.green : (rawScore >= 50 ? colors.amber : colors.red);
        doc.setFillColor(barColor[0], barColor[1], barColor[2]);
        doc.rect(barX, barY, (barW * Math.min(100, Math.max(0, rawScore))) / 100, barH, "F");
      }
    },
  });

  curY = (doc as any).lastAutoTable.finalY + 14;

  // ==========================================
  // SECTION D: KEY FINDINGS & STRATEGIC RISKS
  // ==========================================
  const drivers = (report.positiveDrivers && report.positiveDrivers.length > 0)
    ? report.positiveDrivers.slice(0, 4)
    : ["Moderate commercial saturation allows headroom for new market entrants.", "Viable pedestrian catchment supported by local neighborhood activity."];

  const risks = (report.negativeRisks && report.negativeRisks.length > 0)
    ? report.negativeRisks.slice(0, 4)
    : ["Competitive presence requires distinct value proposition and service differentiation.", "On-site footfall and lease rates should be confirmed before capital commitment."];

  // Estimate height needed for the 2 side-by-side cards
  const boxW = (contentWidth - 10) / 2;
  const maxLinesCount = Math.max(drivers.length, risks.length);
  const findingsH = Math.max(76, maxLinesCount * 17 + 24);

  curY = ensureSpace(curY, findingsH + 28);
  curY = drawSectionHeading(curY, "KEY FINDINGS & STRATEGIC RISKS", "Structured opportunities and trade-offs identified by the spatial engine");

  // Box 1: Positive Signals (Green)
  doc.setFillColor(colors.greenBg[0], colors.greenBg[1], colors.greenBg[2]);
  doc.setDrawColor(colors.greenBorder[0], colors.greenBorder[1], colors.greenBorder[2]);
  doc.roundedRect(margin, curY, boxW, findingsH, 3, 3, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(22, 101, 52); // Green 800
  doc.text("POSITIVE MARKET SIGNALS", margin + 8, curY + 13);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  let drvY = curY + 25;
  drivers.forEach((drv) => {
    const wrapped = doc.splitTextToSize(`+ ${drv}`, boxW - 16);
    doc.text(wrapped, margin + 8, drvY);
    drvY += wrapped.length * 9 + 4;
  });

  // Box 2: Risks & Trade-Offs (Red)
  const rX = margin + boxW + 10;
  doc.setFillColor(colors.redBg[0], colors.redBg[1], colors.redBg[2]);
  doc.setDrawColor(colors.redBorder[0], colors.redBorder[1], colors.redBorder[2]);
  doc.roundedRect(rX, curY, boxW, findingsH, 3, 3, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(153, 27, 27); // Red 800
  doc.text("RISKS & STRATEGIC TRADE-OFFS", rX + 8, curY + 13);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  let rskY = curY + 25;
  risks.forEach((rsk) => {
    const wrapped = doc.splitTextToSize(`- ${rsk}`, boxW - 16);
    doc.text(wrapped, rX + 8, rskY);
    rskY += wrapped.length * 9 + 4;
  });

  curY += findingsH + 16;

  // ==========================================
  // SECTION E: CANDIDATE LOCATIONS (IF AVAILABLE)
  // ==========================================
  const hasCandidates = (report.recommendedAreas && report.recommendedAreas.length > 0) ||
    (comparisonCandidates && comparisonCandidates.length > 1);

  if (hasCandidates) {
    curY = ensureSpace(curY, 110);
    curY = drawSectionHeading(curY, "ALTERNATIVE CANDIDATE SITES WITHIN STUDY RADIUS", "Promising candidate zones evaluated using spatial Non-Maximum Suppression (NMS)");

    if (report.recommendedAreas && report.recommendedAreas.length > 0) {
      const candidateRows = report.recommendedAreas.slice(0, 4).map((cand) => [
        `#${cand.rank}`,
        cand.landmark || `${cand.locality || "Study Area"} Zone`,
        `${cand.score}/100`,
        `${cand.competitors_500m} in 500m`,
        `${cand.latitude.toFixed(4)}, ${cand.longitude.toFixed(4)}`,
        cand.has_verified_street ? "Verified Road" : "Approximate Zone",
        cand.badge || "Alternative Candidate",
      ]);

      autoTable(doc, {
        startY: curY,
        head: [["Rank", "Area / Landmark", "Score", "Competition", "Coordinates", "Street Verification", "Suitability Label"]],
        body: candidateRows,
        theme: "striped",
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 7.5,
          cellPadding: 4,
        },
        bodyStyles: {
          fontSize: 7.5,
          cellPadding: 4,
        },
        columnStyles: {
          0: { halign: "center", fontStyle: "bold", cellWidth: 28 },
          1: { fontStyle: "bold", cellWidth: 120 },
          2: { halign: "center", fontStyle: "bold", textColor: [22, 101, 52], cellWidth: 44 },
          3: { halign: "center", cellWidth: 64 },
          4: { cellWidth: 85 },
          5: { cellWidth: 80 },
          6: { cellWidth: "auto" },
        },
        margin: { left: margin, right: margin },
      });

      curY = (doc as any).lastAutoTable.finalY + 14;
    }

    // Comparison Set if user has saved multiple locations
    if (comparisonCandidates && comparisonCandidates.length > 1) {
      curY = ensureSpace(curY, 90);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
      doc.text("Saved Multi-Location Benchmark Set", margin, curY);
      curY += 8;

      const compRows = comparisonCandidates.slice(0, 5).map((c, i) => [
        `#${i + 1}`,
        c.areaName || c.city,
        c.businessType,
        `${c.score}/100`,
        `${c.competitors.length}`,
        `${c.latitude.toFixed(4)}, ${c.longitude.toFixed(4)}`,
        `${(c.radiusMeters / 1000).toFixed(1)} km`,
      ]);

      autoTable(doc, {
        startY: curY,
        head: [["#", "Location", "Category", "Score", "Competitors", "Coordinates", "Radius"]],
        body: compRows,
        theme: "grid",
        headStyles: {
          fillColor: [51, 65, 85],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 7.5,
          cellPadding: 3.5,
        },
        bodyStyles: {
          fontSize: 7,
          cellPadding: 3.5,
        },
        columnStyles: {
          0: { halign: "center", cellWidth: 24 },
          1: { fontStyle: "bold", cellWidth: 110 },
          2: { cellWidth: 70 },
          3: { halign: "center", fontStyle: "bold", cellWidth: 50 },
          4: { halign: "center", cellWidth: 55 },
          5: { cellWidth: 85 },
          6: { halign: "center", cellWidth: "auto" },
        },
        margin: { left: margin, right: margin },
      });

      curY = (doc as any).lastAutoTable.finalY + 16;
    }
  }

  // ==========================================
  // SECTION F: APPENDIX — COMPETITOR DIRECTORY
  // ==========================================
  // Competitors table goes into a cleanly labelled appendix section.
  // It naturally starts on the next page if needed or continues fluidly.
  if (report.competitors && report.competitors.length > 0) {
    // If not much space left, start appendix cleanly on a fresh page
    if (curY + 80 > bottomThreshold) {
      doc.addPage();
      curY = margin + 10;
    }

    curY = drawSectionHeading(
      curY,
      `APPENDIX: RECORDED COMPETITOR VENUES (${report.competitors.length} PLACES)`,
      `Complete directory of mapped venues identified within ${(report.radiusMeters / 1000).toFixed(1)} km study radius`
    );

    const competitorRows = report.competitors.map((c, i) => [
      `#${i + 1}`,
      c.name || "Commercial Establishment",
      c.category || report.businessType,
      `${c.latitude.toFixed(5)}, ${c.longitude.toFixed(5)}`,
      report.dataSource === "google_places" ? "Google Places API" : "OpenStreetMap",
    ]);

    autoTable(doc, {
      startY: curY,
      head: [["#", "Business Name", "Category", "Coordinates", "Verified Source"]],
      body: competitorRows,
      theme: "grid",
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 7.5,
        cellPadding: 3.5,
      },
      bodyStyles: {
        fontSize: 7,
        textColor: [51, 65, 85],
        cellPadding: 3.5,
      },
      columnStyles: {
        0: { halign: "center", cellWidth: 24 },
        1: { fontStyle: "bold", cellWidth: 155 },
        2: { cellWidth: 95 },
        3: { cellWidth: 95 },
        4: { cellWidth: "auto" },
      },
      margin: { left: margin, right: margin, bottom: 42 },
      showHead: "everyPage",
    });
  }

  // ==========================================
  // GLOBAL FOOTER & PAGE NUMBERING (ALL PAGES)
  // ==========================================
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Subtle divider rule
    doc.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
    doc.line(margin, pageHeight - 28, pageWidth - margin, pageHeight - 28);

    // Left: Authoritative Disclaimer
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(colors.slateLight[0], colors.slateLight[1], colors.slateLight[2]);
    doc.text(
      "UrbanIQ Decision Intelligence Platform · Multi-Criteria Decision Analysis & Fuzzy Inference · For business feasibility screening purposes only.",
      margin,
      pageHeight - 16
    );

    // Right: Page Numbers
    doc.setFontSize(7);
    doc.setTextColor(colors.slate[0], colors.slate[1], colors.slate[2]);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin - 45, pageHeight - 16);
  }

  // Sanitize Filename
  const cleanLoc = (report.areaName || report.city).replace(/[^a-zA-Z0-9]+/g, "_");
  const cleanCat = report.businessType.replace(/[^a-zA-Z0-9]+/g, "_");
  const dateTag = new Date().toISOString().split("T")[0];
  const filename = `UrbanIQ_Feasibility_${cleanLoc}_${cleanCat}_${dateTag}.pdf`;

  // Trigger Download
  doc.save(filename);
}
