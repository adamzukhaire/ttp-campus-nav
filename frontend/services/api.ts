// services/api.ts
// All backend API calls live here — one place to update if the URL changes

const API_URL = 'https://ttp-campus-nav.onrender.com';
const HEADERS = { 'Content-Type': 'application/json' };

export type Coordinate = { latitude: number; longitude: number };

export type RouteResult = {
  path: Coordinate[];
  distanceMeters: number;
};

// NEW: TypeScript definition for the Places coming from your backend
export type Place = {
  name: string;
  latitude: number;
  longitude: number;
  area: string;
  icon: string;
};

// GET /paths — fetch all walkable path lines for drawing on map
export async function fetchPaths(): Promise<Coordinate[][]> {
  const res = await fetch(`${API_URL}/paths`, { headers: HEADERS });
  if (!res.ok) throw new Error('Failed to fetch paths');
  const data = await res.json();
  return data.paths;
}

// POST /route — get shortest path between two coordinates
export async function fetchRoute(
  from: Coordinate,
  to: Coordinate
): Promise<RouteResult> {
  const res = await fetch(`${API_URL}/route`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({
      start: [from.longitude, from.latitude],
      end:   [to.longitude,   to.latitude],
    }),
  });
  if (!res.ok) throw new Error('Route not found');
  const data = await res.json();

  // Convert [lon, lat] arrays → { latitude, longitude } for react-native-maps
  const path: Coordinate[] = data.path.map(([lon, lat]: [number, number]) => ({
    latitude: lat,
    longitude: lon,
  }));

  return { path, distanceMeters: data.distanceMeters };
}

// NEW: GET /places — fetch buildings, markers, and sports courts
export async function fetchPlaces(): Promise<Place[]> {
  const res = await fetch(`${API_URL}/places`, { headers: HEADERS });
  if (!res.ok) throw new Error('Failed to fetch places');
  const data = await res.json();
  return data.places || [];
}