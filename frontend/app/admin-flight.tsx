import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Linking,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";

import { colors, fonts, font, spacing, radius } from "@/src/theme";
import { adminApi, AdminFlightInput, api } from "@/src/api";
import { useAdminPin } from "@/src/adminStore";

const PRESETS = [
  "https://images.unsplash.com/photo-1601042879364-f3947d3f9c16?crop=entropy&cs=srgb&fm=jpg&q=80&w=600",
  "https://images.unsplash.com/photo-1715619684759-8203b89e88ee?crop=entropy&cs=srgb&fm=jpg&q=80&w=600",
  "https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?crop=entropy&cs=srgb&fm=jpg&q=80&w=600",
  "https://images.unsplash.com/photo-1483729558449-99ef09a8c325?crop=entropy&cs=srgb&fm=jpg&q=80&w=600",
  "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?crop=entropy&cs=srgb&fm=jpg&q=80&w=600",
  "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?crop=entropy&cs=srgb&fm=jpg&q=80&w=600",
];

const STICKY_H = 88;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export default function AdminFlightForm() {
  const { flightId } = useLocalSearchParams<{ flightId?: string }>();
  const isEdit = !!flightId;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pin = useAdminPin();

  const [loaded, setLoaded] = useState(!isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permMsg, setPermMsg] = useState(false);

  const [destination, setDestination] = useState("");
  const [pilot, setPilot] = useState("");
  const [flightNumber, setFlightNumber] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [genres, setGenres] = useState("");
  const [venue, setVenue] = useState("Stardust, BGC");
  const [gate, setGate] = useState("A1");
  const [terminal, setTerminal] = useState("T2");
  const [duration, setDuration] = useState("6h set");
  const [date, setDate] = useState(() => {
    const d = new Date(Date.now() + 7 * 864e5);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });
  const [time, setTime] = useState("22:00");
  const [image, setImage] = useState(PRESETS[0]);
  const [galleryUrl, setGalleryUrl] = useState("");
  const [bizPrice, setBizPrice] = useState("2500");
  const [firstPrice, setFirstPrice] = useState("15000");
  const [ecoCap, setEcoCap] = useState("400");
  const [bizTables, setBizTables] = useState("12");
  const [firstBooths, setFirstBooths] = useState("4");

  const loadExisting = useCallback(async () => {
    if (!isEdit) return;
    const f = await api.getFlight(flightId!);
    const d = new Date(f.departure);
    setDestination(f.destination);
    setPilot(f.pilot);
    setFlightNumber(f.flight_number);
    setTagline(f.tagline);
    setDescription(f.description);
    setGenres(f.genres.join(", "));
    setVenue(f.venue);
    setGate(f.gate);
    setTerminal(f.terminal);
    setDuration(f.duration);
    setDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
    setTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
    setImage(f.image_url);
    setGalleryUrl(f.gallery_url || "");
    const biz = f.classes.find((c) => c.key === "business");
    const first = f.classes.find((c) => c.key === "first");
    const eco = f.classes.find((c) => c.key === "economy");
    if (biz) { setBizPrice(String(biz.price)); setBizTables(String(biz.capacity)); }
    if (first) { setFirstPrice(String(first.price)); setFirstBooths(String(first.capacity)); }
    if (eco) setEcoCap(String(eco.capacity));
    setLoaded(true);
  }, [isEdit, flightId]);

  useFocusEffect(
    useCallback(() => {
      loadExisting();
    }, [loadExisting])
  );

  const pickImage = async () => {
    setPermMsg(false);
    const perm = await ImagePicker.getMediaLibraryPermissionsAsync();
    let status = perm.status;
    if (status !== "granted" && perm.canAskAgain) {
      const req = await ImagePicker.requestMediaLibraryPermissionsAsync();
      status = req.status;
    }
    if (status !== "granted") {
      setPermMsg(true);
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
      base64: true,
    });
    if (!res.canceled && res.assets[0]?.base64) {
      setImage(`data:image/jpeg;base64,${res.assets[0].base64}`);
    }
  };

  const save = async () => {
    if (!pin) return;
    if (destination.trim().length < 2 || pilot.trim().length < 2) {
      setError("Destination and DJ / pilot are required.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
      setError("Use date YYYY-MM-DD and time HH:MM.");
      return;
    }
    setSaving(true);
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const departure = new Date(`${date}T${time}:00`).toISOString();
    const body: AdminFlightInput = {
      flight_number: flightNumber.trim() || undefined,
      destination: destination.trim(),
      tagline: tagline.trim(),
      pilot: pilot.trim(),
      genres: genres.split(",").map((g) => g.trim()).filter(Boolean),
      venue: venue.trim(),
      gate: gate.trim() || "A1",
      terminal: terminal.trim() || "T2",
      departure,
      duration: duration.trim() || "6h set",
      image_url: image,
      description: description.trim(),
      gallery_url: galleryUrl.trim(),
      economy_price: 0,
      business_price: parseInt(bizPrice || "0", 10) || 0,
      first_price: parseInt(firstPrice || "0", 10) || 0,
      economy_capacity: parseInt(ecoCap || "0", 10) || 0,
      business_tables: Math.max(0, Math.min(12, parseInt(bizTables || "0", 10) || 0)),
      first_booths: Math.max(0, Math.min(4, parseInt(firstBooths || "0", 10) || 0)),
    };

    try {
      if (isEdit) await adminApi.updateFlight(pin, flightId!, body);
      else await adminApi.createFlight(pin, body);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e: any) {
      setError(e?.message || "Could not save flight.");
      setSaving(false);
    }
  };

  if (!loaded) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="form-back" onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.topTitle}>{isEdit ? "EDIT FLIGHT" : "NEW FLIGHT"}</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAwareScrollView
        bottomOffset={STICKY_H + spacing.lg}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.xl, paddingBottom: STICKY_H + insets.bottom + spacing.xl }}
      >
        {/* Cover image */}
        <Text style={styles.label}>COVER IMAGE</Text>
        <Image source={{ uri: image }} style={styles.preview} contentFit="cover" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetRow}>
          {PRESETS.map((p) => (
            <Pressable key={p} testID={`preset-${PRESETS.indexOf(p)}`} onPress={() => setImage(p)}>
              <Image
                source={{ uri: p }}
                style={[styles.presetThumb, image === p && styles.presetActive]}
                contentFit="cover"
              />
            </Pressable>
          ))}
        </ScrollView>
        <Pressable testID="upload-image" style={styles.uploadBtn} onPress={pickImage}>
          <Ionicons name="cloud-upload-outline" size={16} color={colors.onSurface} />
          <Text style={styles.uploadText}>Upload from phone</Text>
        </Pressable>
        {permMsg && (
          <Pressable onPress={() => Linking.openSettings()}>
            <Text style={styles.permText}>Photo access denied. Tap to open Settings.</Text>
          </Pressable>
        )}

        <Field label="DESTINATION" value={destination} onChange={setDestination} placeholder="Tokyo" testID="f-destination" />
        <Field label="DJ / PILOT" value={pilot} onChange={setPilot} placeholder="DJ KAZE" testID="f-pilot" />
        <Field label="TAGLINE" value={tagline} onChange={setTagline} placeholder="Neon nights & future bass" testID="f-tagline" />
        <Field label="FLIGHT NUMBER (optional)" value={flightNumber} onChange={setFlightNumber} placeholder="FA 808" testID="f-number" />
        <Field label="GENRES (comma separated)" value={genres} onChange={setGenres} placeholder="Future Bass, Tech" testID="f-genres" />

        <View style={styles.row}>
          <Field style={{ flex: 1 }} label="DATE" value={date} onChange={setDate} placeholder="2026-07-20" testID="f-date" />
          <Field style={{ flex: 1 }} label="TIME" value={time} onChange={setTime} placeholder="22:00" testID="f-time" />
        </View>
        <View style={styles.row}>
          <Field style={{ flex: 1 }} label="GATE" value={gate} onChange={setGate} placeholder="A1" testID="f-gate" />
          <Field style={{ flex: 1 }} label="TERMINAL" value={terminal} onChange={setTerminal} placeholder="T2" testID="f-terminal" />
          <Field style={{ flex: 1 }} label="SET LENGTH" value={duration} onChange={setDuration} placeholder="6h set" testID="f-duration" />
        </View>
        <Field label="VENUE" value={venue} onChange={setVenue} placeholder="Stardust, BGC" testID="f-venue" />
        <Field label="DESCRIPTION" value={description} onChange={setDescription} placeholder="Tell guests about the night…" multiline testID="f-desc" />

        <Text style={styles.section}>PRICING & CAPACITY</Text>
        <Text style={styles.helper}>Economy is always free walk-in.</Text>
        <View style={styles.row}>
          <Field style={{ flex: 1 }} label="BUSINESS ₱ / TABLE" value={bizPrice} onChange={setBizPrice} keyboardType="number-pad" testID="f-bizprice" />
          <Field style={{ flex: 1 }} label="FIRST ₱ / BOOTH" value={firstPrice} onChange={setFirstPrice} keyboardType="number-pad" testID="f-firstprice" />
        </View>
        <View style={styles.row}>
          <Field style={{ flex: 1 }} label="ECONOMY CAP" value={ecoCap} onChange={setEcoCap} keyboardType="number-pad" testID="f-ecocap" />
          <Field style={{ flex: 1 }} label="TABLES (max 12)" value={bizTables} onChange={setBizTables} keyboardType="number-pad" testID="f-tables" />
          <Field style={{ flex: 1 }} label="BOOTHS (max 4)" value={firstBooths} onChange={setFirstBooths} keyboardType="number-pad" testID="f-booths" />
        </View>

        <Text style={styles.section}>AFTER THE NIGHT</Text>
        <Field
          label="PHOTO GALLERY LINK (Google Drive)"
          value={galleryUrl}
          onChange={setGalleryUrl}
          placeholder="https://drive.google.com/…"
          testID="f-gallery"
          autoCapitalize="none"
        />
        <Text style={styles.helper}>Shown on the flight once it has landed.</Text>

        {error && <Text style={styles.errText} testID="form-error">{error}</Text>}
      </KeyboardAwareScrollView>

      <View style={[styles.sticky, { paddingBottom: insets.bottom + spacing.md }]}>
        <Pressable
          testID="save-flight"
          onPress={save}
          disabled={saving}
          style={[styles.saveBtn, saving && { opacity: 0.5 }]}
        >
          {saving ? (
            <ActivityIndicator color={colors.onBrand} />
          ) : (
            <Text style={styles.saveText}>{isEdit ? "SAVE CHANGES" : "CREATE FLIGHT"}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
  multiline,
  style,
  testID,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChange: (t: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "number-pad";
  multiline?: boolean;
  style?: any;
  testID?: string;
  autoCapitalize?: "none" | "sentences" | "words";
}) {
  return (
    <View style={[{ marginTop: spacing.lg }, style]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.onSurfaceSecondary}
        style={[styles.input, multiline && { height: 90, textAlignVertical: "top" }]}
        keyboardType={keyboardType}
        multiline={multiline}
        autoCapitalize={autoCapitalize}
      />
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
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
    backgroundColor: colors.surfaceSecondary,
  },
  topTitle: { fontFamily: fonts.monoBold, color: colors.onSurface, fontSize: font.base, letterSpacing: 2 },
  label: {
    fontFamily: fonts.mono,
    color: colors.onSurfaceSecondary,
    fontSize: 10,
    letterSpacing: 1.5,
    marginBottom: spacing.sm,
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
  preview: { width: "100%", height: 160, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary },
  presetRow: { gap: spacing.sm, paddingVertical: spacing.md },
  presetThumb: {
    width: 64, height: 48, borderRadius: radius.sm,
    borderWidth: 2, borderColor: "transparent",
  },
  presetActive: { borderColor: colors.brand },
  uploadBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderStrong,
    borderRadius: radius.md, paddingVertical: spacing.md,
  },
  uploadText: { fontFamily: fonts.monoBold, color: colors.onSurface, fontSize: font.sm },
  permText: { fontFamily: fonts.mono, color: colors.error, fontSize: font.sm, marginTop: spacing.sm, textAlign: "center" },
  row: { flexDirection: "row", gap: spacing.md },
  section: {
    fontFamily: fonts.mono, color: colors.brandSecondary, fontSize: 11, letterSpacing: 2,
    marginTop: spacing.xxl,
  },
  helper: { fontFamily: fonts.mono, color: colors.onSurfaceSecondary, fontSize: font.sm, marginTop: spacing.xs },
  errText: { fontFamily: fonts.mono, color: colors.error, fontSize: font.sm, marginTop: spacing.lg, textAlign: "center" },
  sticky: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    paddingHorizontal: spacing.xl, paddingTop: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
  },
  saveBtn: {
    backgroundColor: colors.brand, paddingVertical: spacing.md + 2,
    borderRadius: 999, alignItems: "center",
  },
  saveText: { fontFamily: fonts.monoBold, color: colors.onBrand, letterSpacing: 2, fontSize: font.base },
});
