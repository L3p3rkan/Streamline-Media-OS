import { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

type PairScannerProps = {
  visible: boolean;
  busy: boolean;
  error: string;
  onScan: (data: string) => void;
  onClose: () => void;
};

export function PairScanner({ visible, busy, error, onScan, onClose }: PairScannerProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [hasScanned, setHasScanned] = useState(false);

  const handleScan = ({ data }: { data: string }) => {
    if (hasScanned || busy) return;
    setHasScanned(true);
    onScan(data);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View
        style={[
          styles.screen,
          {
            backgroundColor: colors.background,
            paddingTop: Platform.OS === 'web' ? 67 : insets.top,
            paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom,
          },
        ]}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close QR scanner"
            testID="button-close-scanner"
            onPress={onClose}
            style={styles.iconButton}
          >
            <Feather name="x" size={22} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Pair a PC</Text>
          <View style={styles.iconButton} />
        </View>

        <View style={styles.instructions}>
          <Text style={[styles.title, { color: colors.foreground }]}>Scan its QR code</Text>
          <Text style={[styles.copy, { color: colors.mutedForeground }]}>
            On the Streamline dashboard, open Settings and choose Remote control.
          </Text>
        </View>

        <View style={[styles.cameraFrame, { borderColor: colors.border, backgroundColor: colors.card }]}>
          {Platform.OS === 'web' ? (
            <View style={styles.permissionState}>
              <Feather name="smartphone" size={32} color={colors.primary} />
              <Text style={[styles.stateTitle, { color: colors.foreground }]}>Use the iPhone app</Text>
              <Text style={[styles.copy, { color: colors.mutedForeground }]}>
                QR pairing uses the iPhone camera and secure device storage.
              </Text>
            </View>
          ) : permission?.granted ? (
            <>
              <CameraView
                style={StyleSheet.absoluteFill}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={hasScanned ? undefined : handleScan}
              />
              <View pointerEvents="none" style={styles.scanTarget}>
                <View style={[styles.scanCorner, styles.topLeft, { borderColor: colors.accent }]} />
                <View style={[styles.scanCorner, styles.topRight, { borderColor: colors.accent }]} />
                <View style={[styles.scanCorner, styles.bottomLeft, { borderColor: colors.accent }]} />
                <View style={[styles.scanCorner, styles.bottomRight, { borderColor: colors.accent }]} />
              </View>
              {busy && (
                <View style={[styles.busyOverlay, { backgroundColor: colors.background, opacity: 0.96 }]}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={[styles.copy, { color: colors.foreground }]}>Pairing securely…</Text>
                </View>
              )}
            </>
          ) : (
            <View style={styles.permissionState}>
              <Feather name="camera" size={30} color={colors.primary} />
              <Text style={[styles.stateTitle, { color: colors.foreground }]}>Camera access is needed</Text>
              <Text style={[styles.copy, { color: colors.mutedForeground }]}>
                The camera is used only to scan a one-time code shown on your PC.
              </Text>
              {permission?.status === 'denied' && !permission.canAskAgain ? (
                <Pressable
                  accessibilityRole="button"
                  testID="button-open-camera-settings"
                  style={[styles.actionButton, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    if (Platform.OS !== 'web') void Linking.openSettings().catch(() => undefined);
                  }}
                >
                  <Text style={[styles.actionText, { color: colors.primaryForeground }]}>Open iPhone Settings</Text>
                </Pressable>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  testID="button-request-camera"
                  style={[styles.actionButton, { backgroundColor: colors.primary }]}
                  onPress={() => void requestPermission()}
                >
                  <Text style={[styles.actionText, { color: colors.primaryForeground }]}>Allow camera</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>

        {error ? (
          <View style={[styles.errorBox, { borderColor: colors.destructive }]}>
            <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
            <Pressable
              accessibilityRole="button"
              testID="button-scan-again"
              onPress={() => setHasScanned(false)}
            >
              <Text style={[styles.retryText, { color: colors.accent }]}>Scan again</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={[styles.networkNote, { color: colors.mutedForeground }]}>
            Both devices must be on the same Wi-Fi. Some campus networks block device-to-device connections.
          </Text>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 22, gap: 18 },
  header: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: 'Manrope_700Bold', fontSize: 17 },
  instructions: { gap: 7, paddingTop: 10 },
  title: { fontFamily: 'Manrope_700Bold', fontSize: 26, letterSpacing: -0.8 },
  copy: { fontFamily: 'Manrope_500Medium', fontSize: 14, lineHeight: 21, textAlign: 'center' },
  cameraFrame: { flex: 1, maxHeight: 520, minHeight: 280, borderWidth: 1, borderRadius: 24, overflow: 'hidden' },
  permissionState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14 },
  stateTitle: { fontFamily: 'Manrope_700Bold', fontSize: 17, textAlign: 'center' },
  actionButton: { minHeight: 48, paddingHorizontal: 20, justifyContent: 'center', borderRadius: 14, marginTop: 8 },
  actionText: { fontFamily: 'Manrope_700Bold', fontSize: 14 },
  scanTarget: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  scanCorner: { position: 'absolute', width: 46, height: 46, borderWidth: 4 },
  topLeft: { top: '29%', left: '18%', borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 13 },
  topRight: { top: '29%', right: '18%', borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 13 },
  bottomLeft: { bottom: '29%', left: '18%', borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 13 },
  bottomRight: { bottom: '29%', right: '18%', borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 13 },
  busyOverlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 14 },
  errorBox: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 },
  errorText: { fontFamily: 'Manrope_600SemiBold', fontSize: 13, lineHeight: 19 },
  retryText: { fontFamily: 'Manrope_700Bold', fontSize: 13 },
  networkNote: { fontFamily: 'Manrope_500Medium', fontSize: 12, lineHeight: 18, textAlign: 'center', paddingHorizontal: 4 },
});
