import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export type PairedDevice = {
  id: string;
  name: string;
  baseUrl: string;
  token: string;
};

const STORAGE_KEY = 'streamline.remote.paired-devices.v1';

function isPairedDevice(value: unknown): value is PairedDevice {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.baseUrl === 'string' &&
    typeof candidate.token === 'string'
  );
}

export async function loadPairedDevices(): Promise<PairedDevice[]> {
  if (Platform.OS === 'web') return [];
  const stored = await SecureStore.getItemAsync(STORAGE_KEY);
  if (stored === null) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    throw new Error('Saved pairings could not be read. Remove the app data and pair your PCs again.');
  }
  if (!Array.isArray(parsed) || !parsed.every(isPairedDevice)) {
    throw new Error('Saved pairings are invalid. Remove the app data and pair your PCs again.');
  }
  return parsed;
}

export async function savePairedDevices(devices: PairedDevice[]): Promise<void> {
  if (Platform.OS === 'web') {
    throw new Error('Secure pairing storage is available in the iPhone app, not in this browser preview.');
  }
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(devices));
}

export async function clearPairedDevices(): Promise<void> {
  if (Platform.OS === 'web') return;
  await SecureStore.deleteItemAsync(STORAGE_KEY);
}
