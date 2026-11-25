import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { PairScanner } from '@/components/PairScanner';
import { RemotePad } from '@/components/RemotePad';
import { loadPairedDevices, savePairedDevices, type PairedDevice } from '@/lib/devices';
import {
  getRemoteStatus,
  pairWithComputer,
  parsePairingQr,
  remoteSocketUrl,
  sendRemoteAction,
  unpairComputer,
  type RemoteAction,
} from '@/lib/remote';

type ScreenState = 'loading' | 'devices' | 'remote';

function IconButton({
  icon,
  label,
  onPress,
  testID,
  disabled = false,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  onPress: () => void;
  testID: string;
  disabled?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.controlButton,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: disabled ? 0.48 : pressed ? 0.75 : 1 },
      ]}
    >
      <Feather name={icon} size={22} color={colors.foreground} />
      <Text style={[styles.controlLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </Pressable>
  );
}

function PairedDeviceCard({
  device,
  onConnect,
  onForget,
}: {
  device: PairedDevice;
  onConnect: () => void;
  onForget: () => void;
}) {
  const colors = useColors();
  return (
    <View style={[styles.deviceCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.deviceInfo}>
        <View style={[styles.deviceGlyph, { backgroundColor: colors.background }]}>
          <Feather name="monitor" size={20} color={colors.primary} />
        </View>
        <View style={styles.deviceText}>
          <Text numberOfLines={1} style={[styles.deviceName, { color: colors.foreground }]}>{device.name}</Text>
          <Text style={[styles.deviceSubtitle, { color: colors.mutedForeground }]}>Paired · same Wi-Fi required</Text>
        </View>
      </View>
      <View style={styles.deviceActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Control ${device.name}`}
          testID={`button-control-${device.id}`}
          onPress={onConnect}
          style={({ pressed }) => [
            styles.connectButton,
            { backgroundColor: colors.primary, opacity: pressed ? 0.78 : 1 },
          ]}
        >
          <Text style={[styles.connectText, { color: colors.primaryForeground }]}>Control</Text>
          <Feather name="arrow-up-right" size={16} color={colors.primaryForeground} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Forget ${device.name}`}
          testID={`button-forget-${device.id}`}
          onPress={onForget}
          style={styles.forgetButton}
        >
          <Feather name="trash-2" size={17} color={colors.mutedForeground} />
        </Pressable>
      </View>
    </View>
  );
}

function RemoteScreen({
  device,
  onBack,
}: {
  device: PairedDevice;
  onBack: () => void;
}) {
  const colors = useColors();
  const [connected, setConnected] = useState(false);
  const [busyAction, setBusyAction] = useState<RemoteAction | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const socketRef = useRef<WebSocket | null>(null);
  const statusQuery = useQuery({
    queryKey: ['remote-status', device.id],
    queryFn: () => getRemoteStatus(device),
    enabled: connected,
    retry: 1,
    refetchInterval: connected ? 30_000 : false,
  });
  const inputReady = statusQuery.data?.inputReady === true;
  const displayedMessage =
    statusMessage ||
    (connected && statusQuery.isPending
      ? 'Checking input access on this PC…'
      : statusQuery.error
        ? statusQuery.error instanceof Error
          ? statusQuery.error.message
          : 'The PC did not confirm its control status.'
        : connected && !inputReady
          ? 'Input access is not ready. Install the Streamline update, then sign out and back in.'
          : '');

  useEffect(() => {
    let mounted = true;
    setConnected(false);
    setStatusMessage('Connecting to your PC…');
    const socket = new WebSocket(remoteSocketUrl(device));
    socketRef.current = socket;
    socket.onopen = () => {
      if (!mounted) return;
      setConnected(true);
      setStatusMessage('');
    };
    socket.onmessage = (event) => {
      if (typeof event.data !== 'string') return;
      try {
        const message = JSON.parse(event.data) as { error?: unknown };
        if (typeof message.error === 'string' && mounted) setStatusMessage(message.error);
      } catch {
        // Ignore non-JSON control acknowledgements.
      }
    };
    socket.onerror = () => {
      if (mounted) {
        setConnected(false);
        setStatusMessage('Could not connect. Check that both devices are on the same Wi-Fi.');
      }
    };
    socket.onclose = () => {
      if (mounted) {
        setConnected(false);
        setStatusMessage((current) => current || 'Connection closed. Reconnect to the PC’s Wi-Fi.');
      }
    };
    return () => {
      mounted = false;
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      socket.close();
      socketRef.current = null;
    };
  }, [device, connectionAttempt]);

  const sendMove = useCallback((dx: number, dy: number) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: 'move', dx, dy }));
  }, []);

  const runAction = useCallback(async (action: Exclude<RemoteAction, 'unpair'>) => {
    if (!connected || !inputReady || busyAction) return;
    setBusyAction(action);
    setStatusMessage('');
    try {
      await sendRemoteAction(device, action);
      if (action === 'home') {
        setStatusMessage('The Streamline dashboard is opening on your PC.');
      }
      if (action === 'playPause' || action === 'click') {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'The command could not be sent.');
    } finally {
      setBusyAction(null);
    }
  }, [busyAction, connected, device, inputReady]);

  const click = useCallback(() => {
    void runAction('click');
  }, [runAction]);

  return (
    <View style={styles.remoteScreen}>
      <View style={styles.remoteHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to paired computers"
          testID="button-back-to-devices"
          onPress={onBack}
          style={styles.headerIcon}
        >
          <Feather name="chevron-left" size={25} color={colors.foreground} />
        </Pressable>
        <View style={styles.remoteHeading}>
          <Text numberOfLines={1} style={[styles.remoteTitle, { color: colors.foreground }]}>{device.name}</Text>
          <View style={styles.connectionLine}>
            <View style={[styles.connectionDot, { backgroundColor: connected ? colors.primary : colors.destructive }]} />
            <Text style={[styles.connectionText, { color: colors.mutedForeground }]}>
              {connected ? 'Connected on local Wi-Fi' : 'Not connected'}
            </Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reconnect"
          testID="button-reconnect"
          onPress={() => setConnectionAttempt((value) => value + 1)}
          style={styles.headerIcon}
        >
          <Feather name="refresh-cw" size={19} color={colors.foreground} />
        </Pressable>
      </View>

      {displayedMessage ? (
        <View style={[styles.statusBanner, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.statusText, { color: colors.mutedForeground }]}>{displayedMessage}</Text>
        </View>
      ) : null}

      <View style={styles.padSection}>
        <RemotePad connected={connected && inputReady} onMove={sendMove} onTap={click} />
      </View>

      <View style={styles.controls}>
        <IconButton
          icon="home"
          label="Dashboard"
          testID="button-dashboard-home"
          onPress={() => void runAction('home')}
          disabled={!connected || !inputReady || busyAction !== null}
        />
        <IconButton
          icon="play"
          label="Play / pause"
          testID="button-play-pause"
          onPress={() => void runAction('playPause')}
          disabled={!connected || !inputReady || busyAction !== null}
        />
        <IconButton
          icon="volume-1"
          label="Volume down"
          testID="button-volume-down"
          onPress={() => void runAction('volumeDown')}
          disabled={!connected || !inputReady || busyAction !== null}
        />
        <IconButton
          icon="volume-2"
          label="Volume up"
          testID="button-volume-up"
          onPress={() => void runAction('volumeUp')}
          disabled={!connected || !inputReady || busyAction !== null}
        />
      </View>
      <Text style={[styles.footerHint, { color: colors.mutedForeground }]}>
        Tap the pad to click. The Dashboard button returns Firefox to Streamline.
      </Text>
    </View>
  );
}

export default function RemoteHomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [screen, setScreen] = useState<ScreenState>('loading');
  const [devices, setDevices] = useState<PairedDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<PairedDevice | null>(null);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [pairing, setPairing] = useState(false);
  const [scannerError, setScannerError] = useState('');
  const [loadError, setLoadError] = useState('');

  const refreshDevices = useCallback(async () => {
    setLoadError('');
    try {
      const saved = await loadPairedDevices();
      setDevices(saved);
      setScreen('devices');
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Saved pairings could not be loaded.');
      setScreen('devices');
    }
  }, []);

  useEffect(() => {
    void refreshDevices();
  }, [refreshDevices]);

  const handleScan = async (data: string) => {
    setPairing(true);
    setScannerError('');
    try {
      const payload = parsePairingQr(data);
      const newDevice = await pairWithComputer(payload);
      const next = [newDevice, ...devices.filter((device) => device.id !== newDevice.id)];
      await savePairedDevices(next);
      setDevices(next);
      setScannerVisible(false);
      setSelectedDevice(newDevice);
      setScreen('remote');
    } catch (error) {
      setScannerError(error instanceof Error ? error.message : 'Pairing failed. Try scanning again.');
    } finally {
      setPairing(false);
    }
  };

  const openScanner = () => {
    setScannerError('');
    setScannerVisible(true);
  };

  const forgetDevice = (device: PairedDevice) => {
    Alert.alert(
      `Forget ${device.name}?`,
      'This removes its saved access token from this iPhone. If the PC is offline, revoke its saved phone entry from that PC’s Settings too.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Forget PC',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await unpairComputer(device);
              } catch {
                // The PC may be offline; removing the token from this phone still stops this app using it.
              }
              const next = devices.filter((item) => item.id !== device.id);
              try {
                await savePairedDevices(next);
                setDevices(next);
                if (selectedDevice?.id === device.id) {
                  setSelectedDevice(null);
                  setScreen('devices');
                }
              } catch (error) {
                setLoadError(error instanceof Error ? error.message : 'The PC could not be removed.');
              }
            })();
          },
        },
      ],
    );
  };

  const topPadding = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPadding = Platform.OS === 'web' ? 34 : insets.bottom;

  if (screen === 'remote' && selectedDevice) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: topPadding, paddingBottom: bottomPadding }]}>
        <StatusBar barStyle="light-content" />
        <RemoteScreen
          device={selectedDevice}
          onBack={() => setScreen('devices')}
        />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: topPadding, paddingBottom: bottomPadding }]}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        contentContainerStyle={styles.homeContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brand}>
          <Image source={require('../assets/images/icon.png')} style={styles.brandIcon} />
          <View>
            <Text style={[styles.brandName, { color: colors.foreground }]}>Streamline</Text>
            <Text style={[styles.brandLabel, { color: colors.mutedForeground }]}>REMOTE</Text>
          </View>
        </View>

        <View style={styles.homeHeading}>
          <Text style={[styles.pageTitle, { color: colors.foreground }]}>Your PCs</Text>
          <Text style={[styles.pageSubtitle, { color: colors.mutedForeground }]}>
            Pair each Streamline computer once. Choose one to control it on your local Wi-Fi.
          </Text>
        </View>

        {screen === 'loading' ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.pageSubtitle, { color: colors.mutedForeground }]}>Loading paired computers…</Text>
          </View>
        ) : (
          <>
            {loadError ? (
              <View style={[styles.errorCard, { borderColor: colors.destructive, backgroundColor: colors.card }]}>
                <Text style={[styles.errorText, { color: colors.destructive }]}>{loadError}</Text>
                <Pressable accessibilityRole="button" testID="button-retry-load" onPress={() => void refreshDevices()}>
                  <Text style={[styles.linkText, { color: colors.accent }]}>Try again</Text>
                </Pressable>
              </View>
            ) : null}

            {devices.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.emptyGlyph, { backgroundColor: colors.background }]}>
                  <Feather name="monitor" size={25} color={colors.primary} />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No PCs paired yet</Text>
                <Text style={[styles.emptyCopy, { color: colors.mutedForeground }]}>
                  Open Settings on a Streamline PC and scan its one-time QR code.
                </Text>
              </View>
            ) : (
              <View style={styles.deviceList}>
                {devices.map((device) => (
                  <PairedDeviceCard
                    key={device.id}
                    device={device}
                    onConnect={() => {
                      setSelectedDevice(device);
                      setScreen('remote');
                    }}
                    onForget={() => forgetDevice(device)}
                  />
                ))}
              </View>
            )}

            <Pressable
              accessibilityRole="button"
              testID="button-pair-computer"
              onPress={openScanner}
              style={({ pressed }) => [
                styles.pairButton,
                { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Feather name="plus" size={19} color={colors.primaryForeground} />
              <Text style={[styles.pairButtonText, { color: colors.primaryForeground }]}>Pair a Streamline PC</Text>
            </Pressable>
          </>
        )}

        <View style={[styles.privacyNote, { borderColor: colors.border }]}>
          <Feather name="shield" size={16} color={colors.primary} />
          <Text style={[styles.privacyText, { color: colors.mutedForeground }]}>
            Pairing stays on your local network. Control access is stored securely on this iPhone.
          </Text>
        </View>
      </ScrollView>
      <PairScanner
        visible={scannerVisible}
        busy={pairing}
        error={scannerError}
        onScan={(data) => void handleScan(data)}
        onClose={() => {
          setScannerVisible(false);
          setScannerError('');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  homeContent: { flexGrow: 1, paddingHorizontal: 22, paddingBottom: 20 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingTop: 8 },
  brandIcon: { width: 44, height: 44, borderRadius: 13 },
  brandName: { fontFamily: 'Manrope_700Bold', fontSize: 16 },
  brandLabel: { fontFamily: 'Manrope_700Bold', fontSize: 9, letterSpacing: 2.2, marginTop: 2 },
  homeHeading: { marginTop: 43, marginBottom: 23, gap: 9 },
  pageTitle: { fontFamily: 'Manrope_700Bold', fontSize: 33, letterSpacing: -1.3 },
  pageSubtitle: { fontFamily: 'Manrope_500Medium', fontSize: 14, lineHeight: 21 },
  loadingState: { minHeight: 220, alignItems: 'center', justifyContent: 'center', gap: 18 },
  emptyCard: { minHeight: 220, borderWidth: 1, borderRadius: 22, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyGlyph: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: 'Manrope_700Bold', fontSize: 17, marginTop: 4 },
  emptyCopy: { fontFamily: 'Manrope_500Medium', fontSize: 13, lineHeight: 19, textAlign: 'center', maxWidth: 270 },
  deviceList: { gap: 12 },
  deviceCard: { borderWidth: 1, borderRadius: 18, padding: 15, gap: 14 },
  deviceInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  deviceGlyph: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  deviceText: { flex: 1, gap: 3 },
  deviceName: { fontFamily: 'Manrope_700Bold', fontSize: 15 },
  deviceSubtitle: { fontFamily: 'Manrope_500Medium', fontSize: 11 },
  deviceActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  connectButton: { flex: 1, height: 43, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  connectText: { fontFamily: 'Manrope_700Bold', fontSize: 13 },
  forgetButton: { width: 43, height: 43, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  pairButton: { minHeight: 52, borderRadius: 16, marginTop: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  pairButtonText: { fontFamily: 'Manrope_700Bold', fontSize: 14 },
  privacyNote: { marginTop: 22, paddingTop: 16, borderTopWidth: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  privacyText: { flex: 1, fontFamily: 'Manrope_500Medium', fontSize: 11, lineHeight: 17 },
  errorCard: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 12, gap: 8 },
  errorText: { fontFamily: 'Manrope_600SemiBold', fontSize: 12, lineHeight: 18 },
  linkText: { fontFamily: 'Manrope_700Bold', fontSize: 12 },
  remoteScreen: { flex: 1, paddingHorizontal: 20, paddingBottom: 14 },
  remoteHeader: { minHeight: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  headerIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  remoteHeading: { flex: 1, alignItems: 'center', gap: 3 },
  remoteTitle: { fontFamily: 'Manrope_700Bold', fontSize: 16 },
  connectionLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  connectionDot: { width: 7, height: 7, borderRadius: 4 },
  connectionText: { fontFamily: 'Manrope_500Medium', fontSize: 10 },
  statusBanner: { borderWidth: 1, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 12, marginTop: 8 },
  statusText: { fontFamily: 'Manrope_500Medium', fontSize: 11, lineHeight: 16, textAlign: 'center' },
  padSection: { flex: 1, paddingTop: 20, paddingBottom: 18 },
  controls: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  controlButton: { flex: 1, minHeight: 74, borderWidth: 1, borderRadius: 17, alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 3 },
  controlLabel: { fontFamily: 'Manrope_600SemiBold', fontSize: 9, textAlign: 'center' },
  footerHint: { fontFamily: 'Manrope_500Medium', fontSize: 10, lineHeight: 15, textAlign: 'center', paddingTop: 13, paddingHorizontal: 5 },
});
