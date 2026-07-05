import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { colors, fonts, font, spacing, radius, priceLabel } from "@/src/theme";
import { adminApi, Flight, formatDeparture, isPast } from "@/src/api";
import { useAdminPin, lock } from "@/src/adminStore";

export default function AdminDashboard() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pin = useAdminPin();
  const [flights, setFlights] = useState<Flight[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!pin) {
      setLoading(false);
      return;
    }
    try {
      const data = await adminApi.listFlights(pin);
      setFlights(data);
    } catch {
      setFlights([]);
    } finally {
      setLoading(false);
    }
  }, [pin]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  if (!pin) {
    return (
      <View style={[styles.container, styles.center, { padding: spacing.xl }]}>
        <Ionicons name="lock-closed" size={44} color={colors.borderStrong} />
        <Text style={styles.lockedTitle}>Crew access locked</Text>
        <Pressable
          testID="unlock-button"
          style={styles.unlockBtn}
          onPress={() => router.push("/admin-login")}
        >
          <Text style={styles.unlockText}>ENTER PIN</Text>
        </Pressable>
      </View>
    );
  }

  const resetSeats = async (f: Flight) => {
    setBusyId(f.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await adminApi.resetSeats(pin, f.id);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (f: Flight) => {
    setBusyId(f.id);
    try {
      await adminApi.deleteFlight(pin, f.id);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const renderItem = ({ item }: { item: Flight }) => {
    const { date, time } = formatDeparture(item.departure);
    const past = isPast(item.departure);
    const biz = item.classes.find((c) => c.key === "business");
    const first = item.classes.find((c) => c.key === "first");
    const tablesLeft = biz ? biz.capacity - biz.booked : 0;
    const boothsLeft = first ? first.capacity - first.booked : 0;

    return (
      <View style={styles.card} testID={`admin-flight-${item.id}`}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardFlightNo}>{item.flight_number}</Text>
            <Text style={styles.cardDest}>{item.destination}</Text>
            <Text style={styles.cardMeta}>
              {date} · {time} · {item.pilot}
            </Text>
          </View>
          <View style={[styles.statusPill, past ? styles.pillPast : styles.pillLive]}>
            <Text style={[styles.statusText, { color: past ? colors.onSurfaceSecondary : colors.success }]}>
              {past ? "LANDED" : "UPCOMING"}
            </Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <Text style={styles.stat}>🍸 {tablesLeft}/{biz?.capacity ?? 0} tables</Text>
          <Text style={styles.stat}>🥂 {boothsLeft}/{first?.capacity ?? 0} booths</Text>
          <Text style={styles.stat}>{priceLabel(biz?.price ?? 0)}+</Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            testID={`edit-${item.id}`}
            style={styles.actionBtn}
            onPress={() => router.push({ pathname: "/admin-flight", params: { flightId: item.id } })}
          >
            <Ionicons name="create-outline" size={16} color={colors.onSurface} />
            <Text style={styles.actionText}>Edit</Text>
          </Pressable>
          <Pressable
            testID={`reset-${item.id}`}
            style={styles.actionBtn}
            onPress={() => resetSeats(item)}
            disabled={busyId === item.id}
          >
            <Ionicons name="refresh" size={16} color={colors.brand} />
            <Text style={[styles.actionText, { color: colors.brand }]}>Reset seats</Text>
          </Pressable>
          <Pressable
            testID={`delete-${item.id}`}
            style={styles.actionBtn}
            onPress={() => remove(item)}
            disabled={busyId === item.id}
          >
            <Ionicons name="trash-outline" size={16} color={colors.error} />
            <Text style={[styles.actionText, { color: colors.error }]}>Delete</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  const header = (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <View>
          <Text style={styles.kicker}>CREW CONTROL</Text>
          <Text style={styles.title}>FLIGHTS</Text>
        </View>
        <Pressable testID="lock-button" onPress={() => lock()} style={styles.lockChip}>
          <Ionicons name="lock-open" size={14} color={colors.onSurfaceSecondary} />
          <Text style={styles.lockChipText}>LOCK</Text>
        </Pressable>
      </View>
      <Pressable
        testID="new-flight-button"
        style={styles.newBtn}
        onPress={() => router.push("/admin-flight")}
      >
        <Ionicons name="add" size={20} color={colors.onBrand} />
        <Text style={styles.newText}>ADD NEW FLIGHT</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={[styles.center, { flex: 1 }]}>
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : (
        <FlatList
          testID="admin-list"
          data={flights}
          keyExtractor={(f) => f.id}
          ListHeaderComponent={header}
          renderItem={renderItem}
          contentContainerStyle={{
            paddingTop: insets.top + spacing.sm,
            paddingHorizontal: spacing.lg,
            paddingBottom: insets.bottom + 90,
          }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { alignItems: "center", justifyContent: "center" },
  lockedTitle: {
    fontFamily: fonts.display,
    color: colors.onSurface,
    fontSize: font.xl,
    marginTop: spacing.lg,
  },
  unlockBtn: {
    marginTop: spacing.xl,
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: 999,
  },
  unlockText: { fontFamily: fonts.monoBold, color: colors.onBrand, letterSpacing: 2, fontSize: font.sm },
  header: { marginBottom: spacing.lg },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  kicker: {
    fontFamily: fonts.mono,
    color: colors.brand,
    fontSize: 11,
    letterSpacing: 3,
  },
  title: {
    fontFamily: fonts.display,
    color: colors.onSurface,
    fontSize: 40,
    letterSpacing: 1,
    marginTop: spacing.xs,
  },
  lockChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    marginTop: spacing.sm,
  },
  lockChipText: {
    fontFamily: fonts.mono,
    color: colors.onSurfaceSecondary,
    fontSize: 10,
    letterSpacing: 1.5,
  },
  newBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.brand,
    paddingVertical: spacing.md + 2,
    borderRadius: radius.md,
    marginTop: spacing.lg,
  },
  newText: { fontFamily: fonts.monoBold, color: colors.onBrand, letterSpacing: 2, fontSize: font.base },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start" },
  cardFlightNo: {
    fontFamily: fonts.monoBold,
    color: colors.brand,
    fontSize: font.sm,
    letterSpacing: 1,
  },
  cardDest: {
    fontFamily: fonts.display,
    color: colors.onSurface,
    fontSize: font.xxl,
    marginTop: 2,
  },
  cardMeta: {
    fontFamily: fonts.mono,
    color: colors.onSurfaceSecondary,
    fontSize: font.sm,
    marginTop: 2,
  },
  statusPill: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: 999 },
  pillLive: { backgroundColor: "rgba(132,204,22,0.12)" },
  pillPast: { backgroundColor: colors.surfaceTertiary },
  statusText: { fontFamily: fonts.monoBold, fontSize: 9, letterSpacing: 1.5 },
  statsRow: {
    flexDirection: "row",
    gap: spacing.lg,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  stat: { fontFamily: fonts.mono, color: colors.onSurfaceTertiary, fontSize: font.sm },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.surfaceTertiary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  actionText: { fontFamily: fonts.monoBold, color: colors.onSurface, fontSize: 12 },
});
