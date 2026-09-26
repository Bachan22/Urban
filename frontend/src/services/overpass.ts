const OVERPASS_URL =
  "https://overpass-api.de/api/interpreter";

export type Place = {
  id: number;
  lat: number;
  lon: number;
  name: string;
  category: string;
};

const BUSINESS_QUERIES: Record<string, string> = {
  "Education Institute": `
    nwr["amenity"~"school|college|university|kindergarten|training_centre"]
  `,

  Pharmacy: `
    nwr["amenity"="pharmacy"]
  `,

  Restaurant: `
    nwr["amenity"="restaurant"]
  `,

  Gym: `
    nwr["leisure"="fitness_centre"]
  `,

  "Clothing Store": `
    nwr["shop"="clothes"]
  `,

  Cafe: `
    nwr["amenity"="cafe"]
  `,

  Clinic: `
    nwr["amenity"="clinic"]
  `,
};

export async function getBusinessData(
  businessType: string,
  latitude: number,
  longitude: number,
  radius = 2000
) {
  const businessQuery =
    BUSINESS_QUERIES[businessType];

  if (!businessQuery) {
    throw new Error(
      "Unsupported business type"
    );
  }

  const query = `
    [out:json][timeout:40];

    (
      ${businessQuery}
      (around:${radius},${latitude},${longitude});

      nwr["amenity"="hospital"]
      (around:${radius},${latitude},${longitude});

      nwr["amenity"="school"]
      (around:${radius},${latitude},${longitude});

      nwr["amenity"="college"]
      (around:${radius},${latitude},${longitude});
    );

    out center;
  `;

  const response = await fetch(
    `${OVERPASS_URL}?data=${encodeURIComponent(
      query
    )}`
  );

  if (!response.ok) {
    throw new Error(
      "Unable to retrieve OpenStreetMap data"
    );
  }

  const data = await response.json();

  const businesses: Place[] = [];
  const hospitals: Place[] = [];
  const schools: Place[] = [];
  const colleges: Place[] = [];

  for (const element of data.elements ?? []) {
    const lat =
      element.lat ??
      element.center?.lat;

    const lon =
      element.lon ??
      element.center?.lon;

    if (
      lat === undefined ||
      lon === undefined
    ) {
      continue;
    }

    const amenity =
      element.tags?.amenity ?? "";

    const place: Place = {
      id: element.id,
      lat,
      lon,
      name:
        element.tags?.name ??
        "Unnamed location",
      category: amenity,
    };

    if (amenity === "hospital") {
      hospitals.push(place);
    } else if (amenity === "school") {
      schools.push(place);
    } else if (amenity === "college") {
      colleges.push(place);
    } else {
      businesses.push(place);
    }
  }

  return {
    businesses,
    hospitals,
    schools,
    colleges,
  };
}