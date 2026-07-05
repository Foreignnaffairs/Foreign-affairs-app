import { memo } from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { colors, fonts, font, spacing, radius } from "@/src/theme";
import { Flight, formatDeparture } from "@/src/api";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  flight: Flight;
  onPress: () => void;
  index: number;
  past?: boolean;
};

function FlightCardBase({ flight, onPress, index, past }: Props) {
  const { date, time } = formatDeparture(flight.departure);
  const fromPrice = Math.min(...flight.classes.map((c) => c.price));

  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View entering={FadeInDown.delay(index * 90).duration(450).springify().damping(18)}>
    <AnimatedPressable
      testID={`flight-card-${flight.id}`}
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.97, { damping: 18, stiffness: 220 });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: 180 });
      }}
      style={[styles.card, animStyle]}
    >
      <Image
        source={{ uri: flight.image_url }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={300}
      />
      <LinearGradient
        colors={["rgba(9,9,11,0.15)", "rgba(9,9,11,0.55)", "rgba(9,9,11,0.94)"]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Top row: flight number + date */}
      <View style={styles.topRow}>
        <View style={styles.badge}>
          <Text style={styles.flightNo}>{flight.flight_number}</Text>
        </View>
        {past ? (
          <View style={styles.landedBadge}>
            <Text style={styles.landedText}>● LANDED</Text>
          </View>
        ) : (
          <Text style={styles.dateText}>
            {date} · {time}
          </Text>
        )}
      </View>

      {/* Bottom content */}
      <View style={styles.bottom}>
        <Text style={styles.label}>DESTINATION</Text>
        <Text style={styles.destination}>{flight.destination}</Text>
        <Text style={styles.tagline}>{flight.tagline}</Text>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>PILOT</Text>
            <Text style={styles.metaValue}>{flight.pilot}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>GATE</Text>
            <Text style={styles.metaValue}>{flight.gate}</Text>
          </View>
          <View style={[styles.metaItem, { alignItems: "flex-end", flex: 0 }]}>
            <Text style={styles.metaLabel}>{past ? "GALLERY" : "FROM"}</Text>
            <Text style={styles.priceValue}>
              {past
                ? flight.gallery_url
                  ? "PHOTOS"
                  : "RECAP"
                : fromPrice === 0
                  ? "FREE"
                  : "₱" + fromPrice.toLocaleString("en-PH")}
            </Text>
          </View>
        </View>
      </View>
    </AnimatedPressable>
    </Animated.View>
  );
}

export const FlightCard = memo(FlightCardBase);

const styles = StyleSheet.create({
  card: {
    height: 320,
    borderRadius: radius.lg,
    overflow: "hidden",
    marginBottom: spacing.lg,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.lg,
  },
  badge: {
    backgroundColor: "rgba(9,9,11,0.55)",
    borderColor: colors.brand,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.sm,
  },
  flightNo: {
    fontFamily: fonts.monoBold,
    color: colors.brand,
    fontSize: font.sm,
    letterSpacing: 1,
  },
  dateText: {
    fontFamily: fonts.mono,
    color: colors.onSurface,
    fontSize: font.sm,
    letterSpacing: 0.5,
  },
  landedBadge: {
    backgroundColor: "rgba(9,9,11,0.55)",
    borderColor: colors.onSurfaceSecondary,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.sm,
  },
  landedText: {
    fontFamily: fonts.monoBold,
    color: colors.onSurfaceSecondary,
    fontSize: 10,
    letterSpacing: 1.5,
  },
  bottom: {
    marginTop: "auto",
    padding: spacing.lg,
  },
  label: {
    fontFamily: fonts.mono,
    color: colors.brandSecondary,
    fontSize: 10,
    letterSpacing: 3,
    marginBottom: 2,
  },
  destination: {
    fontFamily: fonts.display,
    color: colors.onSurface,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -1,
  },
  tagline: {
    fontFamily: fonts.displayMedium,
    color: colors.onSurfaceSecondary,
    fontSize: font.base,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: "row",
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.12)",
  },
  metaItem: { flex: 1 },
  metaLabel: {
    fontFamily: fonts.mono,
    color: colors.onSurfaceSecondary,
    fontSize: 9,
    letterSpacing: 2,
    marginBottom: 3,
  },
  metaValue: {
    fontFamily: fonts.monoBold,
    color: colors.onSurface,
    fontSize: font.base,
  },
  priceValue: {
    fontFamily: fonts.monoBold,
    color: colors.brand,
    fontSize: font.base,
  },
});
