// hooks/useLocation.ts
// Handles GPS permission + watching user position
// Dev mode: allows manual position control via joystick

import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';
import { Coordinate } from '../services/api';

type UseLocationResult = {
  userLocation: Coordinate | null;
  locationError: string | null;
  devMode: boolean;
  toggleDevMode: () => void;
  moveDevLocation: (deltaLat: number, deltaLon: number) => void;
};

const DEV_STEP = 0.00003; // how far each joystick tick moves (meters scale)

export function useLocation(): UseLocationResult {
  const [userLocation, setUserLocation] = useState<Coordinate | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [devMode, setDevMode] = useState(false);

  // Real GPS watching
  useEffect(() => {
    if (devMode) return; // skip real GPS in dev mode

    let subscription: Location.LocationSubscription;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Location permission denied. Please enable it in Settings.');
        return;
      }

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 3000,
          distanceInterval: 5,
        },
        (loc) => {
          setUserLocation({
            latitude:  loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
        }
      );
    })();

    return () => { if (subscription) subscription.remove(); };
  }, [devMode]);

  // Toggle dev mode — seed position to current GPS or campus center
  const toggleDevMode = useCallback(() => {
    setDevMode(prev => {
      if (!prev) {
        // entering dev mode — keep current location or default to campus center
        setUserLocation(cur => cur ?? { latitude: 4.3830, longitude: 100.9679 });
      }
      return !prev;
    });
  }, []);

  // Move dev location by delta
  const moveDevLocation = useCallback((deltaLat: number, deltaLon: number) => {
    setUserLocation(cur => {
      if (!cur) return cur;
      return {
        latitude:  cur.latitude  + deltaLat * DEV_STEP,
        longitude: cur.longitude + deltaLon * DEV_STEP,
      };
    });
  }, []);

  return { userLocation, locationError, devMode, toggleDevMode, moveDevLocation };
}