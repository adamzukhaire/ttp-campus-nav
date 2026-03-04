import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, TextInput, FlatList,
  ActivityIndicator, Alert, Modal, PanResponder, Animated, Keyboard
} from 'react-native';
import MapView, { Marker, Polyline, MapPressEvent } from 'react-native-maps';
import { MaterialIcons } from '@expo/vector-icons';
import { Coordinate, fetchPaths } from '../../services/api';
import { useLocation } from '../../hooks/use-location';
import { useNavigation } from '../../hooks/use-navigation';

const CAMPUS_REGION = {
  latitude: 4.3830, longitude: 100.9679,
  latitudeDelta: 0.012, longitudeDelta: 0.012,
};

const JOYSTICK_RADIUS = 40;

// Predefined UTP Places
const PLACES = [
  { name: 'Pocket D', area: 'Academic Core', icon: 'local-library', latitude: 4.38245, longitude: 100.96910 },
  { name: 'Chancellor Hall', area: 'Student Centre', icon: 'celebration', latitude: 4.38195, longitude: 100.96840 },
  { name: 'Pocket C', area: 'Residential College', icon: 'apartment', latitude: 4.38310, longitude: 100.96780 },
  { name: 'Sports Complex', area: 'Recreation', icon: 'sports-soccer', latitude: 4.38400, longitude: 100.97000 },
];

// Haversine Distance Calculator (KM)
const calculateDistanceKM = (lat1, lon1, lat2, lon2) => {
  const earthRadius = 6371;
  const degToRad = (deg) => (deg * Math.PI) / 180;
  
  const dLat = degToRad(lat2 - lat1);
  const dLon = degToRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(degToRad(lat1)) * Math.cos(degToRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
};

export default function Index() {
  const [campusPaths, setCampusPaths] = useState<Coordinate[][]>([]);
  const [destination, setDestination] = useState<Coordinate | null>(null);
  const [pendingDest, setPendingDest] = useState<Coordinate | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  
  // Search UI State
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const { userLocation, locationError, devMode, toggleDevMode, moveDevLocation } = useLocation();
  const {
    passedRoute, remainingRoute,
    distance, loading, rerouting,
    startNavigation, resetNavigation,
  } = useNavigation(userLocation, destination);

  // ─── Joystick refs ───
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
        Animated.spring(joystickAnim.current, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: true,
        }).start();
        joystickPos.current = { x: 0, y: 0 };
        if (moveInterval.current) clearInterval(moveInterval.current);
      },
    })
  ).current;

  // Fetch paths
  useEffect(() => {
    fetchPaths()
      .then(setCampusPaths)
      .catch(() => console.error('Failed to load campus paths'));
  }, []);

  useEffect(() => {
    if (locationError) Alert.alert('Location Error', locationError);
  }, [locationError]);

  // Search Filtering
  const filteredPlaces = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return PLACES;
    return PLACES.filter(
      (p) => p.name.toLowerCase().includes(q) || p.area.toLowerCase().includes(q)
    );
  }, [query]);

  // Map & Navigation Handlers
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
    if (!pendingDest || !userLocation) {
      Alert.alert('Error', 'Could not get your location yet. Please wait.');
      return;
    }
    const dest = pendingDest;
    setPendingDest(null);
    executeNavigation(dest);
  };

  const handleSelectPredefinedPlace = (place: typeof PLACES[0]) => {
    if (!userLocation) {
      Alert.alert('Hold on', 'Still finding your location...');
      return;
    }
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

        {passedRoute.length > 1 && (
          <Polyline coordinates={passedRoute} strokeColor="#94a3b8" strokeWidth={5} lineJoin="round" />
        )}
        {remainingRoute.length > 1 && (
          <Polyline coordinates={remainingRoute} strokeColor="#eab308" strokeWidth={5} lineJoin="round" />
        )}
      </MapView>

      {/* Floating Search Bar */}
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

        {/* Floating Search Results */}
        {isSearching && (
          <View style={styles.searchResults}>
            <FlatList
              data={filteredPlaces}
              keyExtractor={(item) => item.name}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const distKM = userLocation ? calculateDistanceKM(userLocation.latitude, userLocation.longitude, item.latitude, item.longitude) : 0;
                const walkMins = Math.ceil((distKM / 5) * 60);

                return (
                  <TouchableOpacity style={styles.card} onPress={() => handleSelectPredefinedPlace(item)}>
                    <MaterialIcons name={item.icon as any} size={24} color="#2563EB" style={styles.cardIcon} />
                    <View style={styles.cardBody}>
                      <Text style={styles.cardTitle}>{item.name}</Text>
                      <Text style={styles.cardSubtitle}>
                        {item.area} {userLocation ? `• ${distKM.toFixed(2)} km • ~${walkMins} min` : ''}
                      </Text>
                    </View>
                    <MaterialIcons name="directions" size={24} color="#1D4ED8" />
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        )}
      </View>

      {/* Dev mode toggle button - Moved down to avoid search bar */}
      {!isSearching && (
        <TouchableOpacity
          style={[styles.devBtn, devMode && styles.devBtnActive]}
          onPress={toggleDevMode}
        >
          <Text style={styles.devBtnText}>{devMode ? '🕹️ DEV ON' : '🕹️ DEV'}</Text>
        </TouchableOpacity>
      )}

      {/* Joystick */}
      {devMode && !isSearching && (
        <View style={styles.joystickContainer}>
          <View style={styles.joystickBase}>
            <Animated.View
              style={[
                styles.joystickKnob,
                { transform: joystickAnim.current.getTranslateTransform() }
              ]}
              {...panResponder.panHandlers}
            />
          </View>
        </View>
      )}

      {/* Confirmation Modal */}
      <Modal transparent visible={showConfirm} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Go to this location?</Text>
            <Text style={styles.modalSub}>A route will be calculated from your current position.</Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
                <Text style={styles.confirmText}>Let's Go! 🚀</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Info Panel */}
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
          {distance !== null && !loading && !rerouting && <Text style={styles.distance}>📍 Distance: {distance}m</Text>}
          {destination && (
            <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
              <Text style={styles.resetText}>Cancel Route</Text>
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

  // Search UI overlaid on map
  searchHeader: {
    position: 'absolute',
    top: 50, // Adjust this based on device safe area if needed
    left: 16,
    right: 16,
    zIndex: 10,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 16 },
  searchResults: {
    backgroundColor: '#FFF',
    marginTop: 8,
    borderRadius: 8,
    maxHeight: 300,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  cardIcon: { marginRight: 16 },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
  cardSubtitle: { fontSize: 12, color: '#6B7280', marginTop: 2 },

  devBtn: {
    position: 'absolute', top: 120, right: 16, // Moved down to avoid search bar
    backgroundColor: '#1e293b', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: '#334155',
  },
  devBtnActive: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  devBtnText: { color: '#f1f5f9', fontSize: 12, fontWeight: 'bold' },

  devDot: {
    width: 16, height: 16, borderRadius: 8, backgroundColor: '#3b82f6',
    borderWidth: 2, borderColor: '#fff',
  },

  joystickContainer: {
    position: 'absolute', bottom: 140, right: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  joystickBase: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: 2, borderColor: '#334155',
    alignItems: 'center', justifyContent: 'center',
  },
  joystickKnob: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#7c3aed', borderWidth: 2, borderColor: '#a78bfa',
  },

  panel: {
    position: 'absolute', bottom: 30, left: 20, right: 20,
    backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 12,
    padding: 14, alignItems: 'center', gap: 8,
  },
  hint: { color: '#f1f5f9', fontSize: 14, textAlign: 'center' },
  distance: { color: '#eab308', fontSize: 16, fontWeight: 'bold' },
  resetBtn: { backgroundColor: '#dc2626', borderRadius: 8, paddingHorizontal: 20, paddingVertical: 8 },
  resetText: { color: '#fff', fontWeight: 'bold' },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center',
  },
  modalBox: {
    backgroundColor: '#1e293b', borderRadius: 16,
    padding: 24, width: '80%', alignItems: 'center', gap: 10,
  },
  modalTitle: { color: '#f1f5f9', fontSize: 18, fontWeight: 'bold' },
  modalSub: { color: '#94a3b8', fontSize: 13, textAlign: 'center' },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: { backgroundColor: '#334155', borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 },
  cancelText: { color: '#f1f5f9', fontWeight: 'bold' },
  confirmBtn: { backgroundColor: '#16a34a', borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 },
  confirmText: { color: '#fff', fontWeight: 'bold' },
});