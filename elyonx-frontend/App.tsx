import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';
import { MixerScreen } from './src/screens/MixerScreen';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,       // OSC pushes updates; don't auto-refetch
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <View style={styles.root}>
        <MixerScreen />
      </View>
    </QueryClientProvider>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

export default App;
