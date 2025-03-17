import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Text, Card, Title, Paragraph, ActivityIndicator, Chip, Button } from 'react-native-paper';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Letter, LetterWithDetails } from '../types/database.types';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { format } from 'date-fns';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const HomeScreen = () => {
  const [letters, setLetters] = useState<LetterWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp>();

  const fetchLetters = async () => {
    try {
      setLoading(true);
      
      // Fetch letters with category and author details
      const { data, error } = await supabase
        .from('letters')
        .select(`
          *,
          category:categories(*),
          author:user_profiles(*)
        `)
        .is('parent_id', null) // Only get top-level letters, not replies
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching letters:', error);
        return;
      }

      if (data) {
        // Check which letters the user has read
        if (user) {
          const { data: readData } = await supabase
            .from('letter_reads')
            .select('letter_id')
            .eq('user_id', user.id);

          const readLetterIds = readData ? readData.map(item => item.letter_id) : [];
          
          // Mark letters as read or unread
          const lettersWithReadStatus = data.map(letter => ({
            ...letter,
            is_read: readLetterIds.includes(letter.id)
          }));
          
          setLetters(lettersWithReadStatus as LetterWithDetails[]);
        } else {
          setLetters(data as LetterWithDetails[]);
        }
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLetters();
  }, [user]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchLetters();
  };

  const handleLetterPress = async (letter: LetterWithDetails) => {
    // Navigate to letter detail
    navigation.navigate('LetterDetail', { letterId: letter.id });

    // Mark letter as read if user is logged in
    if (user && !letter.is_read) {
      try {
        await supabase.from('letter_reads').insert([
          {
            user_id: user.id,
            letter_id: letter.id,
          },
        ]);
      } catch (error) {
        console.error('Error marking letter as read:', error);
      }
    }
  };

  const renderLetterItem = ({ item }: { item: LetterWithDetails }) => (
    <Card 
      style={[styles.card, !item.is_read && styles.unreadCard]} 
      onPress={() => handleLetterPress(item)}
    >
      <Card.Content>
        <View style={styles.headerRow}>
          <Title>{item.title}</Title>
          {!item.is_read && <View style={styles.unreadDot} />}
        </View>
        <Paragraph numberOfLines={3}>{item.content}</Paragraph>
        <View style={styles.cardFooter}>
          <Chip icon="account" style={styles.chip}>{item.display_name}</Chip>
          <Chip icon="tag" style={styles.chip}>{item.category?.name}</Chip>
          <Text style={styles.date}>
            {format(new Date(item.created_at), 'MMM d, yyyy')}
          </Text>
        </View>
      </Card.Content>
    </Card>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={letters}
        renderItem={renderLetterItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No letters found</Text>
            <Button 
              mode="contained" 
              onPress={() => navigation.navigate('WriteLetter', {})}
              style={styles.writeButton}
            >
              Write a Letter
            </Button>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
  },
  card: {
    marginBottom: 16,
    elevation: 2,
  },
  unreadCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#6200ee',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#6200ee',
  },
  cardFooter: {
    flexDirection: 'row',
    marginTop: 12,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  chip: {
    marginRight: 8,
    marginBottom: 4,
  },
  date: {
    fontSize: 12,
    color: '#666',
    marginLeft: 'auto',
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  writeButton: {
    marginTop: 10,
  },
});

export default HomeScreen; 