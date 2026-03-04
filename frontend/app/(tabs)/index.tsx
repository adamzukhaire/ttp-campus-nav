import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity,
  ActivityIndicator, Alert, Modal, PanResponder, Animated
} from 'react-native';
import MapView, { Marker, Polyline, MapPressEvent } from 'react-native-maps';
import { Coordinate, fetchPaths } from '../../services/api';
import { useLocation } from '../../hooks/use-location';
import { useNavigation } from '../../hooks/use-navigation';

const CAMPUS_REGION = {
  latitude: 4.3830, longitude: 100.9679,
  latitudeDelta: 0.012, longitudeDelta: 0.012,
};

const JOYSTICK_RADIUS = 40;

export default function Index() {
  const [campusPaths, setCampusPaths] = useState<Coordinate[][]>([]);
  const [destination, setDestination] = useState<Coordinate | null>(null);
  const [pendingDest, setPendingDest] = useState<Coordinate | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const { userLocation, locationError, devMode, toggleDevMode, moveDevLocation } = useLocation();
  const {
    passedRoute, remainingRoute,
    distance, loading, rerouting,
    startNavigation, resetNavigation,
  } = useNavigation(userLocation, destination);

  // ─── Joystick refs — must be declared before panResponder ───
  const joystickAnim = useRef(new Animated.ValueXY({ x: 0, y: 0 }));
  const joystickPos  = useRef({ x: 0, y: 0 });
  const moveInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const moveDevRef   = useRef(moveDevLocation);

  // Keep moveDevRef up to date so panResponder always uses latest version
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

  // Fetch blue paths on startup
  useEffect(() => {
    fetchPaths()
      .then(setCampusPaths)
      .catch(() => console.error('Failed to load campus paths'));
  }, []);

  useEffect(() => {
    if (locationError) Alert.alert('Location Error', locationError);
  }, [locationError]);

  const handleMapPress = (e: MapPressEvent) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setPendingDest({ latitude, longitude });
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    setShowConfirm(false);
    if (!pendingDest || !userLocation) {
      Alert.alert('Error', 'Could not get your location yet. Please wait.');
      return;
    }
    setDestination(pendingDest);
    setPendingDest(null);
    try {
      await startNavigation(userLocation, pendingDest);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
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
        {/* Blue lines — walkable paths */}
        {campusPaths.map((path, i) => (
          <Polyline key={i} coordinates={path}
            strokeColor="#3b82f6" strokeWidth={3} lineJoin="round" />
        ))}

        {/* Dev mode blue dot */}
        {devMode && userLocation && (
          <Marker coordinate={userLocation} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.devDot} />
          </Marker>
        )}

        {/* Orange pin — pending destination */}
        {pendingDest && (
          <Marker coordinate={pendingDest} title="?" pinColor="orange" />
        )}

        {/* Red pin — confirmed destination */}
        {destination && (
          <Marker coordinate={destination} title="Destination" pinColor="red" />
        )}

        {/* Grey line — passed portion */}
        {passedRoute.length > 1 && (
          <Polyline coordinates={passedRoute}
            strokeColor="#94a3b8" strokeWidth={5} lineJoin="round" />
        )}

        {/* Yellow line — remaining portion */}
        {remainingRoute.length > 1 && (
          <Polyline coordinates={remainingRoute}
            strokeColor="#eab308" strokeWidth={5} lineJoin="round" />
        )}
      </MapView>

      {/* Dev mode toggle button */}
      <TouchableOpacity
        style={[styles.devBtn, devMode && styles.devBtnActive]}
        onPress={toggleDevMode}
      >
        <Text style={styles.devBtnText}>{devMode ? '🕹️ DEV ON' : '🕹️ DEV'}</Text>
      </TouchableOpacity>

      {/* Joystick — only in dev mode */}
      {devMode && (
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
            <Text style={styles.modalSub}>
              A route will be calculated from your current position.
            </Text>
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
      <View style={styles.panel}>
        {!userLocation && (
          <Text style={styles.hint}>📡 Getting your location...</Text>
        )}
        {userLocation && !destination && !loading && (
          <Text style={styles.hint}>👆 Tap anywhere on the map to navigate</Text>
        )}
        {(loading || rerouting) && (
          <View style={styles.row}>
            <ActivityIndicator size="small" color="#eab308" />
            <Text style={styles.hint}>
              {rerouting ? '🔄 Rerouting...' : '⏳ Finding route...'}
            </Text>
          </View>
        )}
        {distance !== null && !loading && !rerouting && (
          <Text style={styles.distance}>📍 Distance: {distance}m</Text>
        )}
        {destination && (
          <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
            <Text style={styles.resetText}>Cancel Route</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map:       { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  devBtn: {
    position: 'absolute', top: 50, right: 16,
    backgroundColor: '#1e293b', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: '#334155',
  },
  devBtnActive: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  devBtnText: { color: '#f1f5f9', fontSize: 12, fontWeight: 'bold' },

  devDot: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#3b82f6',
    borderWidth: 2, borderColor: '#fff',
  },

  joystickContainer: {
    position: 'absolute', bottom: 140, right: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  joystickBase: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 2, borderColor: '#334155',
    alignItems: 'center', justifyContent: 'center',
  },
  joystickKnob: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#7c3aed',
    borderWidth: 2, borderColor: '#a78bfa',
  },

  panel: {
    position: 'absolute', bottom: 30, left: 20, right: 20,
    backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 12,
    padding: 14, alignItems: 'center', gap: 8,
  },
  hint:      { color: '#f1f5f9', fontSize: 14, textAlign: 'center' },
  distance:  { color: '#eab308', fontSize: 16, fontWeight: 'bold' },
  resetBtn:  { backgroundColor: '#dc2626', borderRadius: 8, paddingHorizontal: 20, paddingVertical: 8 },
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
  modalSub:   { color: '#94a3b8', fontSize: 13, textAlign: 'center' },
  modalBtns:  { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: {
    backgroundColor: '#334155', borderRadius: 8,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  cancelText:  { color: '#f1f5f9', fontWeight: 'bold' },
  confirmBtn: {
    backgroundColor: '#16a34a', borderRadius: 8,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  confirmText: { color: '#fff', fontWeight: 'bold' },
});