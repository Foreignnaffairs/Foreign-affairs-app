import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, fonts, spacing, radius } from "@/src/theme";
import { Booking, formatDeparture } from "@/src/api";

// Deterministic barcode bars from a string.
function bars(seed: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < 44; i++) {
    const code = seed.charCodeAt(i % seed.length) + i * 7;
    out.push((code % 3) + 1); // width 1..3
  }
  return out;
}

function Barcode({ seed }: { seed: string }) {
  return (
    <View style={styles.barcode}>
      {bars(seed).map((w, i) => (
        <View
          key={i}
          style={{
            width: w,
            height: "100%",
            backgroundColor: i % 2 === 0 ? colors.onSurfaceInverse : "transparent",
            marginRight: 2,
          }}
        />
      ))}
    </View>
  );
}

function Notch({ side }: { side: "left" | "right" }) {
  return (
    <View
      style={[
        styles.notch,
        side === "left" ? styles.notchLeft : styles.notchRight,
      ]}
    />
  );
}

function BoardingPassBase({ booking }: { booking: Booking }) {
  const { date, time } = formatDeparture(booking.departure);

  return (
    <View style={styles.pass} testID={`boarding-pass-${booking.id}`}>
      {/* Header strip */}
      <View style={styles.header}>
        <Text style={styles.brand}>FOREIGN AFFAIRS</Text>
        <Text style={styles.classTag}>{booking.class_name.toUpperCase()}</Text>
      </View>

      {/* Route */}
      <View style={styles.routeRow}>
        <View>
          <Text style={styles.miniLabel}>MANILA</Text>
          <Text style={styles.code}>MNL</Text>
        </View>
        <View style={styles.planeMid}>
          <View style={styles.dottedLine} />
          <Text style={styles.plane}>✈</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.miniLabel}>{booking.destination.toUpperCase()}</Text>
          <Text style={styles.code}>
            {booking.destination.slice(0, 3).toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Passenger info grid */}
      <View style={styles.grid}>
        <View style={styles.gridItem}>
          <Text style={styles.miniLabel}>PASSENGER</Text>
          <Text style={styles.gridValue} numberOfLines={1}>
            {booking.passenger_name}
          </Text>
        </View>
        <View style={styles.gridItem}>
          <Text style={styles.miniLabel}>FLIGHT</Text>
          <Text style={styles.gridValue}>{booking.flight_number}</Text>
        </View>
      </View>

      <View style={styles.grid}>
        <View style={styles.gridItem}>
          <Text style={styles.miniLabel}>DATE</Text>
          <Text style={styles.gridValue}>{date}</Text>
        </View>
        <View style={styles.gridItem}>
          <Text style={styles.miniLabel}>BOARDING</Text>
          <Text style={styles.gridValue}>{time}</Text>
        </View>
        <View style={styles.gridItem}>
          <Text style={styles.miniLabel}>GATE</Text>
          <Text style={styles.gridValue}>{booking.gate}</Text>
        </View>
        <View style={styles.gridItem}>
          <Text style={styles.miniLabel}>
            {booking.unit === "table" ? "TABLE" : "SEAT"}
          </Text>
          <Text style={styles.gridValue}>{booking.seat_label}</Text>
        </View>
      </View>

      <View style={styles.grid}>
        <View style={styles.gridItem}>
          <Text style={styles.miniLabel}>PILOT</Text>
          <Text style={styles.gridValue}>{booking.pilot}</Text>
        </View>
        <View style={styles.gridItem}>
          <Text style={styles.miniLabel}>VENUE</Text>
          <Text style={styles.gridValue} numberOfLines={1}>
            {booking.venue}
          </Text>
        </View>
      </View>

      {/* Perforation */}
      <View style={styles.perforation}>
        <Notch side="left" />
        <View style={styles.perfLine} />
        <Notch side="right" />
      </View>

      {/* Stub */}
      <View style={styles.stub}>
        <View>
          <Text style={styles.miniLabel}>BOOKING REF</Text>
          <Text style={styles.ref}>{booking.reference}</Text>
        </View>
        <Barcode seed={booking.reference} />
      </View>
    </View>
  );
}

export const BoardingPass = memo(BoardingPassBase);

const styles = StyleSheet.create({
  pass: {
    backgroundColor: colors.surfaceInverse,
    borderRadius: radius.lg,
    padding: spacing.lg,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: spacing.md,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.onSurfaceInverse,
    borderStyle: "dashed",
  },
  brand: {
    fontFamily: fonts.display,
    color: colors.onSurfaceInverse,
    fontSize: 15,
    letterSpacing: 2,
  },
  classTag: {
    fontFamily: fonts.monoBold,
    color: colors.onSurfaceInverse,
    fontSize: 10,
    letterSpacing: 1,
    backgroundColor: colors.brand,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    overflow: "hidden",
  },
  routeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.lg,
  },
  planeMid: { flex: 1, alignItems: "center", paddingHorizontal: spacing.md },
  dottedLine: {
    position: "absolute",
    top: "50%",
    left: 8,
    right: 8,
    borderTopWidth: 1,
    borderTopColor: "#00000030",
    borderStyle: "dashed",
  },
  plane: { fontSize: 18, color: colors.onSurfaceInverse },
  miniLabel: {
    fontFamily: fonts.mono,
    color: "#00000080",
    fontSize: 8,
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  code: {
    fontFamily: fonts.display,
    color: colors.onSurfaceInverse,
    fontSize: 28,
    lineHeight: 30,
  },
  grid: {
    flexDirection: "row",
    marginTop: spacing.lg,
  },
  gridItem: { flex: 1 },
  gridValue: {
    fontFamily: fonts.monoBold,
    color: colors.onSurfaceInverse,
    fontSize: 13,
  },
  perforation: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.lg,
    marginHorizontal: -spacing.lg,
  },
  perfLine: {
    flex: 1,
    borderTopWidth: 1.5,
    borderTopColor: "#00000040",
    borderStyle: "dashed",
    marginHorizontal: 6,
  },
  notch: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  notchLeft: { marginLeft: -10 },
  notchRight: { marginRight: -10 },
  stub: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.lg,
  },
  ref: {
    fontFamily: fonts.monoBold,
    color: colors.onSurfaceInverse,
    fontSize: 18,
    letterSpacing: 1,
  },
  barcode: {
    flexDirection: "row",
    height: 44,
    alignItems: "stretch",
  },
});
