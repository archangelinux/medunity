'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { MapPin, ArrowLeft, ChevronDown } from 'lucide-react';
import { generateScenario, generateLiveSignal, computeFacilityLoads } from '@/lib/simulation';
import type { ProviderSignal, Scenario, DemandAnalysis, CuratedFacility } from '@/lib/provider-types';
import { TORONTO_HOSPITALS } from '@/lib/provider-types';
import { getProviderSignals, analyzeDemand, clearAllSignals } from '@/lib/api';
import { fetchRoutesForSignals } from '@/lib/routes';
import { ProviderMap } from '@/components/provider/ProviderMap';
import { DemandPanel } from '@/components/provider/DemandPanel';
import { SimulationBar } from '@/components/provider/SimulationBar';

const DEFAULT_CENTER = { lat: 43.6532, lng: -79.3832 }; // Toronto

export default function ProviderPage() {
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>('toronto-general');
  const [realSignals, setRealSignals] = useState<ProviderSignal[]>([]);
  const [simSignals, setSimSignals] = useState<ProviderSignal[]>([]);
  const [scenario, setScenario] = useState<Scenario>('normal');
  const [isLive, setIsLive] = useState(false);
  const [timeSpeed, setTimeSpeed] = useState(1); // 1x, 2x, 5x, 10x
  const [showPicker, setShowPicker] = useState(false);
  const [demandAnalysis, setDemandAnalysis] = useState<DemandAnalysis | null>(null);
  const [analyzingDemand, setAnalyzingDemand] = useState(false);
  const [arrivedCount, setArrivedCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyzeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scenarioRef = useRef(scenario);
  scenarioRef.current = scenario;

  const selectedFacility = TORONTO_HOSPITALS.find((f) => f.id === selectedFacilityId) ?? TORONTO_HOSPITALS[1];

  // Merged signals: real + simulated
  const allSignals = useMemo(
    () => [...realSignals, ...simSignals],
    [realSignals, simSignals],
  );

  // Signals heading to selected facility — match by ID, name, or proximity
  const mySignals = useMemo(() => {
    const facilityNameLower = selectedFacility.name.toLowerCase();
    return allSignals.filter((s) => {
      // Exact ID match (simulated signals)
      if (s.destinationId === selectedFacilityId) return true;
      // Name match (real signals sent from patient side to an Overpass facility with similar name)
      if (s.facilityName && facilityNameLower.includes(s.facilityName.toLowerCase().split(' ')[0])) return true;
      if (s.destinationName && facilityNameLower.includes(s.destinationName.toLowerCase().split(' ')[0])) return true;
      // Unmatched real signals — assign to closest facility by checking if this is the nearest curated hospital
      if (!s.isSimulated && s.facilityId && !TORONTO_HOSPITALS.some((h) => h.id === s.facilityId)) {
        // This signal was sent to a non-curated facility — show it on the selected facility
        // if the signal's destination coordinates are within 2km
        const dLat = Math.abs(s.latitude - selectedFacility.latitude);
        const dLng = Math.abs(s.longitude - selectedFacility.longitude);
        if (dLat < 0.02 && dLng < 0.02) return true; // ~2km
      }
      return false;
    });
  }, [allSignals, selectedFacilityId, selectedFacility]);

  // Facility loads
  const facilityLoads = useMemo(
    () => computeFacilityLoads(allSignals),
    [allSignals],
  );

  const myLoad = useMemo(
    () => facilityLoads.find((l) => l.facilityId === selectedFacilityId) ?? null,
    [facilityLoads, selectedFacilityId],
  );

  // Poll real signals every 10s
  useEffect(() => {
    const fetchSignals = async () => {
      try {
        const data = await getProviderSignals(selectedFacilityId);
        const mapped: ProviderSignal[] = data.signals.map((s) => ({
          ...s,
          // Map API fields to TriageSignal fields
          destinationId: s.facilityId ?? s.destinationId ?? selectedFacilityId,
          destinationName: s.facilityName ?? s.destinationName ?? selectedFacility.name,
          destinationType: s.destinationType ?? selectedFacility.type,
          isSimulated: false,
          startLatitude: s.startLatitude ?? s.latitude,
          startLongitude: s.startLongitude ?? s.longitude,
        }));
        setRealSignals(mapped);
      } catch {
        // Backend may be down — that's ok
      }
    };

    fetchSignals();
    pollRef.current = setInterval(fetchSignals, 10000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [selectedFacilityId, selectedFacility.name, selectedFacility.type]);

  // Debounced demand analysis — only triggers on significant changes
  const lastAnalyzedCountRef = useRef(0);
  useEffect(() => {
    if (mySignals.length === 0) {
      setDemandAnalysis(null);
      lastAnalyzedCountRef.current = 0;
      return;
    }

    // Skip if count hasn't changed by at least 3 signals (avoids churn from trickle)
    const diff = Math.abs(mySignals.length - lastAnalyzedCountRef.current);
    if (diff < 3 && lastAnalyzedCountRef.current > 0) return;

    if (analyzeTimerRef.current) clearTimeout(analyzeTimerRef.current);
    analyzeTimerRef.current = setTimeout(async () => {
      setAnalyzingDemand(true);
      lastAnalyzedCountRef.current = mySignals.length;
      try {
        const otherLoads = facilityLoads.filter((l) => l.facilityId !== selectedFacilityId);
        const signalData = mySignals.map((s) => ({
          id: s.id,
          ctas_level: s.ctasLevel,
          chief_complaint: s.chiefComplaint,
          symptoms: s.symptoms,
          eta_minutes: s.etaMinutes,
        }));
        const result = await analyzeDemand({
          signals: signalData,
          facility_name: selectedFacility.name,
          facility_load: {
            facilityId: selectedFacilityId,
            incoming: myLoad?.incoming ?? 0,
            capacity: myLoad?.capacity ?? selectedFacility.capacity,
            utilization: myLoad?.utilization ?? 0,
          },
          nearby_loads: otherLoads.map((l) => ({
            facility_id: l.facilityId,
            name: l.name,
            utilization: l.utilization,
            incoming: l.incoming,
            capacity: l.capacity,
          })),
        });
        setDemandAnalysis(result.analysis);
      } catch (e) {
        console.error('Demand analysis failed:', e);
      }
      setAnalyzingDemand(false);
    }, 3000); // 3s debounce

    return () => {
      if (analyzeTimerRef.current) clearTimeout(analyzeTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mySignals.length, selectedFacilityId]);

  // Live trickle
  useEffect(() => {
    if (isLive) {
      intervalRef.current = setInterval(() => {
        const signal = generateLiveSignal(scenarioRef.current, selectedFacility);
        if (signal) setSimSignals((prev) => [...prev, signal]);
      }, 3000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isLive, selectedFacility]);

  // ETA countdown tick — updates sim signal ETAs and removes arrived patients
  const timeSpeedRef = useRef(timeSpeed);
  timeSpeedRef.current = timeSpeed;

  useEffect(() => {
    // Tick every second — only active when speed > 1x
    tickRef.current = setInterval(() => {
      const speed = timeSpeedRef.current;
      if (speed <= 1) return;

      const updateSignals = (prev: ProviderSignal[]): ProviderSignal[] => {
        const arrived: string[] = [];
        const updated = prev.map((s) => {
          const reduction = (speed - 1) / 60;
          const newEta = Math.max(0, s.etaMinutes - reduction);
          if (newEta <= 0) arrived.push(s.id);
          return { ...s, etaMinutes: newEta };
        });
        if (arrived.length > 0) {
          setArrivedCount((c) => c + arrived.length);
          return updated.filter((s) => !arrived.includes(s.id));
        }
        return updated;
      };

      setSimSignals(updateSignals);
      setRealSignals(updateSignals);
    }, 1000);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  // Fetch road routes for signals that don't have them yet
  const routeFetchedRef = useRef(new Set<string>());
  useEffect(() => {
    const allSigs = [...realSignals, ...simSignals];
    const needRoutes = allSigs.filter(
      (s) => !s.routeCoordinates && !routeFetchedRef.current.has(s.id),
    );
    if (needRoutes.length === 0) return;

    // Mark as fetching to avoid double-requests
    needRoutes.forEach((s) => routeFetchedRef.current.add(s.id));

    fetchRoutesForSignals(
      needRoutes.map((s) => ({ id: s.id, startLongitude: s.startLongitude, startLatitude: s.startLatitude })),
      selectedFacility.longitude,
      selectedFacility.latitude,
    ).then((routeMap) => {
      if (routeMap.size === 0) return;

      // Patch routes onto sim signals
      setSimSignals((prev) =>
        prev.map((s) => {
          const route = routeMap.get(s.id);
          if (route) {
            return { ...s, routeCoordinates: route.coordinates, etaMinutes: route.durationMinutes || s.etaMinutes };
          }
          return s;
        }),
      );

      // Patch routes onto real signals
      setRealSignals((prev) =>
        prev.map((s) => {
          const route = routeMap.get(s.id);
          if (route) {
            return { ...s, routeCoordinates: route.coordinates, etaMinutes: route.durationMinutes || s.etaMinutes };
          }
          return s;
        }),
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realSignals.length, simSignals.length, selectedFacility.id]);

  const handleGenerate = useCallback(() => {
    routeFetchedRef.current.clear();
    const batch = generateScenario(scenarioRef.current, selectedFacility);
    setSimSignals(batch);
  }, [selectedFacility]);

  const handleClear = useCallback(() => {
    setSimSignals([]);
    setIsLive(false);
    setArrivedCount(0);
    setTimeSpeed(1);
    setDemandAnalysis(null);
    lastAnalyzedCountRef.current = 0;
    routeFetchedRef.current.clear();
  }, []);

  const handleClearReal = useCallback(async () => {
    try {
      await clearAllSignals();
      setRealSignals([]);
    } catch (e) {
      console.error('Failed to clear signals:', e);
    }
  }, []);

  const handleFacilitySelect = useCallback((id: string) => {
    setSelectedFacilityId(id);
    setShowPicker(false);
    const facility = TORONTO_HOSPITALS.find((f) => f.id === id);
    if (facility) {
      setCenter({ lat: facility.latitude, lng: facility.longitude });
    }
  }, []);

  return (
    <div className="flex h-screen bg-bg">
      {/* Left: Map area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Map */}
        <div className="flex-1 relative">
          <ProviderMap
            selectedFacility={selectedFacility}
            mySignals={mySignals}
            center={center}
          />

          {/* Floating top bar */}
          <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between pointer-events-none">
            {/* Logo */}
            <Link href="/" className="provider-glass rounded-[var(--radius-lg)] px-4 py-2.5 flex items-center gap-3 pointer-events-auto">
              <Image
                src="/assets/medunity-logo.png"
                alt="Medunity"
                width={110}
                height={26}
                className="h-6 w-auto"
              />
              <div className="w-px h-5 bg-border-soft" />
              <span className="text-[0.75rem] font-semibold text-accent font-[family-name:var(--font-heading)] uppercase tracking-wider">
                Provider
              </span>
            </Link>

            {/* Facility picker */}
            <div className="relative pointer-events-auto">
              <button
                onClick={() => setShowPicker(!showPicker)}
                className="provider-glass rounded-[var(--radius-lg)] px-4 py-2.5 flex items-center gap-2 cursor-pointer hover:shadow-lg transition-shadow"
              >
                <MapPin size={14} className="text-accent" />
                <span className="text-[0.8125rem] font-medium text-text-primary max-w-[260px] truncate">
                  {selectedFacility.name}
                </span>
                <ChevronDown size={14} className="text-text-tertiary" />
              </button>

              {showPicker && (
                <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-[340px] provider-glass rounded-[var(--radius-lg)] p-2 max-h-[400px] overflow-y-auto shadow-lg">
                  {TORONTO_HOSPITALS.map((f) => {
                    const fl = facilityLoads.find((l) => l.facilityId === f.id);
                    return (
                      <button
                        key={f.id}
                        onClick={() => handleFacilitySelect(f.id)}
                        className={`w-full text-left px-3 py-2.5 rounded-[var(--radius-md)] flex items-center gap-3 transition-colors cursor-pointer ${
                          f.id === selectedFacilityId ? 'bg-accent-soft' : 'hover:bg-surface-soft'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-[0.625rem] font-bold flex-shrink-0 bg-[#FDCECE] text-[#9B2C2C]">
                          H
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[0.8125rem] font-medium text-text-primary truncate">
                            {f.name}
                          </div>
                          <div className="text-[0.6875rem] text-text-tertiary truncate">{f.address}</div>
                        </div>
                        {fl && fl.incoming > 0 && (
                          <span className="text-[0.625rem] font-bold text-text-tertiary tabular-nums">
                            {fl.utilization}%
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Back */}
            <Link
              href="/"
              className="provider-glass rounded-[var(--radius-lg)] px-4 py-2.5 flex items-center gap-2 text-[0.8125rem] text-text-secondary hover:text-text-primary transition-colors pointer-events-auto"
            >
              <ArrowLeft size={14} />
              <span className="font-medium">Patient View</span>
            </Link>
          </div>
        </div>

        {/* Simulation bar */}
        <SimulationBar
          scenario={scenario}
          onScenarioChange={setScenario}
          onGenerate={handleGenerate}
          isLive={isLive}
          onToggleLive={() => setIsLive((p) => !p)}
          onClear={handleClear}
          onClearReal={handleClearReal}
          realCount={realSignals.length}
          simCount={simSignals.length}
          arrivedCount={arrivedCount}
          timeSpeed={timeSpeed}
          onTimeSpeedChange={setTimeSpeed}
          disabled={false}
        />
      </div>

      {/* Right: Dashboard sidebar */}
      <aside className="w-[420px] flex-shrink-0 border-l border-border-soft">
        <DemandPanel
          facilityName={selectedFacility.name}
          facilityType={selectedFacility.type}
          mySignals={mySignals}
          myLoad={myLoad}
          allLoads={facilityLoads}
          demandAnalysis={demandAnalysis}
        />
      </aside>
    </div>
  );
}
