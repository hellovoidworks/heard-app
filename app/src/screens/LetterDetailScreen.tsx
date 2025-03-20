import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text, Card, Title, Paragraph, Chip, ActivityIndicator } from 'react-native-paper';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { LetterWithDetails } from '../types/database.types';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { format } from 'date-fns';

type Props = NativeStackScreenProps<RootStackParamList, 'LetterDetail'>;

const LetterDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { letterId } = route.params;
  const [letter, setLetter] = useState<LetterWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();

  const fetchLetter = async () => {
    try {
      setLoading(true);
      
      // Fetch the letter details
      const { data: letterData, error: letterError } = await supabase
        .from('letters')
        .select(`
          *,
          category:categories(*),
          author:user_profiles!letters_author_id_fkey(*)
        `)
        .eq('id', letterId)
        .single();

      if (letterError) {
        console.error('Error fetching letter:', letterError);
        return;
      }

      if (letterData) {
        setLetter(letterData as LetterWithDetails);
        
        // Record that the user has read this letter if they are logged in
        if (user && user.id !== letterData.author_id) {
          const { error: readError } = await supabase
            .from('letter_reads')
            .upsert([
              {
                user_id: user.id,
                letter_id: letterId,
                read_at: new Date().toISOString()
              }
            ], { 
              onConflict: 'user_id,letter_id',
              ignoreDuplicates: true 
            });
            
          if (readError) {
            console.error('Error recording letter read:', readError);
          }
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
    fetchLetter();
  }, [letterId, user]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchLetter();
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!letter) {
    return (
      <View style={styles.errorContainer}>
        <Text>Letter not found</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      <Card style={styles.letterCard}>
        <Card.Content>
          <Title style={styles.title}>{letter.title}</Title>
          
          <View style={styles.metaContainer}>
            <Chip icon="account" style={styles.chip}>{letter.display_name}</Chip>
            <Chip icon="tag" style={styles.chip}>{letter.category?.name}</Chip>
            <Text style={styles.date}>
              {format(new Date(letter.created_at), 'MMM d, yyyy')}
            </Text>
          </View>
          
          <Paragraph style={styles.content}>{letter.content}</Paragraph>
        </Card.Content>
      </Card>
    </ScrollView>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  letterCard: {
    margin: 16,
    elevation: 2,
  },
  title: {
    fontSize: 24,
    marginBottom: 12,
  },
  metaContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
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
  content: {
    fontSize: 16,
    lineHeight: 24,
  },
});

export default LetterDetailScreen; 