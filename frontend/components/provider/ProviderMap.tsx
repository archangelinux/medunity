'use client';

import { useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import type { ProviderSignal, CuratedFacility } from '@/lib/provider-types';
import { CTAS_COLORS, CTAS_LABELS } from '@/lib/provider-types';
import { interpolateSignalPosition } from '@/lib/simulation';

function timeAgo(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

interface ProviderMapProps {
  selectedFacility: CuratedFacility;
  mySignals: ProviderSignal[];
  center: { lat: number; lng: number };
}

export function ProviderMap({ selectedFacility, mySignals, center }: ProviderMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const styleLoadedRef = useRef(false);
  const facilityMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const animFrameRef = useRef<number>(0);

  const signalsRef = useRef<ProviderSignal[]>([]);
  signalsRef.current = mySignals;

  const facilityRef = useRef(selectedFacility);
  facilityRef.current = selectedFacility;

  // Build signal dot GeoJSON with interpolated positions along routes
  const buildSignalGeoJSON = useCallback((): GeoJSON.FeatureCollection => {
    const facility = facilityRef.current;
    return {
      type: 'FeatureCollection',
      features: signalsRef.current
        .map((s) => {
          const pos = interpolateSignalPosition(s, facility.latitude, facility.longitude);
          return {
            type: 'Feature' as const,
            properties: {
              id: s.id,
              ctasLevel: s.ctasLevel,
              symptoms: s.symptoms.join(', '),
              chiefComplaint: s.chiefComplaint,
              suggestedWard: s.suggestedWard || '',
              etaMinutes: s.etaMinutes,
              reportedAt: s.reportedAt,
              progress: pos.progress,
            },
            geometry: {
              type: 'Point' as const,
              coordinates: [pos.lng, pos.lat],
            },
          };
        })
    };
  }, []);

  // Build route lines GeoJSON — one LineString per signal with route data
  const buildRoutesGeoJSON = useCallback((): GeoJSON.FeatureCollection => {
    const facility = facilityRef.current;
    return {
      type: 'FeatureCollection',
      features: signalsRef.current
        .map((s) => {
          // Use road route if available, otherwise straight line
          const coordinates: [number, number][] = s.routeCoordinates && s.routeCoordinates.length >= 2
            ? s.routeCoordinates
            : [
                [s.startLongitude, s.startLatitude],
                [facility.longitude, facility.latitude],
              ];

          return {
            type: 'Feature' as const,
            properties: { ctasLevel: s.ctasLevel },
            geometry: {
              type: 'LineString' as const,
              coordinates,
            },
          };
        }),
    };
  }, []);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

    mapRef.current = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [center.lng, center.lat],
      zoom: 12,
      attributionControl: false,
    });

    mapRef.current.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-left');

    mapRef.current.on('load', () => {
      styleLoadedRef.current = true;
      const map = mapRef.current!;
      const empty: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

      map.addSource('signals', { type: 'geojson', data: empty });
      map.addSource('routes', { type: 'geojson', data: empty });

      // Route lines — dashed, following roads
      map.addLayer({
        id: 'route-lines',
        type: 'line',
        source: 'routes',
        paint: {
          'line-color': [
            'match', ['get', 'ctasLevel'],
            1, '#E5625E', 2, '#CD533B', 3, '#2364AA', 4, '#62A8AC', 5, '#8BA868', '#8BA868',
          ],
          'line-width': 2,
          'line-opacity': 0.3,
          'line-dasharray': [2, 3],
        },
      });

      // Glow for CTAS 1-2
      map.addLayer({
        id: 'signals-glow',
        type: 'circle',
        source: 'signals',
        filter: ['<=', ['get', 'ctasLevel'], 2],
        paint: {
          'circle-radius': 16,
          'circle-color': [
            'match', ['get', 'ctasLevel'],
            1, '#E5625E', 2, '#CD533B', '#E5625E',
          ],
          'circle-opacity': 0.2,
        },
      });

      // Signal dots
      map.addLayer({
        id: 'signals-circle',
        type: 'circle',
        source: 'signals',
        paint: {
          'circle-radius': [
            'match', ['get', 'ctasLevel'], 1, 8, 2, 7, 3, 6, 4, 6, 5, 5, 6,
          ],
          'circle-color': [
            'match', ['get', 'ctasLevel'],
            1, '#E5625E', 2, '#CD533B', 3, '#2364AA', 4, '#62A8AC', 5, '#8BA868', '#8BA868',
          ],
          'circle-opacity': 0.9,
          'circle-stroke-width': 2,
          'circle-stroke-color': 'white',
        },
      });

      // CTAS labels
      map.addLayer({
        id: 'signals-label',
        type: 'symbol',
        source: 'signals',
        layout: {
          'text-field': ['to-string', ['get', 'ctasLevel']],
          'text-size': 9,
          'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
          'text-allow-overlap': true,
        },
        paint: { 'text-color': 'white' },
      });

      // Hover popup
      popupRef.current = new mapboxgl.Popup({ offset: 14, closeButton: false, className: 'signal-popup' });

      map.on('mouseenter', 'signals-circle', (e) => {
        map.getCanvas().style.cursor = 'pointer';
        if (!e.features?.[0]) return;
        const p = e.features[0].properties!;
        const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number];
        const color = CTAS_COLORS[p.ctasLevel as 1 | 2 | 3 | 4 | 5] || '#94A3B8';
        const label = CTAS_LABELS[p.ctasLevel as 1 | 2 | 3 | 4 | 5] || '';
        const progress = Math.round((p.progress as number) * 100);
        const wardHtml = p.suggestedWard
          ? `<div style="font-size:10px;color:#5D9E82;margin-top:4px;font-weight:600;">&rarr; ${p.suggestedWard}</div>`
          : '';
        popupRef.current
          ?.setLngLat(coords)
          .setHTML(
            `<div style="font-family:var(--font-heading),sans-serif;padding:4px 0;min-width:180px;">
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
                <span style="background:${color};color:white;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:700;">CTAS ${p.ctasLevel} &middot; ${label}</span>
                <span style="font-size:10px;color:#94A3B8;">${timeAgo(p.reportedAt as string)}</span>
              </div>
              <div style="font-weight:600;font-size:12px;color:#0F1729;">${p.chiefComplaint}</div>
              <div style="font-size:11px;color:#475569;margin-top:2px;">${p.symptoms}</div>
              ${wardHtml}
              <div style="font-size:11px;color:#94A3B8;margin-top:6px;padding-top:6px;border-top:1px solid #E2E5EB;">
                ${progress}% en route &middot; ${Math.round(Number(p.etaMinutes))} min total ETA
              </div>
            </div>`,
          )
          .addTo(map);
      });

      map.on('mouseleave', 'signals-circle', () => {
        map.getCanvas().style.cursor = '';
        popupRef.current?.remove();
      });

      // Animation loop
      let frame = 0;
      function animate() {
        frame++;
        const map = mapRef.current;
        if (!map || !styleLoadedRef.current) {
          animFrameRef.current = requestAnimationFrame(animate);
          return;
        }

        // Update dot positions every 30 frames (~0.5s)
        if (frame % 30 === 0) {
          const src = map.getSource('signals') as mapboxgl.GeoJSONSource | undefined;
          if (src) src.setData(buildSignalGeoJSON());
        }

        // Glow pulse
        if (map.getLayer('signals-glow')) {
          const t = frame * 0.04;
          map.setPaintProperty('signals-glow', 'circle-opacity', 0.12 + Math.sin(t) * 0.1);
          map.setPaintProperty('signals-glow', 'circle-radius', 14 + Math.sin(t) * 5);
        }

        animFrameRef.current = requestAnimationFrame(animate);
      }
      animate();
    });

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      mapRef.current?.remove();
      mapRef.current = null;
      styleLoadedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fly to center
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.flyTo({ center: [center.lng, center.lat], zoom: 12, duration: 1200 });
  }, [center.lat, center.lng]);

  // Facility marker
  useEffect(() => {
    if (!mapRef.current) return;

    if (facilityMarkerRef.current) {
      facilityMarkerRef.current.remove();
      facilityMarkerRef.current = null;
    }

    const el = document.createElement('div');
    el.style.cssText = 'width:48px;height:48px;cursor:default;';
    el.innerHTML = `
      <div style="
        width:48px;height:48px;
        background:white;
        border:3px solid #5D9E82;
        border-radius:50%;
        display:flex;align-items:center;justify-content:center;
        font-size:16px;font-weight:800;color:#5D9E82;
        font-family:var(--font-heading),sans-serif;
        box-shadow:0 0 0 5px rgba(93,158,130,0.2), 0 4px 16px rgba(0,0,0,0.15);
      ">H</div>
    `;

    facilityMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: 'center' })
      .setLngLat([selectedFacility.longitude, selectedFacility.latitude])
      .addTo(mapRef.current);
  }, [selectedFacility]);

  // Update signal dots + route lines when signals change
  useEffect(() => {
    if (!mapRef.current || !styleLoadedRef.current) return;

    const signalSrc = mapRef.current.getSource('signals') as mapboxgl.GeoJSONSource | undefined;
    if (signalSrc) signalSrc.setData(buildSignalGeoJSON());

    const routeSrc = mapRef.current.getSource('routes') as mapboxgl.GeoJSONSource | undefined;
    if (routeSrc) routeSrc.setData(buildRoutesGeoJSON());
  }, [mySignals, buildSignalGeoJSON, buildRoutesGeoJSON]);

  return <div ref={containerRef} className="w-full h-full" />;
}
