import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Page, ScanRecord, scanLabel, StoreSession } from "../../shared/model";
import { request } from "../api";
import { Garment } from "../components/Garment";
import { Button, common, Notice, Pill } from "../components/UI";

export function Activity({
  session,
  onResult,
  onScan,
}: {
  session: StoreSession | null;
  onResult: (scan: ScanRecord) => void;
  onScan: () => void;
}) {
  const [records, setRecords] = useState<ScanRecord[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(Boolean(session));
  const [offset, setOffset] = useState(0);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    if (session)
      request<Page<ScanRecord>>(session, `/scans?offset=${offset}`)
        .then((result) => {
          if (active) {
            setRecords((previous) =>
              offset ? [...previous, ...result.items] : result.items,
            );
            setHasMore(result.hasMore);
            setError("");
          }
        })
        .catch((failure) => {
          if (active) setError((failure as Error).message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    return () => {
      active = false;
    };
  }, [session, offset, revision]);
  return (
    <View style={common.stack}>
      <Text style={common.eyebrow}>EVERY LITTLE CHECK, ALL HERE</Text>
      <Text style={common.title}>A trail of good checks.</Text>
      <Text style={common.subtitle}>
        Your most recent scans, across connected devices.
      </Text>
      <Button
        label="Refresh checks"
        kind="hoodie"
        badge="history"
        tone="secondary"
        small
        loading={loading}
        onPress={() => {
          setOffset(0);
          setRevision((value) => value + 1);
          setLoading(Boolean(session));
        }}
      />
      {Boolean(error) && <Notice error>{error}</Notice>}
      {records.map((record) => (
        <Pressable
          key={record.id}
          accessibilityRole="button"
          accessibilityLabel={`View check for ${record.itemName}`}
          onPress={() => onResult(record)}
          style={[common.card, common.row]}
        >
          <Garment kind={record.kind} badge="history" size={57} />
          <View style={{ flex: 1, gap: 7 }}>
            <Text style={common.sectionTitle}>{record.itemName}</Text>
            <Pill
              text={scanLabel(record)}
              tone={
                record.tag === "mismatch" ||
                record.photo === "mismatch" ||
                record.tag === "not_found"
                  ? "red"
                  : record.tag === "matched" && record.photo === "consistent"
                    ? "green"
                    : "blue"
              }
            />
            <Text style={[common.subtitle, { fontSize: 12 }]}>
              {new Date(record.createdAt).toLocaleString()} · {record.source}
            </Text>
          </View>
        </Pressable>
      ))}
      {loading && <ActivityIndicator />}
      {!loading && !error && records.length === 0 && (
        <View style={[common.card, { alignItems: "center", gap: 15 }]}>
          <Garment kind="hoodie" badge="history" size={115} />
          <Text style={common.sectionTitle}>A fresh start.</Text>
          <Text style={[common.subtitle, { textAlign: "center" }]}>
            Your checks will land here after your first scan.
          </Text>
          <Button label="Check your first piece" badge="qr" onPress={onScan} />
        </View>
      )}
      {hasMore && (
        <Button
          label="More checks"
          kind="hoodie"
          badge="history"
          tone="secondary"
          loading={loading}
          onPress={() => {
            setOffset(records.length);
            setLoading(true);
          }}
        />
      )}
    </View>
  );
}
