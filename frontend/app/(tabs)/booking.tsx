import React, { useState } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, FlatList,
  Image, Modal, SafeAreaView, Alert, Platform
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

const FACILITIES = [
  { title: 'Study Room 101', location: 'Study Room', startHour: 10, endHour: 22, image: 'https://picsum.photos/200/200?random=1' },
  { title: 'Sports Court', location: 'Sports Court', startHour: 10, endHour: 22, image: 'https://picsum.photos/200/200?random=2' },
  { title: 'Lecture Hall B', location: 'Lecture Hall', startHour: 10, endHour: 22, image: 'https://picsum.photos/200/200?random=3' },
];

export default function BookingPage() {
  // Real Date object state
  const [date, setDate] = useState(new Date());
  
  // Picker visibility and mode states
  const [mode, setMode] = useState('date');
  const [showPicker, setShowPicker] = useState(false);
  
  const [bookings, setBookings] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  // Handle Date/Time Selection
  const onChange = (event, selectedDate) => {
    // Hide picker on Android after selection. On iOS, we also hide it to mimic a modal.
    setShowPicker(false); 
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  const showMode = (currentMode) => {
    setShowPicker(true);
    setMode(currentMode);
  };

  // Formatters for display
  const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const formattedTime = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const handleBook = (facility) => {
    const isAlreadyBooked = bookings.some(
      b => b.title === facility.title && b.date === formattedDate && b.time === formattedTime
    );
    
    if (isAlreadyBooked) {
      Alert.alert('Unavailable', 'This specific slot is already booked ❌');
      return;
    }
    
    setBookings([...bookings, { ...facility, date: formattedDate, time: formattedTime }]);
    Alert.alert('Success 🎉', `${facility.title} booked for ${formattedDate} at ${formattedTime}.`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appBar}>
        <Text style={styles.appBarTitle}>Booking</Text>
        <TouchableOpacity onPress={() => setShowHistory(true)}>
          <MaterialIcons name="history" size={28} color="#1F2937" />
        </TouchableOpacity>
      </View>

      {/* Date & Time Filters */}
      <View style={styles.filters}>
        <TouchableOpacity style={styles.filterBox} onPress={() => showMode('date')}>
          <MaterialIcons name="calendar-today" size={16} color="#4B5563" style={{ marginRight: 8 }} />
          <Text style={styles.filterText}>{formattedDate}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.filterBox} onPress={() => showMode('time')}>
          <MaterialIcons name="access-time" size={16} color="#4B5563" style={{ marginRight: 8 }} />
          <Text style={styles.filterText}>{formattedTime}</Text>
        </TouchableOpacity>
      </View>

      {/* The Native Picker */}
      {showPicker && (
        <DateTimePicker
          value={date}
          mode={mode}
          is24Hour={false}
          display="default"
          onChange={onChange}
          minimumDate={new Date()} // Prevents booking in the past
        />
      )}

      <FlatList
        data={FACILITIES}
        contentContainerStyle={styles.list}
        keyExtractor={item => item.title}
        renderItem={({ item }) => {
          // Check if booked for the CURRENTLY selected date and time
          const isBooked = bookings.some(b => b.title === item.title && b.date === formattedDate && b.time === formattedTime);
          
          return (
            <View style={styles.card}>
              <Image source={{ uri: item.image }} style={styles.cardImage} />
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardSubtitle}>Available: {item.startHour}:00 - {item.endHour}:00</Text>
                <TouchableOpacity
                  style={[styles.button, isBooked && styles.buttonDisabled]}
                  onPress={() => handleBook(item)}
                  disabled={isBooked}
                >
                  <Text style={[styles.buttonText, isBooked && styles.buttonTextDisabled]}>
                    {isBooked ? 'Booked' : 'Book Now'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />

      {/* History Modal */}
      <Modal visible={showHistory} animationType="slide" onRequestClose={() => setShowHistory(false)}>
        <SafeAreaView style={styles.container}>
          <View style={styles.appBar}>
            <TouchableOpacity onPress={() => setShowHistory(false)}>
              <MaterialIcons name="arrow-back" size={24} color="#1F2937" />
            </TouchableOpacity>
            <Text style={[styles.appBarTitle, { marginLeft: 16 }]}>My Bookings</Text>
          </View>
          {bookings.length === 0 ? (
            <View style={styles.emptyState}><Text>No bookings yet</Text></View>
          ) : (
            <FlatList
              data={bookings}
              keyExtractor={(item, index) => index.toString()}
              renderItem={({ item }) => (
                <View style={styles.historyListItem}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardSubtitle}>{item.date} at {item.time}</Text>
                </View>
              )}
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  appBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#FFF' },
  appBarTitle: { fontSize: 24, fontWeight: 'bold', color: '#1F2937' },
  filters: { flexDirection: 'row', padding: 16, gap: 12, backgroundColor: '#FFF' },
  filterBox: { flex: 1, flexDirection: 'row', backgroundColor: '#F3F4F6', padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  filterText: { fontSize: 14, color: '#374151', fontWeight: '500' },
  list: { padding: 16, gap: 16 },
  card: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 16, overflow: 'hidden' },
  cardImage: { width: 100, height: 100 },
  cardBody: { flex: 1, padding: 12, justifyContent: 'space-between' },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1F2937' },
  cardSubtitle: { fontSize: 12, color: '#6B7280' },
  button: { alignSelf: 'flex-end', backgroundColor: '#2563EB', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  buttonDisabled: { backgroundColor: '#E5E7EB' },
  buttonText: { color: '#FFF', fontWeight: '600', fontSize: 12 },
  buttonTextDisabled: { color: '#9CA3AF' },
  historyListItem: { backgroundColor: '#FFF', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});