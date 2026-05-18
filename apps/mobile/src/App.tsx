import React from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

export function App() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.center}>
        <Text style={styles.title}>OpenCut</Text>
        <Text style={styles.subtitle}>Local-first mobile video editor</Text>
        <Text style={styles.status}>WebGPU compositor via expo-gl</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#a0a0a0',
    marginBottom: 16,
  },
  status: {
    fontSize: 14,
    color: '#666',
  },
});
