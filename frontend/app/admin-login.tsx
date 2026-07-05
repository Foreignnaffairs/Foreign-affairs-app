import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { colors, fonts, font, spacing, radius } from "@/src/theme";
import { adminApi } from "@/src/api";
import { getPin, unlock } from "@/src/adminStore";

export default function AdminLogin() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    // already unlocked -> go straight in
    if (getPin()) router.replace("/(tabs)/admin");
  }, [router]);

  const submit = async () => {
    if (pin.length < 4 || checking) return;
    setChecking(true);
    setError(false);
    try {
      const res = await adminApi.verifyPin(pin);
      if (res.valid) {
        await unlock(pin);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace("/(tabs)/admin");
      } else {
        setError(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch {
      setError(true);
    } finally {
      setChecking(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.xl }]}>
      <Pressable testID="login-close" onPress={() => router.back()} style={styles.close}>
        <Ionicons name="close" size={24} color={colors.onSurfaceSecondary} />
      </Pressable>

      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="lock-closed" size={28} color={colors.brand} />
        </View>
        <Text style={styles.title}>CREW ACCESS</Text>
        <Text style={styles.sub}>Enter your admin PIN to manage flights.</Text>

        <TextInput
          testID="pin-input"
          value={pin}
          onChangeText={(t) => {
            setPin(t.replace(/[^0-9]/g, ""));
            setError(false);
          }}
          placeholder="••••••"
          placeholderTextColor={colors.onSurfaceSecondary}
          style={[styles.input, error && { borderColor: colors.error }]}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={10}
          autoFocus
          onSubmitEditing={submit}
        />
        {error && <Text style={styles.errText}>Incorrect PIN. Try again.</Text>}

        <Pressable
          testID="pin-submit"
          onPress={submit}
          disabled={pin.length < 4 || checking}
          style={[styles.btn, (pin.length < 4 || checking) && styles.btnDisabled]}
        >
          {checking ? (
            <ActivityIndicator color={colors.onBrand} />
          ) : (
            <Text style={styles.btnText}>UNLOCK</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: spacing.xl },
  close: { alignSelf: "flex-end", padding: spacing.sm },
  content: { marginTop: spacing.xxxl, alignItems: "center" },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  title: {
    fontFamily: fonts.display,
    color: colors.onSurface,
    fontSize: font.xxl,
    letterSpacing: 1,
  },
  sub: {
    fontFamily: fonts.mono,
    color: colors.onSurfaceSecondary,
    fontSize: font.sm,
    marginTop: spacing.sm,
    textAlign: "center",
  },
  input: {
    width: "100%",
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.surfaceTertiary,
    paddingVertical: spacing.lg,
    marginTop: spacing.xxl,
    textAlign: "center",
    color: colors.onSurface,
    fontFamily: fonts.monoBold,
    fontSize: 28,
    letterSpacing: 8,
  },
  errText: {
    fontFamily: fonts.mono,
    color: colors.error,
    fontSize: font.sm,
    marginTop: spacing.md,
  },
  btn: {
    width: "100%",
    backgroundColor: colors.brand,
    paddingVertical: spacing.md + 2,
    borderRadius: 999,
    alignItems: "center",
    marginTop: spacing.xl,
  },
  btnDisabled: { opacity: 0.4 },
  btnText: {
    fontFamily: fonts.monoBold,
    color: colors.onBrand,
    letterSpacing: 2,
    fontSize: font.base,
  },
});
