// mobile/src/components/screens/AnimatedSplash.tsx
//
// Écran d'intro animé, affiché juste après la disparition du splash
// natif (statique par nature — aucune animation n'est possible avant
// que le JS ne tourne, c'est une contrainte du système, pas de l'app).
// Celui-ci prend le relais pendant ~2s : quelques gouttes tombent,
// le pin atterrit avec un petit rebond, puis des vagues se propagent
// depuis sa base — avant de laisser place à l'app réelle.
//
// Ne dépend que de l'API Animated déjà fournie par React Native (pas
// de reanimated/lottie à installer).
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { colors } from '@/theme';

const PIN_SOURCE = require('../../../assets/images/pin-glyph.png');

const DROP_COUNT = 3;
const DROP_STAGGER_MS = 140;
const DROP_FALL_MS = 520;
const PIN_DROP_DELAY_MS = 260;
const PIN_FALL_MS = 650;
const RING_COUNT = 3;
const RING_STAGGER_MS = 220;
const RING_EXPAND_MS = 900;
const HOLD_MS = 250;
const FADE_OUT_MS = 320;

export function AnimatedSplash({ onFinish }: { onFinish: () => void }) {
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const pinTranslateY = useRef(new Animated.Value(-140)).current;
  const pinOpacity = useRef(new Animated.Value(0)).current;
  const pinScale = useRef(new Animated.Value(0.9)).current;
  const dropAnims = useRef(
    Array.from({ length: DROP_COUNT }, () => ({
      translateY: new Animated.Value(-60),
      opacity: new Animated.Value(0),
    })),
  ).current;
  const ringAnims = useRef(
    Array.from({ length: RING_COUNT }, () => ({
      scale: new Animated.Value(0.2),
      opacity: new Animated.Value(0),
    })),
  ).current;

  useEffect(() => {
    const dropAnimations = dropAnims.map((drop, index) =>
      Animated.sequence([
        Animated.delay(index * DROP_STAGGER_MS),
        Animated.parallel([
          Animated.timing(drop.opacity, {
            toValue: 1,
            duration: DROP_FALL_MS * 0.3,
            useNativeDriver: true,
          }),
          Animated.timing(drop.translateY, {
            toValue: 40,
            duration: DROP_FALL_MS,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(drop.opacity, {
            toValue: 0,
            duration: DROP_FALL_MS * 0.4,
            delay: DROP_FALL_MS * 0.6,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );

    const pinAnimation = Animated.sequence([
      Animated.delay(PIN_DROP_DELAY_MS),
      Animated.parallel([
        Animated.timing(pinOpacity, {
          toValue: 1,
          duration: PIN_FALL_MS * 0.4,
          useNativeDriver: true,
        }),
        Animated.spring(pinTranslateY, {
          toValue: 0,
          bounciness: 14,
          speed: 8,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(pinScale, {
            toValue: 1.08,
            duration: PIN_FALL_MS * 0.7,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.spring(pinScale, {
            toValue: 1,
            bounciness: 10,
            speed: 10,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]);

    const ringAnimations = ringAnims.map((ring, index) =>
      Animated.sequence([
        Animated.delay(PIN_DROP_DELAY_MS + PIN_FALL_MS + index * RING_STAGGER_MS),
        Animated.parallel([
          Animated.timing(ring.scale, {
            toValue: 1,
            duration: RING_EXPAND_MS,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(ring.opacity, {
              toValue: 0.55,
              duration: RING_EXPAND_MS * 0.2,
              useNativeDriver: true,
            }),
            Animated.timing(ring.opacity, {
              toValue: 0,
              duration: RING_EXPAND_MS * 0.8,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
        ]),
      ]),
    );

    const totalMs =
      PIN_DROP_DELAY_MS +
      PIN_FALL_MS +
      (RING_COUNT - 1) * RING_STAGGER_MS +
      RING_EXPAND_MS +
      HOLD_MS;

    Animated.parallel([...dropAnimations, pinAnimation, ...ringAnimations]).start();

    const fadeTimer = setTimeout(() => {
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: FADE_OUT_MS,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) onFinish();
      });
    }, totalMs);

    return () => clearTimeout(fadeTimer);
    // Ne doit tourner qu'une fois au montage — les Animated.Value sont stables (useRef).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: screenOpacity }]} pointerEvents="none">
      {dropAnims.map((drop, index) => (
        <Animated.View
          key={index}
          style={[
            styles.drop,
            {
              opacity: drop.opacity,
              transform: [{ translateX: (index - 1) * 22 }, { translateY: drop.translateY }],
            },
          ]}
        />
      ))}

      <View style={styles.rippleAnchor}>
        {ringAnims.map((ring, index) => (
          <Animated.View
            key={index}
            style={[
              styles.ring,
              {
                opacity: ring.opacity,
                transform: [{ scale: ring.scale }],
              },
            ]}
          />
        ))}
      </View>

      <Animated.Image
        source={PIN_SOURCE}
        resizeMode="contain"
        style={[
          styles.pin,
          {
            opacity: pinOpacity,
            transform: [{ translateY: pinTranslateY }, { scale: pinScale }],
          },
        ]}
      />
    </Animated.View>
  );
}

const PIN_WIDTH = 160;
const PIN_HEIGHT = 206;

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  pin: {
    width: PIN_WIDTH,
    height: PIN_HEIGHT,
  },
  drop: {
    position: 'absolute',
    top: '38%',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  rippleAnchor: {
    position: 'absolute',
    width: 1,
    height: 1,
    top: '50%',
    marginTop: PIN_HEIGHT / 2 - 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: colors.primary,
  },
});