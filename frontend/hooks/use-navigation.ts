// hooks/useNavigation.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { Coordinate, RouteResult, fetchRoute } from '../services/api';

const REROUTE_THRESHOLD = 30;
const REROUTE_COOLDOWN  = 2000; // ms — wait 2s before rerouting again

// ─── GEOMETRY HELPERS ────────────────────────────────────────────────────────

function haversine(a: Coordinate, b: Coordinate): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude  - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

// Calculates the angle (bearing) between two GPS coordinates
function calculateBearing(start: Coordinate, end: Coordinate): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;

  const startLat = toRad(start.latitude);
  const startLon = toRad(start.longitude);
  const endLat = toRad(end.latitude);
  const endLon = toRad(end.longitude);

  const dLon = endLon - startLon;

  const y = Math.sin(dLon) * Math.cos(endLat);
  const x = Math.cos(startLat) * Math.sin(endLat) -
            Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLon);

  let brng = toDeg(Math.atan2(y, x));
  return (brng + 360) % 360; // Normalize to 0-360
}

// Looks at the upcoming points to guess the next move
function getNextTurnInstruction(remainingRoute: Coordinate[]): { text: string; icon: string } {
  if (remainingRoute.length < 3) {
    return { text: 'Continue straight to destination', icon: 'straight' };
  }

  // Look a few points ahead to ignore tiny wiggles in the path
  const currentPos = remainingRoute[0];
  const midPos = remainingRoute[Math.min(2, remainingRoute.length - 1)];
  const futurePos = remainingRoute[Math.min(5, remainingRoute.length - 1)];

  const bearing1 = calculateBearing(currentPos, midPos);
  const bearing2 = calculateBearing(midPos, futurePos);
  
  // Calculate the difference in angles
  let angleDiff = bearing2 - bearing1;
  
  // Normalize between -180 and 180
  if (angleDiff > 180) angleDiff -= 360;
  if (angleDiff < -180) angleDiff += 360;

  // Determine turn based on angle threshold
  if (angleDiff > 30 && angleDiff <= 135) {
    return { text: 'Turn right ahead', icon: 'turn-right' };
  } else if (angleDiff < -30 && angleDiff >= -135) {
    return { text: 'Turn left ahead', icon: 'turn-left' };
  } else if (angleDiff > 135 || angleDiff < -135) {
    return { text: 'Turn around', icon: 'u-turn-left' };
  } else {
    return { text: 'Continue straight', icon: 'straight' };
  }
}

function closestPointIndex(userPos: Coordinate, route: Coordinate[]): number {
  let minDist = Infinity;
  let idx = 0;
  route.forEach((point, i) => {
    const d = haversine(userPos, point);
    if (d < minDist) { minDist = d; idx = i; }
  });
  return idx;
}

function isOnRoute(userPos: Coordinate, route: Coordinate[]): boolean {
  return route.some(point => haversine(userPos, point) < REROUTE_THRESHOLD);
}

// ─── HOOK TYPES & EXPORT ─────────────────────────────────────────────────────

type UseNavigationResult = {
  route: Coordinate[];
  passedRoute: Coordinate[];
  remainingRoute: Coordinate[];
  distance: number | null;
  loading: boolean;
  rerouting: boolean;
  nextInstruction: string;
  turnIcon: string;
  startNavigation: (from: Coordinate, to: Coordinate) => Promise<void>;
  resetNavigation: () => void;
};

export function useNavigation(
  userLocation: Coordinate | null,
  destination: Coordinate | null
): UseNavigationResult {
  const [route, setRoute]                   = useState<Coordinate[]>([]);
  const [passedRoute, setPassedRoute]       = useState<Coordinate[]>([]);
  const [remainingRoute, setRemainingRoute] = useState<Coordinate[]>([]);
  const [distance, setDistance]             = useState<number | null>(null);
  const [loading, setLoading]               = useState(false);
  const [rerouting, setRerouting]           = useState(false);
  
  // Turn-by-Turn UI States
  const [nextInstruction, setNextInstruction] = useState('Calculating route...');
  const [turnIcon, setTurnIcon]               = useState('straight');

  const isReroutingRef    = useRef(false);
  const lastRerouteRef    = useRef(0);
  const isMountedRef      = useRef(true);
  const destinationRef    = useRef(destination);

  useEffect(() => { destinationRef.current = destination; }, [destination]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const startNavigation = useCallback(async (
    from: Coordinate, to: Coordinate
  ) => {
    setLoading(true);
    setNextInstruction('Finding best path...');
    try {
      const result: RouteResult = await fetchRoute(from, to);
      if (!isMountedRef.current) return;
      setRoute(result.path);
      setPassedRoute([]);
      setRemainingRoute(result.path);
      setDistance(result.distanceMeters);
      
      setNextInstruction('Head towards the route');
      setTurnIcon('straight');
    } catch {
      throw new Error('Could not find a route. Try tapping closer to a path.');
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, []);

  const resetNavigation = useCallback(() => {
    setRoute([]);
    setPassedRoute([]);
    setRemainingRoute([]);
    setDistance(null);
    setNextInstruction('');
    isReroutingRef.current = false;
    lastRerouteRef.current = 0;
  }, []);

  // Progress tracking + auto reroute
  useEffect(() => {
    if (!userLocation || route.length === 0) return;

    // ─── Progress tracking ───────────────────────────
    const idx = closestPointIndex(userLocation, route);
    setPassedRoute(route.slice(0, idx + 1));
    const newRemaining = route.slice(idx);
    setRemainingRoute(newRemaining);

    // ─── Dynamic Instructions & Distance ─────────────
    const dest = destinationRef.current;
    if (dest) {
      const remainingDistanceToDest = Math.round(haversine(userLocation, dest));
      setDistance(remainingDistanceToDest);

      if (remainingDistanceToDest < 20) {
        setNextInstruction('Arriving at destination!');
        setTurnIcon('place'); 
      } else {
        const upcomingTurn = getNextTurnInstruction(newRemaining);
        setNextInstruction(upcomingTurn.text);
        setTurnIcon(upcomingTurn.icon);
      }
    }

    // ─── Auto reroute ────────────────────────────────
    if (!dest) return;
    if (isReroutingRef.current) return;

    const now = Date.now();
    if (now - lastRerouteRef.current < REROUTE_COOLDOWN) return;

    if (!isOnRoute(userLocation, route)) {
      isReroutingRef.current = true;
      lastRerouteRef.current = now;
      setRerouting(true);
      setNextInstruction('Rerouting...');
      setTurnIcon('sync');

      fetchRoute(userLocation, dest)
        .then(result => {
          if (!isMountedRef.current) return;
          setRoute(result.path);
          setPassedRoute([]);
          setRemainingRoute(result.path);
          setDistance(result.distanceMeters);
          setNextInstruction('Route updated. Follow the path.');
          setTurnIcon('straight');
        })
        .catch(() => {
          console.warn('Reroute failed — keeping current route');
        })
        .finally(() => {
          if (isMountedRef.current) setRerouting(false);
          isReroutingRef.current = false;
        });
    }
  }, [userLocation, route]);

  return {
    route, passedRoute, remainingRoute,
    distance, loading, rerouting,
    nextInstruction, turnIcon,
    startNavigation, resetNavigation,
  };
}