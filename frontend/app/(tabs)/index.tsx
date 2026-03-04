import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import MapView, { Marker, Polyline, MapPressEvent } from 'react-native-maps';
import * as Location from 'expo-location';

const API_URL = 'https://ttp-campus-nav.onrender.com';

const HEADERS = {
  'Content-Type': 'application/json',
};

type Coordinate = { latitude: number; longitude: number };

export default function Index() {
  const [start, setStart]             = useState<Coordinate | null>(null);
  const [end, setEnd]                 = useState<Coordinate | null>(null);
  const [route, setRoute]             = useState<Coordinate[]>([]);
  const [campusPaths, setCampusPaths] = useState<Coordinate[][]>([]);
  const [distance, setDistance]       = useState<number | null>(null);
  const [eta, setEta]                 = useState<number | null>(null);
  const [loading, setLoading]         = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  const mapRef = useRef<MapView>(null);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);

  // Fetch blue paths from backend on startup
  useEffect(() => {
    fetch(`${API_URL}/paths`, { headers: HEADERS })
      .then(res => res.json())
      .then(data => setCampusPaths(data.paths))
      .catch(err => console.error("Failed to load paths:", err));
  }, []);

  // Clean up location subscription when component unmounts
  useEffect(() => {
    return () => {
      locationSubscription.current?.remove();
    };
  }, []);

  // Get user location automatically on startup
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        setStart({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      }
    })();
  }, []);

  const campusRegion = {
    latitude: 4.3830,
    longitude: 100.9679,
    latitudeDelta: 0.012,
    longitudeDelta: 0.012,
  };

  const handleMapPress = async (e: MapPressEvent) => {
    if (isNavigating) return;

    const destination = e.nativeEvent.coordinate;
    setEnd(destination);

    let currentStart = start;

    if (!currentStart) {
      setLoading(true);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Location is required to calculate a route.');
          setLoading(false);
          return;
        }
        const location = await Location.getCurrentPositionAsync({});
        currentStart = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
        setStart(currentStart);
      } catch (error) {
        Alert.alert('Error', 'Could not get your location.');
        setLoading(false);
        return;
      }
    }

    await fetchRoute(currentStart, destination);
  };

  const fetchRoute = async (from: Coordinate, to: Coordinate) => {
    setLoading(true);
    try {
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
      const coords: Coordinate[] = data.path.map(([lon, lat]: [number, number]) => ({
        latitude: lat,
        longitude: lon,
      }));
      setRoute(coords);
      setDistance(data.distanceMeters);
      setEta(data.etaMinutes);
    } catch (err) {
      Alert.alert('Error', 'Could not find a route. Try tapping closer to a path.');
    } finally {
      setLoading(false);
    }
  };

  const beginLiveNavigation = () => {
    if (!end || !start) return;
    setIsNavigating(true);

    mapRef.current?.animateToRegion({ ...start, latitudeDelta: 0.005, longitudeDelta: 0.005 }, 1000);

    Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: Platform.OS === 'android' ? 2000 : undefined,
        distanceInterval: 10,
      },
      (newLocation) => {
        const userCoord = {
          latitude: newLocation.coords.latitude,
          longitude: newLocation.coords.longitude,
        };
        
        setStart(userCoord);
        fetchRoute(userCoord, end);
        mapRef.current?.animateCamera({ center: userCoord }, { duration: 1000 });
      }
    ).then(subscription => {
      locationSubscription.current = subscription;
    });
  };

  const stopNavigation = () => {
    if (isNavigating) {
      locationSubscription.current?.remove();
      locationSubscription.current = null;
      setIsNavigating(false);
    }
    setEnd(null);
    setRoute([]);
    setDistance(null);
    setEta(null);
  };

  const handleUseMyLocation = async () => {
    if (isNavigating) return;

    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Permission to access location was denied.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const userCoord = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setStart(userCoord);
      mapRef.current?.animateToRegion({
        ...userCoord,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }, 1000);
      
    } catch (error) {
      Alert.alert('Error', 'Could not get your location.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={campusRegion}
        ref={mapRef}
        onPress={handleMapPress}
        showsUserLocation={true}
        showsMyLocationButton={false}
      >
        {/* Walkable paths */}
        {campusPaths.map((path, i) => (
          <Polyline
            key={i}
            coordinates={path}
            strokeColor="#3b82f6"
            strokeWidth={3}
            lineJoin="round"
          />
        ))}

        {/* Removed the manual start marker to let the native OS blue dot take over */}
        {end && <Marker coordinate={end} title="Destination" pinColor="red" />}

        {/* Route result */}
        {route.length > 0 && (
          <Polyline
            coordinates={route}
            strokeColor="#eab308"
            strokeWidth={5}
            lineJoin="round"
          />
        )}
      </MapView>

      <View style={styles.panel}>
        {loading && (
          <View style={{ alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#eab308" />
            <Text style={[styles.hint, { marginTop: 8 }]}>Calculating... (Server may take a moment to wake up)</Text>
          </View>
        )}

        {!loading && isNavigating && (
          <View style={styles.navigatingView}>
            <Text style={styles.distance}>{distance}m ({eta} min walk)</Text>
            <TouchableOpacity style={styles.resetBtn} onPress={stopNavigation}>
              <Text style={styles.resetText}>Stop Navigation</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && !isNavigating && !end && (
          <View style={styles.startPrompt}>
            <Text style={styles.hint}>👆 Tap anywhere to set your destination</Text>
            <TouchableOpacity style={styles.locationBtn} onPress={handleUseMyLocation}>
              <Text style={styles.locationBtnText}>Center on Me</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && !isNavigating && end && route.length > 0 && (
          <View style={styles.routePreview}>
            <Text style={styles.distance}>{distance}m ({eta} min walk)</Text>
            <TouchableOpacity style={styles.startNavBtn} onPress={beginLiveNavigation}>
              <Text style={styles.locationBtnText}>Start Navigation</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.resetBtn} onPress={stopNavigation}>
              <Text style={styles.resetText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map:       { flex: 1 },
  panel: {
    position: 'absolute', bottom: 30, left: 20, right: 20,
    backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 12,
    padding: 14, alignItems: 'center',
  },
  hint:      { color: '#f1f5f9', fontSize: 14, textAlign: 'center' },
  distance:  { color: '#eab308', fontSize: 16, fontWeight: 'bold' },
  resetBtn:  { backgroundColor: '#dc2626', borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10, marginTop: 8 },
  resetText: { color: '#fff', fontWeight: 'bold' },
  startPrompt: { alignItems: 'center', gap: 10 },
  locationBtn: { backgroundColor: '#3b82f6', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  locationBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  startNavBtn: { backgroundColor: '#16a34a', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8, marginTop: 8 },
  navigatingView: { alignItems: 'center', gap: 12 },
  routePreview: { alignItems: 'center', gap: 8, width: '100%' }
});