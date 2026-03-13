/* ================================================================
   Fuzzy-VIKOR Multi-Criteria Decision Making Engine

   Implements the full VIKOR method with Triangular Fuzzy Numbers (TFN)
   and Chebyshev (L∞) distance for Individual Regret minimisation.

   References:
   - Opricovic & Tzeng (2004) Compromise solution by MCDM methods
   - Chen (2000) Extensions of the TOPSIS for group decision-making
   under fuzzy environment
   ================================================================ */

// ── Triangular Fuzzy Number ────────────────────────────────────

/** Triangular Fuzzy Number (l, m, u) where l ≤ m ≤ u */
export type TFN = [number, number, number];

/** Create a crisp value as a degenerate TFN (x, x, x) */
export const crisp = (x: number): TFN => [x, x, x];

/** TFN addition: ã + b̃ = (a_l+b_l, a_m+b_m, a_u+b_u) */
export const tfnAdd = (a: TFN, b: TFN): TFN => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

/** TFN subtraction: ã - b̃ = (a_l-b_u, a_m-b_m, a_u-b_l) */
export const tfnSub = (a: TFN, b: TFN): TFN => [a[0] - b[2], a[1] - b[1], a[2] - b[0]];

/** TFN scalar multiplication: k·ã = (k·a_l, k·a_m, k·a_u) for k ≥ 0 */
export const tfnScale = (k: number, a: TFN): TFN => [k * a[0], k * a[1], k * a[2]];

/** TFN multiplication: ã ⊗ b̃ ≈ (a_l·b_l, a_m·b_m, a_u·b_u) for positive TFNs */
export const tfnMul = (a: TFN, b: TFN): TFN => [a[0] * b[0], a[1] * b[1], a[2] * b[2]];

/** TFN division: ã / b̃ ≈ (a_l/b_u, a_m/b_m, a_u/b_l) for positive TFNs */
export const tfnDiv = (a: TFN, b: TFN): TFN => {
  const bl = Math.max(b[0], 1e-10);
  const bm = Math.max(b[1], 1e-10);
  const bu = Math.max(b[2], 1e-10);
  return [a[0] / bu, a[1] / bm, a[2] / bl];
};

/** Center of Area (COA) defuzzification: (l + m + u) / 3 */
export const defuzzCOA = (t: TFN): number => (t[0] + t[1] + t[2]) / 3;

/** Graded Mean: (l + 4m + u) / 6 — often preferred for decision-making */
export const defuzzGraded = (t: TFN): number => (t[0] + 4 * t[1] + t[2]) / 6;

/** Distance between two TFNs: d(ã, b̃) = √(1/3·[(a_l-b_l)² + (a_m-b_m)² + (a_u-b_u)²]) */
export const tfnDistance = (a: TFN, b: TFN): number =>
  Math.sqrt(((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2) / 3);

// ── Criteria Definitions ───────────────────────────────────────

export type CriterionType = 'benefit' | 'cost';

export interface Criterion {
  id: string;
  label: string;
  type: CriterionType;       // benefit = higher is better; cost = lower is better
  weight: TFN;                // fuzzy weight
}

// ── Default Adeptify Criteria for Center Matching ──────────────

/**
 * Criteria for ranking education centers as expansion prospects.
 * Weights expressed as TFN on a [0,1] scale.
 */
export const DEFAULT_CRITERIA: Criterion[] = [
  {
    id: 'proximity',
    label: 'Proximitat geogràfica',
    type: 'cost',                    // lower distance = better
    weight: [0.15, 0.20, 0.25],
  },
  {
    id: 'type_match',
    label: 'Afinitat de tipologia',
    type: 'benefit',                 // higher = better match
    weight: [0.10, 0.15, 0.20],
  },
  {
    id: 'study_overlap',
    label: 'Solapament d\'estudis',
    type: 'benefit',
    weight: [0.15, 0.20, 0.25],
  },
  {
    id: 'digital_maturity',
    label: 'Maduresa digital',
    type: 'benefit',
    weight: [0.05, 0.10, 0.15],
  },
  {
    id: 'engagement',
    label: 'Nivell d\'interacció',
    type: 'benefit',                 // open_count + click_count + interactions
    weight: [0.10, 0.15, 0.20],
  },
  {
    id: 'ai_opportunity',
    label: 'Oportunitat AI',
    type: 'benefit',
    weight: [0.10, 0.15, 0.20],
  },
];

// ── Feature Extraction ─────────────────────────────────────────

/** Study level boolean fields on CatEducationCenterFull */
const STUDY_FIELDS = [
  'einf1c', 'einf2c', 'epri', 'eso', 'batx', 'aa01', 'cfpm', 'ppas',
  'aa03', 'cfps', 'ee', 'ife', 'pfi', 'pa01', 'cfam', 'pa02', 'cfas',
  'esdi', 'escm', 'escs', 'adr', 'crbc', 'idi', 'dane', 'danp', 'dans',
  'muse', 'musp', 'muss', 'tegm', 'tegs', 'estr', 'adults',
] as const;

/** Nature/type similarity mapping — higher score for same type */
const TYPE_SIMILARITY: Record<string, number> = {
  'same': 1.0,
  'public-concerted': 0.6,
  'concerted-private': 0.7,
  'public-private': 0.4,
};

function getTypeSimScore(refType: string | null, candType: string | null): number {
  if (!refType || !candType) return 0.5;
  const a = refType.toLowerCase();
  const b = candType.toLowerCase();
  if (a === b) return 1.0;
  const key = [a, b].sort().join('-');
  // Normalize common Catalan type names
  const norm = (s: string) => {
    if (s.includes('públic') || s.includes('public')) return 'public';
    if (s.includes('concertat') || s.includes('concert')) return 'concerted';
    if (s.includes('privat') || s.includes('priv')) return 'private';
    return s;
  };
  const na = norm(a);
  const nb = norm(b);
  if (na === nb) return 1.0;
  const normKey = [na, nb].sort().join('-');
  return TYPE_SIMILARITY[normKey] ?? 0.5;
}

function getStudyOverlap(ref: any, cand: any): number {
  let shared = 0;
  let total = 0;
  for (const f of STUDY_FIELDS) {
    const rVal = !!(ref as any)[f];
    const cVal = !!(cand as any)[f];
    if (rVal || cVal) {
      total++;
      if (rVal && cVal) shared++;
    }
  }
  return total > 0 ? shared / total : 0;
}

/** Haversine distance in km */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface CenterCandidate {
  codi_centre: string;
  denominacio_completa: string;
  nom_naturalesa: string | null;
  nom_municipi: string | null;
  nom_comarca: string | null;
  coordenades_geo_x: number | null;
  coordenades_geo_y: number | null;
  ai_opportunity_score: number | null;
  email_centre: string | null;
  // study booleans
  [key: string]: any;
  // pre-computed
  _distance?: number;
  _engagement?: number;
  _digital_maturity?: number;
}

/**
 * Extract crisp criterion values for a candidate relative to a reference center.
 * Values are normalised to [0, 1] where possible.
 */
export function extractCriterionValues(
  ref: CenterCandidate,
  cand: CenterCandidate,
  maxDistance: number,
): Record<string, number> {
  // Proximity (0 = far, max_distance → 1 = on top)
  const dist = cand._distance ??
    (ref.coordenades_geo_y && ref.coordenades_geo_x && cand.coordenades_geo_y && cand.coordenades_geo_x
      ? haversineKm(ref.coordenades_geo_y, ref.coordenades_geo_x, cand.coordenades_geo_y, cand.coordenades_geo_x)
      : maxDistance);

  return {
    proximity: Math.min(dist / Math.max(maxDistance, 1), 1.0),     // cost criterion: raw distance ratio
    type_match: getTypeSimScore(ref.nom_naturalesa, cand.nom_naturalesa),
    study_overlap: getStudyOverlap(ref, cand),
    digital_maturity: cand._digital_maturity ?? 0.5,
    engagement: Math.min((cand._engagement ?? 0) / 10, 1.0),       // normalise to [0,1]
    ai_opportunity: (cand.ai_opportunity_score ?? 5) / 10,
  };
}

/**
 * Convert a crisp value to a TFN with ±spread uncertainty.
 * spread controls the fuzziness: 0 = crisp, 0.1 = ±10% of range.
 */
export function crispToTFN(value: number, spread: number = 0.1): TFN {
  return [
    Math.max(0, value - spread),
    value,
    Math.min(1, value + spread),
  ];
}

// ── VIKOR Algorithm ────────────────────────────────────────────

export interface VikorInput {
  alternativeId: string;
  criteria: Record<string, TFN>;  // criterion_id → fuzzy value
}

export interface VikorResult {
  alternativeId: string;
  S: number;   // Group Utility (defuzzified)
  R: number;   // Individual Regret (defuzzified)
  Q: number;   // Compromise Index
  rank: number;
}

/**
 * Run Fuzzy-VIKOR on a decision matrix.
 *
 * @param alternatives  Each alternative with fuzzy criterion values
 * @param criteria      Criterion definitions with fuzzy weights
 * @param v             Weight of strategy of "majority" (S) vs "opponent" (R).
 *                      v=0.5 → balanced compromise. Default: 0.5
 * @returns Sorted array of results (best Q first)
 */
export function fuzzyVikor(
  alternatives: VikorInput[],
  criteria: Criterion[],
  v: number = 0.5,
): VikorResult[] {
  const n = alternatives.length;
  if (n === 0) return [];
  if (n === 1) {
    return [{ alternativeId: alternatives[0].alternativeId, S: 0, R: 0, Q: 0, rank: 1 }];
  }

  const criterionIds = criteria.map(c => c.id);

  // ── Step 1: Determine fuzzy ideal positive (f*) and negative (f⁻) ──
  const fStar: Record<string, TFN> = {};
  const fMinus: Record<string, TFN> = {};

  for (const crit of criteria) {
    const values = alternatives.map(a => a.criteria[crit.id] || crisp(0));

    if (crit.type === 'benefit') {
      // f* = max, f⁻ = min (using defuzzified comparison)
      fStar[crit.id] = values.reduce((best, v) => defuzzCOA(v) > defuzzCOA(best) ? v : best);
      fMinus[crit.id] = values.reduce((worst, v) => defuzzCOA(v) < defuzzCOA(worst) ? v : worst);
    } else {
      // cost: f* = min, f⁻ = max
      fStar[crit.id] = values.reduce((best, v) => defuzzCOA(v) < defuzzCOA(best) ? v : best);
      fMinus[crit.id] = values.reduce((worst, v) => defuzzCOA(v) > defuzzCOA(worst) ? v : worst);
    }
  }

  // ── Step 2: Compute normalised fuzzy distances d_ij ──
  //    d_ij = (f_i* - f_ij) / (f_i* - f_i⁻)   for benefit
  //    d_ij = (f_ij - f_i*) / (f_i⁻ - f_i*)     for cost

  const computeD = (crit: Criterion, value: TFN): TFN => {
    const star = fStar[crit.id];
    const minus = fMinus[crit.id];
    const range = defuzzCOA(star) - defuzzCOA(minus);
    if (Math.abs(range) < 1e-10) return crisp(0); // all same

    if (crit.type === 'benefit') {
      // d = (f* - f) / (f* - f⁻)
      const num = tfnSub(star, value);
      const den: TFN = [Math.abs(range), Math.abs(range), Math.abs(range)];
      return tfnDiv(num, den);
    } else {
      // d = (f - f*) / (f⁻ - f*)
      const num = tfnSub(value, star);
      const den: TFN = [Math.abs(range), Math.abs(range), Math.abs(range)];
      return tfnDiv(num, den);
    }
  };

  // ── Step 3: Compute S_j (Group Utility, L1) and R_j (Individual Regret, L∞) ──
  const sValues: number[] = [];
  const rValues: number[] = [];
  const resultMap: Map<string, { S: number; R: number }> = new Map();

  for (const alt of alternatives) {
    let S_tfn: TFN = [0, 0, 0];
    let R_max = -Infinity;

    for (const crit of criteria) {
      const value = alt.criteria[crit.id] || crisp(0);
      const d = computeD(crit, value);

      // Weighted distance: w_i · d_ij
      const wd = tfnMul(crit.weight, d);

      // S_j = Σ w_i · d_ij  (L1 norm — Group Utility)
      S_tfn = tfnAdd(S_tfn, wd);

      // R_j = max_i [w_i · d_ij]  (L∞ norm — Chebyshev — Individual Regret)
      const wd_crisp = defuzzCOA(wd);
      if (wd_crisp > R_max) R_max = wd_crisp;
    }

    const S = defuzzCOA(S_tfn);
    const R = R_max;
    sValues.push(S);
    rValues.push(R);
    resultMap.set(alt.alternativeId, { S, R });
  }

  // ── Step 4: Compute Q_j (Compromise Index) ──
  const sStar = Math.min(...sValues);
  const sMinus = Math.max(...sValues);
  const rStar = Math.min(...rValues);
  const rMinus = Math.max(...rValues);

  const sRange = sMinus - sStar;
  const rRange = rMinus - rStar;

  const results: VikorResult[] = [];

  for (const alt of alternatives) {
    const { S, R } = resultMap.get(alt.alternativeId)!;

    // Q_j = v · (S_j - S*) / (S⁻ - S*) + (1-v) · (R_j - R*) / (R⁻ - R*)
    const qS = sRange > 1e-10 ? v * (S - sStar) / sRange : 0;
    const qR = rRange > 1e-10 ? (1 - v) * (R - rStar) / rRange : 0;
    const Q = qS + qR;

    results.push({ alternativeId: alt.alternativeId, S, R, Q, rank: 0 });
  }

  // ── Step 5: Rank by Q (ascending — lower Q is better) ──
  results.sort((a, b) => a.Q - b.Q);
  results.forEach((r, i) => { r.rank = i + 1; });

  return results;
}

// ── High-Level API for Adeptify ────────────────────────────────

export interface VikorRankedCenter {
  codi_centre: string;
  denominacio_completa: string;
  nom_naturalesa: string | null;
  nom_municipi: string | null;
  nom_comarca: string | null;
  distance_km: number;
  vikor_S: number;
  vikor_R: number;
  vikor_Q: number;
  vikor_rank: number;
  opportunity_score: number;   // Q mapped to 1-10 scale (10 = best)
  criteria_values: Record<string, number>;
}

/**
 * Rank candidate centers against a reference center using Fuzzy-VIKOR.
 * This is the main entry point for the Adeptify matching engine.
 *
 * @param referenceCenter  The "seed" center to match against
 * @param candidates       Nearby centers to rank
 * @param options          Optional overrides for criteria, weights, v
 */
export function rankCentersVikor(
  referenceCenter: CenterCandidate,
  candidates: CenterCandidate[],
  options?: {
    criteria?: Criterion[];
    v?: number;
    fuzzSpread?: number;
    maxDistanceKm?: number;
    engagementData?: Record<string, number>;  // codi_centre → engagement score
    digitalMaturityData?: Record<string, number>;
  },
): VikorRankedCenter[] {
  if (candidates.length === 0) return [];

  const criteria = options?.criteria ?? DEFAULT_CRITERIA;
  const v = options?.v ?? 0.5;
  const spread = options?.fuzzSpread ?? 0.1;
  const maxDist = options?.maxDistanceKm ??
    Math.max(...candidates.map(c => c._distance ?? 50), 1);

  // Build the decision matrix
  const vikorInputs: VikorInput[] = candidates.map(cand => {
    // Inject engagement/digital maturity from external data if provided
    if (options?.engagementData && cand.codi_centre in options.engagementData) {
      cand._engagement = options.engagementData[cand.codi_centre];
    }
    if (options?.digitalMaturityData && cand.codi_centre in options.digitalMaturityData) {
      cand._digital_maturity = options.digitalMaturityData[cand.codi_centre];
    }

    const vals = extractCriterionValues(referenceCenter, cand, maxDist);
    const fuzzyCriteria: Record<string, TFN> = {};
    for (const [k, v] of Object.entries(vals)) {
      fuzzyCriteria[k] = crispToTFN(v, spread);
    }

    return {
      alternativeId: cand.codi_centre,
      criteria: fuzzyCriteria,
    };
  });

  // Run VIKOR
  const vikorResults = fuzzyVikor(vikorInputs, criteria, v);

  // Map back to enriched center objects
  const candMap = new Map(candidates.map(c => [c.codi_centre, c]));
  const qValues = vikorResults.map(r => r.Q);
  const qMin = Math.min(...qValues);
  const qMax = Math.max(...qValues);
  const qRange = qMax - qMin;

  return vikorResults.map(vr => {
    const c = candMap.get(vr.alternativeId)!;
    const crispVals = extractCriterionValues(referenceCenter, c, maxDist);

    // Map Q to 1-10 score (Q=0 best → 10, Q=max → 1)
    const normalizedQ = qRange > 1e-10 ? (vr.Q - qMin) / qRange : 0;
    const opportunityScore = Math.round((1 - normalizedQ) * 9 + 1);

    return {
      codi_centre: c.codi_centre,
      denominacio_completa: c.denominacio_completa,
      nom_naturalesa: c.nom_naturalesa,
      nom_municipi: c.nom_municipi ?? null,
      nom_comarca: c.nom_comarca ?? null,
      distance_km: c._distance ?? haversineKm(
        referenceCenter.coordenades_geo_y!, referenceCenter.coordenades_geo_x!,
        c.coordenades_geo_y!, c.coordenades_geo_x!,
      ),
      vikor_S: Math.round(vr.S * 10000) / 10000,
      vikor_R: Math.round(vr.R * 10000) / 10000,
      vikor_Q: Math.round(vr.Q * 10000) / 10000,
      vikor_rank: vr.rank,
      opportunity_score: opportunityScore,
      criteria_values: crispVals,
    };
  });
}
