import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { colors, fonts, font, spacing, radius, priceLabel } from "@/src/theme";
import { api, Flight, Seat } from "@/src/api";

const RATIO = 1.0; // floor plan aspect (h / w)

export default function SeatMap() {
  const { flightId, classKey } = useLocalSearchParams<{
    flightId: string;
    classKey: string;
  }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [flight, setFlight] = useState<Flight | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [width, setWidth] = useState(0);

  const load = useCallback(async () => {
    const data = await api.getFlight(flightId);
    setFlight(data);
  }, [flightId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!flight) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  const seatClass = flight.classes.find((c) => c.key === classKey)!;
  const isFirst = classKey === "first";
  const unitLabel = isFirst ? "booth" : "table";
  const height = width * RATIO;

  const classSeats = flight.seats.filter((s) => s.class_key === classKey);
  const availCount = classSeats.filter((s) => s.status === "available").length;
  const totalCount = classSeats.length;
  const lowStock = availCount <= Math.ceil(totalCount / 3);
  const urgent = availCount > 0 && availCount <= 2;
  const availColor = availCount === 0 ? colors.error : lowStock ? colors.brand : colors.success;
  const availText =
    availCount === 0
      ? `All ${unitLabel}s booked`
      : urgent
        ? `Only ${availCount} ${unitLabel}${availCount > 1 ? "s" : ""} left`
        : lowStock
          ? `${availCount} of ${totalCount} ${unitLabel}s left · selling fast`
          : `${availCount} of ${totalCount} ${unitLabel}s available`;

  const toggle = (seat: Seat) => {
    if (seat.class_key !== classKey || seat.status === "booked") return;
    Haptics.selectionAsync();
    setSelected((prev) =>
      prev.includes(seat.label)
        ? prev.filter((l) => l !== seat.label)
        : [...prev, seat.label]
    );
  };

  const total = seatClass.price * selected.length;

  const onLayout = (e: LayoutChangeEvent) =>
    setWidth(e.nativeEvent.layout.width);

  const proceed = () => {
    if (selected.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: "/checkout",
      params: {
        flightId: flight.id,
        classKey,
        seatLabels: selected.join(","),
      },
    });
  };

  const selectedNames = flight.seats
    .filter((s) => selected.includes(s.label))
    .map((s) => s.name)
    .join(", ");

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="seatmap-back" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <View style={{ alignItems: "center" }}>
          <Text style={styles.topTitle}>SELECT YOUR {unitLabel.toUpperCase()}</Text>
          <Text style={styles.topSub}>
            {flight.flight_number} · {flight.destination} · {seatClass.name}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: 140 + insets.bottom,
        }}
      >
        {/* Live availability */}
        <View testID="availability-banner" style={styles.availBanner}>
          <View style={[styles.availPulse, { backgroundColor: availColor }]} />
          <Text style={[styles.availText, { color: availColor }]}>{availText}</Text>
          {(lowStock && availCount > 0) && (
            <Ionicons name="flame" size={14} color={colors.brand} style={{ marginLeft: 4 }} />
          )}
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          <LegendDot color={colors.surfaceTertiary} border={colors.brand} label="Available" />
          <LegendDot color={colors.brand} border={colors.brand} label="Selected" />
          <LegendDot color="#161618" border={colors.border} label="Booked" />
        </View>

        {/* Floor plan */}
        <View style={styles.plan} onLayout={onLayout}>
          <View style={{ width: "100%", height }}>
            {/* Decorative venue features */}
            <Feature style={styles.djBooth} label="DJ BOOTH" vertical />
            <Feature style={styles.bar} label="BAR" />
            <Feature style={styles.entrance} label="ENTRANCE" />
            <Feature style={styles.men} label="WC" />
            <Feature style={styles.women} label="WC" />

            {width > 0 &&
              flight.seats.map((seat) => {
                const mine = seat.class_key === classKey;
                const booked = seat.status === "booked";
                const isSel = selected.includes(seat.label);
                const size = seat.class_key === "first" ? 58 : 48;
                return (
                  <Pressable
                    key={seat.label}
                    testID={`seat-${seat.label}`}
                    onPress={() => toggle(seat)}
                    disabled={!mine || booked}
                    style={[
                      styles.seat,
                      {
                        width: size,
                        height: size,
                        left: seat.x * width - size / 2,
                        top: seat.y * height - size / 2,
                        borderRadius: seat.class_key === "first" ? 12 : size / 2,
                      },
                      mine ? styles.seatMine : styles.seatOther,
                      mine && !booked && !isSel && lowStock && styles.seatGlow,
                      booked && styles.seatBooked,
                      isSel && styles.seatSelected,
                    ]}
                  >
                    {isSel ? (
                      <Ionicons name="checkmark" size={18} color={colors.onBrand} />
                    ) : booked ? (
                      <Ionicons
                        name="close"
                        size={14}
                        color={colors.onSurfaceSecondary}
                      />
                    ) : (
                      <Text
                        style={[
                          styles.seatLabel,
                          !mine && { color: colors.onSurfaceSecondary },
                          seat.class_key === "first" && styles.seatLabelFirst,
                        ]}
                        numberOfLines={1}
                      >
                        {seat.class_key === "first"
                          ? seat.label.replace("FC", "FC ")
                          : seat.label}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
          </View>
        </View>

        <Text style={styles.hint}>
          {isFirst
            ? "Tap a booth to reserve it. First Class booths seat up to 10."
            : "Tap a table to reserve it. Cocktail tables seat 3–6, bottle included."}
        </Text>
      </ScrollView>

      {/* Sticky CTA */}
      <View style={[styles.cta, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={{ flex: 1, marginRight: spacing.md }}>
          <Text style={styles.ctaLabel}>
            {selected.length
              ? `${selected.length} ${unitLabel}${selected.length > 1 ? "s" : ""} · ${priceLabel(total)}`
              : `Select a ${unitLabel}`}
          </Text>
          <Text style={styles.ctaNames} numberOfLines={1}>
            {selectedNames || "None selected yet"}
          </Text>
        </View>
        <Pressable
          testID="seatmap-continue"
          onPress={proceed}
          disabled={selected.length === 0}
          style={[styles.continueBtn, selected.length === 0 && styles.continueDisabled]}
        >
          <Text style={styles.continueText}>CONTINUE</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.onBrand} />
        </Pressable>
      </View>
    </View>
  );
}

function LegendDot({
  color,
  border,
  label,
}: {
  color: string;
  border: string;
  label: string;
}) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color, borderColor: border }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function Feature({
  style,
  label,
  vertical,
}: {
  style: any;
  label: string;
  vertical?: boolean;
}) {
  return (
    <View style={[styles.feature, style]}>
      <Text style={[styles.featureText, vertical && styles.featureTextVertical]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { alignItems: "center", justifyContent: "center" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSecondary,
  },
  topTitle: {
    fontFamily: fonts.monoBold,
    color: colors.onSurface,
    fontSize: font.sm,
    letterSpacing: 2,
  },
  topSub: {
    fontFamily: fonts.mono,
    color: colors.onSurfaceSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  availBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  availPulse: { width: 8, height: 8, borderRadius: 4 },
  availText: {
    fontFamily: fonts.monoBold,
    fontSize: font.sm,
    letterSpacing: 0.5,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5 },
  legendText: {
    fontFamily: fonts.mono,
    color: colors.onSurfaceSecondary,
    fontSize: 11,
  },
  plan: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    padding: spacing.sm,
    overflow: "hidden",
  },
  feature: {
    position: "absolute",
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  featureText: {
    fontFamily: fonts.mono,
    color: colors.onSurfaceSecondary,
    fontSize: 9,
    letterSpacing: 1,
  },
  featureTextVertical: { transform: [{ rotate: "-90deg" }], width: 80, textAlign: "center" },
  djBooth: { left: "0%", top: "34%", width: "8%", height: "26%" },
  bar: { left: "6%", top: "90%", width: "66%", height: "6%" },
  entrance: { left: "62%", top: "4%", width: "22%", height: "10%" },
  men: { left: "90%", top: "24%", width: "8%", height: "12%" },
  women: { left: "90%", top: "78%", width: "8%", height: "12%" },
  seat: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  seatMine: {
    backgroundColor: colors.surfaceTertiary,
    borderColor: colors.brand,
  },
  seatGlow: {
    borderColor: colors.brandSecondary,
    shadowColor: colors.brand,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  seatOther: {
    backgroundColor: "#161618",
    borderColor: colors.border,
    opacity: 0.45,
  },
  seatBooked: {
    backgroundColor: "#161618",
    borderColor: colors.border,
    opacity: 0.8,
  },
  seatSelected: {
    backgroundColor: colors.brand,
    borderColor: colors.brandSecondary,
  },
  seatLabel: {
    fontFamily: fonts.monoBold,
    color: colors.onSurface,
    fontSize: 13,
  },
  seatLabelFirst: { fontSize: 10, color: colors.brand },
  hint: {
    fontFamily: fonts.mono,
    color: colors.onSurfaceSecondary,
    fontSize: font.sm,
    textAlign: "center",
    marginTop: spacing.lg,
    lineHeight: 18,
    paddingHorizontal: spacing.lg,
  },
  cta: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  ctaLabel: {
    fontFamily: fonts.monoBold,
    color: colors.onSurface,
    fontSize: font.base,
  },
  ctaNames: {
    fontFamily: fonts.mono,
    color: colors.onSurfaceSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  continueBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md + 2,
    borderRadius: 999,
  },
  continueDisabled: { opacity: 0.4 },
  continueText: {
    fontFamily: fonts.monoBold,
    color: colors.onBrand,
    letterSpacing: 1.5,
    fontSize: font.base,
  },
});
