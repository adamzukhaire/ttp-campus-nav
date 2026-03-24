import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, FlatList,
  Image, SafeAreaView, Alert, ActivityIndicator
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase'; // The database connection!

const FACILITIES = [
  { id: '1', title: 'Study Room 101', startHour: 10, endHour: 22, image: 'https://picsum.photos/200/200?random=1' },
  { id: '2', title: 'Sports Court', startHour: 10, endHour: 22, image: 'https://picsum.photos/200/200?random=2' },
  { id: '3', title: 'Lecture Hall B', startHour: 10, endHour: 22, image: 'https://picsum.photos/200/200?random=3' },
];

const SCHEDULE_HOURS = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];

export default function BookingPage() {
  const [date, setDate] = useState(new Date());
  const [mode, setMode] = useState('date' as any);
  const [showPicker, setShowPicker] = useState(false);
  
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Formatters
  const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const formattedTime = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const selectedHour = date.getHours();

  const formatHourUI = (hour: number) => {
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    return `${displayHour}${ampm}`;
  };

  // 1. Fetch real availability from Supabase for the selected date!
  const fetchAvailability = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('bookings')
        .select('facility_name, time_block')
        .eq('booking_date', formattedDate) // Only get bookings for the day we are looking at
        .eq('status', 'Confirmed'); // Only count it if it wasn't cancelled

      if (error) throw error;
      if (data) setBookings(data);
    } catch (error) {
      console.error("Error fetching availability:", error);
    } finally {
      setLoading(false);
    }
  };

  // Trigger the fetch every time the user changes the Date, or switches back to this tab
  useFocusEffect(
    useCallback(() => {
      fetchAvailability();
    }, [formattedDate])
  );

  const onChange = (event: any, selectedDate?: Date) => {
    setShowPicker(false);
    if (selectedDate) setDate(selectedDate);
  };

  const showMode = (currentMode: string) => {
    setShowPicker(true);
    setMode(currentMode);
  };

  // 2. The Upgraded Booking Logic
  const handleBook = async (facility: any) => {
    // Prevent booking if they are trying to book in the past (optional, but good practice!)
    if (date < new Date(new Date().setHours(0,0,0,0))) {
      return Alert.alert('Invalid Date', 'You cannot book a facility in the past.');
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return Alert.alert('Error', 'You must be logged in.');

      // Double-check the UI hasn't lied to us
      const isAlreadyBooked = bookings.some(
        b => b.facility_name === facility.title && parseInt(b.time_block, 10) === selectedHour
      );
      if (isAlreadyBooked) return Alert.alert('Unavailable', 'This slot was just taken! ❌');

      // Send to Database
      const { error } = await supabase.from('bookings').insert({
        user_id: user.id,
        facility_name: facility.title,
        booking_date: formattedDate,
        time_block: selectedHour.toString(),
        status: 'Confirmed'
      });

      if (error) throw error;

      Alert.alert('Success 🎉', `${facility.title} booked for ${formatHourUI(selectedHour)}.`);
      
      // 3. Instantly refresh the dots to show the new booking!
      fetchAvailability(); 

    } catch (error: any) {
      Alert.alert('Booking Failed', error.message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.appBar}>
        <Text style={styles.appBarTitle}>Book a Facility</Text>
        {loading && <ActivityIndicator color="#2563EB" />}
      </View>

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

      {showPicker && (
        <DateTimePicker
          value={date}
          mode={mode}
          is24Hour={false}
          display="default"
          onChange={onChange}
          minimumDate={new Date()}
        />
      )}

      <FlatList
        data={FACILITIES}
        contentContainerStyle={styles.list}
        keyExtractor={item => item.id}
        renderItem={({ item }) => {
          // Check database data instead of local data
          const isCurrentSelectionBooked = bookings.some(
            b => b.facility_name === item.title && parseInt(b.time_block, 10) === selectedHour
          );
          
          return (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <Image source={{ uri: item.image }} style={styles.cardImage} />
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardSubtitle}>Available: {item.startHour}:00 - {item.endHour}:00</Text>
                  
                  <TouchableOpacity
                    style={[styles.button, isCurrentSelectionBooked && styles.buttonDisabled]}
                    onPress={() => handleBook(item)}
                    disabled={isCurrentSelectionBooked}
                  >
                    <Text style={[styles.buttonText, isCurrentSelectionBooked && styles.buttonTextDisabled]}>
                      {isCurrentSelectionBooked ? 'Slot Taken' : 'Book Now'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.scheduleContainer}>
                <Text style={styles.scheduleLabel}>Availability for {formattedDate}:</Text>
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  data={SCHEDULE_HOURS}
                  keyExtractor={(hour) => hour.toString()}
                  renderItem={({ item: hour }) => {
                    // Make the timeline dots react to the Supabase data!
                    const isSlotBooked = bookings.some(
                      b => b.facility_name === item.title && parseInt(b.time_block, 10) === hour
                    );

                    return (
                      <View style={styles.hourSlot}>
                        <View style={[
                          styles.statusDot, 
                          { backgroundColor: isSlotBooked ? '#EF4444' : '#10B981' }
                        ]} />
                        <Text style={styles.hourText}>{formatHourUI(hour)}</Text>
                      </View>
                    );
                  }}
                />
              </View>
            </View>
          );
        }}
      />
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
  list: { padding: 16, gap: 16, paddingBottom: 40 },
  card: { backgroundColor: '#FFF', borderRadius: 16, overflow: 'hidden', marginBottom: 16 },
  cardTop: { flexDirection: 'row' },
  cardImage: { width: 110, height: 110 },
  cardBody: { flex: 1, padding: 12, justifyContent: 'space-between' },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1F2937' },
  cardSubtitle: { fontSize: 12, color: '#6B7280' },
  button: { alignSelf: 'flex-start', backgroundColor: '#2563EB', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, marginTop: 8 },
  buttonDisabled: { backgroundColor: '#E5E7EB' },
  buttonText: { color: '#FFF', fontWeight: '600', fontSize: 12 },
  buttonTextDisabled: { color: '#9CA3AF' },
  scheduleContainer: { padding: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6', backgroundColor: '#FAFAFA' },
  scheduleLabel: { fontSize: 11, fontWeight: '700', color: '#6B7280', marginBottom: 10, textTransform: 'uppercase' },
  hourSlot: { alignItems: 'center', marginRight: 16 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginBottom: 6 },
  hourText: { fontSize: 11, color: '#374151', fontWeight: '500' },
});