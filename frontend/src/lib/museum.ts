export interface CarEntry {
  id: string;
  name: string;
  year: number;
  constructor: string;
  era: string;
  engine: string | null;
  drivers: string[];
  wins: number | null;
  notes: string;
  source: string;
  model?: { url: string; credit: string; license: string; bytes: number };
}
// Editorial catalogue: facts transcribed from linked primary sources; no external imagery reused.
export const cars: CarEntry[] = [
  {
    id: "m23-1974",
    name: "M23",
    year: 1974,
    constructor: "McLaren",
    era: "Naturally aspirated development",
    engine: null,
    drivers: ["Emerson Fittipaldi", "Denny Hulme", "Mike Hailwood"],
    wins: 4,
    notes:
      "McLaren’s heritage record identifies the M23 as its 1974 championship-winning car. Dimensions and technical specifications are not supplied here.",
    source: "https://www.mclaren.com/racing/heritage/formula-1/cars/1974-formula-1-mclaren-m23/",
  },
  {
    id: "mp44-1988",
    name: "MP4/4",
    year: 1988,
    constructor: "McLaren",
    era: "Turbo era",
    engine: "Honda RA168E V6 turbo",
    drivers: ["Ayrton Senna", "Alain Prost"],
    wins: 15,
    notes:
      "The last season before the 1989 turbo ban. Honda’s engine and McLaren’s chassis won 15 of 16 Grands Prix.",
    source: "https://www.mclaren.com/racing/heritage/formula-1/cars/1988-formula-1-mclaren-mp4-4/",
  },
  {
    id: "mp413-1998",
    name: "MP4/13",
    year: 1998,
    constructor: "McLaren",
    era: "V10 era",
    engine: "Mercedes-Benz V10",
    drivers: ["Mika Häkkinen", "David Coulthard"],
    wins: 9,
    notes:
      "Developed for narrower-track and grooved-tyre regulations. McLaren records nine race wins and both championships.",
    source: "https://www.mclaren.com/racing/heritage/formula-1/cars/mp4-13/",
  },
  {
    id: "fw14b-1992",
    name: "FW14B",
    year: 1992,
    constructor: "Williams",
    era: "Active-suspension era",
    engine: null,
    drivers: ["Nigel Mansell", "Riccardo Patrese"],
    wins: 10,
    notes:
      "Williams describes the FW14B as an evolution of its 1991 car with traction control and an improved active suspension system. The team records ten victories in 1992.",
    source:
      "https://www.williamsf1.com/articles/d807f8a4-e045-4277-994e-f9a872101cfe/atlassian-williams-f1-team-our-journey",
  },
  {
    id: "f2004-2004",
    name: "F2004",
    year: 2004,
    constructor: "Ferrari",
    era: "V10 era",
    engine: "Ferrari 90° V10, 2997 cc",
    drivers: [],
    wins: null,
    notes:
      "Ferrari’s heritage specification lists a rear longitudinal 90-degree V10 and an electro-hydraulic seven-speed transmission. Driver associations and season achievements are not inferred from this specification page.",
    source: "https://www.ferrari.com/en-UG/history/garage/2004/f2004",
  },
];
export function validatedModel(model: CarEntry["model"]) {
  if (
    !model ||
    !model.credit ||
    !model.license ||
    !Number.isFinite(model.bytes) ||
    model.bytes <= 0 ||
    model.bytes > 25000000
  )
    return null;
  if (!/^\/models\/[a-zA-Z0-9_./-]+\.(glb|gltf)$/.test(model.url) || model.url.includes(".."))
    return null;
  return model;
}
