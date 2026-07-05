import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";

import { colors, fonts, font, spacing, radius } from "@/src/theme";
import { api, Booking } from "@/src/api";
import { BoardingPass } from "@/src/components/BoardingPass";
import { storage } from "@/src/utils/storage";

export default function MyTrips() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lookupPhone, setLookupPhone] = useState("");

  const load = useCallback(async () => {
    const saved = await storage.getItem<string>("fa_phone", "");
    if (saved) {
      try {
        const data = await api.getBookings(saved);
        setBookings(data);
      } catch {
        setBookings([]);
      }
    } else {
      setBookings([]);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const doLookup = async () => {
    if (lookupPhone.trim().length < 7) return;
    setLoading(true);
    await storage.setItem("fa_phone", lookupPhone.trim());
    setLookupPhone("");
    await load();
  };

  const header = (
    <View style={styles.header}>
      <Text style={styles.kicker}>YOUR PASSPORT</Text>
      <Text style={styles.title}>MY TRIPS</Text>
      <Text style={styles.subtitle}>
        {bookings.length
          ? `${bookings.length} boarding pass${bookings.length === 1 ? "" : "es"}`
          : "Your booked flights live here"}
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

  const empty = (
    <View style={styles.emptyWrap}>
      <Ionicons name="ticket-outline" size={56} color={colors.borderStrong} />
      <Text style={styles.emptyTitle}>No flights booked</Text>
      <Text style={styles.emptyText}>
        Your passport is empty. Book a flight from Departures to get your
        boarding pass.
      </Text>

      <View style={styles.lookupBox}>
        <Text style={styles.lookupLabel}>ALREADY BOOKED? FIND BY PHONE</Text>
        <View style={styles.lookupRow}>
          <TextInput
            testID="lookup-phone-input"
            value={lookupPhone}
            onChangeText={setLookupPhone}
            placeholder="+63 900 000 0000"
            placeholderTextColor={colors.onSurfaceSecondary}
            style={styles.lookupInput}
            keyboardType="phone-pad"
          />
          <Pressable testID="lookup-button" style={styles.lookupBtn} onPress={doLookup}>
            <Ionicons name="search" size={18} color={colors.onBrand} />
          </Pressable>
        </View>
      </View>

      <Pressable
        testID="browse-flights-button"
        style={styles.browseBtn}
        onPress={() => router.push("/(tabs)")}
      >
        <Text style={styles.browseText}>BROWSE FLIGHTS</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        testID="trips-list"
        data={bookings}
        keyExtractor={(b) => b.id}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        renderItem={({ item, index }) => (
          <Animated.View
            entering={FadeInDown.delay(index * 90).duration(450).springify().damping(18)}
            style={{ marginBottom: spacing.xl }}
          >
            <BoardingPass booking={item} />
          </Animated.View>
        )}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingBottom: insets.bottom + 90,
          flexGrow: 1,
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
  header: { marginBottom: spacing.xl },
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
    marginTop: spacing.sm,
  },
  subtitle: {
    fontFamily: fonts.mono,
    color: colors.onSurfaceSecondary,
    fontSize: font.sm,
    marginTop: spacing.xs,
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxxl,
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
    fontSize: font.sm,
    textAlign: "center",
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    lineHeight: 20,
  },
  lookupBox: {
    width: "100%",
    marginTop: spacing.xxl,
  },
  lookupLabel: {
    fontFamily: fonts.mono,
    color: colors.onSurfaceSecondary,
    fontSize: 10,
    letterSpacing: 1.5,
    marginBottom: spacing.sm,
  },
  lookupRow: { flexDirection: "row", gap: spacing.sm },
  lookupInput: {
    flex: 1,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: colors.onSurface,
    fontFamily: fonts.displayMedium,
    fontSize: font.base,
  },
  lookupBtn: {
    width: 52,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  browseBtn: {
    marginTop: spacing.xxl,
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: 999,
  },
  browseText: {
    fontFamily: fonts.monoBold,
    color: colors.onBrand,
    letterSpacing: 2,
    fontSize: font.sm,
  },
});
