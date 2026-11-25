import { useMemo, useRef } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

type RemotePadProps = {
  connected: boolean;
  onMove: (dx: number, dy: number) => void;
  onTap: () => void;
};

export function RemotePad({ connected, onMove, onTap }: RemotePadProps) {
  const colors = useColors();
  const lastPoint = useRef({ x: 0, y: 0 });
  const remainder = useRef({ x: 0, y: 0 });
  const moved = useRef(false);
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => connected,
        onMoveShouldSetPanResponder: () => connected,
        onPanResponderGrant: () => {
          lastPoint.current = { x: 0, y: 0 };
          remainder.current = { x: 0, y: 0 };
          moved.current = false;
        },
        onPanResponderMove: (_event, gesture) => {
          const rawX = gesture.dx - lastPoint.current.x;
          const rawY = gesture.dy - lastPoint.current.y;
          lastPoint.current = { x: gesture.dx, y: gesture.dy };
          if (Math.abs(gesture.dx) + Math.abs(gesture.dy) > 5) moved.current = true;

          remainder.current.x += rawX * 1.8;
          remainder.current.y += rawY * 1.8;
          const dx = Math.trunc(remainder.current.x);
          const dy = Math.trunc(remainder.current.y);
          remainder.current.x -= dx;
          remainder.current.y -= dy;
          if (dx !== 0 || dy !== 0) onMove(dx, dy);
        },
        onPanResponderRelease: () => {
          if (connected && !moved.current) onTap();
        },
        onPanResponderTerminate: () => {
          moved.current = true;
        },
      }),
    [connected, onMove, onTap],
  );

  return (
    <View
      {...panResponder.panHandlers}
      accessible
      accessibilityRole="button"
      accessibilityLabel="Trackpad. Slide to move the pointer. Tap to left click."
      accessibilityState={{ disabled: !connected }}
      testID="remote-trackpad"
      style={[
        styles.pad,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: connected ? 1 : 0.55,
        },
      ]}
    >
      <View style={[styles.orbit, { borderColor: colors.primary }]} />
      <View style={[styles.pointer, { backgroundColor: colors.background, borderColor: colors.primary }]}>
        <Feather name="mouse-pointer" size={27} color={colors.primary} />
      </View>
      <Text style={[styles.label, { color: colors.foreground }]}>Slide to move</Text>
      <Text style={[styles.hint, { color: colors.mutedForeground }]}>Tap anywhere to left-click</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: {
    flex: 1,
    minHeight: 220,
    borderWidth: 1,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    gap: 9,
  },
  orbit: {
    position: 'absolute',
    width: 148,
    height: 148,
    borderWidth: 1,
    borderRadius: 74,
    opacity: 0.22,
  },
  pointer: {
    width: 66,
    height: 66,
    borderWidth: 1,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 9,
  },
  label: { fontFamily: 'Manrope_700Bold', fontSize: 17 },
  hint: { fontFamily: 'Manrope_500Medium', fontSize: 12 },
});
