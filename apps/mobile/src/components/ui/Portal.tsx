import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { create } from 'zustand';

interface PortalState {
  nodes: Record<string, ReactNode>;
  set: (id: string, node: ReactNode) => void;
  remove: (id: string) => void;
}

export const usePortals = create<PortalState>((set) => ({
  nodes: {},
  set: (id, node) => set((s) => ({ nodes: { ...s.nodes, [id]: node } })),
  remove: (id) =>
    set((s) => {
      if (!(id in s.nodes)) return s;
      const { [id]: _removed, ...rest } = s.nodes;
      return { nodes: rest };
    }),
}));

/**
 * Draws whatever sheets publish, above the whole app. Mount it once, last, inside
 * the providers. It replaces React Native's Modal, which on Android (new
 * architecture) can come up as a tiny square in the top-left corner.
 */
export function PortalHost() {
  const nodes = usePortals((s) => s.nodes);
  const entries = Object.entries(nodes);
  if (entries.length === 0) return null;
  return (
    <View pointerEvents="box-none" style={styles.host}>
      {entries.map(([id, node]) => (
        <View key={id} pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          {node}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  host: { ...StyleSheet.absoluteFillObject, zIndex: 1000, elevation: 1000 },
});
