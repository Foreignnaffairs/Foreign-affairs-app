import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { colors, fonts, font, spacing, radius, peso } from "@/src/theme";
import { api, Flight, SeatClass, formatDeparture } from "@/src/api";

export default function FlightDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [flight, setFlight] = useState<Flight | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedKey, setSelectedKey] = useState<string>("economy");
  const [qty, setQty] = useState(1);

  const load = useCallback(async () => {
    try {
      const data = await api.getFlight(id);
      setFlight(data);
      setSelectedKey(data.classes[0]?.key ?? "economy");
    } catch {
      setFlight(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  if (!flight) {
    return (
      <View style={[styles.container, styles.center, { padding: spacing.xl }]}>
        <Text style={styles.errTitle}>Failed to load flight manifest</Text>
        <Pressable style={styles.backChip} onPress={() => router.back()}>
          <Text style={styles.backChipText}>GO BACK</Text>
        </Pressable>
      </View>
    );
  }

  const selected = flight.classes.find((c) => c.key === selectedKey)!;
  const remaining = selected.capacity - selected.booked;
  const soldOut = remaining <= 0;
  const total = selected.price * qty;
  const { date, time } = formatDeparture(flight.departure);

  const book = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: "/checkout",
      params: {
        flightId: flight.id,
        classKey: selected.key,
        qty: String(qty),
      },
    });
  };

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 160 }}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <Image
            source={{ uri: flight.image_url }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={300}
          />
          <LinearGradient
            colors={["rgba(9,9,11,0.4)", "rgba(9,9,11,0.2)", "rgba(9,9,11,1)"]}
            locations={[0, 0.5, 1]}
            style={StyleSheet.absoluteFill}
          />
          <Pressable
            testID="back-button"
            onPress={() => router.back()}
            style={[styles.backBtn, { top: insets.top + spacing.sm }]}
          >
            <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
          </Pressable>

          <View style={styles.heroContent}>
            <Text style={styles.flightNo}>{flight.flight_number}</Text>
            <Text style={styles.destination}>{flight.destination}</Text>
            <Text style={styles.tagline}>{flight.tagline}</Text>
            <View style={styles.genreRow}>
              {flight.genres.map((g) => (
                <View key={g} style={styles.genreChip}>
                  <Text style={styles.genreText}>{g}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Flight info strip */}
        <View style={styles.infoStrip}>
          <Info label="DATE" value={date} />
          <Info label="BOARDING" value={time} />
          <Info label="PILOT" value={flight.pilot} />
          <Info label="GATE" value={flight.gate} />
        </View>

        <View style={styles.body}>
          <Text style={styles.description}>{flight.description}</Text>

          <Text style={styles.sectionLabel}>SELECT YOUR CLASS</Text>
          {flight.classes.map((c) => (
            <ClassRow
              key={c.key}
              seat={c}
              selected={c.key === selectedKey}
              onSelect={() => {
                Haptics.selectionAsync();
                setSelectedKey(c.key);
                setQty(1);
              }}
            />
          ))}

          {/* Quantity */}
          {!soldOut && (
            <View style={styles.qtyBlock}>
              <View>
                <Text style={styles.sectionLabel}>
                  {selected.unit === "table" ? "TABLES" : "SEATS"}
                </Text>
                <Text style={styles.remaining}>{remaining} left</Text>
              </View>
              <View style={styles.stepper}>
                <Pressable
                  testID="qty-decrement"
                  style={styles.stepBtn}
                  onPress={() => setQty((q) => Math.max(1, q - 1))}
                >
                  <Ionicons name="remove" size={20} color={colors.onSurface} />
                </Pressable>
                <Text style={styles.qtyText} testID="qty-value">
                  {qty}
                </Text>
                <Pressable
                  testID="qty-increment"
                  style={styles.stepBtn}
                  onPress={() =>
                    setQty((q) => Math.min(remaining, q + 1))
                  }
                >
                  <Ionicons name="add" size={20} color={colors.onSurface} />
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Sticky CTA */}
      <View
        style={[styles.cta, { paddingBottom: insets.bottom + spacing.md }]}
      >
        <View>
          <Text style={styles.ctaLabel}>TOTAL</Text>
          <Text style={styles.ctaTotal}>{peso(total)}</Text>
        </View>
        <Pressable
          testID="book-button"
          disabled={soldOut}
          onPress={book}
          style={[styles.bookBtn, soldOut && styles.bookBtnDisabled]}
        >
          <Text style={styles.bookText}>
            {soldOut ? "SOLD OUT" : "BOOK SEAT"}
          </Text>
          {!soldOut && (
            <Ionicons name="airplane" size={16} color={colors.onBrand} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoItem}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function ClassRow({
  seat,
  selected,
  onSelect,
}: {
  seat: SeatClass;
  selected: boolean;
  onSelect: () => void;
}) {
  const remaining = seat.capacity - seat.booked;
  const soldOut = remaining <= 0;
  const isFirst = seat.key === "first";

  return (
    <Pressable
      testID={`class-${seat.key}`}
      onPress={onSelect}
      style={[
        styles.classRow,
        selected && styles.classRowSelected,
        selected && isFirst && { borderColor: colors.brand },
      ]}
    >
      <View style={styles.classHead}>
        <View style={{ flex: 1 }}>
          <Text
            style={[
              styles.className,
              (selected || isFirst) && { color: colors.brand },
            ]}
          >
            {seat.name}
          </Text>
          <Text style={styles.classTagline}>{seat.tagline}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.classPrice}>{peso(seat.price)}</Text>
          <Text style={styles.classUnit}>/{seat.unit}</Text>
        </View>
      </View>

      {selected && (
        <View style={styles.perks}>
          {seat.perks.map((p) => (
            <View key={p} style={styles.perkRow}>
              <Ionicons name="checkmark" size={14} color={colors.brand} />
              <Text style={styles.perkText}>{p}</Text>
            </View>
          ))}
          <Text style={[styles.remaining, { marginTop: spacing.sm }]}>
            {soldOut ? "Sold out" : `${remaining} ${seat.unit}(s) left`}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { alignItems: "center", justifyContent: "center" },
  errTitle: {
    fontFamily: fonts.display,
    color: colors.onSurface,
    fontSize: font.lg,
  },
  backChip: {
    marginTop: spacing.lg,
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 999,
  },
  backChipText: {
    fontFamily: fonts.monoBold,
    color: colors.onSurface,
    letterSpacing: 2,
  },
  hero: { height: 440, justifyContent: "flex-end" },
  backBtn: {
    position: "absolute",
    left: spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(9,9,11,0.5)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  heroContent: { padding: spacing.xl },
  flightNo: {
    fontFamily: fonts.monoBold,
    color: colors.brand,
    fontSize: font.base,
    letterSpacing: 2,
  },
  destination: {
    fontFamily: fonts.display,
    color: colors.onSurface,
    fontSize: 52,
    lineHeight: 56,
    marginTop: spacing.xs,
  },
  tagline: {
    fontFamily: fonts.displayMedium,
    color: colors.onSurfaceTertiary,
    fontSize: font.lg,
    marginTop: 2,
  },
  genreRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  genreChip: {
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: 999,
  },
  genreText: {
    fontFamily: fonts.mono,
    color: colors.onSurface,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  infoStrip: {
    flexDirection: "row",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  infoItem: { flex: 1 },
  infoLabel: {
    fontFamily: fonts.mono,
    color: colors.onSurfaceSecondary,
    fontSize: 9,
    letterSpacing: 1.5,
    marginBottom: 3,
  },
  infoValue: {
    fontFamily: fonts.monoBold,
    color: colors.onSurface,
    fontSize: font.sm,
  },
  body: { paddingHorizontal: spacing.xl },
  description: {
    fontFamily: fonts.displayMedium,
    color: colors.onSurfaceTertiary,
    fontSize: font.lg,
    lineHeight: 26,
  },
  sectionLabel: {
    fontFamily: fonts.mono,
    color: colors.brandSecondary,
    fontSize: 11,
    letterSpacing: 2,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  classRow: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  classRowSelected: {
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceTertiary,
  },
  classHead: { flexDirection: "row", alignItems: "center" },
  className: {
    fontFamily: fonts.display,
    color: colors.onSurface,
    fontSize: font.xl,
  },
  classTagline: {
    fontFamily: fonts.mono,
    color: colors.onSurfaceSecondary,
    fontSize: font.sm,
    marginTop: 2,
  },
  classPrice: {
    fontFamily: fonts.monoBold,
    color: colors.onSurface,
    fontSize: font.lg,
  },
  classUnit: {
    fontFamily: fonts.mono,
    color: colors.onSurfaceSecondary,
    fontSize: 11,
  },
  perks: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderStrong,
  },
  perkRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: 6 },
  perkText: {
    fontFamily: fonts.displayMedium,
    color: colors.onSurfaceTertiary,
    fontSize: font.base,
    flex: 1,
  },
  remaining: {
    fontFamily: fonts.mono,
    color: colors.brandSecondary,
    fontSize: font.sm,
  },
  qtyBlock: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.sm,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  stepBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyText: {
    fontFamily: fonts.monoBold,
    color: colors.onSurface,
    fontSize: font.lg,
    minWidth: 28,
    textAlign: "center",
  },
  cta: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  ctaLabel: {
    fontFamily: fonts.mono,
    color: colors.onSurfaceSecondary,
    fontSize: 10,
    letterSpacing: 2,
  },
  ctaTotal: {
    fontFamily: fonts.display,
    color: colors.onSurface,
    fontSize: font.xxl,
  },
  bookBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 999,
  },
  bookBtnDisabled: { backgroundColor: colors.surfaceTertiary },
  bookText: {
    fontFamily: fonts.monoBold,
    color: colors.onBrand,
    letterSpacing: 2,
    fontSize: font.base,
  },
});
