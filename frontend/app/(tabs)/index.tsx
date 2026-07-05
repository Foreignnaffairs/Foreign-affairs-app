import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { colors, fonts, font, spacing } from "@/src/theme";
import { api, Flight, isPast } from "@/src/api";
import { FlightCard } from "@/src/components/FlightCard";

type Row =
  | { type: "flight"; flight: Flight; past: boolean }
  | { type: "section"; title: string };

export default function Departures() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [flights, setFlights] = useState<Flight[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(false);
      const data = await api.getFlights();
      setFlights(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const upcoming = flights.filter((f) => !isPast(f.departure));
  const past = flights
    .filter((f) => isPast(f.departure))
    .sort((a, b) => (a.departure < b.departure ? 1 : -1));

  const rows: Row[] = [
    ...upcoming.map((f) => ({ type: "flight" as const, flight: f, past: false })),
    ...(past.length ? [{ type: "section" as const, title: "PAST FLIGHTS" }] : []),
    ...past.map((f) => ({ type: "flight" as const, flight: f, past: true })),
  ];

  const header = (
    <View style={styles.header}>
      <View style={styles.headerTopRow}>
        <Text
          testID="brand-logo"
          style={styles.kicker}
          onLongPress={() => router.push("/admin-login")}
          suppressHighlighting
        >
          FOREIGN AFFAIRS
        </Text>
        <View style={styles.headerRight}>
          <View style={styles.liveDot}>
            <View style={styles.dot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
          <Pressable
            testID="admin-entry"
            onPress={() => router.push("/admin-login")}
            hitSlop={12}
            style={styles.crewBtn}
          >
            <Ionicons name="lock-closed" size={13} color={colors.onSurfaceSecondary} />
            <Text style={styles.crewText}>CREW</Text>
          </Pressable>
        </View>
      </View>
      <Text style={styles.title}>DEPARTURES</Text>
      <Text style={styles.subtitle}>
        {upcoming.length} flight{upcoming.length === 1 ? "" : "s"} boarding soon ·
        pick your destination
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.center, { padding: spacing.xl }]}>
        <Ionicons name="cloud-offline-outline" size={48} color={colors.onSurfaceSecondary} />
        <Text style={styles.emptyTitle}>Flight tracking offline</Text>
        <Text style={styles.emptyText}>{"We couldn't reach the tower."}</Text>
        <Pressable testID="retry-button" style={styles.retryBtn} onPress={load}>
          <Text style={styles.retryText}>RETRY</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        testID="departures-list"
        data={rows}
        keyExtractor={(item, i) =>
          item.type === "flight" ? item.flight.id : `section-${i}`
        }
        ListHeaderComponent={header}
        renderItem={({ item, index }) =>
          item.type === "section" ? (
            <View style={styles.sectionRow}>
              <View style={styles.sectionLine} />
              <Text style={styles.sectionTitle}>{item.title}</Text>
              <View style={styles.sectionLine} />
            </View>
          ) : (
            <FlightCard
              flight={item.flight}
              index={index}
              past={item.past}
              onPress={() => router.push(`/flight/${item.flight.id}`)}
            />
          )
        }
        contentContainerStyle={{
          paddingTop: insets.top + spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingBottom: insets.bottom + 90,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.brand}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { alignItems: "center", justifyContent: "center" },
  header: { marginBottom: spacing.lg },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.lg,
    marginTop: spacing.xs,
  },
  sectionLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderStrong,
  },
  sectionTitle: {
    fontFamily: fonts.mono,
    color: colors.onSurfaceSecondary,
    fontSize: 11,
    letterSpacing: 2,
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  kicker: {
    fontFamily: fonts.mono,
    color: colors.brand,
    fontSize: 11,
    letterSpacing: 3,
  },
  liveDot: { flexDirection: "row", alignItems: "center", gap: 5 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  crewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
  },
  crewText: {
    fontFamily: fonts.mono,
    color: colors.onSurfaceSecondary,
    fontSize: 10,
    letterSpacing: 1.5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  liveText: {
    fontFamily: fonts.mono,
    color: colors.onSurfaceSecondary,
    fontSize: 10,
    letterSpacing: 2,
  },
  title: {
    fontFamily: fonts.display,
    color: colors.onSurface,
    fontSize: 40,
    letterSpacing: 1,
    marginTop: spacing.sm,
  },
  subtitle: {
    fontFamily: fonts.mono,
    color: colors.onSurfaceSecondary,
    fontSize: font.sm,
    marginTop: spacing.xs,
  },
  emptyTitle: {
    fontFamily: fonts.display,
    color: colors.onSurface,
    fontSize: font.xl,
    marginTop: spacing.lg,
  },
  emptyText: {
    fontFamily: fonts.mono,
    color: colors.onSurfaceSecondary,
    fontSize: font.base,
    marginTop: spacing.xs,
  },
  retryBtn: {
    marginTop: spacing.xl,
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 999,
  },
  retryText: {
    fontFamily: fonts.monoBold,
    color: colors.onBrand,
    letterSpacing: 2,
    fontSize: font.sm,
  },
});
