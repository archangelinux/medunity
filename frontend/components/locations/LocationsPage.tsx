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
import { ReportModal } from './ReportModal';
import { Badge } from '@/components/ui/Badge';
import { fetchNearbyFacilities, geocodeSearch } from '@/lib/overpass';
import type { GeocodeSuggestion } from '@/lib/overpass';
import type { LocationFacility, FacilityType, LocationReport } from '@/lib/types';

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

export function LocationsPage() {
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

  // --- Geocoding state ---
  const [locationInput, setLocationInput] = useState('');
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

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
        const results = await fetchNearbyFacilities(lat, lng, debouncedRadius);
        if (!cancelled) {
          setFacilities(results);
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
  }, [facilities, filter, nameSearch]);

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

  // CSS variable overrides for the teal glass theme
  const glassVars = {
    '--color-surface': 'rgba(236, 248, 245, 0.78)',
    '--color-surface-soft': 'rgba(224, 242, 237, 0.55)',
    '--color-border-soft': 'rgba(190, 224, 216, 0.35)',
    '--color-border': 'rgba(175, 212, 204, 0.45)',
  } as React.CSSProperties;

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
