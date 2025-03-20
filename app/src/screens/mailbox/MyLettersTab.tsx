import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Text, Card, Title, Paragraph, ActivityIndicator, Chip, Button } from 'react-native-paper';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { format } from 'date-fns';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type Letter = {
  id: string;
  title: string;
  content: string;
  created_at: string;
  category: {
    id: string;
    name: string;
  } | null;
};

const MyLettersTab = () => {
  const [letters, setLetters] = useState<Letter[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp>();

  const fetchMyLetters = async () => {
    try {
      setLoading(true);
      
      if (!user) return;

      // Get all letters authored by the user
      const { data, error } = await supabase
        .from('letters')
        .select(`
          id,
          title,
          content,
          created_at,
          category:categories(id, name)
        `)
        .eq('author_id', user.id)
        .is('parent_id', null) // Only get top-level letters, not replies
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching letters:', error);
        return;
      }

      if (!data || data.length === 0) {
        setLetters([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Process the data to ensure category is correctly formatted
      const processedLetters = data.map(letter => ({
        id: letter.id,
        title: letter.title,
        content: letter.content,
        created_at: letter.created_at,
        category: Array.isArray(letter.category) 
          ? (letter.category.length > 0 ? letter.category[0] : null) 
          : letter.category
      }));

      setLetters(processedLetters as Letter[]);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMyLetters();
  }, [user]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchMyLetters();
  };

  const handleLetterPress = (letter: Letter) => {
    navigation.navigate('LetterDetail', { letterId: letter.id });
  };

  const renderLetterItem = ({ item }: { item: Letter }) => (
    <Card 
      style={styles.card} 
      onPress={() => handleLetterPress(item)}
    >
      <Card.Content>
        <Title>{item.title}</Title>
        <Paragraph numberOfLines={2}>{item.content}</Paragraph>
        <View style={styles.cardFooter}>
          {item.category && (
            <Chip icon="tag" style={styles.chip}>{item.category.name}</Chip>
          )}
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
            <Text style={styles.emptyText}>You haven't written any letters yet</Text>
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

export default MyLettersTab; 