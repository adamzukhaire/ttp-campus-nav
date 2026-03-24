import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, TextInput, FlatList,
  ActivityIndicator, Alert, Modal, PanResponder, Animated, Keyboard, SafeAreaView
} from 'react-native';
import MapView, { Marker, Polyline, MapPressEvent } from 'react-native-maps';
import { MaterialIcons } from '@expo/vector-icons';
import { Coordinate, fetchPaths } from '../../services/api';
import { useLocation } from '../../hooks/use-location';
import { useNavigation } from '../../hooks/use-navigation';
import { useLocalSearchParams } from 'expo-router'; // Add this line

const CAMPUS_REGION = {
  latitude: 4.3837, longitude: 100.9645, // Adjusted to center your new coordinates
  latitudeDelta: 0.012, longitudeDelta: 0.012,
};

const JOYSTICK_RADIUS = 40;

const PLACES = [
  { name: 'Pocket D', area: 'Academic Core', icon: 'local-library', latitude: 4.384158,  longitude: 100.966547 },
  { name: 'Chancellor Hall', area: 'Student Centre', icon: 'celebration', latitude: 4.381684, longitude: 100.969503 },
  { name: 'Pocket C', area: 'Academic Core', icon: 'local-library',  latitude: 4.382932, longitude: 100.963829 },
  { name: 'Sports Complex', area: 'Recreation', icon: 'sports-soccer', latitude: 4.387342, longitude: 100.975057 },
  { name: 'Village 5E', area: 'Residential College', icon: 'apartment', latitude: 4.386596, longitude: 100.964087 },
];

const calculateDistanceKM = (lat1, lon1, lat2, lon2) => {
  const earthRadius = 6371;
  const degToRad = (deg) => (deg * Math.PI) / 180;
  const dLat = degToRad(lat2 - lat1);
  const dLon = degToRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(degToRad(lat1)) * Math.cos(degToRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
};

export default function Index() {
  const [campusPaths, setCampusPaths] = useState<Coordinate[][]>([]);
  const [destination, setDestination] = useState<Coordinate | null>(null);
  const [pendingDest, setPendingDest] = useState<Coordinate | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const { destLat, destLon } = useLocalSearchParams();
  
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const { userLocation, locationError, devMode, toggleDevMode, moveDevLocation } = useLocation();
  
  // Notice we are assuming useNavigation now returns nextInstruction and turnIcon
  const {
    passedRoute, remainingRoute,
    distance, loading, rerouting,
    startNavigation, resetNavigation,
    nextInstruction = "Turn left onto Academic Pathway", // MOCKED: Your hook needs to provide this
    turnIcon = "turn-left" // MOCKED: Your hook needs to provide this (e.g., 'straight', 'turn-right')
  } = useNavigation(userLocation, destination);

  const joystickAnim = useRef(new Animated.ValueXY({ x: 0, y: 0 }));
  const joystickPos  = useRef({ x: 0, y: 0 });
  const moveInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const moveDevRef   = useRef(moveDevLocation);

  useEffect(() => { moveDevRef.current = moveDevLocation; }, [moveDevLocation]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gesture) => {
        const dist  = Math.sqrt(gesture.dx ** 2 + gesture.dy ** 2);
        const scale = dist > JOYSTICK_RADIUS ? JOYSTICK_RADIUS / dist : 1;
        const x = gesture.dx * scale;
        const y = gesture.dy * scale;
        joystickAnim.current.setValue({ x, y });
        joystickPos.current = { x, y };
      },
      onPanResponderGrant: () => {
        moveInterval.current = setInterval(() => {
          const { x, y } = joystickPos.current;
          if (Math.abs(x) > 5 || Math.abs(y) > 5) {
            moveDevRef.current(-y / JOYSTICK_RADIUS, x / JOYSTICK_RADIUS);
          }
        }, 100);
      },
      onPanResponderRelease: () => {
        Animated.spring(joystickAnim.current, { toValue: { x: 0, y: 0 }, useNativeDriver: true }).start();
        joystickPos.current = { x: 0, y: 0 };
        if (moveInterval.current) clearInterval(moveInterval.current);
      },
    })
  ).current;

  useEffect(() => {
    fetchPaths().then(setCampusPaths).catch(() => console.error('Failed to load campus paths'));
  }, []);

  useEffect(() => {
    // If we received coordinates from the Events tab AND we have the user's location
    if (destLat && destLon && userLocation) {
      const autoDest = { 
        latitude: parseFloat(destLat as string), 
        longitude: parseFloat(destLon as string) 
      };
      
      // Automatically start navigating!
      executeNavigation(autoDest);
    }
  }, [destLat, destLon, userLocation]); // This runs whenever these values change

  const filteredPlaces = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return PLACES;
    return PLACES.filter((p) => p.name.toLowerCase().includes(q) || p.area.toLowerCase().includes(q));
  }, [query]);

useEffect(() => {
    // 1. Only check if we are actively navigating and have a location
    if (destination && userLocation) {
      
      // 2. Calculate exact straight-line distance (Bulletproof)
      const distKM = calculateDistanceKM(
        userLocation.latitude, 
        userLocation.longitude, 
        destination.latitude, 
        destination.longitude
      );
      
      const distMeters = distKM * 1000;

      // 3. Arrival Radius (2 meters)
      if (distMeters <= 2) {
        
        // 4. IMMEDIATELY clear the route! This stops the spamming.
        handleReset();

        // 5. Show the single alert
        Alert.alert(
          '📍 You have arrived!',
          'You have reached your destination.',
          [{ text: 'Awesome' }]
        );
      }
    }
  }, [userLocation, destination]);

  const handleMapPress = (e: MapPressEvent) => {
    if (isSearching) {
      Keyboard.dismiss();
      setIsSearching(false);
      return;
    }
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setPendingDest({ latitude, longitude });
    setShowConfirm(true);
  };

  const executeNavigation = async (destCoords: Coordinate) => {
    setDestination(destCoords);
    try {
      await startNavigation(userLocation, destCoords);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const handleConfirm = async () => {
    setShowConfirm(false);
    if (!pendingDest || !userLocation) return Alert.alert('Error', 'Could not get your location yet.');
    const dest = pendingDest;
    setPendingDest(null);
    executeNavigation(dest);
  };

  const handleSelectPredefinedPlace = (place: typeof PLACES[0]) => {
    if (!userLocation) return Alert.alert('Hold on', 'Still finding your location...');
    Keyboard.dismiss();
    setIsSearching(false);
    setQuery('');
    executeNavigation({ latitude: place.latitude, longitude: place.longitude });
  };

  const handleCancel = () => { setShowConfirm(false); setPendingDest(null); };

  const handleReset = () => {
    setDestination(null);
    setPendingDest(null);
    resetNavigation();
  };

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={CAMPUS_REGION}
        onPress={handleMapPress}
        showsUserLocation={!devMode}
        followsUserLocation={false}
      >
        {campusPaths.map((path, i) => (
          <Polyline key={i} coordinates={path} strokeColor="#3b82f6" strokeWidth={3} lineJoin="round" />
        ))}
        {devMode && userLocation && (
          <Marker coordinate={userLocation} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.devDot} />
          </Marker>
        )}
        {pendingDest && <Marker coordinate={pendingDest} title="?" pinColor="orange" />}
        {destination && <Marker coordinate={destination} title="Destination" pinColor="red" />}
        {passedRoute.length > 1 && <Polyline coordinates={passedRoute} strokeColor="#94a3b8" strokeWidth={5} lineJoin="round" />}
        {remainingRoute.length > 1 && <Polyline coordinates={remainingRoute} strokeColor="#eab308" strokeWidth={5} lineJoin="round" />}
      </MapView>

      {/* Conditional Header: Show Search Bar OR Turn-by-Turn Banner */}
      {!destination ? (
        <View style={styles.searchHeader}>
          <View style={styles.searchContainer}>
            <MaterialIcons name="search" size={24} color="#9CA3AF" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search building..."
              value={query}
              onChangeText={setQuery}
              onFocus={() => setIsSearching(true)}
            />
            {isSearching && (
              <TouchableOpacity onPress={() => { Keyboard.dismiss(); setIsSearching(false); setQuery(''); }}>
                <MaterialIcons name="close" size={24} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>

          {isSearching && (
            <View style={styles.searchResults}>
              <FlatList
                data={filteredPlaces}
                keyExtractor={(item) => item.name}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => {
                  const distKM = userLocation ? calculateDistanceKM(userLocation.latitude, userLocation.longitude, item.latitude, item.longitude) : 0;
                  return (
                    <TouchableOpacity style={styles.card} onPress={() => handleSelectPredefinedPlace(item)}>
                      <MaterialIcons name={item.icon as any} size={24} color="#2563EB" style={styles.cardIcon} />
                      <View style={styles.cardBody}>
                        <Text style={styles.cardTitle}>{item.name}</Text>
                        <Text style={styles.cardSubtitle}>{item.area} {userLocation ? `• ${distKM.toFixed(2)} km` : ''}</Text>
                      </View>
                      <MaterialIcons name="directions" size={24} color="#1D4ED8" />
                    </TouchableOpacity>
                  );
                }}
              />
            </View>
          )}
        </View>
      ) : (
        /* TURN-BY-TURN NAVIGATION BANNER */
        <SafeAreaView style={styles.turnByTurnContainer}>
          <View style={styles.turnByTurnBanner}>
            <MaterialIcons name={turnIcon as any} size={48} color="#FFF" />
            <View style={styles.turnTextContainer}>
              <Text style={styles.turnDistance}>{distance}m</Text>
              <Text style={styles.turnInstruction}>{nextInstruction}</Text>
            </View>
          </View>
        </SafeAreaView>
      )}

      {/* Dev mode toggle button */}
      {!isSearching && (
        <TouchableOpacity style={[styles.devBtn, devMode && styles.devBtnActive]} onPress={toggleDevMode}>
          <Text style={styles.devBtnText}>{devMode ? '🕹️ DEV ON' : '🕹️ DEV'}</Text>
        </TouchableOpacity>
      )}

      {/* Joystick */}
      {devMode && !isSearching && (
        <View style={styles.joystickContainer}>
          <View style={styles.joystickBase}>
            <Animated.View style={[styles.joystickKnob, { transform: joystickAnim.current.getTranslateTransform() }]} {...panResponder.panHandlers} />
          </View>
        </View>
      )}

      {/* Bottom Info Panel */}
      {!isSearching && (
        <View style={styles.panel}>
          {!userLocation && <Text style={styles.hint}>📡 Getting your location...</Text>}
          {userLocation && !destination && !loading && <Text style={styles.hint}>👆 Tap anywhere to navigate, or search top.</Text>}
          {(loading || rerouting) && (
            <View style={styles.row}>
              <ActivityIndicator size="small" color="#eab308" />
              <Text style={styles.hint}>{rerouting ? '🔄 Rerouting...' : '⏳ Finding route...'}</Text>
            </View>
          )}
          {destination && (
            <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
              <Text style={styles.resetText}>End Route</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  // Search UI
  searchHeader: { position: 'absolute', top: 50, left: 16, right: 16, zIndex: 10 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 8, paddingHorizontal: 12, elevation: 5 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 16 },
  searchResults: { backgroundColor: '#FFF', marginTop: 8, borderRadius: 8, maxHeight: 300, elevation: 5 },
  card: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  cardIcon: { marginRight: 16 },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
  cardSubtitle: { fontSize: 12, color: '#6B7280', marginTop: 2 },

  // Turn-by-Turn UI
  turnByTurnContainer: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, backgroundColor: '#16a34a' },
  turnByTurnBanner: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 60, paddingBottom: 24, gap: 16 },
  turnTextContainer: { flex: 1 },
  turnDistance: { color: '#FFF', fontSize: 24, fontWeight: '900' },
  turnInstruction: { color: '#e2e8f0', fontSize: 18, fontWeight: '500', marginTop: 2 },

  // Dev & Joystick
  devBtn: { position: 'absolute', top: 160, right: 16, backgroundColor: '#1e293b', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#334155' },
  devBtnActive: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  devBtnText: { color: '#f1f5f9', fontSize: 12, fontWeight: 'bold' },
  devDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#3b82f6', borderWidth: 2, borderColor: '#fff' },
  joystickContainer: { position: 'absolute', bottom: 140, right: 20, alignItems: 'center', justifyContent: 'center' },
  joystickBase: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: 2, borderColor: '#334155', alignItems: 'center', justifyContent: 'center' },
  joystickKnob: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#7c3aed', borderWidth: 2, borderColor: '#a78bfa' },

  // Bottom Panel
  panel: { position: 'absolute', bottom: 30, left: 20, right: 20, backgroundColor: 'rgba(0,0,0,0.85)', borderRadius: 16, padding: 16, alignItems: 'center', gap: 12, elevation: 10 },
  hint: { color: '#f1f5f9', fontSize: 15, textAlign: 'center', fontWeight: '500' },
  resetBtn: { backgroundColor: '#ef4444', borderRadius: 12, paddingHorizontal: 30, paddingVertical: 12, width: '100%', alignItems: 'center' },
  resetText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});