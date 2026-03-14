export type CTASLevel = 1 | 2 | 3 | 4 | 5;

export type EntryStatus = 'active' | 'resolved' | 'watching' | 'escalated';

export type CareType = 'walk-in' | 'er' | 'urgent-care' | 'telehealth' | 'campus-health';

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
}

export interface Clinic {
  id: string;
  name: string;
  type: CareType;
  waitMinutes: number;
  distanceKm: number;
  address: string;
  hours: string;
  isOpen: boolean;
  closingTime?: string;
  services: string[];
  recommended?: boolean;
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
}

export interface TriageQuestion {
  id: string;
  question: string;
  type: 'yesno' | 'scale' | 'choice' | 'text';
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

export interface Resource {
  id: string;
  name: string;
  category: 'food' | 'clothing' | 'hygiene' | 'medical' | 'mental-health' | 'housing' | 'other';
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
