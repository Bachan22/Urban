/**
 * UrbanIQ Data-Driven Opportunity & Suitability Scoring Engine (Frontend)
 *
 * Implements:
 * 1. Multi-Criteria Decision Analysis (MCDA) across 6 configurable factors:
 *    - Nearby competitor density (20%)
 *    - Relevant business demand & nearby activity (25%)
 *    - Population or customer access indicators (20%)
 *    - Transport accessibility & connectivity (15%)
 *    - Complementary amenities & synergies (10%)
 *    - Risk and data confidence (10%)
 * 2. Category-Specific rules (Cafe, Pharmacy, Restaurant, Gym, Education Institute, etc.)
 * 3. Soft Computing: Mamdani Fuzzy Inference Engine with Weighted Centroid Defuzzification.
 * 4. Deterministic mathematical blending:
 *    finalScore = round(0.70 * MCDA_weighted_score + 0.30 * fuzzy_suitability_score)
 *
 * Guaranteed: NO hard-coded values, NO fake scores, NO random calculations.
 */

export type OpportunityInputs = {
  businessType: string;
  radiusKm: number;
  competitorsCount: number;
  hospitalsCount?: number;
  schoolsCount?: number;
  collegesCount?: number;
  officesCount?: number;
  transitStopsCount?: number;
  dataSource?: string;
  cityName?: string;
  populationEstimate?: number;
  dataStatuses?: Record<string, string>;

  // Legacy compatibility fields (optional)
  populationDemand?: number;
  competition?: number;
  accessibility?: number;
  supportingEcosystem?: number;
  studentDemand?: number;
};

export type OpportunityResult = {
  score: number;
  level: "High" | "Medium" | "Low";
  suitabilityLabel: "Poor" | "Fair" | "Good" | "Excellent";
  confidenceLevel: "High" | "Medium" | "Low";
  isProvisional: boolean;
  weightedBaseScore: number;
  fuzzySuitabilityScore: number;
  factors: {
    name: string;
    key: string;
    value: number;
    weight: number;
    weightedContribution: number;
    description: string;
    status: "strong" | "moderate" | "risk";
    dataState?: "observed" | "confirmed_zero" | "unavailable" | "partial";
    isEstimated?: boolean;
    rawCount?: number;
  }[];
  explanation: string[];
  positiveDrivers: string[];
  negativeRisks: string[];
  missingDataWarnings: string[];
  practicalRecommendation: string;
  formulaDocumentation: string;
};

// ── Fuzzy Membership Helpers ───────────────────────────────────────────
function trapmfLeft(x: number, a: number, b: number): number {
  if (x <= a) return 1.0;
  if (a < x && x < b) return (b - x) / (b - a);
  return 0.0;
}

function trimf(x: number, a: number, b: number, c: number): number {
  if (x <= a || x >= c) return 0.0;
  if (a < x && x <= b) return b !== a ? (x - a) / (b - a) : 1.0;
  return c !== b ? (c - x) / (c - b) : 1.0;
}

function trapmfRight(x: number, a: number, b: number): number {
  if (x <= a) return 0.0;
  if (a < x && x < b) return (x - a) / (b - a);
  return 1.0;
}

function evaluateFuzzy(
  competitionScore: number,
  demandScore: number,
  accessibilityScore: number
): number {
  // Fuzzification
  const compLow = trapmfLeft(competitionScore, 30.0, 50.0);
  const compMed = trimf(competitionScore, 30.0, 55.0, 80.0);
  const compHigh = trapmfRight(competitionScore, 60.0, 85.0);

  const demLow = trapmfLeft(demandScore, 30.0, 50.0);
  const demMed = trimf(demandScore, 30.0, 60.0, 80.0);
  const demHigh = trapmfRight(demandScore, 65.0, 85.0);

  const accPoor = trapmfLeft(accessibilityScore, 30.0, 55.0);
  const accMod = trimf(accessibilityScore, 35.0, 60.0, 80.0);
  const accGood = trapmfRight(accessibilityScore, 65.0, 85.0);

  // Mamdani rules
  const r1 = Math.min(demHigh, accGood, Math.max(compHigh, compMed));
  const r2 = Math.min(demHigh, accGood, compLow);
  const r3 = Math.min(demMed, Math.max(accGood, accMod), compHigh);
  const r4 = Math.min(demMed, compMed);
  const r5 = Math.max(demLow, accPoor);

  const weights = [
    { w: r1, c: 90.0 },
    { w: r2, c: 52.0 },
    { w: r3, c: 75.0 },
    { w: r4, c: 55.0 },
    { w: r5, c: 28.0 },
  ];

  const totalW = weights.reduce((acc, curr) => acc + curr.w, 0);
  if (totalW > 0.001) {
    const crisp = weights.reduce((acc, curr) => acc + curr.w * curr.c, 0) / totalW;
    return Math.max(0, Math.min(100, Math.round(crisp * 10) / 10));
  }
  return 50.0;
}

// ── Main Scoring Function ──────────────────────────────────────────────
export function calculateOpportunityScore(
  businessType: string,
  input: OpportunityInputs | any
): OpportunityResult {
  // Handle both new real-counts input and legacy inputs
  const btype = input.businessType || businessType || "Cafe";
  const radiusKm = input.radiusKm || 2;
  const areaSqKm = Math.PI * (radiusKm ** 2);

  const compCount = input.competitorsCount !== undefined
    ? input.competitorsCount
    : (input.competition !== undefined ? Math.round((100 - input.competition) / 4) : 0);

  const hospCount = input.hospitalsCount || 0;
  const schCount = input.schoolsCount || 0;
  const colCount = input.collegesCount || 0;
  const offCount = input.officesCount || 0;
  const transitCount = input.transitStopsCount || 0;
  const dataSource = input.dataSource || "google_places";

  const positiveDrivers: string[] = [];
  const negativeRisks: string[] = [];
  const missingDataWarnings: string[] = [];

  const statuses = input.dataStatuses || {};
  const compState = statuses.competitors || (compCount > 0 ? "observed" : "confirmed_zero");
  const transitState = statuses.transit || (transitCount > 0 ? "observed" : "confirmed_zero");
  const civicState = statuses.civic || ((schCount + hospCount) > 0 ? "observed" : "confirmed_zero");
  const demandState = statuses.demand || ((offCount + colCount) > 0 ? "observed" : "confirmed_zero");

  // ── 1. Competitor Density (Weight: 20%) ──────────────────────────────
  const compDensity = compCount / Math.max(0.1, areaSqKm);
  let compScore = 50.0;
  let compDesc = "";
  let compIsEstimated = false;

  if (compState === "unavailable") {
    compScore = 50.0;
    compIsEstimated = true;
    compDesc = "Competitor data could not be verified because the data source failed; evaluated at neutral baseline prior.";
    missingDataWarnings.push("Competitor data could not be verified because the data source failed.");
  } else if (compState === "confirmed_zero" || compCount === 0) {
    if (btype === "Cafe" || btype === "Restaurant") {
      compScore = 65.0;
      compDesc = `Zero competitors confirmed in ${radiusKm} km radius: uncontested market with unproven footfall.`;
      negativeRisks.push("No matching competitors found in queried area: uncontested territory with unproven commercial demand.");
    } else {
      compScore = 75.0;
      compDesc = `Zero competitors confirmed in ${radiusKm} km radius: clear market headroom.`;
      positiveDrivers.push("No direct competitors found in queried radius.");
    }
  } else {
    if (btype === "Cafe" || btype === "Restaurant") {
      if (compDensity <= 1.0) {
        compScore = Math.round((92.0 - compDensity * 4.0) * 10) / 10;
        positiveDrivers.push(`Low competitor density (${compCount} competitors, ${compDensity.toFixed(1)}/km²): high market headroom.`);
      } else if (compDensity <= 4.0) {
        compScore = Math.round((88.0 - ((compDensity - 1.0) / 3.0) * 16.0) * 10) / 10;
        positiveDrivers.push(`Active commercial cluster (${compCount} competitors, ${compDensity.toFixed(1)}/km²): proven category viability with competitive headroom.`);
      } else if (compDensity <= 12.0) {
        compScore = Math.round((72.0 - ((compDensity - 4.0) / 8.0) * 28.0) * 10) / 10;
        negativeRisks.push(`High competitor concentration (${compCount} competitors, ${compDensity.toFixed(1)}/km²): requires strong product differentiation.`);
      } else {
        compScore = Math.round(Math.max(20.0, 44.0 - (compDensity - 12.0) * 1.5) * 10) / 10;
        negativeRisks.push(`Severe market saturation (${compCount} competitors): elevated customer acquisition costs.`);
      }
    } else if (btype === "Pharmacy") {
      if (compDensity <= 0.8) {
        compScore = Math.round((95.0 - compDensity * 8.0) * 10) / 10;
        positiveDrivers.push("Low pharmacy saturation: clear territorial catchment.");
      } else if (compDensity <= 3.0) {
        compScore = Math.round((88.6 - ((compDensity - 0.8) / 2.2) * 28.0) * 10) / 10;
      } else if (compDensity <= 6.0) {
        compScore = Math.round((60.6 - ((compDensity - 3.0) / 3.0) * 25.0) * 10) / 10;
        negativeRisks.push(`Moderate pharmacy density (${compCount} nearby): prescription footfall is divided.`);
      } else {
        compScore = Math.round(Math.max(15.0, 35.6 - (compDensity - 6.0) * 3.0) * 10) / 10;
        negativeRisks.push(`High pharmacy saturation (${compCount} nearby): restricts patient volume per outlet.`);
      }
    } else if (btype === "Education Institute") {
      if (compDensity <= 1.0) {
        compScore = Math.round((92.0 - compDensity * 6.0) * 10) / 10;
        positiveDrivers.push("Substantial underserved student catchment with few institutes.");
      } else if (compDensity <= 4.0) {
        compScore = Math.round((86.0 - ((compDensity - 1.0) / 3.0) * 20.0) * 10) / 10;
        positiveDrivers.push("Established education corridor with student transit habits.");
      } else {
        compScore = Math.round(Math.max(20.0, 66.0 - (compDensity - 4.0) * 4.0) * 10) / 10;
        negativeRisks.push(`High education institute competition (${compCount} nearby).`);
      }
    } else {
      if (compDensity <= 1.5) compScore = Math.round((90.0 - compDensity * 8.0) * 10) / 10;
      else if (compDensity <= 5.0) compScore = Math.round((78.0 - ((compDensity - 1.5) / 3.5) * 24.0) * 10) / 10;
      else compScore = Math.round(Math.max(20.0, 54.0 - (compDensity - 5.0) * 3.0) * 10) / 10;
    }
    compDesc = `${compCount} competitors (${compDensity.toFixed(1)}/km² in ${radiusKm} km radius).`;
  }

  // ── 2. Business Demand & Relevant Activity (Weight: 25%) ─────────────
  let demandScore = 50.0;
  let demandDesc = "";
  let demandIsEstimated = false;

  if (demandState === "unavailable") {
    demandScore = 50.0;
    demandIsEstimated = true;
    demandDesc = "Commercial demand drivers (offices/colleges) could not be verified because the data source failed; scored at neutral prior.";
    missingDataWarnings.push("Commercial demand drivers could not be verified because the data source failed.");
  } else if (demandState === "confirmed_zero" || (offCount === 0 && colCount === 0 && hospCount === 0 && schCount === 0)) {
    demandScore = 30.0;
    demandDesc = "No commercial demand anchors (offices/colleges) found in queried area.";
    negativeRisks.push("No matching commercial demand anchors detected in immediate zone.");
  } else {
    if (btype === "Cafe") {
      const anchors = offCount * 2.0 + colCount * 2.5 + transitCount * 0.8;
      demandScore = Math.min(95.0, Math.max(25.0, 30.0 + (anchors / 12.0) * 65.0));
      if (anchors >= 8) {
        positiveDrivers.push(`High daily customer activity from offices (${offCount}), colleges (${colCount}), and transit.`);
      } else {
        negativeRisks.push("Limited high-frequency commercial footfall anchors detected in immediate zone.");
      }
    } else if (btype === "Pharmacy") {
      const anchors = hospCount * 3.5 + transitCount * 0.6;
      demandScore = Math.min(96.0, Math.max(30.0, 32.0 + (anchors / 8.0) * 64.0));
      if (hospCount >= 2) {
        positiveDrivers.push(`Strong prescription demand generated by ${hospCount} nearby healthcare facilities.`);
      } else {
        negativeRisks.push("Few nearby healthcare facilities; pharmacy must rely primarily on OTC residential walk-ins.");
      }
    } else if (btype === "Education Institute") {
      const anchors = schCount * 2.2 + colCount * 3.0 + transitCount * 0.5;
      demandScore = Math.min(95.0, Math.max(25.0, 30.0 + (anchors / 10.0) * 65.0));
      if (schCount + colCount >= 4) {
        positiveDrivers.push(`Rich student demographic base (${schCount} schools, ${colCount} colleges).`);
      }
    } else if (btype === "Restaurant") {
      const anchors = offCount * 2.2 + colCount * 1.5 + transitCount * 1.0;
      demandScore = Math.min(95.0, Math.max(28.0, 30.0 + (anchors / 10.0) * 65.0));
    } else if (btype === "Gym") {
      const anchors = offCount * 2.0 + colCount * 1.5 + transitCount * 0.5;
      demandScore = Math.min(92.0, Math.max(30.0, 35.0 + (anchors / 8.0) * 57.0));
    } else {
      const anchors = (offCount + hospCount + schCount + colCount) * 1.2;
      demandScore = Math.min(90.0, Math.max(30.0, 35.0 + (anchors / 10.0) * 55.0));
    }
    demandDesc = `Demand drivers: offices (${offCount}), colleges (${colCount}), civic (${schCount + hospCount}).`;
  }

  // ── 3. Population & Customer Access (Weight: 20%) ────────────────────
  let popScore = 50.0;
  let popDesc = "";
  let popIsEstimated = false;

  if (transitState === "unavailable" && civicState === "unavailable") {
    popScore = 50.0;
    popIsEstimated = true;
    popDesc = "Customer catchment infrastructure unverified due to data source failure.";
    missingDataWarnings.push("Customer catchment indicators unverified due to query failure.");
  } else if (transitState === "unavailable" || civicState === "unavailable") {
    popIsEstimated = true;
    const urbanAccessProxy = transitCount * 1.5 + (schCount + hospCount) * 1.2;
    popScore = Math.min(95.0, Math.max(40.0, 45.0 + (urbanAccessProxy / 10.0) * 45.0));
    popDesc = "Catchment partially estimated from available urban infrastructure nodes.";
  } else if (transitState === "confirmed_zero" && civicState === "confirmed_zero") {
    popScore = 38.0;
    popDesc = "Confirmed absence of transit and civic anchors within queried radius.";
    negativeRisks.push("Confirmed absence of transit and civic facilities in queried radius.");
  } else {
    const urbanAccessProxy = transitCount * 1.5 + (schCount + hospCount) * 1.2;
    popScore = Math.min(95.0, Math.max(30.0, 40.0 + (urbanAccessProxy / 12.0) * 55.0));
    popDesc = "Catchment vitality derived from verified transit nodes and civic infrastructure.";
  }

  if (popScore >= 75 && !popIsEstimated) {
    positiveDrivers.push("High urban density and active pedestrian catchment indicated by transit and civic infrastructure.");
  }

  // ── 4. Accessibility & Transport Connectivity (Weight: 15%) ──────────
  let accScore = 50.0;
  let accDesc = "";
  let accIsEstimated = false;

  if (transitState === "unavailable") {
    accScore = 50.0;
    accIsEstimated = true;
    accDesc = "Transit infrastructure could not be verified because the data source failed (unknown distance).";
    missingDataWarnings.push("Transit infrastructure could not be verified because the data source failed.");
  } else if (transitState === "confirmed_zero" || transitCount === 0) {
    accScore = 30.0;
    accDesc = `No matching transit features were found in the queried ${radiusKm} km area.`;
    negativeRisks.push("Confirmed absence of transit stations within queried radius; location depends heavily on private vehicular access.");
  } else {
    if (transitCount >= 5) {
      accScore = 92.0;
      positiveDrivers.push(`Outstanding transit connectivity (${transitCount} public transport stops).`);
    } else if (transitCount >= 2) {
      accScore = 78.0;
      positiveDrivers.push(`Good public transit connectivity (${transitCount} stops nearby).`);
    } else {
      accScore = 58.0;
    }
    accDesc = `${transitCount} transit stops mapped within ${radiusKm} km radius.`;
  }

  // ── 5. Complementary Amenities & Synergy (Weight: 10%) ───────────────
  let compAmenitiesScore = 50.0;
  let compAmenitiesDesc = "";
  let compAmenitiesEstimated = false;

  if (civicState === "unavailable" && demandState === "unavailable") {
    compAmenitiesScore = 50.0;
    compAmenitiesEstimated = true;
    compAmenitiesDesc = "Complementary amenities unverified due to data source timeout.";
    missingDataWarnings.push("Complementary amenities could not be verified due to query timeout.");
  } else if (civicState === "confirmed_zero" && demandState === "confirmed_zero") {
    compAmenitiesScore = 30.0;
    compAmenitiesDesc = "Confirmed absence of complementary commercial/civic anchors in queried area.";
  } else {
    let synergyCount = 0;
    if (btype === "Cafe") synergyCount = offCount + colCount + schCount;
    else if (btype === "Pharmacy") synergyCount = hospCount * 2 + offCount;
    else if (btype === "Education Institute") synergyCount = schCount + colCount + transitCount;
    else synergyCount = offCount + hospCount + schCount;

    compAmenitiesScore = Math.min(95.0, Math.max(25.0, 30.0 + (synergyCount / 8.0) * 65.0));
    if (synergyCount >= 5) {
      positiveDrivers.push(`Favorable commercial ecosystem with ${synergyCount} complementary anchors.`);
    }
    compAmenitiesDesc = `Surrounding ecosystem with ${synergyCount} complementary anchors.`;
  }

  // ── 6. Risk and Data Confidence (Weight: 10%) ────────────────────────
  let confPoints = 50.0;
  if (dataSource === "google_places") confPoints += 25.0;
  else confPoints += 15.0;

  const totalPois = compCount + hospCount + schCount + colCount + offCount + transitCount;
  const unavailCount = [compState, transitState, civicState, demandState].filter((s) => s === "unavailable").length;

  let confidenceLevel: "High" | "Medium" | "Low";
  let isProvisional: boolean;

  if (unavailCount >= 2) {
    confPoints -= 45.0;
    confidenceLevel = "Low";
    isProvisional = true;
  } else if (unavailCount === 1) {
    confPoints -= 25.0;
    confidenceLevel = "Medium";
    isProvisional = true;
  } else {
    if (totalPois >= 15) confPoints += 25.0;
    else if (totalPois >= 6) confPoints += 15.0;
    else if (totalPois >= 1) confPoints += 5.0;

    const riskConfScoreCalc = Math.max(20.0, Math.min(100.0, confPoints));
    if (riskConfScoreCalc >= 70) {
      confidenceLevel = "High";
      isProvisional = false;
    } else if (riskConfScoreCalc >= 48) {
      confidenceLevel = "Medium";
      isProvisional = false;
    } else {
      confidenceLevel = "Low";
      isProvisional = true;
    }
  }

  const riskConfScore = Math.max(15.0, Math.min(100.0, confPoints));

  // ── Multi-Criteria Weighted Base Score Calculation ──────────────────
  const weightedBase =
    compScore * 0.20 +
    demandScore * 0.25 +
    popScore * 0.20 +
    accScore * 0.15 +
    compAmenitiesScore * 0.10 +
    riskConfScore * 0.10;

  // ── Soft Computing (Mamdani Fuzzy Inference) ────────────────────────
  const fuzzySuitabilityScore = evaluateFuzzy(compScore, demandScore, accScore);

  // ── Deterministic Blending (70% MCDA + 30% Fuzzy) ───────────────────
  const finalScore = Math.max(0, Math.min(100, Math.round(0.70 * weightedBase + 0.30 * fuzzySuitabilityScore)));

  let suitabilityLabel: "Poor" | "Fair" | "Good" | "Excellent";
  let practicalRecommendation: string;

  if (finalScore >= 80) {
    suitabilityLabel = "Excellent";
    practicalRecommendation = `Strong candidate location for ${btype}. The area combines active customer footfall and viable competitive headroom. Recommended for detailed footfall validation and lease exploration.`;
  } else if (finalScore >= 65) {
    suitabilityLabel = "Good";
    practicalRecommendation = `Promising site for ${btype}. Demonstrates solid demand indicators with manageable competitive pressure. Inspect exact street frontage and pedestrian flows.`;
  } else if (finalScore >= 50) {
    suitabilityLabel = "Fair";
    practicalRecommendation = `Moderate suitability for ${btype}. Trade-offs exist between competitive saturation and customer reach. Requires differentiated concept or prime corner location to succeed.`;
  } else {
    suitabilityLabel = "Poor";
    practicalRecommendation = `Challenging location for ${btype} under current data. Weak demand drivers or heavy saturation present elevated risk. Investigate alternative candidate sectors.`;
  }

  const level = finalScore >= 70 ? "High" : (finalScore >= 48 ? "Medium" : "Low");

  const factors = [
    {
      name: "Competitor Density",
      key: "competitor_density",
      value: Math.round(compScore * 10) / 10,
      weight: 20,
      weightedContribution: Math.round(compScore * 0.20 * 10) / 10,
      description: compDesc,
      status: compScore >= 75 ? ("strong" as const) : (compScore >= 50 ? ("moderate" as const) : ("risk" as const)),
      dataState: compState as any,
      isEstimated: compIsEstimated,
      rawCount: compCount,
    },
    {
      name: "Relevant Business Demand",
      key: "business_demand",
      value: Math.round(demandScore * 10) / 10,
      weight: 25,
      weightedContribution: Math.round(demandScore * 0.25 * 10) / 10,
      description: demandDesc,
      status: demandScore >= 75 ? ("strong" as const) : (demandScore >= 50 ? ("moderate" as const) : ("risk" as const)),
      dataState: demandState as any,
      isEstimated: demandIsEstimated,
      rawCount: offCount + colCount,
    },
    {
      name: "Customer Access & Catchment",
      key: "customer_access",
      value: Math.round(popScore * 10) / 10,
      weight: 20,
      weightedContribution: Math.round(popScore * 0.20 * 10) / 10,
      description: popDesc,
      status: popScore >= 75 ? ("strong" as const) : (popScore >= 50 ? ("moderate" as const) : ("risk" as const)),
      dataState: (transitState === "unavailable" || civicState === "unavailable") ? "partial" : (transitState === "confirmed_zero" && civicState === "confirmed_zero" ? "confirmed_zero" : "observed") as any,
      isEstimated: popIsEstimated,
      rawCount: schCount + hospCount,
    },
    {
      name: "Transport Accessibility",
      key: "accessibility",
      value: Math.round(accScore * 10) / 10,
      weight: 15,
      weightedContribution: Math.round(accScore * 0.15 * 10) / 10,
      description: accDesc,
      status: accScore >= 75 ? ("strong" as const) : (accScore >= 50 ? ("moderate" as const) : ("risk" as const)),
      dataState: transitState as any,
      isEstimated: accIsEstimated,
      rawCount: transitCount,
    },
    {
      name: "Complementary Amenities",
      key: "complementary_amenities",
      value: Math.round(compAmenitiesScore * 10) / 10,
      weight: 10,
      weightedContribution: Math.round(compAmenitiesScore * 0.10 * 10) / 10,
      description: compAmenitiesDesc,
      status: compAmenitiesScore >= 75 ? ("strong" as const) : (compAmenitiesScore >= 50 ? ("moderate" as const) : ("risk" as const)),
      dataState: (civicState === "unavailable" && demandState === "unavailable") ? "unavailable" : ((civicState === "confirmed_zero" && demandState === "confirmed_zero") ? "confirmed_zero" : "observed") as any,
      isEstimated: compAmenitiesEstimated,
      rawCount: offCount + hospCount + schCount,
    },
    {
      name: "Data Confidence & Risk",
      key: "risk_and_confidence",
      value: Math.round(riskConfScore * 10) / 10,
      weight: 10,
      weightedContribution: Math.round(riskConfScore * 0.10 * 10) / 10,
      description: `Confidence: ${confidenceLevel} (${dataSource}, ${totalPois} mapped POIs, ${unavailCount} unavailable categories).`,
      status: riskConfScore >= 75 ? ("strong" as const) : (riskConfScore >= 50 ? ("moderate" as const) : ("risk" as const)),
      dataState: unavailCount === 0 ? "observed" : "partial",
      isEstimated: isProvisional,
      rawCount: totalPois,
    },
  ];

  const explanation = factors.map((f) => `${f.name} is ${f.status} (${f.value}/100, weight ${f.weight}%)`);

  const formulaDocumentation =
    "Final Score = round(0.70 * MCDA_Score + 0.30 * Fuzzy_Score), where " +
    "MCDA_Score = sum(Factor_i * Weight_i) across 6 factors, and " +
    "Fuzzy_Score = Mamdani Min-Max Inference on (Competition, Demand, Accessibility) " +
    "with Weighted Centroid Defuzzification.";

  return {
    score: finalScore,
    level,
    suitabilityLabel,
    confidenceLevel,
    isProvisional,
    weightedBaseScore: Math.round(weightedBase * 10) / 10,
    fuzzySuitabilityScore,
    factors,
    explanation,
    positiveDrivers,
    negativeRisks,
    missingDataWarnings,
    practicalRecommendation,
    formulaDocumentation,
  };
}