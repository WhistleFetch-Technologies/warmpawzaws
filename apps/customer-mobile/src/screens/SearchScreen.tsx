/**
 * Search Screen - Customer Mobile App
 * Search for services, providers, and problems
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/navigation';
import Icon from 'react-native-vector-icons/MaterialIcons';

type SearchScreenNavigationProp = StackNavigationProp<RootStackParamList, 'MainTabs'>;

export default function SearchScreen() {
  const navigation = useNavigation<SearchScreenNavigationProp>();
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchBar}>
        <Icon name="search" size={24} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search services, providers, or problems..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#999"
        />
      </View>

      <ScrollView style={styles.content}>
        {/* Quick Search Options */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Search</Text>
          
          <TouchableOpacity style={styles.quickSearchButton}>
            <Icon name="local-hospital" size={24} color="#FF8C42" />
            <Text style={styles.quickSearchText}>Veterinary Services</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickSearchButton}>
            <Icon name="content-cut" size={24} color="#FF8C42" />
            <Text style={styles.quickSearchText}>Grooming</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickSearchButton}>
            <Icon name="school" size={24} color="#FF8C42" />
            <Text style={styles.quickSearchText}>Training</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickSearchButton}>
            <Icon name="home" size={24} color="#FF8C42" />
            <Text style={styles.quickSearchText}>Home Services</Text>
          </TouchableOpacity>
        </View>

        {/* Search by Problem */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Search by Problem</Text>
          <Text style={styles.sectionDescription}>
            Tell us what problem your pet is facing, and we'll find the right service
          </Text>
          <TouchableOpacity style={styles.problemSearchButton}>
            <Text style={styles.problemSearchText}>Start Problem Search</Text>
            <Icon name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: '#333',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  quickSearchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 8,
  },
  quickSearchText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#333',
  },
  problemSearchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF8C42',
    padding: 16,
    borderRadius: 8,
  },
  problemSearchText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
});

