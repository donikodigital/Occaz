// mobile/src/components/ui/ResponsiveList.tsx
import React from 'react';
import { FlatList, FlatListProps, StyleSheet, View } from 'react-native';
import { spacing } from '@/theme';
import { useResponsive } from '@/hooks/useResponsive';

export interface ResponsiveListProps<T> extends Omit<FlatListProps<T>, 'numColumns' | 'columnWrapperStyle'> {
  gap?: number;
}

/**
 * FlatList qui passe automatiquement de 1 colonne (mobile) à 2
 * (tablette) ou 3 (desktop large) — un seul endroit pour ce
 * comportement plutôt qu'un calcul de `numColumns` répété dans chaque
 * écran à liste. `key={columns}` est nécessaire : FlatList ne supporte
 * pas de changer `numColumns` sans être remonté (limite connue de RN).
 */
export function ResponsiveList<T>({
  data,
  renderItem,
  gap = spacing.sm,
  ItemSeparatorComponent,
  ...rest
}: ResponsiveListProps<T>) {
  const { columns } = useResponsive();

  if (columns <= 1) {
    return (
      <FlatList
        key="single-column"
        data={data}
        renderItem={renderItem}
        ItemSeparatorComponent={ItemSeparatorComponent}
        {...rest}
      />
    );
  }

  return (
    <FlatList
      key={`columns-${columns}`}
      data={data}
      numColumns={columns}
      columnWrapperStyle={[styles.row, { gap }]}
      renderItem={(info) => <View style={styles.cell}>{renderItem?.(info)}</View>}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'stretch',
  },
  cell: {
    flex: 1,
  },
});
