import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated";

import { colors, fonts, font, spacing, peso } from "@/src/theme";
import { api, Booking } from "@/src/api";
import { BoardingPass } from "@/src/components/BoardingPass";

export default function Confirmation() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await api.getBooking(bookingId);
      setBooking(data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !booking) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  const share = () => {
    Share.share({
      message: `I'm flying to ${booking.destination} with Foreign Affairs ✈ Flight ${booking.flight_number}. Ref ${booking.reference}. See you on the dancefloor!`,
    });
  };

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.xl,
          paddingHorizontal: spacing.lg,
          paddingBottom: insets.bottom + 120,
        }}
      >
        <View style={styles.checkWrap}>
          <Animated.View
            entering={ZoomIn.duration(500).springify().damping(12)}
            style={styles.checkCircle}
          >
            <Ionicons name="checkmark" size={34} color={colors.onBrand} />
          </Animated.View>
          <Animated.Text entering={FadeInDown.delay(200).duration(400)} style={styles.confirmed}>
            YOU'RE BOARDED
          </Animated.Text>
          <Animated.Text entering={FadeInDown.delay(300).duration(400)} style={styles.confirmSub}>
            Reservation confirmed · payment simulated
          </Animated.Text>
        </View>

        <Animated.View entering={FadeInDown.delay(400).duration(500).springify().damping(16)}>
          <BoardingPass booking={booking} />
        </Animated.View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>PAID</Text>
          <Text style={styles.totalValue}>{peso(booking.total)}</Text>
        </View>

        <Pressable testID="share-button" style={styles.shareBtn} onPress={share}>
          <Ionicons name="share-outline" size={18} color={colors.onSurface} />
          <Text style={styles.shareText}>SHARE BOARDING PASS</Text>
        </Pressable>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Pressable
          testID="done-button"
          style={styles.doneBtn}
          onPress={() => router.replace("/(tabs)/trips")}
        >
          <Text style={styles.doneText}>VIEW MY TRIPS</Text>
        </Pressable>
        <Pressable
          testID="home-button"
          style={styles.homeBtn}
          onPress={() => router.replace("/(tabs)")}
        >
          <Text style={styles.homeText}>Back to Departures</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { alignItems: "center", justifyContent: "center" },
  checkWrap: { alignItems: "center", marginBottom: spacing.xl },
  checkCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  confirmed: {
    fontFamily: fonts.display,
    color: colors.onSurface,
    fontSize: font.xxl,
    letterSpacing: 1,
  },
  confirmSub: {
    fontFamily: fonts.mono,
    color: colors.onSurfaceSecondary,
    fontSize: font.sm,
    marginTop: spacing.xs,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  totalLabel: {
    fontFamily: fonts.mono,
    color: colors.onSurfaceSecondary,
    fontSize: font.sm,
    letterSpacing: 2,
  },
  totalValue: {
    fontFamily: fonts.display,
    color: colors.brand,
    fontSize: font.xl,
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  shareText: {
    fontFamily: fonts.monoBold,
    color: colors.onSurface,
    letterSpacing: 2,
    fontSize: font.sm,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  doneBtn: {
    backgroundColor: colors.brand,
    paddingVertical: spacing.md + 2,
    borderRadius: 999,
    alignItems: "center",
  },
  doneText: {
    fontFamily: fonts.monoBold,
    color: colors.onBrand,
    letterSpacing: 2,
    fontSize: font.base,
  },
  homeBtn: { alignItems: "center", paddingVertical: spacing.md },
  homeText: {
    fontFamily: fonts.mono,
    color: colors.onSurfaceSecondary,
    fontSize: font.sm,
  },
});
