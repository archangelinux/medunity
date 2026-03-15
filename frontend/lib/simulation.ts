import type { CTASLevel } from './types';
import type { ProviderSignal, Scenario, FacilityLoad, CuratedFacility } from './provider-types';
import { SCENARIOS, TORONTO_HOSPITALS } from './provider-types';

// Ward mapping (mirrors backend)
const WARD_MAP: Record<string, string> = {
  '1-cardiac': 'Resus Bay — Cardiac',
  '1-neuro': 'Resus Bay — Neuro',
  '1-respiratory': 'Resus Bay — Respiratory',
  '1-injury': 'Resus Bay — Trauma',
  '1-general': 'Resus Bay',
  '2-cardiac': 'CCU / Monitored Beds',
  '2-neuro': 'Acute Neuro Bay',
  '2-respiratory': 'Acute Respiratory',
  '2-mental': 'Psychiatric Emergency',
  '2-injury': 'Trauma Bay',
  '2-general': 'Acute Assessment',
  '3-respiratory': 'Respiratory Isolation',
  '3-mental': 'Psychiatric Assessment',
  '3-general': 'Acute Medical',
  '4-default': 'Minor Treatment Area',
  '5-default': 'Minor Treatment / Walk-in',
};

function detectCategory(symptoms: string[]): string {
  const catMap: Record<string, string> = {
    'chest pain': 'cardiac', 'palpitations': 'cardiac', 'sweating': 'cardiac',
    'dizziness': 'neuro', 'confusion': 'neuro', 'numbness': 'neuro', 'vision changes': 'neuro',
    'cough': 'respiratory', 'shortness of breath': 'respiratory', 'wheezing': 'respiratory',
    'nausea': 'gi', 'vomiting': 'gi', 'diarrhea': 'gi',
    'headache': 'pain', 'back pain': 'pain', 'abdominal pain': 'pain',
    'anxiety': 'mental', 'depression': 'mental', 'panic attacks': 'mental',
    'laceration': 'injury', 'bleeding': 'injury', 'swelling': 'injury',
    'fever': 'general', 'fatigue': 'general', 'chills': 'general',
  };
  const counts: Record<string, number> = {};
  for (const s of symptoms) {
    const cat = catMap[s.toLowerCase()];
    if (cat) counts[cat] = (counts[cat] || 0) + 1;
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] || 'general';
}

function suggestWard(ctasLevel: CTASLevel, symptoms: string[]): string {
  if (ctasLevel >= 4) return WARD_MAP[`${ctasLevel}-default`] || 'Minor Treatment Area';
  const cat = detectCategory(symptoms);
  return WARD_MAP[`${ctasLevel}-${cat}`] || WARD_MAP[`${ctasLevel}-general`] || 'Acute Assessment';
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ───────────────────────────────────────────────
// Curated demo patients — realistic Toronto cases
// ───────────────────────────────────────────────

interface DemoPatient {
  label: string; // e.g. "45M" — not displayed, just for reference
  lat: number;
  lng: number;
  ctasLevel: CTASLevel;
  symptoms: string[];
  chiefComplaint: string;
}

// Curated patients — scattered across Toronto with mixed acuity at every location
const CURATED_PATIENTS: Record<Scenario, DemoPatient[]> = {
  normal: [
    // Spread across city, CTAS levels deliberately mixed per neighborhood
    { label: '72F Scarborough', lat: 43.7731, lng: -79.2578, ctasLevel: 2, symptoms: ['chest pain', 'shortness of breath', 'sweating'], chiefComplaint: 'Chest pain radiating to left arm, diaphoresis' },
    { label: '34M Scarborough SW', lat: 43.7200, lng: -79.2690, ctasLevel: 4, symptoms: ['headache', 'fatigue'], chiefComplaint: 'Persistent headache for 3 days' },
    { label: '45F North York Centre', lat: 43.7615, lng: -79.4111, ctasLevel: 3, symptoms: ['abdominal pain', 'nausea', 'fever'], chiefComplaint: 'Acute abdominal pain, RLQ tenderness, low-grade fever' },
    { label: '28F North York W', lat: 43.7340, lng: -79.4520, ctasLevel: 5, symptoms: ['sore throat', 'cough'], chiefComplaint: 'Sore throat and dry cough, 2 days' },
    { label: '81F Midtown', lat: 43.6990, lng: -79.3925, ctasLevel: 2, symptoms: ['confusion', 'weakness', 'dizziness'], chiefComplaint: 'Acute confusion, left-sided weakness, possible stroke' },
    { label: '22F Midtown E', lat: 43.7050, lng: -79.3580, ctasLevel: 4, symptoms: ['anxiety', 'insomnia', 'panic attacks'], chiefComplaint: 'Worsening anxiety, panic attacks increasing' },
    { label: '67F Etobicoke', lat: 43.6545, lng: -79.5132, ctasLevel: 3, symptoms: ['dizziness', 'palpitations', 'shortness of breath'], chiefComplaint: 'Episodes of dizziness with rapid heart rate' },
    { label: '19M Etobicoke S', lat: 43.6350, lng: -79.4900, ctasLevel: 5, symptoms: ['laceration', 'bleeding'], chiefComplaint: 'Cut on hand from kitchen knife, bleeding controlled' },
    { label: '41F Leslieville', lat: 43.6632, lng: -79.3310, ctasLevel: 4, symptoms: ['back pain', 'numbness'], chiefComplaint: 'Lower back pain with left leg numbness' },
    { label: '58M Bloor West', lat: 43.6496, lng: -79.4738, ctasLevel: 3, symptoms: ['chest tightness', 'cough', 'wheezing'], chiefComplaint: 'Asthma exacerbation not responding to puffer' },
    { label: '36F Roncesvalles', lat: 43.6479, lng: -79.4497, ctasLevel: 5, symptoms: ['fatigue', 'body aches'], chiefComplaint: 'General fatigue and body aches, possible flu' },
    { label: '48M East York', lat: 43.6920, lng: -79.3250, ctasLevel: 4, symptoms: ['joint pain', 'swelling'], chiefComplaint: 'Swollen right knee, painful to walk' },
    { label: '63M Downsview', lat: 43.7480, lng: -79.4380, ctasLevel: 3, symptoms: ['fever', 'vomiting', 'weakness'], chiefComplaint: 'Diabetic with vomiting, blood sugar 22 mmol/L' },
    { label: '29F Danforth', lat: 43.6846, lng: -79.3009, ctasLevel: 2, symptoms: ['chest pain', 'palpitations', 'shortness of breath'], chiefComplaint: 'SVT, heart rate 180, feeling like passing out' },
    { label: '50M Parkdale', lat: 43.6380, lng: -79.4430, ctasLevel: 4, symptoms: ['cough', 'fatigue', 'body aches'], chiefComplaint: 'Persistent cough with mild fever, 5 days' },
  ],
  'flu-season': [
    // Heavy respiratory cases spread city-wide, mixed with other presentations
    { label: '72F Willowdale', lat: 43.7649, lng: -79.4086, ctasLevel: 2, symptoms: ['shortness of breath', 'fever', 'confusion'], chiefComplaint: 'Elderly with pneumonia symptoms, declining O2 sat' },
    { label: '45M Don Mills', lat: 43.7442, lng: -79.3441, ctasLevel: 3, symptoms: ['fever', 'cough', 'body aches', 'chills'], chiefComplaint: 'High fever 39.5°C, productive cough, 4 days' },
    { label: '8F Thornhill', lat: 43.8000, lng: -79.4200, ctasLevel: 3, symptoms: ['fever', 'vomiting', 'cough'], chiefComplaint: 'Child with high fever, vomiting, refusing fluids' },
    { label: '31M Parkdale', lat: 43.6393, lng: -79.4433, ctasLevel: 4, symptoms: ['cough', 'sore throat', 'fatigue'], chiefComplaint: 'Flu-like symptoms, 3 days, managing at home' },
    { label: '55F Beaches', lat: 43.6705, lng: -79.2930, ctasLevel: 3, symptoms: ['fever', 'shortness of breath', 'chest tightness'], chiefComplaint: 'Worsening respiratory symptoms despite antibiotics' },
    { label: '78F East York', lat: 43.6950, lng: -79.3350, ctasLevel: 2, symptoms: ['shortness of breath', 'fever', 'weakness'], chiefComplaint: 'Frail elderly with acute respiratory failure' },
    { label: '23M Cabbagetown', lat: 43.6649, lng: -79.3647, ctasLevel: 5, symptoms: ['cough', 'fatigue'], chiefComplaint: 'Mild cough and fatigue, 2 days, no fever' },
    { label: '66M Scarborough', lat: 43.7500, lng: -79.2500, ctasLevel: 3, symptoms: ['fever', 'cough', 'wheezing', 'shortness of breath'], chiefComplaint: 'COPD patient with acute respiratory distress' },
    { label: '42F Forest Hill', lat: 43.6883, lng: -79.4161, ctasLevel: 4, symptoms: ['headache', 'fever', 'body aches'], chiefComplaint: 'Flu symptoms with severe headache' },
    { label: '19M U of T', lat: 43.6629, lng: -79.3957, ctasLevel: 4, symptoms: ['fever', 'sore throat', 'fatigue', 'cough'], chiefComplaint: 'University student, flu spreading in residence' },
    { label: '38M Leaside', lat: 43.7080, lng: -79.3680, ctasLevel: 4, symptoms: ['cough', 'fever', 'chills'], chiefComplaint: 'Persistent flu, not improving after 5 days' },
    { label: '51F Chinatown', lat: 43.6525, lng: -79.3975, ctasLevel: 3, symptoms: ['fever', 'vomiting', 'diarrhea', 'weakness'], chiefComplaint: 'Severe dehydration from gastroenteritis' },
    { label: '4M Riverdale', lat: 43.6725, lng: -79.3475, ctasLevel: 3, symptoms: ['fever', 'cough', 'wheezing'], chiefComplaint: 'Toddler with croup, stridor at rest' },
    { label: '60F Downsview', lat: 43.7530, lng: -79.4580, ctasLevel: 4, symptoms: ['fever', 'body aches', 'fatigue'], chiefComplaint: 'Influenza A confirmed, monitoring for complications' },
    { label: '33M Etobicoke', lat: 43.6500, lng: -79.5050, ctasLevel: 5, symptoms: ['cough', 'sore throat'], chiefComplaint: 'Common cold symptoms, requesting note for work' },
    { label: '85F Lawrence Park', lat: 43.7270, lng: -79.4050, ctasLevel: 2, symptoms: ['fever', 'confusion', 'shortness of breath'], chiefComplaint: 'Influenza complicated by delirium, lives alone' },
  ],
  'mass-casualty': [
    // Concentrated near Dundas Square (epicenter) but with ripple effect outward
    { label: '32M at scene', lat: 43.6561, lng: -79.3803, ctasLevel: 1, symptoms: ['bleeding', 'laceration', 'dizziness'], chiefComplaint: 'Deep laceration to chest, significant blood loss' },
    { label: '28M at scene', lat: 43.6555, lng: -79.3812, ctasLevel: 1, symptoms: ['confusion', 'head injury', 'vomiting'], chiefComplaint: 'Head trauma with loss of consciousness, GCS 9' },
    { label: '45F near scene', lat: 43.6570, lng: -79.3790, ctasLevel: 2, symptoms: ['fracture', 'swelling', 'pain'], chiefComplaint: 'Open fracture right tibia from falling debris' },
    { label: '56F 1 block N', lat: 43.6590, lng: -79.3830, ctasLevel: 2, symptoms: ['chest pain', 'shortness of breath'], chiefComplaint: 'Crush injury to chest, respiratory distress' },
    { label: '50M at scene', lat: 43.6548, lng: -79.3795, ctasLevel: 2, symptoms: ['burns', 'pain', 'shortness of breath'], chiefComplaint: 'Partial thickness burns to arms, smoke inhalation' },
    { label: '22M near scene', lat: 43.6580, lng: -79.3775, ctasLevel: 3, symptoms: ['laceration', 'swelling', 'bleeding'], chiefComplaint: 'Multiple lacerations to arms and face, alert' },
    { label: '67F 2 blocks W', lat: 43.6560, lng: -79.3850, ctasLevel: 3, symptoms: ['anxiety', 'chest pain', 'palpitations'], chiefComplaint: 'Cardiac symptoms triggered by event stress' },
    { label: '41M near scene', lat: 43.6545, lng: -79.3820, ctasLevel: 3, symptoms: ['back pain', 'numbness', 'swelling'], chiefComplaint: 'Thrown by blast wave, lower back pain, ambulatory' },
    { label: '19F bystander', lat: 43.6600, lng: -79.3760, ctasLevel: 4, symptoms: ['laceration', 'bruising'], chiefComplaint: 'Minor cuts from broken glass, ambulatory' },
    { label: '35F bystander', lat: 43.6575, lng: -79.3840, ctasLevel: 4, symptoms: ['anxiety', 'panic attacks'], chiefComplaint: 'Severe anxiety reaction, hyperventilating' },
    { label: '70M cardiac', lat: 43.6620, lng: -79.3870, ctasLevel: 2, symptoms: ['chest pain', 'sweating', 'shortness of breath'], chiefComplaint: 'Witnessed event, now having acute chest pain, hx MI' },
    { label: '25F trampled', lat: 43.6553, lng: -79.3808, ctasLevel: 3, symptoms: ['bruising', 'pain', 'shortness of breath'], chiefComplaint: 'Trampled in crowd, rib pain, difficulty breathing' },
  ],
  'heat-wave': [
    // Spread across city with concentration in vulnerable neighborhoods
    { label: '82M Regent Park', lat: 43.6580, lng: -79.3625, ctasLevel: 2, symptoms: ['confusion', 'fever', 'weakness'], chiefComplaint: 'Heat stroke, core temp 40.2°C, altered consciousness' },
    { label: '75F St. James Town', lat: 43.6687, lng: -79.3720, ctasLevel: 2, symptoms: ['dizziness', 'nausea', 'weakness', 'fever'], chiefComplaint: 'Heat exhaustion, no A/C at home, found lethargic' },
    { label: '91F N York nursing home', lat: 43.7250, lng: -79.4100, ctasLevel: 2, symptoms: ['confusion', 'weakness', 'fever'], chiefComplaint: 'Nursing home resident, dehydrated, altered mental status' },
    { label: '45M Liberty Village', lat: 43.6370, lng: -79.4180, ctasLevel: 3, symptoms: ['headache', 'nausea', 'dizziness', 'chills'], chiefComplaint: 'Heat exhaustion from construction work' },
    { label: '68F Moss Park', lat: 43.6555, lng: -79.3670, ctasLevel: 3, symptoms: ['weakness', 'dizziness', 'palpitations'], chiefComplaint: 'Cardiac patient struggling in heat, dehydrated' },
    { label: '5M High Park', lat: 43.6486, lng: -79.4637, ctasLevel: 3, symptoms: ['fever', 'vomiting', 'fatigue'], chiefComplaint: 'Child with heat exhaustion from outdoor play' },
    { label: '72M Moss Park', lat: 43.6540, lng: -79.3720, ctasLevel: 3, symptoms: ['confusion', 'fever', 'weakness', 'dizziness'], chiefComplaint: 'Unhoused person found disoriented in park, dehydrated' },
    { label: '84F Cabbagetown', lat: 43.6670, lng: -79.3640, ctasLevel: 3, symptoms: ['weakness', 'confusion', 'fever'], chiefComplaint: 'Elderly on diuretics, severely dehydrated in heat' },
    { label: '55M Don Valley', lat: 43.6900, lng: -79.3480, ctasLevel: 4, symptoms: ['nausea', 'dizziness', 'fatigue'], chiefComplaint: 'Heat exhaustion after running, cramping' },
    { label: '38F Kensington Mkt', lat: 43.6545, lng: -79.4010, ctasLevel: 4, symptoms: ['headache', 'nausea', 'weakness'], chiefComplaint: 'Feeling faint at outdoor market in sun' },
    { label: '60F Corktown', lat: 43.6560, lng: -79.3580, ctasLevel: 4, symptoms: ['fatigue', 'headache', 'nausea'], chiefComplaint: 'Mild heat-related symptoms, monitoring' },
    { label: '29M Scarborough', lat: 43.7380, lng: -79.2730, ctasLevel: 4, symptoms: ['dizziness', 'nausea', 'chills'], chiefComplaint: 'Heat exhaustion, working in non-A/C vehicle all day' },
    { label: '33F Bloor/Yonge', lat: 43.6710, lng: -79.3860, ctasLevel: 5, symptoms: ['fatigue', 'headache'], chiefComplaint: 'Mild headache from sun exposure, seeking cooling centre' },
    { label: '47M Etobicoke', lat: 43.6450, lng: -79.4950, ctasLevel: 3, symptoms: ['dizziness', 'weakness', 'nausea'], chiefComplaint: 'Roofer with heat exhaustion, near-syncope on site' },
  ],
};

let signalCounter = 0;

function makeSignal(
  patient: DemoPatient,
  targetFacility: CuratedFacility,
  timeOffsetMinutes: number,
): ProviderSignal {
  const dist = haversineDistance(patient.lat, patient.lng, targetFacility.latitude, targetFacility.longitude);
  const roadDist = dist * 1.35; // Toronto roads add ~35% over straight line
  const etaMinutes = Math.max(5, Math.round((roadDist / 30) * 60)); // ~30 km/h avg Toronto

  const reportedAt = new Date(Date.now() - timeOffsetMinutes * 60000);
  signalCounter++;

  return {
    id: `sim-${Date.now()}-${signalCounter}`,
    latitude: patient.lat, // current display position (animated)
    longitude: patient.lng,
    startLatitude: patient.lat, // original start position
    startLongitude: patient.lng,
    ctasLevel: patient.ctasLevel,
    symptoms: patient.symptoms,
    chiefComplaint: patient.chiefComplaint,
    destinationId: targetFacility.id,
    destinationName: targetFacility.name,
    destinationType: targetFacility.type,
    etaMinutes,
    reportedAt: reportedAt.toISOString(),
    suggestedWard: suggestWard(patient.ctasLevel, patient.symptoms),
    prepChecklist: [],
    status: 'active',
    isSimulated: true,
  };
}

/** Generate a full scenario from curated demo data */
export function generateScenario(
  scenario: Scenario,
  targetFacility: CuratedFacility,
): ProviderSignal[] {
  const patients = CURATED_PATIENTS[scenario];

  return patients.map((patient, i) => {
    // Stagger so patients are at various points along their route (20-80% progress)
    // timeOffset = how many minutes ago they were "reported"
    // We want: elapsed / eta = 0.2 to 0.8 (spread across the batch)
    const dist = haversineDistance(patient.lat, patient.lng, targetFacility.latitude, targetFacility.longitude);
    const roadDist = dist * 1.35;
    const estimatedEta = Math.max(5, Math.round((roadDist / 30) * 60));
    const progress = 0.15 + (i / patients.length) * 0.6; // 15% to 75% along route
    const timeOffset = Math.round(progress * estimatedEta);
    return makeSignal(patient, targetFacility, timeOffset);
  });
}

/** Generate a single live signal — picks a random curated patient template */
export function generateLiveSignal(
  scenario: Scenario,
  targetFacility: CuratedFacility,
): ProviderSignal | null {
  const patients = CURATED_PATIENTS[scenario];
  const template = patients[Math.floor(Math.random() * patients.length)];

  // Offset the position slightly so live signals don't stack exactly on templates
  const jitterLat = (Math.random() - 0.5) * 0.01;
  const jitterLng = (Math.random() - 0.5) * 0.01;

  const patient: DemoPatient = {
    ...template,
    lat: template.lat + jitterLat,
    lng: template.lng + jitterLng,
  };

  const signal = makeSignal(patient, targetFacility, 0);
  signal.reportedAt = new Date().toISOString();
  return signal;
}

/**
 * Compute interpolated position for a signal based on elapsed time.
 * If routeCoordinates exist, follows the road path.
 * Otherwise falls back to straight-line interpolation.
 */
export function interpolateSignalPosition(
  signal: ProviderSignal,
  facilityLat: number,
  facilityLng: number,
): { lat: number; lng: number; progress: number } {
  const elapsed = (Date.now() - new Date(signal.reportedAt).getTime()) / 60000;
  const progress = Math.min(1, Math.max(0, elapsed / signal.etaMinutes));

  // If we have road route coordinates, interpolate along the polyline
  if (signal.routeCoordinates && signal.routeCoordinates.length >= 2) {
    const coords = signal.routeCoordinates;

    // Compute cumulative distances along the route
    let totalDist = 0;
    const segDists: number[] = [0];
    for (let i = 1; i < coords.length; i++) {
      const dx = coords[i][0] - coords[i - 1][0];
      const dy = coords[i][1] - coords[i - 1][1];
      totalDist += Math.sqrt(dx * dx + dy * dy);
      segDists.push(totalDist);
    }

    // Find the position at `progress` along the route
    const targetDist = progress * totalDist;
    for (let i = 1; i < segDists.length; i++) {
      if (segDists[i] >= targetDist) {
        const segLen = segDists[i] - segDists[i - 1];
        const t = segLen > 0 ? (targetDist - segDists[i - 1]) / segLen : 0;
        return {
          lng: coords[i - 1][0] + (coords[i][0] - coords[i - 1][0]) * t,
          lat: coords[i - 1][1] + (coords[i][1] - coords[i - 1][1]) * t,
          progress,
        };
      }
    }
    // At end of route
    const last = coords[coords.length - 1];
    return { lng: last[0], lat: last[1], progress };
  }

  // Fallback: straight line
  return {
    lat: signal.startLatitude + (facilityLat - signal.startLatitude) * progress,
    lng: signal.startLongitude + (facilityLng - signal.startLongitude) * progress,
    progress,
  };
}

/** Compute load stats for all curated facilities given signals.
 *  Baseline occupancy starts at ~50% to reflect real hospital conditions. */
export function computeFacilityLoads(
  signals: ProviderSignal[],
  facilities: CuratedFacility[] = TORONTO_HOSPITALS,
): FacilityLoad[] {
  return facilities
    .map((f) => {
      const incoming = signals.filter((s) => s.destinationId === f.id).length;
      const baselineOccupancy = Math.round(f.capacity * 0.5);
      const totalOccupied = baselineOccupancy + incoming;
      return {
        facilityId: f.id,
        name: f.name,
        type: f.type,
        incoming,
        capacity: f.capacity,
        utilization: Math.min(100, Math.round((totalOccupied / f.capacity) * 100)),
      };
    })
    .sort((a, b) => b.utilization - a.utilization);
}
