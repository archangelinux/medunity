'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Search,
  Filter,
  Navigation,
  RefreshCw,
  Loader2,
  MapPin,
  AlertTriangle,
  X,
} from 'lucide-react';
import { MapView } from './MapView';
import { FacilityCard } from './FacilityCard';
import { StagingPanel } from './StagingPanel';
import { StagingFacilityCard } from './StagingFacilityCard';
import { ProviderReport } from './ProviderReport';
import { ReportModal } from './ReportModal';
import { Badge } from '@/components/ui/Badge';
import { getEntry, getBackendFacilities, getSignalsForEntry, cancelSignal, markSignalArrived } from '@/lib/api';
import { fetchNearbyFacilities, geocodeSearch } from '@/lib/overpass';
import type { GeocodeSuggestion } from '@/lib/overpass';
import type { LocationFacility, FacilityType, LocationReport, HealthEntry } from '@/lib/types';
import { CTAS_FACILITY_MAP } from '@/lib/types';

/**
 * Smart facility matching: uses AI-recommended types and search terms
 * to find facilities relevant to the specific condition (not just CTAS level).
 */
// Specialist facility keywords — clinics with these in the name are specialty-only
// and should be excluded unless the patient's condition specifically matches
const SPECIALIST_KEYWORDS = [
  'eye', 'vision', 'optom', 'ophthal', 'optical',
  'dental', 'dent', 'orthodon', 'oral surgery',
  'chiro', 'physio', 'physiother', 'massage', 'acupunctur', 'naturo',
  'cosmetic', 'aesthetic', 'dermat', 'skin', 'laser', 'hair', 'beauty',
  'fertility', 'ivf', 'prenatal', 'maternity', 'obstet', 'midwi',
  'veterinar', 'animal', 'pet',
  'occupational therapy', 'speech', 'audiol', 'hearing',
  'podiatr', 'foot care', 'footcare', 'orthotics', 'biopod', 'orthoped',
  'weight loss', 'bariatric', 'diet', 'nutrition',
  'sleep clinic', 'imaging', 'mri', 'x-ray', 'radiol',
  'lab', 'blood test', 'specimen',
  'pharmacy', 'dispensar',
  'rehab', 'rehabilitation',
];

function isSpecialistMatch(facilityName: string, searchTerms: string[]): boolean {
  const nameLower = facilityName.toLowerCase();
  for (const term of searchTerms) {
    if (nameLower.includes(term.toLowerCase())) return true;
  }
  return false;
}

function matchesStagingEntry(facility: LocationFacility, entry: HealthEntry): boolean {
  const report = entry.triageReport;
  const nameLower = facility.name.toLowerCase();
  const servicesLower = facility.services.map(s => s.toLowerCase()).join(' ');
  const allText = `${nameLower} ${servicesLower}`;

  // EXCLUDE facilities whose name/services match exclusion keywords from the AI
  if (report?.facilityExcludeKeywords && report.facilityExcludeKeywords.length > 0) {
    const excluded = report.facilityExcludeKeywords.some(kw =>
      allText.includes(kw.toLowerCase())
    );
    if (excluded) return false;
  }

  // EXCLUDE specialist clinics — check BOTH name AND services for specialty keywords
  // e.g., "Eye Clinic", a clinic with "optometry" in services, etc.
  const patientTerms = (report?.facilitySearchTerms || []).map(t => t.toLowerCase());
  const isSpecialist = SPECIALIST_KEYWORDS.some(kw => allText.includes(kw));
  if (isSpecialist) {
    // Only include if the patient's search terms explicitly match this specialty
    const specialtyMatch = patientTerms.some(term =>
      SPECIALIST_KEYWORDS.some(kw => term.includes(kw) || kw.includes(term))
    ) || patientTerms.some(term => allText.includes(term));
    if (!specialtyMatch) return false;
  }

  // CTAS 1-2: always include hospitals — emergent patients need ERs
  if (entry.ctasLevel <= 2 && facility.type === 'hospital') return true;

  // If AI provided specific facility types, use those
  if (report?.recommendedFacilityTypes && report.recommendedFacilityTypes.length > 0) {
    if (report.recommendedFacilityTypes.includes(facility.type)) return true;
  }

  // Fallback to CTAS-based filtering
  const allowed = CTAS_FACILITY_MAP[entry.ctasLevel] || [];
  if (allowed.includes(facility.type)) return true;

  // Also match by AI-provided search terms against facility services
  if (report?.facilitySearchTerms && report.facilitySearchTerms.length > 0) {
    const terms = report.facilitySearchTerms.map(t => t.toLowerCase());
    const serviceMatch = facility.services.some(s =>
      terms.some(t => s.toLowerCase().includes(t) || t.includes(s.toLowerCase()))
    );
    if (serviceMatch) return true;
  }

  return false;
}

const filterOptions: { label: string; value: FacilityType | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Hospitals', value: 'hospital' },
  { label: 'Walk-in', value: 'walk-in' },
  { label: 'Urgent Care', value: 'urgent-care' },
  { label: 'Community', value: 'community-centre' },
  { label: 'Wellness', value: 'wellness-centre' },
];

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

interface LocationsPageProps {
  entryId?: string;
  patternEntryIds?: string[];
}

export function LocationsPage({ entryId, patternEntryIds }: LocationsPageProps) {
  // --- Staging state ---
  const [stagingEntry, setStagingEntry] = useState<HealthEntry | null>(null);
  const [patternLinkedEntries, setPatternLinkedEntries] = useState<HealthEntry[]>([]);
  const [departureOffset, setDepartureOffset] = useState(0);
  const [stagingLoading, setStagingLoading] = useState(false);

  const isStaging = !!stagingEntry;

  // --- Location state ---
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState(10);
  const [locationName, setLocationName] = useState('');

  // --- Data state ---
  const [facilities, setFacilities] = useState<LocationFacility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // --- UI state ---
  const [filter, setFilter] = useState<FacilityType | 'all'>('all');
  const [nameSearch, setNameSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reportingFacility, setReportingFacility] = useState<LocationFacility | null>(null);
  const [sendReportFacility, setSendReportFacility] = useState<LocationFacility | null>(null);
  const [sentSignals, setSentSignals] = useState<Map<string, { signalId: string; status: string }>>(new Map());

  // --- Geocoding state ---
  const [locationInput, setLocationInput] = useState('');
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // --- Fetch staging entry when entryId provided ---
  useEffect(() => {
    if (!entryId && !patternEntryIds?.length) {
      setStagingEntry(null);
      setPatternLinkedEntries([]);
      return;
    }

    setStagingLoading(true);

    if (patternEntryIds?.length) {
      // Pattern mode: fetch all related entries, use most recent as primary
      Promise.all(patternEntryIds.map((id) => getEntry(id).catch(() => null)))
        .then((results) => {
          const validEntries = results.filter(Boolean) as HealthEntry[];
          if (validEntries.length > 0) {
            // Sort by timestamp desc — most recent becomes the primary entry
            validEntries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            setStagingEntry(validEntries[0]);
            setPatternLinkedEntries(validEntries.slice(1));
          }
        })
        .finally(() => setStagingLoading(false));
    } else if (entryId) {
      getEntry(entryId)
        .then(async (entry) => {
          setStagingEntry(entry);
          // Fetch linked entries' full data for the report
          if (entry.linkedEntries && entry.linkedEntries.length > 0) {
            const linked = await Promise.all(
              entry.linkedEntries.map((le) => getEntry(le.id).catch(() => null))
            );
            setPatternLinkedEntries(linked.filter((e): e is HealthEntry => e !== null));
          }
        })
        .catch(() => setStagingEntry(null))
        .finally(() => setStagingLoading(false));
    }
  }, [entryId, patternEntryIds]);

  // --- Fetch existing sent signals for this entry ---
  useEffect(() => {
    if (!stagingEntry) {
      setSentSignals(new Map());
      return;
    }
    getSignalsForEntry(stagingEntry.id)
      .then((data) => {
        const map = new Map<string, { signalId: string; status: string }>();
        for (const sig of data.signals) {
          // Use facility name as key since IDs may differ between Overpass and backend
          map.set(sig.facilityId, { signalId: sig.id, status: sig.status });
          // Also store by name for cross-matching
          map.set(sig.facilityName.toLowerCase(), { signalId: sig.id, status: sig.status });
        }
        setSentSignals(map);
      })
      .catch(() => {});
  }, [stagingEntry]);

  // --- Auto-filter by CTAS when staging ---
  useEffect(() => {
    if (stagingEntry) {
      setFilter('all');
    }
  }, [stagingEntry]);

  // --- Get user location on mount ---
  useEffect(() => {
    if (!navigator.geolocation) {
      const fallback = { lat: 43.4643, lng: -80.5204 };
      setUserLocation(fallback);
      setCenter(fallback);
      setLocationName('Waterloo, ON');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        setCenter(loc);
        setLocationName('Your location');
      },
      () => {
        const fallback = { lat: 43.4643, lng: -80.5204 };
        setUserLocation(fallback);
        setCenter(fallback);
        setLocationName('Waterloo, ON (default)');
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  // --- Fetch facilities when center/radius changes (debounced) ---
  const debouncedRadius = useDebounce(radiusKm, 600);

  useEffect(() => {
    if (!center) return;
    const { lat, lng } = center;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        // Fetch Overpass (hospitals/clinics) + backend (community centres with resources) in parallel
        const [overpassResults, backendResults] = await Promise.all([
          fetchNearbyFacilities(lat, lng, debouncedRadius),
          getBackendFacilities(lat, lng),
        ]);

        // Merge: backend centres (with resources) take priority over Overpass duplicates
        const backendNames = new Set(backendResults.map((f) => f.name.toLowerCase()));
        const deduped = overpassResults.filter(
          (f) => !backendNames.has(f.name.toLowerCase()),
        );
        const merged = [...deduped, ...backendResults].sort(
          (a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999),
        );

        if (!cancelled) {
          setFacilities(merged);
          setLastUpdated(new Date());
        }
      } catch {
        if (!cancelled) {
          setError('Could not reach location service. Check your connection and try again.');
          setFacilities([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [center, debouncedRadius]);

  // --- Simulate live wait time jitter every 30s ---
  useEffect(() => {
    const interval = setInterval(() => {
      setFacilities((prev) =>
        prev.map((f) => {
          if (f.waitMinutes == null) return f;
          const delta = Math.floor(Math.random() * 11) - 5;
          return { ...f, waitMinutes: Math.max(5, f.waitMinutes + delta) };
        }),
      );
      setLastUpdated(new Date());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // --- Geocoding search ---
  useEffect(() => {
    if (!locationInput.trim()) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      const results = await geocodeSearch(locationInput);
      setSuggestions(results);
      setShowSuggestions(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [locationInput]);

  // Close suggestions on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelectSuggestion = useCallback((s: GeocodeSuggestion) => {
    setCenter({ lat: s.lat, lng: s.lng });
    setLocationName(s.name.split(',').slice(0, 2).join(','));
    setLocationInput('');
    setSuggestions([]);
    setShowSuggestions(false);
    setSelectedId(null);
  }, []);

  const handleUseMyLocation = useCallback(() => {
    if (!userLocation) return;
    setCenter(userLocation);
    setLocationName('Your location');
    setLocationInput('');
    setSelectedId(null);
  }, [userLocation]);

  const handleRefresh = useCallback(() => {
    if (!center) return;
    setLoading(true);
    setError(null);
    fetchNearbyFacilities(center.lat, center.lng, radiusKm)
      .then((results) => {
        setFacilities(results);
        setLastUpdated(new Date());
      })
      .catch(() => setError('Refresh failed'))
      .finally(() => setLoading(false));
  }, [center, radiusKm]);

  // --- Reports ---
  const handleReport = useCallback((report: Omit<LocationReport, 'id' | 'createdAt'>) => {
    const newReport: LocationReport = {
      ...report,
      id: `rpt-user-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setFacilities((prev) =>
      prev.map((f) => {
        if (f.id !== report.facilityId) return f;
        const updated = { ...f, reports: [newReport, ...f.reports] };
        if (report.waitTimeUpdate) updated.waitMinutes = report.waitTimeUpdate;
        return updated;
      }),
    );
  }, []);

  // --- Filtered + searched facilities ---
  const filteredFacilities = useMemo(() => {
    let result = facilities;

    // In staging mode, use AI-recommended facility types + search terms
    // If filtering produces 0 results, fall back to showing all (never leave an emergent patient with no options)
    if (stagingEntry) {
      const matched = result.filter((f) => matchesStagingEntry(f, stagingEntry));
      if (matched.length > 0) {
        result = matched;
      }
      // else: keep all facilities — better to show everything than nothing
    }

    if (filter !== 'all') {
      result = result.filter((f) => f.type === filter);
    }
    if (nameSearch.trim()) {
      const q = nameSearch.toLowerCase();
      result = result.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.address.toLowerCase().includes(q) ||
          f.services.some((s) => s.toLowerCase().includes(q)),
      );
    }
    return result;
  }, [facilities, filter, nameSearch, stagingEntry]);

  // Count by type
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: facilities.length };
    for (const f of facilities) {
      counts[f.type] = (counts[f.type] || 0) + 1;
    }
    return counts;
  }, [facilities]);

  // Auto-scroll list to selected card
  useEffect(() => {
    if (!selectedId || !listRef.current) return;
    const card = listRef.current.querySelector(`[data-facility-id="${selectedId}"]`);
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedId]);

  const donationAlertCount = useMemo(
    () => facilities.reduce((acc, f) => acc + (f.resources?.filter((r) => r.donationNeeded).length ?? 0), 0),
    [facilities],
  );

  const handleCloseStaging = useCallback(() => {
    setStagingEntry(null);
    // Remove entryId from URL without full navigation
    window.history.replaceState(null, '', '/locations');
  }, []);

  // CSS variable overrides for the teal glass theme
  const glassVars = {
    '--color-surface': 'rgba(236, 248, 245, 0.78)',
    '--color-surface-soft': 'rgba(224, 242, 237, 0.55)',
    '--color-border-soft': 'rgba(190, 224, 216, 0.35)',
    '--color-border': 'rgba(175, 212, 204, 0.45)',
  } as React.CSSProperties;

  // --- Staging mode layout ---
  if (isStaging) {
    return (
      <div className="h-screen relative overflow-hidden">
        {/* Full-bleed map */}
        <div className="absolute inset-0">
          <MapView
            facilities={filteredFacilities}
            userLocation={userLocation}
            center={center}
            radiusKm={radiusKm}
            selectedId={selectedId}
            onFacilitySelect={setSelectedId}
          />
        </div>

        {/* Map legend — bottom-left */}
        <div className="absolute bottom-3 left-3 z-10 bg-surface/85 backdrop-blur-lg rounded-[var(--radius-md)] px-3 py-2 shadow-md border border-white/30">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.6875rem]">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#FDCECE]" />Hospital</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#C6DBFF]" />Walk-in</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#FDE3B9]" />Urgent</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#C2E8B0]" />Community</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#DDD4F5]" />Wellness</span>
          </div>
        </div>

        {loading && (
          <div className="absolute top-3 left-3 z-10 bg-surface/85 backdrop-blur-lg rounded-[var(--radius-md)] px-3 py-2 shadow-md border border-white/30">
            <span className="flex items-center gap-2 text-[0.8125rem] text-text-secondary">
              <Loader2 size={14} className="animate-spin text-accent" />
              Searching nearby facilities...
            </span>
          </div>
        )}

        {/* Floating top pill — entry info + departure picker + view report */}
        <div className="absolute top-3 left-[60px] right-[500px] z-10 hidden md:block">
          <StagingPanel
            entry={stagingEntry!}
            departureOffset={departureOffset}
            onDepartureChange={setDepartureOffset}
          />
        </div>

        {/* Mobile top pill */}
        <div className="absolute top-3 left-3 right-3 z-10 md:hidden">
          <StagingPanel
            entry={stagingEntry!}
            departureOffset={departureOffset}
            onDepartureChange={setDepartureOffset}
          />
        </div>

        {/* Floating right panel — glass style matching normal mode */}
        <div
          className="
            glass-panel absolute z-10
            bottom-0 left-0 right-0 top-[40vh]
            md:top-0 md:left-auto md:right-0 md:w-[480px]
            flex flex-col pointer-events-none
          "
          style={glassVars}
        >
          {/* Header card */}
          <div
            data-glass
            className="
              pointer-events-auto mx-3 mt-3 mb-0 flex-shrink-0
              bg-surface rounded-[var(--radius-lg)] shadow-md p-4
            "
          >
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-[1.125rem] font-bold font-[family-name:var(--font-heading)] text-text-primary">
                Matching Facilities
              </h2>
              <button
                onClick={handleCloseStaging}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)]
                           bg-surface-soft text-text-secondary text-[0.8125rem] font-medium
                           hover:bg-border-soft transition-colors cursor-pointer"
              >
                View All Facilities
              </button>
            </div>
            <p className="text-[0.75rem] text-text-tertiary">
              {loading ? 'Searching...' : `${filteredFacilities.length} facilities match your triage level`}
            </p>
          </div>

          {/* Scrollable card list */}
          <div className="flex-1 overflow-y-auto pointer-events-auto px-3 pt-3 pb-20 md:pb-4 space-y-2"
               style={{ maskImage: 'linear-gradient(to bottom, transparent 0px, black 12px)', WebkitMaskImage: 'linear-gradient(to bottom, transparent 0px, black 12px)' }}>
            {filteredFacilities.map((facility) => (
              <div key={facility.id} data-facility-id={facility.id}>
                <StagingFacilityCard
                  facility={facility}
                  departureOffset={departureOffset}
                  isSelected={facility.id === selectedId}
                  signalStatus={sentSignals.get(facility.id) || sentSignals.get(facility.name.toLowerCase()) || null}
                  onSelect={() => setSelectedId(facility.id === selectedId ? null : facility.id)}
                  onSendReport={() => setSendReportFacility(facility)}
                  onCancel={async (signalId) => {
                    try {
                      await cancelSignal(signalId);
                      setSentSignals((prev) => {
                        const next = new Map(prev);
                        // Update status to cancelled
                        for (const [key, val] of next) {
                          if (val.signalId === signalId) next.set(key, { ...val, status: 'cancelled' });
                        }
                        return next;
                      });
                    } catch {}
                  }}
                  onArrived={async (signalId) => {
                    try {
                      await markSignalArrived(signalId);
                      setSentSignals((prev) => {
                        const next = new Map(prev);
                        for (const [key, val] of next) {
                          if (val.signalId === signalId) next.set(key, { ...val, status: 'arrived' });
                        }
                        return next;
                      });
                    } catch {}
                  }}
                />
              </div>
            ))}

            {!loading && filteredFacilities.length === 0 && (
              <div data-glass className="bg-surface rounded-[var(--radius-lg)] shadow-md border border-white/30 text-center py-12 px-4">
                <Filter size={32} className="mx-auto text-text-tertiary mb-3" />
                <p className="text-[0.9375rem] font-medium text-text-secondary">No matching facilities</p>
                <p className="text-[0.8125rem] text-text-tertiary mt-1">Try increasing the search radius</p>
              </div>
            )}
          </div>
        </div>

        {/* Report modal (anonymous facility feedback) */}
        {reportingFacility && (
          <ReportModal
            facility={reportingFacility}
            onClose={() => setReportingFacility(null)}
            onSubmit={handleReport}
          />
        )}

        {/* Send Report modal — lifted to top level so it overlays properly */}
        {sendReportFacility && stagingEntry && (
          <ProviderReport
            entry={stagingEntry}
            facility={sendReportFacility}
            departureOffset={departureOffset}
            userLocation={userLocation ?? undefined}
            onClose={() => setSendReportFacility(null)}
            onSent={(signalId?: string) => {
              setSentSignals((prev) => {
                const next = new Map(prev);
                const sid = signalId || `local-${Date.now()}`;
                next.set(sendReportFacility.id, { signalId: sid, status: 'active' });
                next.set(sendReportFacility.name.toLowerCase(), { signalId: sid, status: 'active' });
                return next;
              });
              setSendReportFacility(null);
            }}
            linkedEntries={patternLinkedEntries}
          />
        )}

      </div>
    );
  }

  // --- Normal mode layout ---
  return (
    <div className="h-screen relative overflow-hidden">
      {/* Full-bleed map */}
      <div className="absolute inset-0">
        <MapView
          facilities={filteredFacilities}
          userLocation={userLocation}
          center={center}
          radiusKm={radiusKm}
          selectedId={selectedId}
          onFacilitySelect={setSelectedId}
        />
      </div>

      {/* Map legend — bottom-left */}
      <div className="absolute bottom-3 left-3 z-10 bg-surface/85 backdrop-blur-lg rounded-[var(--radius-md)] px-3 py-2 shadow-md border border-white/30">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.6875rem]">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#FDCECE]" />Hospital</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#C6DBFF]" />Walk-in</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#FDE3B9]" />Urgent</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#C2E8B0]" />Community</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#DDD4F5]" />Wellness</span>
        </div>
      </div>

      {/* Loading pill — top-left */}
      {loading && (
        <div className="absolute top-3 left-3 z-10 bg-surface/85 backdrop-blur-lg rounded-[var(--radius-md)] px-3 py-2 shadow-md border border-white/30">
          <span className="flex items-center gap-2 text-[0.8125rem] text-text-secondary">
            <Loader2 size={14} className="animate-spin text-accent" />
            Searching nearby facilities...
          </span>
        </div>
      )}

      {/* Floating right panel */}
      <div
        className="
          glass-panel absolute z-10
          bottom-0 left-0 right-0 top-[35vh]
          md:top-0 md:left-auto md:right-0 md:w-[480px]
          flex flex-col pointer-events-none
        "
        style={glassVars}
      >
        {/* Floating header card */}
        <div
          data-glass
          className="
            pointer-events-auto mx-3 mt-3 mb-0 flex-shrink-0
            bg-surface rounded-[var(--radius-lg)] shadow-md p-4
          "
        >
          <h1 className="text-[1.25rem] font-bold font-[family-name:var(--font-heading)] text-text-primary mb-3">
            Locations & Resources
          </h1>

          {/* Location search */}
          <div className="relative mb-3" ref={suggestionsRef}>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                <input
                  type="text"
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  placeholder={locationName || 'Search a location...'}
                  className="w-full pl-9 pr-8 py-2 rounded-[var(--radius-md)] bg-surface-soft border border-border-soft
                             text-[0.875rem] text-text-primary placeholder-text-tertiary
                             focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30 transition-all"
                />
                {locationInput && (
                  <button
                    onClick={() => { setLocationInput(''); setSuggestions([]); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <button
                onClick={handleUseMyLocation}
                className="flex items-center gap-1.5 px-3 py-2 rounded-[var(--radius-md)]
                           bg-accent-soft text-accent text-[0.8125rem] font-medium
                           hover:bg-accent hover:text-white transition-colors cursor-pointer whitespace-nowrap"
                title="Use my location"
              >
                <Navigation size={14} />
                <span className="hidden sm:inline">My location</span>
              </button>
            </div>

            {/* Suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-surface rounded-[var(--radius-md)] shadow-lg border border-border-soft z-20 overflow-hidden"
                   style={{ '--color-surface': 'rgba(245, 253, 251, 0.95)' } as React.CSSProperties}>
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelectSuggestion(s)}
                    className="w-full text-left px-3 py-2.5 text-[0.8125rem] text-text-secondary
                               hover:bg-surface-soft transition-colors cursor-pointer
                               border-b border-border-soft last:border-0"
                  >
                    <span className="flex items-center gap-2">
                      <MapPin size={13} className="text-text-tertiary flex-shrink-0" />
                      <span className="truncate">{s.name}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Radius slider */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[0.8125rem] font-medium text-text-secondary">Search radius</label>
              <span className="text-[0.875rem] font-semibold font-[family-name:var(--font-heading)] text-text-primary">
                {radiusKm} km
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={50}
              step={1}
              value={radiusKm}
              onChange={(e) => setRadiusKm(parseInt(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer
                         bg-border-soft accent-accent
                         [&::-webkit-slider-thumb]:appearance-none
                         [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                         [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent
                         [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white
                         [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer"
            />
            <div className="flex justify-between text-[0.6875rem] text-text-tertiary mt-0.5">
              <span>1 km</span>
              <span>50 km</span>
            </div>
          </div>

          {/* Status bar */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-[0.75rem] text-text-tertiary">
              {loading ? 'Searching...' : `${facilities.length} found`}
            </span>
            <span className="text-[0.75rem] text-text-tertiary">·</span>
            <button
              onClick={handleRefresh}
              className="flex items-center gap-1 text-[0.75rem] text-text-tertiary hover:text-accent transition-colors cursor-pointer"
            >
              <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
              {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </button>
            {donationAlertCount > 0 && (
              <>
                <span className="text-[0.75rem] text-text-tertiary">·</span>
                <Badge variant="warning">{donationAlertCount} donations needed</Badge>
              </>
            )}
          </div>

          {/* Name search */}
          <div className="relative mb-3">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              value={nameSearch}
              onChange={(e) => setNameSearch(e.target.value)}
              placeholder="Filter by name or service..."
              className="w-full pl-9 pr-3 py-1.5 rounded-[var(--radius-sm)] bg-surface-soft border border-border-soft
                         text-[0.8125rem] text-text-primary placeholder-text-tertiary
                         focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30 transition-all"
            />
          </div>

          {/* Filter tabs with counts */}
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
            {filterOptions.map(({ label, value }) => {
              const count = typeCounts[value] ?? 0;
              return (
                <button
                  key={value}
                  onClick={() => setFilter(value)}
                  className={`
                    px-3 py-1.5 rounded-[var(--radius-sm)] text-[0.8125rem] font-medium whitespace-nowrap
                    transition-colors cursor-pointer flex-shrink-0 flex items-center gap-1.5
                    ${filter === value
                      ? 'bg-accent text-white shadow-sm'
                      : 'bg-surface-soft text-text-secondary hover:bg-border-soft'
                    }
                  `}
                >
                  {label}
                  {count > 0 && (
                    <span className={`text-[0.6875rem] ${filter === value ? 'text-white/70' : 'text-text-tertiary'}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable card list — transparent gaps show map */}
        <div ref={listRef} className="flex-1 overflow-y-auto pointer-events-auto px-3 pt-3 pb-20 md:pb-4 space-y-2"
             style={{ maskImage: 'linear-gradient(to bottom, transparent 0px, black 12px)', WebkitMaskImage: 'linear-gradient(to bottom, transparent 0px, black 12px)' }}>
          {/* Error */}
          {error && (
            <div data-glass className="bg-danger-soft/80 backdrop-blur-lg rounded-[var(--radius-lg)] px-4 py-3 flex items-start gap-2 shadow-md border border-white/30">
              <AlertTriangle size={16} className="text-danger mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[0.8125rem] font-medium text-danger">{error}</p>
                <button
                  onClick={handleRefresh}
                  className="text-[0.8125rem] text-accent font-medium mt-1 hover:underline cursor-pointer"
                >
                  Try again
                </button>
              </div>
            </div>
          )}

          {/* Loading skeleton */}
          {loading && facilities.length === 0 && (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} data-glass className="bg-surface rounded-[var(--radius-lg)] p-5 space-y-3 shadow-md border border-white/30">
                  <div className="skeleton h-5 w-2/3" />
                  <div className="skeleton h-3 w-1/2" />
                  <div className="skeleton h-3 w-1/3" />
                  <div className="flex gap-2">
                    <div className="skeleton h-6 w-16" />
                    <div className="skeleton h-6 w-20" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Facility cards */}
          {!loading &&
            filteredFacilities.map((facility) => (
              <div key={facility.id} data-facility-id={facility.id}>
                <FacilityCard
                  facility={facility}
                  isSelected={facility.id === selectedId}
                  onSelect={() => setSelectedId(facility.id === selectedId ? null : facility.id)}
                  onReport={() => setReportingFacility(facility)}
                />
              </div>
            ))}

          {/* Loading indicator for re-fetches */}
          {loading && facilities.length > 0 && (
            <div className="text-center py-4">
              <Loader2 size={20} className="animate-spin text-accent mx-auto" />
              <p className="text-[0.8125rem] text-text-tertiary mt-1">Updating results...</p>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && filteredFacilities.length === 0 && (
            <div data-glass className="bg-surface rounded-[var(--radius-lg)] shadow-md border border-white/30 text-center py-12 px-4">
              <Filter size={32} className="mx-auto text-text-tertiary mb-3" />
              <p className="text-[0.9375rem] font-medium text-text-secondary">No locations found</p>
              <p className="text-[0.8125rem] text-text-tertiary mt-1">
                {facilities.length > 0
                  ? 'Try adjusting your filters'
                  : 'Try increasing the radius or searching a different area'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Report modal */}
      {reportingFacility && (
        <ReportModal
          facility={reportingFacility}
          onClose={() => setReportingFacility(null)}
          onSubmit={handleReport}
        />
      )}
    </div>
  );
}
