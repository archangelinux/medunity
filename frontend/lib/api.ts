import type {
  HealthEntry,
  SymptomFrequencyItem,
  PatternAlert,
  TriageReport,
} from './types';
import { supabase } from './supabase';

const API_BASE = 'http://localhost:8000';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  // Get current session token
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    headers,
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// --- Entries ---

export interface CreateEntryResponse {
  entry: HealthEntry;
  triageQuestions: import('./types').TriageQuestion[];
  agentResponse: string;
  isResolved: boolean;
}

export interface RespondResponse {
  entry: HealthEntry;
  agentResponse: string;
  isResolved: boolean;
  ctasLevel?: number;
  assessment?: string;
  recommendedAction?: string;
  triageReport?: TriageReport;
}

export async function createEntry(text: string): Promise<CreateEntryResponse> {
  return request('/api/entries', {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

export async function respondToEntry(
  entryId: string,
  message: string,
  resolve: boolean = false
): Promise<RespondResponse> {
  return request(`/api/entries/${entryId}/respond`, {
    method: 'POST',
    body: JSON.stringify({ message, resolve }),
  });
}

export async function getEntries(): Promise<HealthEntry[]> {
  const data = await request<{ entries: HealthEntry[] }>('/api/entries');
  return data.entries;
}

export async function deleteEntry(entryId: string): Promise<void> {
  await request(`/api/entries/${entryId}`, { method: 'DELETE' });
}

export async function getEntry(entryId: string): Promise<HealthEntry> {
  const data = await request<{ entry: HealthEntry }>(`/api/entries/${entryId}`);
  return data.entry;
}

// --- Overview ---

export interface OverviewData {
  entryCount: number;
  avgCtas: number;
  summary: string;
  symptomFrequency: SymptomFrequencyItem[];
  patternAlert: PatternAlert | null;
}

export async function getOverview(): Promise<OverviewData> {
  return request('/api/overview');
}

// --- Profile ---

export interface UserProfile {
  age: number | null;
  sex: string | null;
  heightCm: number | null;
  weightKg: number | null;
  conditions: string[];
  medications: string[];
  allergies: string[];
  labResults: LabResult[];
  healthSummary: string;
  summaryUpdatedAt: string | null;
}

export interface LabResult {
  test: string;
  value: string;
  unit: string;
  range?: string;
  flag: 'normal' | 'high' | 'low';
  date?: string;
}

export async function getProfile(): Promise<UserProfile> {
  const data = await request<{ profile: UserProfile }>('/api/profile');
  return data.profile;
}

export async function updateProfile(profile: {
  age?: number | null;
  sex?: string | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  conditions?: string[];
  medications?: string[];
  allergies?: string[];
}): Promise<UserProfile> {
  const data = await request<{ profile: UserProfile }>('/api/profile', {
    method: 'PUT',
    body: JSON.stringify(profile),
  });
  return data.profile;
}

export async function uploadLabResults(file: File): Promise<{ labResults: LabResult[]; count: number }> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/api/profile/lab-upload`, {
    method: 'POST',
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    body: formData,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return res.json();
}

// --- Locations (backend community centres with resources) ---

export async function getBackendFacilities(lat: number, lng: number): Promise<import('./types').LocationFacility[]> {
  try {
    const data = await request<{ facilities: import('./types').LocationFacility[] }>(
      `/api/locations/facilities?latitude=${lat}&longitude=${lng}`,
    );
    return data.facilities;
  } catch {
    return [];
  }
}

// --- Provider ---

export interface SendReportPayload {
  entry_id?: string;
  facility_id: string;
  facility_name: string;
  ctas_level: number;
  chief_complaint: string;
  symptoms: { label: string; category: string }[];
  eta_minutes: number;
  latitude: number;
  longitude: number;
  report_data?: Record<string, unknown>;
}

export async function sendProviderReport(payload: SendReportPayload) {
  return request('/api/provider/send-report', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getProviderSignals(facilityId: string) {
  return request<{ signals: import('./provider-types').ProviderSignal[] }>(
    `/api/provider/${facilityId}/signals`,
  );
}

export async function getSignalsForEntry(entryId: string) {
  return request<{ signals: { id: string; facilityId: string; facilityName: string; status: string }[] }>(
    `/api/provider/entry/${entryId}/signals`,
  );
}

export async function cancelSignal(signalId: string) {
  return request('/api/provider/signal/${signalId}/cancel'.replace('${signalId}', signalId), {
    method: 'PATCH',
  });
}

export async function markSignalArrived(signalId: string) {
  return request('/api/provider/signal/${signalId}/arrived'.replace('${signalId}', signalId), {
    method: 'PATCH',
  });
}

export async function analyzeDemand(payload: {
  signals: Record<string, unknown>[];
  facility_name: string;
  facility_load: Record<string, unknown>;
  nearby_loads: Record<string, unknown>[];
}) {
  return request<{ analysis: import('./provider-types').DemandAnalysis }>(
    '/api/provider/analyze',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}
