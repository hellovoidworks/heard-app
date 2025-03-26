import React, { useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Text, Card, Title, Paragraph, ActivityIndicator, Button } from 'react-native-paper';
import { Category } from '../types/database.types';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useCategories } from '../contexts/CategoryContext';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const CategoriesScreen = () => {
  const { categories, loading, refreshCategories } = useCategories();
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation<NavigationProp>();

  const handleRefresh = () => {
    setRefreshing(true);
    refreshCategories().finally(() => setRefreshing(false));
  };

  const handleCategoryPress = (category: Category) => {
    // Navigate to write letter screen with the selected category
    navigation.navigate('WriteLetter', { 
      categoryId: category.id 
      // We can't pass the category object directly due to type restrictions
    });
  };

  const renderCategoryItem = ({ item }: { item: Category }) => (
    <Card style={styles.card} onPress={() => handleCategoryPress(item)}>
      <Card.Content>
        <Title>{item.name}</Title>
        <Paragraph>{item.description}</Paragraph>
      </Card.Content>
      <Card.Actions>
        <Button onPress={() => handleCategoryPress(item)}>Write Letter</Button>
      </Card.Actions>
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
        data={categories as Category[]}
        renderItem={renderCategoryItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No categories found</Text>
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
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
});

export default CategoriesScreen; 