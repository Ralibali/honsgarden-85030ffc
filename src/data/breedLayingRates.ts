// Typiska värpprocent (eggs/day/hen × 100) för raser som finns i appens
// rasguider (src/data/honsraserContent.ts). Siffrorna är riktvärden för
// hobbyflockar under värpsäsong, ej garantier. Källor: rasstandarder,
// SBA/Svenska Lanthönsklubben och vedertagna riktvärden för hybrider.
//
// Värpprocent ≈ ägg per höna och dag × 100. Exempel: 250 ägg/år ≈ 68 %.

export interface BreedLayingRate {
  breed: string;
  min: number;     // typisk lägsta nivå (%)
  max: number;     // typisk högsta nivå (%)
  typical: number; // typiskt snitt (%)
}

export const DEFAULT_BREED_RATE: BreedLayingRate = {
  breed: 'Okänd',
  min: 50,
  max: 65,
  typical: 57,
};

// Nyckel = normaliserat rasnamn (lowercase, trim, utan "(hybrid)" osv).
export const BREED_LAYING_RATES: BreedLayingRate[] = [
  // Svenska lantraser – lägre värpning men robusta
  { breed: 'Skånsk blommehöna', min: 40, max: 55, typical: 49 },
  { breed: 'Hedemora',          min: 35, max: 50, typical: 41 },
  { breed: 'Hedemorahöna',      min: 35, max: 50, typical: 41 },
  { breed: 'Bohusläns svarthöna', min: 35, max: 50, typical: 41 },
  { breed: 'Bohuslän-Dals svarthöna', min: 35, max: 50, typical: 41 },
  { breed: 'Öländsk dvärghöna', min: 30, max: 45, typical: 33 },
  { breed: 'Öländsk höna',      min: 30, max: 45, typical: 33 },
  { breed: 'Gotlandshöna',      min: 40, max: 55, typical: 47 },
  { breed: 'Åsbohöna',          min: 35, max: 50, typical: 41 },
  { breed: 'Kindahöna',         min: 38, max: 50, typical: 44 },
  { breed: 'Frisisk höna',      min: 50, max: 65, typical: 55 },
  // Klassiska hobbyraser
  { breed: 'Orpington',         min: 45, max: 60, typical: 49 },
  { breed: 'Wyandotte',         min: 50, max: 65, typical: 55 },
  { breed: 'Sussex',            min: 60, max: 75, typical: 66 },
  { breed: 'Plymouth Rock',     min: 55, max: 68, typical: 60 },
  { breed: 'Rhode Island Red',  min: 60, max: 75, typical: 68 },
  { breed: 'New Hampshire',     min: 55, max: 68, typical: 60 },
  { breed: 'Maran',             min: 45, max: 60, typical: 49 },
  { breed: 'Marans',            min: 45, max: 60, typical: 49 },
  { breed: 'Welsumer',          min: 50, max: 62, typical: 55 },
  { breed: 'Barnevelder',       min: 50, max: 62, typical: 55 },
  { breed: 'Araucana',          min: 45, max: 60, typical: 49 },
  { breed: 'Vit leghorn',       min: 70, max: 82, typical: 77 },
  { breed: 'Leghorn',           min: 65, max: 80, typical: 73 },
  { breed: 'Australorp',        min: 60, max: 78, typical: 68 },
  { breed: 'Bielefelder',       min: 55, max: 70, typical: 62 },
  { breed: 'Vorwerk',           min: 45, max: 60, typical: 49 },
  { breed: 'Faverolle',         min: 45, max: 60, typical: 49 },
  // Stora och prydnad
  { breed: 'Brahma',            min: 35, max: 50, typical: 41 },
  { breed: 'Cochin',            min: 35, max: 50, typical: 38 },
  { breed: 'Silkeshöns',        min: 25, max: 40, typical: 30 },
  { breed: 'Silkeshöna',        min: 25, max: 40, typical: 30 },
  { breed: 'Sebright',          min: 20, max: 35, typical: 25 },
  // Hybrider – höga första året
  { breed: 'ISA Brown',         min: 75, max: 90, typical: 82 },
  { breed: 'Lohmann Brown',     min: 75, max: 90, typical: 82 },
  { breed: 'Bovans',            min: 70, max: 85, typical: 78 },
  { breed: 'Hybrid',            min: 70, max: 88, typical: 80 },
];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\(hybrid\)/g, '')
    .replace(/\(dvärg\)/g, '')
    .replace(/[^\p{L}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const lookup = new Map<string, BreedLayingRate>();
for (const r of BREED_LAYING_RATES) lookup.set(normalize(r.breed), r);

/** Hitta typisk värpprocent för en ras. Returnerar default om okänd. */
export function getBreedLayingRate(breed?: string | null): BreedLayingRate {
  if (!breed) return DEFAULT_BREED_RATE;
  const key = normalize(breed);
  if (lookup.has(key)) return lookup.get(key)!;
  // Försök partiell matchning (t.ex. "ISA Brown hybrid" → "isa brown")
  for (const [k, v] of lookup) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return DEFAULT_BREED_RATE;
}
