'use client';

import { useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import type { LocationFacility, FacilityType } from '@/lib/types';

const MARKER_COLORS: Record<FacilityType, { bg: string; text: string }> = {
  hospital:           { bg: '#FDCECE', text: '#9B2C2C' },
  'walk-in':          { bg: '#C6DBFF', text: '#1E3A6E' },
  'urgent-care':      { bg: '#FDE3B9', text: '#7C4A10' },
  'community-centre': { bg: '#C2E8B0', text: '#2D5F1E' },
  'wellness-centre':  { bg: '#DDD4F5', text: '#4A3278' },
  telehealth:         { bg: '#B5E8EE', text: '#1A5C66' },
};

const MARKER_ICONS: Record<FacilityType, string> = {
  hospital: 'H',
  'walk-in': 'WI',
  'urgent-care': 'U',
  'community-centre': 'C',
  'wellness-centre': 'W',
  telehealth: 'T',
};

function createCircleGeoJSON(
  center: [number, number],
  radiusKm: number,
  points = 64,
): GeoJSON.Feature<GeoJSON.Polygon> {
  const coords: [number, number][] = [];
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    const dx = radiusKm / (111.32 * Math.cos((center[1] * Math.PI) / 180));
    const dy = radiusKm / 110.574;
    coords.push([center[0] + dx * Math.cos(angle), center[1] + dy * Math.sin(angle)]);
  }
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [coords] },
  };
}

interface MapViewProps {
  facilities: LocationFacility[];
  userLocation: { lat: number; lng: number } | null;
  center: { lat: number; lng: number } | null;
  radiusKm: number;
  selectedId: string | null;
  onFacilitySelect: (id: string) => void;
}

export function MapView({
  facilities,
  userLocation,
  center,
  radiusKm,
  selectedId,
  onFacilitySelect,
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const popupsRef = useRef<mapboxgl.Popup[]>([]);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const styleLoadedRef = useRef(false);

  // Stable callback ref
  const onFacilitySelectRef = useRef(onFacilitySelect);
  onFacilitySelectRef.current = onFacilitySelect;

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

    const initCenter: [number, number] = center
      ? [center.lng, center.lat]
      : [-80.5204, 43.4643];

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: initCenter,
      zoom: 12,
      attributionControl: false,
    });

    map.current.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-left');

    map.current.on('load', () => {
      styleLoadedRef.current = true;

      // Add radius circle source + layers
      map.current!.addSource('radius-circle', {
        type: 'geojson',
        data: createCircleGeoJSON(initCenter, radiusKm),
      });

      map.current!.addLayer({
        id: 'radius-circle-fill',
        type: 'fill',
        source: 'radius-circle',
        paint: {
          'fill-color': '#5D9E82',
          'fill-opacity': 0.04,
        },
      });

      map.current!.addLayer({
        id: 'radius-circle-border',
        type: 'line',
        source: 'radius-circle',
        paint: {
          'line-color': '#5D9E82',
          'line-width': 1.5,
          'line-opacity': 0.2,
          'line-dasharray': [4, 4],
        },
      });
    });

    return () => {
      map.current?.remove();
      map.current = null;
      styleLoadedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update radius circle when center or radius changes
  useEffect(() => {
    if (!map.current || !styleLoadedRef.current || !center) return;

    const src = map.current.getSource('radius-circle') as mapboxgl.GeoJSONSource | undefined;
    if (src) {
      src.setData(createCircleGeoJSON([center.lng, center.lat], radiusKm));
    }
  }, [center, radiusKm]);

  // Fly to center when it changes
  useEffect(() => {
    if (!map.current || !center) return;

    // Fit the map to show the full radius circle
    const latDelta = radiusKm / 110.574;
    const lngDelta = radiusKm / (111.32 * Math.cos((center.lat * Math.PI) / 180));

    map.current.fitBounds(
      [
        [center.lng - lngDelta, center.lat - latDelta],
        [center.lng + lngDelta, center.lat + latDelta],
      ],
      { padding: 40, duration: 1000 },
    );
  }, [center, radiusKm]);

  // User location marker
  useEffect(() => {
    if (!map.current || !userLocation) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.setLngLat([userLocation.lng, userLocation.lat]);
      return;
    }

    const el = document.createElement('div');
    el.innerHTML = `
      <div style="position:relative;width:16px;height:16px;">
        <div style="
          position:absolute;inset:-8px;
          background:rgba(93,158,130,0.15);
          border-radius:50%;
          animation:user-pulse 2s ease-in-out infinite;
        "></div>
        <div style="
          width:16px;height:16px;
          background:#5D9E82;
          border:3px solid white;
          border-radius:50%;
          box-shadow:0 0 0 2px rgba(93,158,130,0.3),0 2px 8px rgba(0,0,0,0.15);
          position:relative;
        "></div>
      </div>
    `;

    userMarkerRef.current = new mapboxgl.Marker({ element: el })
      .setLngLat([userLocation.lng, userLocation.lat])
      .addTo(map.current);
  }, [userLocation]);

  // Facility markers
  useEffect(() => {
    if (!map.current) return;

    // Clear old markers and popups
    popupsRef.current.forEach((p) => p.remove());
    popupsRef.current = [];
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    facilities.forEach((facility) => {
      if (!facility.latitude || !facility.longitude) return;

      const { bg, text: textColor } = MARKER_COLORS[facility.type];
      const icon = MARKER_ICONS[facility.type];
      const isSelected = facility.id === selectedId;

      // Outer wrapper — Mapbox controls its transform, so we never touch it
      const el = document.createElement('div');
      el.style.cssText = `cursor:pointer;`;

      // Inner circle — all visual styling + hover animation lives here
      const inner = document.createElement('div');
      const size = isSelected ? 36 : 28;
      inner.style.cssText = `
        width:${size}px;height:${size}px;
        background:${bg};
        border:1.5px solid ${textColor}40;
        border-radius:50%;
        display:flex;align-items:center;justify-content:center;
        color:${textColor};
        font-size:${isSelected ? '13px' : '9px'};
        font-weight:700;
        letter-spacing:0.3px;
        font-family:var(--font-heading),sans-serif;
        box-shadow:0 2px 10px ${bg}66, 0 1px 4px rgba(0,0,0,0.08);
        transition:transform 150ms ease;
        transform:scale(${isSelected ? '1.15' : '1'});
      `;
      inner.textContent = icon;
      el.appendChild(inner);

      // Build hover tooltip content
      const waitInfo =
        facility.waitMinutes != null
          ? `<div style="font-size:12px;font-weight:600;color:${textColor};margin-top:2px;">${facility.waitMinutes} min wait</div>`
          : '';
      const distInfo =
        facility.distanceKm != null
          ? `<div style="font-size:11px;color:#94A3B8;margin-top:1px;">${facility.distanceKm} km away${facility.travelMinutes ? ` · ~${facility.travelMinutes} min drive` : ''}</div>`
          : '';

      const popup = new mapboxgl.Popup({
        offset: 18,
        closeButton: false,
        className: 'facility-popup',
      }).setHTML(`
        <div style="font-family:var(--font-heading),sans-serif;padding:2px 0;">
          <div style="font-weight:600;font-size:12px;color:#0F1729;">${facility.name}</div>
          ${facility.address ? `<div style="font-size:11px;color:#94A3B8;margin-top:1px;">${facility.address}</div>` : ''}
          ${waitInfo}
          ${distInfo}
        </div>
      `);

      // Hover: show tooltip. Click: select in side panel.
      el.addEventListener('mouseenter', () => {
        inner.style.transform = 'scale(1.2)';
        popup.setLngLat([facility.longitude, facility.latitude]).addTo(map.current!);
      });
      el.addEventListener('mouseleave', () => {
        inner.style.transform = isSelected ? 'scale(1.15)' : 'scale(1)';
        popup.remove();
      });
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        popup.remove();
        onFacilitySelectRef.current(facility.id);
      });

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([facility.longitude, facility.latitude])
        .addTo(map.current!);

      markersRef.current.push(marker);
      popupsRef.current.push(popup);
    });
  }, [facilities, selectedId]);

  // Fly to selected facility
  useEffect(() => {
    if (!map.current || !selectedId) return;
    const facility = facilities.find((f) => f.id === selectedId);
    if (facility?.latitude && facility?.longitude) {
      map.current.flyTo({
        center: [facility.longitude, facility.latitude],
        zoom: 15,
        duration: 800,
      });
    }
  }, [selectedId, facilities]);

  return (
    <div
      ref={mapContainer}
      className="w-full h-full"
    />
  );
}
