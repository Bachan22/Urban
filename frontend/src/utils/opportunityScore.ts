export type OpportunityInputs = {
  populationDemand: number;
  competition: number;
  accessibility: number;
  supportingEcosystem: number;
  studentDemand: number;
};

export type OpportunityResult = {
  score: number;
  level: "High" | "Medium" | "Low";

  factors: {
    name: string;
    value: number;
    weight: number;
  }[];

  explanation: string[];
};

function clamp(value: number) {
  return Math.max(
    0,
    Math.min(100, value)
  );
}

export function calculateOpportunityScore(
  businessType: string,
  input: OpportunityInputs
): OpportunityResult {
  let score = 0;

  let factors: {
    name: string;
    value: number;
    weight: number;
  }[] = [];


  // EDUCATION INSTITUTE

  if (
    businessType ===
    "Education Institute"
  ) {
    const studentDemand =
      clamp(input.studentDemand);

    const ecosystem =
      clamp(input.supportingEcosystem);

    const competition =
      clamp(input.competition);

    const accessibility =
      clamp(input.accessibility);

    score =
      studentDemand * 0.30 +
      ecosystem * 0.30 +
      competition * 0.20 +
      accessibility * 0.20;

    factors = [
      {
        name: "Student Demand",
        value: studentDemand,
        weight: 30,
      },

      {
        name: "Education Ecosystem",
        value: ecosystem,
        weight: 30,
      },

      {
        name: "Competition Opportunity",
        value: competition,
        weight: 20,
      },

      {
        name: "Accessibility",
        value: accessibility,
        weight: 20,
      },
    ];
  }


  // PHARMACY

  else if (
    businessType === "Pharmacy"
  ) {
    const population =
      clamp(input.populationDemand);

    const ecosystem =
      clamp(input.supportingEcosystem);

    const competition =
      clamp(input.competition);

    const accessibility =
      clamp(input.accessibility);

    score =
      population * 0.35 +
      ecosystem * 0.25 +
      competition * 0.20 +
      accessibility * 0.20;

    factors = [
      {
        name: "Population Demand",
        value: population,
        weight: 35,
      },

      {
        name: "Healthcare Ecosystem",
        value: ecosystem,
        weight: 25,
      },

      {
        name: "Competition Opportunity",
        value: competition,
        weight: 20,
      },

      {
        name: "Accessibility",
        value: accessibility,
        weight: 20,
      },
    ];
  }


  // OTHER BUSINESSES

  else {
    const population =
      clamp(input.populationDemand);

    const ecosystem =
      clamp(input.supportingEcosystem);

    const competition =
      clamp(input.competition);

    const accessibility =
      clamp(input.accessibility);

    score =
      population * 0.30 +
      ecosystem * 0.25 +
      competition * 0.25 +
      accessibility * 0.20;

    factors = [
      {
        name: "Population Demand",
        value: population,
        weight: 30,
      },

      {
        name: "Supporting Ecosystem",
        value: ecosystem,
        weight: 25,
      },

      {
        name: "Competition Opportunity",
        value: competition,
        weight: 25,
      },

      {
        name: "Accessibility",
        value: accessibility,
        weight: 20,
      },
    ];
  }


  // FINAL SCORE

  const finalScore =
    Math.round(score);

  let level:
    | "High"
    | "Medium"
    | "Low";

  if (finalScore >= 75) {
    level = "High";
  } else if (finalScore >= 50) {
    level = "Medium";
  } else {
    level = "Low";
  }


  // EXPLANATION

  const explanation =
    factors.map((factor) => {
      if (factor.value >= 75) {
        return `${factor.name} is strong`;
      }

      if (factor.value >= 50) {
        return `${factor.name} is moderate`;
      }

      return `${factor.name} is low`;
    });


  return {
    score: finalScore,
    level,
    factors,
    explanation,
  };
}