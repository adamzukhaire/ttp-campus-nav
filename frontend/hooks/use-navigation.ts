// hooks/useNavigation.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { Coordinate, RouteResult, fetchRoute } from '../services/api';

const REROUTE_THRESHOLD = 30;
const REROUTE_COOLDOWN  = 2000; // ms — wait 2s before rerouting again

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

type UseNavigationResult = {
  route: Coordinate[];
  passedRoute: Coordinate[];
  remainingRoute: Coordinate[];
  distance: number | null;
  loading: boolean;
  rerouting: boolean;
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

  const isReroutingRef    = useRef(false);        // prevents concurrent reroutes
  const lastRerouteRef    = useRef(0);            // timestamp of last reroute
  const isMountedRef      = useRef(true);         // prevents state update after unmount
  const destinationRef    = useRef(destination);  // always up to date in effects

  // Keep destinationRef in sync
  useEffect(() => { destinationRef.current = destination; }, [destination]);

  // Track mounted state
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const startNavigation = useCallback(async (
    from: Coordinate, to: Coordinate
  ) => {
    setLoading(true);
    try {
      const result: RouteResult = await fetchRoute(from, to);
      if (!isMountedRef.current) return;
      setRoute(result.path);
      setPassedRoute([]);
      setRemainingRoute(result.path);
      setDistance(result.distanceMeters);
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
    isReroutingRef.current = false;
    lastRerouteRef.current = 0;
  }, []);

  // Progress tracking + auto reroute
  useEffect(() => {
    if (!userLocation || route.length === 0) return;

    // ─── Progress tracking ───────────────────────────
    const idx = closestPointIndex(userLocation, route);
    setPassedRoute(route.slice(0, idx + 1));
    setRemainingRoute(route.slice(idx));

    // ─── Auto reroute ────────────────────────────────
    const dest = destinationRef.current;
    if (!dest) return;
    if (isReroutingRef.current) return; // already rerouting

    // Cooldown — don't reroute more than once every 5 seconds
    const now = Date.now();
    if (now - lastRerouteRef.current < REROUTE_COOLDOWN) return;

    if (!isOnRoute(userLocation, route)) {
      isReroutingRef.current = true;
      lastRerouteRef.current = now;
      setRerouting(true);

      fetchRoute(userLocation, dest)
        .then(result => {
          if (!isMountedRef.current) return;
          setRoute(result.path);
          setPassedRoute([]);
          setRemainingRoute(result.path);
          setDistance(result.distanceMeters);
        })
        .catch(() => {
          // Silently fail — don't crash, just keep the old route
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
    startNavigation, resetNavigation,
  };
}