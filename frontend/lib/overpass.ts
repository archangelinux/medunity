import type { LocationFacility, FacilityType } from './types';

const OVERPASS_API = 'https://overpass-api.de/api/interpreter';

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Deterministic pseudo-random from a seed string so wait times are stable per facility
function seededRandom(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash % 1000) / 1000;
}

function classifyFacility(tags: Record<string, string>): FacilityType {
  const name = (tags.name || '').toLowerCase();

  if (tags.amenity === 'hospital') return 'hospital';
  if (tags.healthcare === 'urgent_care' || name.includes('urgent care')) return 'urgent-care';
  if (
    tags.amenity === 'clinic' ||
    tags.amenity === 'doctors' ||
    tags.healthcare === 'clinic' ||
    tags.healthcare === 'doctor'
  )
    return 'walk-in';
  if (tags.amenity === 'community_centre') return 'community-centre';
  if (tags.amenity === 'social_facility') return 'community-centre';
  if (tags.healthcare === 'centre') return 'wellness-centre';
  if (tags.leisure === 'fitness_centre') return 'wellness-centre';
  return 'walk-in';
}

function buildAddress(tags: Record<string, string>): string {
  const parts: string[] = [];
  if (tags['addr:housenumber']) parts.push(tags['addr:housenumber']);
  if (tags['addr:street']) parts.push(tags['addr:street']);
  if (parts.length && tags['addr:city']) parts.push(tags['addr:city']);
  if (parts.length > 0) return parts.join(' ');
  if (tags['addr:full']) return tags['addr:full'];
  return '';
}

function buildServices(tags: Record<string, string>, type: FacilityType): string[] {
  const services: string[] = [];

  if (tags.emergency === 'yes') services.push('Emergency care');
  if (tags['healthcare:speciality']) {
    services.push(
      ...tags['healthcare:speciality']
        .split(';')
        .slice(0, 4)
        .map((s) => s.trim().replace(/_/g, ' '))
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    );
  }
  if (tags.social_facility) {
    const sf = tags.social_facility.replace(/_/g, ' ');
    services.push(sf.charAt(0).toUpperCase() + sf.slice(1));
  }

  if (services.length === 0) {
    switch (type) {
      case 'hospital':
        services.push('Hospital care');
        break;
      case 'walk-in':
        services.push('General practice');
        break;
      case 'urgent-care':
        services.push('Urgent assessment');
        break;
      case 'community-centre':
        services.push('Community programs');
        break;
      case 'wellness-centre':
        services.push('Wellness services');
        break;
    }
  }

  return services;
}

function estimateWaitMinutes(type: FacilityType, seed: string): number | undefined {
  const r = seededRandom(seed);
  switch (type) {
    case 'hospital':
      return Math.round(60 + r * 180); // 60–240 min
    case 'walk-in':
      return Math.round(15 + r * 60); // 15–75 min
    case 'urgent-care':
      return Math.round(30 + r * 60); // 30–90 min
    default:
      return undefined;
  }
}

function transformElement(
  el: OverpassElement,
  centerLat: number,
  centerLng: number,
): LocationFacility | null {
  const tags = el.tags || {};
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;

  if (!lat || !lon || !tags.name) return null;

  const type = classifyFacility(tags);
  const dist = haversineDistance(centerLat, centerLng, lat, lon);
  const travelMin = Math.max(1, Math.round((dist / 40) * 60));

  return {
    id: `osm-${el.type[0]}-${el.id}`,
    name: tags.name,
    type,
    latitude: lat,
    longitude: lon,
    address: buildAddress(tags),
    hours: tags.opening_hours || 'Hours not listed',
    isOpen: true,
    closingTime: undefined,
    waitMinutes: estimateWaitMinutes(type, `${el.id}`),
    travelMinutes: travelMin,
    distanceKm: Math.round(dist * 10) / 10,
    services: buildServices(tags, type),
    resources: [],
    reports: [],
    isFree: type === 'community-centre' || type === 'hospital' || tags.fee === 'no',
    phone: tags.phone || tags['contact:phone'] || undefined,
  };
}

export async function fetchNearbyFacilities(
  lat: number,
  lng: number,
  radiusKm: number,
): Promise<LocationFacility[]> {
  const radiusM = Math.round(radiusKm * 1000);

  const query = `
[out:json][timeout:30];
(
  nwr["amenity"="hospital"](around:${radiusM},${lat},${lng});
  nwr["amenity"="clinic"](around:${radiusM},${lat},${lng});
  nwr["amenity"="doctors"](around:${radiusM},${lat},${lng});
  nwr["healthcare"="centre"](around:${radiusM},${lat},${lng});
  nwr["healthcare"="clinic"](around:${radiusM},${lat},${lng});
  nwr["amenity"="community_centre"](around:${radiusM},${lat},${lng});
  nwr["amenity"="social_facility"](around:${radiusM},${lat},${lng});
  nwr["healthcare"="counselling"](around:${radiusM},${lat},${lng});
  nwr["healthcare"="community_health_centre"](around:${radiusM},${lat},${lng});
);
out center;`;

  const res = await fetch(OVERPASS_API, {
    method: 'POST',
    body: `data=${encodeURIComponent(query)}`,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  if (!res.ok) throw new Error(`Overpass API error: ${res.status}`);

  const data = await res.json();

  // Health-related keywords — community centres must match at least one to be included
  const HEALTH_KEYWORDS = [
    'health', 'medical', 'clinic', 'hospital', 'care', 'wellness', 'mental',
    'counselling', 'counseling', 'addiction', 'harm reduction', 'naloxone',
    'nursing', 'therapy', 'rehab', 'prenatal', 'sexual', 'dental',
  ];

  const facilities = (data.elements as OverpassElement[])
    .map((el) => transformElement(el, lat, lng))
    .filter((f): f is LocationFacility => {
      if (!f) return false;
      // Hospitals, walk-ins, urgent care always pass
      if (f.type !== 'community-centre' && f.type !== 'wellness-centre') return true;
      // Community/wellness centres must have a health-related name or service
      const text = `${f.name} ${f.services.join(' ')}`.toLowerCase();
      return HEALTH_KEYWORDS.some((kw) => text.includes(kw));
    });

  // Deduplicate by normalized name — keep the entry with more data
  const deduped = new Map<string, LocationFacility>();
  for (const f of facilities) {
    const key = f.name.toLowerCase().trim();
    const existing = deduped.get(key);
    if (!existing || f.address.length > existing.address.length) {
      deduped.set(key, f);
    }
  }

  return Array.from(deduped.values()).sort(
    (a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999),
  );
}

// --- Mapbox Geocoding ---

export interface GeocodeSuggestion {
  name: string;
  lat: number;
  lng: number;
}

export async function geocodeSearch(query: string): Promise<GeocodeSuggestion[]> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token || !query.trim()) return [];

  const res = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
      query,
    )}.json?access_token=${token}&limit=5&types=address,poi,place,locality,neighborhood`,
  );

  if (!res.ok) return [];

  const data = await res.json();
  return (data.features || []).map((f: Record<string, unknown>) => ({
    name: f.place_name as string,
    lat: (f.center as number[])[1],
    lng: (f.center as number[])[0],
  }));
}
