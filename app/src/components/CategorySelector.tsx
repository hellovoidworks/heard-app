import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Text } from 'react-native';
import { Chip, useTheme, ActivityIndicator } from 'react-native-paper';
import { fontNames } from '../utils/fonts';

export interface Category {
  id: string;
  name: string;
  description?: string | null;
  color: string;
  created_at?: string;
}

interface CategorySelectorProps {
  categories: Category[];
  selectedCategories: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  loading?: boolean;
  selectionMode?: 'single' | 'multiple';
  minRequired?: number;
  maxAllowed?: number;
  showSelectionCount?: boolean;
  horizontal?: boolean;
  chipStyle?: object;
  containerStyle?: object;
}

const CategorySelector = ({
  categories,
  selectedCategories,
  onSelectionChange,
  loading = false,
  selectionMode = 'multiple',
  minRequired = 0,
  maxAllowed = Infinity,
  showSelectionCount = false,
  horizontal = false,
  chipStyle = {},
  containerStyle = {},
}: CategorySelectorProps) => {
  const theme = useTheme();
  const [internalSelection, setInternalSelection] = useState<string[]>(selectedCategories);

  // Update internal state when prop changes
  useEffect(() => {
    setInternalSelection(selectedCategories);
  }, [selectedCategories]);

  const toggleCategory = (categoryId: string) => {
    let newSelection: string[];

    if (selectionMode === 'single') {
      // In single selection mode, just select the clicked category
      newSelection = [categoryId];
    } else {
      // In multiple selection mode, toggle the selection
      if (internalSelection.includes(categoryId)) {
        // Remove if already selected
        newSelection = internalSelection.filter(id => id !== categoryId);
      } else {
        // Add if not selected and under max limit
        if (internalSelection.length < maxAllowed) {
          newSelection = [...internalSelection, categoryId];
        } else {
          // At max limit, don't add
          return;
        }
      }
    }

    setInternalSelection(newSelection);
    onSelectionChange(newSelection);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
      </View>
    );
  }

  // Determine the container component based on horizontal prop
  const Container = horizontal ? ScrollView : View;
  const containerProps = horizontal ? {
    horizontal: true,
    showsHorizontalScrollIndicator: false,
  } : {};

  return (
    <View style={[styles.wrapper, containerStyle]}>
      <Container
        {...containerProps}
        style={[
          horizontal ? styles.horizontalContainer : styles.gridContainer,
        ]}
      >
        {categories.map(category => {
          const color = category.color || theme.colors.primary;
          const isSelected = internalSelection.includes(category.id);
          
          return (
            <Chip
              key={category.id}
              selected={isSelected}
              onPress={() => toggleCategory(category.id)}
              selectedColor="#FFFFFF"
              showSelectedCheck={false}
              textStyle={{ 
                color: isSelected ? '#FFFFFF' : theme.colors.onSurface,
                fontFamily: fontNames.sourceCodeProSemiBold,
                textTransform: 'uppercase',
                fontSize: 14
              }}
              mode={isSelected ? 'flat' : 'outlined'}
              style={[
                styles.chip,
                isSelected 
                  ? { backgroundColor: color } 
                  : { borderColor: color + '80' }, // Add 50% transparency to the color
                chipStyle
              ]}
            >
              {category.name.toUpperCase()}
            </Chip>
          );
        })}
      </Container>
      
      {showSelectionCount && (
        <Text style={[styles.selectionCount, { color: theme.colors.onSurfaceVariant }]}>
          {internalSelection.length} of {categories.length} selected
          {minRequired > 0 && internalSelection.length < minRequired && ` (minimum ${minRequired})`}
          {maxAllowed < Infinity && ` (maximum ${maxAllowed})`}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 10,
  },
  horizontalContainer: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  chip: {
    margin: 5,
    borderRadius: 20,
  },
  selectionCount: {
    textAlign: 'center',
    marginTop: 5,
    fontSize: 12,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
});

export default CategorySelector;
