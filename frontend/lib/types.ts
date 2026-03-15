export type CTASLevel = 1 | 2 | 3 | 4 | 5;

export type EntryStatus = 'active' | 'resolved' | 'watching' | 'escalated';

export interface Symptom {
  label: string;
  category: 'pain' | 'digestive' | 'neurological' | 'respiratory' | 'mental' | 'general';
}

export interface FollowUpMessage {
  role: 'agent' | 'user';
  text: string;
  timestamp: string;
}

export interface LinkedEntry {
  id: string;
  label: string;
  date: string;
}

export interface PatientDemographics {
  age?: number;
  sex?: string;
  conditions?: string[];
  medications?: string[];
  allergies?: string[];
}

export interface TriageReport {
  summary: string;
  symptomsIdentified: string[];
  assessment: string;
  recommendedAction: string;
  watchFor: string[];
  urgencyTimeframe: string;
  recommendedCareType: 'hospital' | 'walk-in' | 'urgent-care' | 'telehealth';
  recommendedFacilityTypes?: string[];
  facilitySearchTerms?: string[];
  facilityExcludeKeywords?: string[];
  patientDemographics?: PatientDemographics;
}

export interface HealthEntry {
  id: string;
  timestamp: string;
  userText: string;
  symptoms: Symptom[];
  ctasLevel: CTASLevel;
  status: EntryStatus;
  assessment: string;
  linkedEntries: LinkedEntry[];
  followUp: FollowUpMessage[];
  photoUrl?: string;
  triageQuestions?: TriageQuestion[];
  triageReport?: TriageReport;
}

export interface Treatment {
  id: string;
  label: string;
  type: 'medication' | 'referral' | 'follow-up' | 'lab-work';
  progress: number; // 0-100
  detail: string;
  dueDate?: string;
}

export interface PatternAlert {
  id: string;
  title: string;
  description: string;
  ctasTrend: 'stable' | 'worsening' | 'improving';
  relatedEntries: number;
  relatedEntryIds: string[];
}

export interface TriageQuestion {
  id: string;
  question: string;
  type: 'yesno' | 'scale' | 'choice' | 'multiselect' | 'text';
  options?: string[];
}

export interface SymptomFrequencyItem {
  symptom: string;
  count: number;
  color: string;
}

// --- Locations & Resources ---

export type FacilityType =
  | 'hospital'
  | 'walk-in'
  | 'urgent-care'
  | 'community-centre'
  | 'wellness-centre'
  | 'telehealth';

export const CTAS_FACILITY_MAP: Record<CTASLevel, FacilityType[]> = {
  1: ['hospital'],
  2: ['hospital', 'urgent-care'],
  3: ['hospital', 'urgent-care', 'walk-in'],
  4: ['walk-in', 'urgent-care', 'community-centre'],
  5: ['walk-in', 'community-centre', 'wellness-centre', 'telehealth'],
};

export interface Resource {
  id: string;
  name: string;
  category: 'food' | 'clothing' | 'hygiene' | 'medical' | 'mental-health' | 'housing' | 'harm-reduction' | 'sexual-health' | 'other';
  inStock: boolean;
  donationNeeded: boolean;
}

export interface LocationReport {
  id: string;
  facilityId: string;
  reporterType: 'visitor' | 'medical-professional';
  message: string;
  waitTimeUpdate?: number;
  strainLevel?: 'low' | 'moderate' | 'high' | 'critical';
  createdAt: string;
}

export interface LocationFacility {
  id: string;
  name: string;
  type: FacilityType;
  latitude: number;
  longitude: number;
  address: string;
  hours: string;
  isOpen: boolean;
  closingTime?: string;
  waitMinutes?: number;
  travelMinutes?: number;
  distanceKm?: number;
  services: string[];
  resources?: Resource[];
  reports: LocationReport[];
  isFree?: boolean;
  phone?: string;
}
