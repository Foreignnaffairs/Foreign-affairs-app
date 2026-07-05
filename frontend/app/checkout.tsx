import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  KeyboardAwareScrollView,
  KeyboardStickyView,
} from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { colors, fonts, font, spacing, radius, priceLabel } from "@/src/theme";
import { api, Flight, formatDeparture } from "@/src/api";
import { storage } from "@/src/utils/storage";

const STICKY_H = 96;

export default function Checkout() {
  const { flightId, classKey, qty } = useLocalSearchParams<{
    flightId: string;
    classKey: string;
    qty: string;
  }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [flight, setFlight] = useState<Flight | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const quantity = Math.max(1, parseInt(qty || "1", 10));

  const load = useCallback(async () => {
    const data = await api.getFlight(flightId);
    setFlight(data);
    const savedPhone = await storage.getItem<string>("fa_phone", "");
    const savedName = await storage.getItem<string>("fa_name", "");
    if (savedPhone) setPhone(savedPhone);
    if (savedName) setName(savedName);
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

  const seat = flight.classes.find((c) => c.key === classKey)!;
  const total = seat.price * quantity;
  const { date, time } = formatDeparture(flight.departure);
  const valid = name.trim().length >= 2 && phone.trim().length >= 7;

  const confirm = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    setErrorMsg(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      // simulate payment processing
      await new Promise((r) => setTimeout(r, 1200));
      const booking = await api.createBooking({
        flight_id: flight.id,
        class_key: seat.key,
        quantity,
        passenger_name: name.trim(),
        passenger_phone: phone.trim(),
      });
      await storage.setItem("fa_phone", phone.trim());
      await storage.setItem("fa_name", name.trim());
      router.replace({
        pathname: "/confirmation",
        params: { bookingId: booking.id },
      });
    } catch (e: any) {
      setErrorMsg(e?.message || "Payment failed. Try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="checkout-back" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.topTitle}>CHECKOUT</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAwareScrollView
        bottomOffset={STICKY_H + spacing.lg}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: spacing.xl,
          paddingBottom: STICKY_H + insets.bottom + spacing.xl,
        }}
      >
        {/* Trip summary */}
        <View style={styles.summary}>
          <View style={styles.summaryHead}>
            <View>
              <Text style={styles.sumFlight}>{flight.flight_number}</Text>
              <Text style={styles.sumDest}>{flight.destination}</Text>
            </View>
            <View style={styles.classBadge}>
              <Text style={styles.classBadgeText}>{seat.name}</Text>
            </View>
          </View>
          <View style={styles.sumRow}>
            <SumItem label="DATE" value={date} />
            <SumItem label="BOARDING" value={time} />
            <SumItem label="PILOT" value={flight.pilot} />
          </View>
          <View style={styles.sumDivider} />
          <View style={styles.priceLine}>
            <Text style={styles.priceLineText}>
              {seat.name} × {quantity} {seat.unit}
              {quantity > 1 ? "s" : ""}
            </Text>
            <Text style={styles.priceLineText}>{priceLabel(total)}</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>PASSENGER DETAILS</Text>

        <Text style={styles.inputLabel}>FULL NAME</Text>
        <TextInput
          testID="input-name"
          value={name}
          onChangeText={setName}
          placeholder="Juan Dela Cruz"
          placeholderTextColor={colors.onSurfaceSecondary}
          style={styles.input}
          autoCapitalize="words"
          returnKeyType="next"
        />

        <Text style={styles.inputLabel}>PHONE NUMBER</Text>
        <TextInput
          testID="input-phone"
          value={phone}
          onChangeText={setPhone}
          placeholder="+63 900 000 0000"
          placeholderTextColor={colors.onSurfaceSecondary}
          style={styles.input}
          keyboardType="phone-pad"
          returnKeyType="done"
        />

        <View style={styles.mockNote}>
          <Ionicons
            name={total === 0 ? "ticket-outline" : "card-outline"}
            size={16}
            color={colors.brandSecondary}
          />
          <Text style={styles.mockNoteText}>
            {total === 0
              ? "Free general admission — reserve your spot below."
              : "Payment is simulated for now — no card required."}
          </Text>
        </View>

        {errorMsg && (
          <Text testID="checkout-error" style={styles.errorText}>
            {errorMsg}
          </Text>
        )}
      </KeyboardAwareScrollView>

      <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
        <View style={[styles.sticky, { paddingBottom: insets.bottom + spacing.md }]}>
          <View>
            <Text style={styles.stickyLabel}>
              {total === 0 ? "TOTAL" : "TOTAL DUE"}
            </Text>
            <Text style={styles.stickyTotal}>{priceLabel(total)}</Text>
          </View>
          <Pressable
            testID="confirm-button"
            onPress={confirm}
            disabled={!valid || submitting}
            style={[styles.payBtn, (!valid || submitting) && styles.payBtnDisabled]}
          >
            {submitting ? (
              <ActivityIndicator color={colors.onBrand} />
            ) : (
              <>
                <Text style={styles.payText}>
                  {total === 0 ? "RESERVE SEAT" : "CONFIRM & PAY"}
                </Text>
                <Ionicons name="lock-closed" size={15} color={colors.onBrand} />
              </>
            )}
          </Pressable>
        </View>
      </KeyboardStickyView>
    </View>
  );
}

function SumItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.sumLabel}>{label}</Text>
      <Text style={styles.sumValue} numberOfLines={1}>
        {value}
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
    fontSize: font.base,
    letterSpacing: 3,
  },
  summary: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  summaryHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  sumFlight: {
    fontFamily: fonts.monoBold,
    color: colors.brand,
    fontSize: font.sm,
    letterSpacing: 1,
  },
  sumDest: {
    fontFamily: fonts.display,
    color: colors.onSurface,
    fontSize: font.xxl,
    marginTop: 2,
  },
  classBadge: {
    backgroundColor: colors.brandTertiary,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.sm,
  },
  classBadgeText: {
    fontFamily: fonts.monoBold,
    color: colors.brand,
    fontSize: 11,
    letterSpacing: 1,
  },
  sumRow: { flexDirection: "row", marginTop: spacing.lg, gap: spacing.md },
  sumLabel: {
    fontFamily: fonts.mono,
    color: colors.onSurfaceSecondary,
    fontSize: 9,
    letterSpacing: 1.5,
    marginBottom: 3,
  },
  sumValue: {
    fontFamily: fonts.monoBold,
    color: colors.onSurface,
    fontSize: font.sm,
  },
  sumDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderStrong,
    marginVertical: spacing.lg,
  },
  priceLine: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  priceLineText: {
    fontFamily: fonts.mono,
    color: colors.onSurfaceTertiary,
    fontSize: font.base,
  },
  sectionLabel: {
    fontFamily: fonts.mono,
    color: colors.brandSecondary,
    fontSize: 11,
    letterSpacing: 2,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontFamily: fonts.mono,
    color: colors.onSurfaceSecondary,
    fontSize: 10,
    letterSpacing: 1.5,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    color: colors.onSurface,
    fontFamily: fonts.displayMedium,
    fontSize: font.lg,
  },
  mockNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.xl,
    backgroundColor: colors.brandTertiary,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  mockNoteText: {
    fontFamily: fonts.mono,
    color: colors.brandSecondary,
    fontSize: font.sm,
    flex: 1,
  },
  errorText: {
    fontFamily: fonts.mono,
    color: colors.error,
    fontSize: font.sm,
    marginTop: spacing.lg,
    textAlign: "center",
  },
  sticky: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  stickyLabel: {
    fontFamily: fonts.mono,
    color: colors.onSurfaceSecondary,
    fontSize: 10,
    letterSpacing: 2,
  },
  stickyTotal: {
    fontFamily: fonts.display,
    color: colors.onSurface,
    fontSize: font.xxl,
  },
  payBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md + 2,
    borderRadius: 999,
    minWidth: 160,
    justifyContent: "center",
  },
  payBtnDisabled: { opacity: 0.4 },
  payText: {
    fontFamily: fonts.monoBold,
    color: colors.onBrand,
    letterSpacing: 1.5,
    fontSize: font.base,
  },
});
