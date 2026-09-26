export type BusinessType =
  | "Education Institute"
  | "Pharmacy"
  | "Restaurant"
  | "Gym"
  | "Clothing Store"
  | "Cafe"
  | "Clinic";

export const BUSINESS_TYPES: BusinessType[] = [
  "Education Institute",
  "Pharmacy",
  "Restaurant",
  "Gym",
  "Clothing Store",
  "Cafe",
  "Clinic",
];

export const puneData = {
  city: "Pune",
  state: "Maharashtra",

  center: {
    latitude: 18.5204,
    longitude: 73.8567,
  },

  studyRadiusKm: 20,

  population: {
    observed2011: 3402000,
    observed2022: 3556000,

    source:
      "Pune Municipal Corporation ESR 2021-22",

    sourceYear: 2022,
  },
};