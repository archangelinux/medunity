import type {
  HealthEntry,
  Clinic,
  SymptomFrequencyItem,
  PatternAlert,
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

// --- Clinics ---

export async function getCareRouting(ctasLevel: number): Promise<Clinic[]> {
  const data = await request<{ clinics: Clinic[] }>(
    `/api/clinics/route?ctas_level=${ctasLevel}`
  );
  return data.clinics;
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
