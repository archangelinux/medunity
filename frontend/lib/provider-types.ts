import type { CTASLevel, FacilityType } from './types';

export interface TriageSignal {
  id: string;
  latitude: number;
  longitude: number;
  ctasLevel: CTASLevel;
  symptoms: string[];
  chiefComplaint: string;
  destinationId: string;
  destinationName: string;
  destinationType: FacilityType;
  etaMinutes: number;
  reportedAt: string;
}

export interface LinkedEntryData {
  userText: string;
  symptoms: { label: string; category: string }[];
  ctasLevel: number;
  timestamp: string;
  assessment: string;
  triageResponses?: string;
  triageReport?: {
    summary: string;
    assessment: string;
    recommendedAction: string;
    watchFor: string[];
  };
}

export interface TriageDocumentData {
  userText: string;
  symptoms: { label: string; category: string }[];
  ctasLevel: number;
  timestamp: string;
  triageReport?: {
    summary: string;
    symptomsIdentified: string[];
    assessment: string;
    recommendedAction: string;
    watchFor: string[];
    urgencyTimeframe: string;
    recommendedCareType: string;
  };
  triageResponses?: string;
  linkedEntries?: LinkedEntryData[];
  patientDemographics?: {
    age?: number;
    sex?: string;
    conditions?: string[];
    medications?: string[];
    allergies?: string[];
  };
}

export interface ProviderSignal extends TriageSignal {
  entryId?: string;
  facilityId?: string;
  facilityName?: string;
  suggestedWard?: string;
  prepChecklist: string[];
  status: string;
  isSimulated: boolean;
  reportData?: TriageDocumentData;
  /** Original start position for animation — dots interpolate from here to the facility */
  startLatitude: number;
  startLongitude: number;
  /** Road route coordinates from Mapbox Directions API [lng, lat][] */
  routeCoordinates?: [number, number][];
}

export interface DemandAnalysis {
  summary: string;
  wardSuggestions: { ward: string; category: string; ctas_level: number; signal_id?: string }[];
  clusterAlerts: { category: string; count: number; message: string; protocol: string }[];
  capacityProjection: {
    minutes_until_full: number | null;
    current_utilization: number;
    recommendation: string;
  };
  diversionRecommendations: {
    facility_name: string;
    facility_id: string;
    current_utilization: number;
    recommendation: string;
  }[];
  prepChecklists: { checklist: string[]; category: string; signal_id?: string }[];
}

export type Scenario = 'normal' | 'flu-season' | 'mass-casualty' | 'heat-wave';

export interface ScenarioConfig {
  label: string;
  description: string;
  totalSignals: number;
  ctasWeights: [CTASLevel, number][];
  clusterBias: string[] | null;
}

export interface FacilityLoad {
  facilityId: string;
  name: string;
  type: FacilityType;
  incoming: number;
  capacity: number;
  utilization: number;
}

export interface CuratedFacility {
  id: string;
  name: string;
  type: FacilityType;
  latitude: number;
  longitude: number;
  address: string;
  capacity: number;
}

export const TORONTO_HOSPITALS: CuratedFacility[] = [
  {
    id: 'camh',
    name: 'CAMH — Centre for Addiction & Mental Health',
    type: 'hospital',
    latitude: 43.6492,
    longitude: -79.4042,
    address: '1001 Queen St W, Toronto',
    capacity: 40,
  },
  {
    id: 'toronto-general',
    name: 'Toronto General Hospital',
    type: 'hospital',
    latitude: 43.6594,
    longitude: -79.3882,
    address: '200 Elizabeth St, Toronto',
    capacity: 60,
  },
  {
    id: 'st-michaels',
    name: "St. Michael's Hospital",
    type: 'hospital',
    latitude: 43.6529,
    longitude: -79.3777,
    address: '36 Queen St E, Toronto',
    capacity: 55,
  },
  {
    id: 'sickkids',
    name: 'SickKids Hospital',
    type: 'hospital',
    latitude: 43.6568,
    longitude: -79.3876,
    address: '555 University Ave, Toronto',
    capacity: 45,
  },
  {
    id: 'mount-sinai',
    name: 'Mount Sinai Hospital',
    type: 'hospital',
    latitude: 43.6577,
    longitude: -79.3909,
    address: '600 University Ave, Toronto',
    capacity: 50,
  },
  {
    id: 'sunnybrook',
    name: 'Sunnybrook Health Sciences Centre',
    type: 'hospital',
    latitude: 43.7224,
    longitude: -79.3753,
    address: '2075 Bayview Ave, Toronto',
    capacity: 65,
  },
  {
    id: 'toronto-western',
    name: 'Toronto Western Hospital',
    type: 'hospital',
    latitude: 43.6535,
    longitude: -79.4057,
    address: '399 Bathurst St, Toronto',
    capacity: 50,
  },
];

// CTAS colors: Lobster Pink → Rosy Copper → Ocean Deep → Tropical Teal → Tea Green
export const CTAS_COLORS: Record<CTASLevel, string> = {
  1: '#E5625E', // Lobster Pink
  2: '#CD533B', // Rosy Copper
  3: '#2364AA', // Ocean Deep
  4: '#62A8AC', // Tropical Teal
  5: '#8BA868', // Tea Green (darkened for contrast)
};

export const CTAS_BG_COLORS: Record<CTASLevel, string> = {
  1: '#FADCDB', // soft pink
  2: '#F8D5CC', // soft copper
  3: '#CDDDF2', // soft blue
  4: '#D4EDEE', // soft teal
  5: '#E8F2D8', // soft green
};

export const CTAS_LABELS: Record<CTASLevel, string> = {
  1: 'Resuscitation',
  2: 'Emergent',
  3: 'Urgent',
  4: 'Less Urgent',
  5: 'Non-Urgent',
};

export const SCENARIOS: Record<Scenario, ScenarioConfig> = {
  normal: {
    label: 'Normal Day',
    description: 'Typical community demand',
    totalSignals: 35,
    ctasWeights: [[1, 0.01], [2, 0.08], [3, 0.22], [4, 0.38], [5, 0.31]],
    clusterBias: null,
  },
  'flu-season': {
    label: 'Flu Season',
    description: 'Respiratory illness surge',
    totalSignals: 55,
    ctasWeights: [[1, 0.01], [2, 0.06], [3, 0.30], [4, 0.40], [5, 0.23]],
    clusterBias: ['respiratory', 'general'],
  },
  'mass-casualty': {
    label: 'Mass Casualty',
    description: 'Multi-patient emergency event',
    totalSignals: 25,
    ctasWeights: [[1, 0.08], [2, 0.25], [3, 0.35], [4, 0.22], [5, 0.10]],
    clusterBias: ['injury', 'cardiac', 'neuro'],
  },
  'heat-wave': {
    label: 'Heat Wave',
    description: 'Heat-related illness spike',
    totalSignals: 45,
    ctasWeights: [[1, 0.02], [2, 0.12], [3, 0.28], [4, 0.33], [5, 0.25]],
    clusterBias: ['general', 'cardiac'],
  },
};
