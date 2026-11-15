import { useState } from "react";
import { Platform, Text, View } from "react-native";
import { ScanRecord, scanLabel, StoreSession } from "../../shared/model";
import { request } from "../api";
import { Garment } from "../components/Garment";
import { Button, common, Notice, Pill } from "../components/UI";
import { pickPhoto } from "../photos";
import { fonts, palette } from "../theme";

export function Result({
  record,
  session,
  onResult,
  onAgain,
  onOpenItem,
}: {
  record: ScanRecord;
  session: StoreSession | null;
  onResult: (record: ScanRecord) => void;
  onAgain: () => void;
  onOpenItem: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const failed =
    record.tag === "mismatch" ||
    record.tag === "not_found" ||
    record.photo === "mismatch";
  const passed = record.tag === "matched" && record.photo === "consistent";
  async function checkPhoto(camera: boolean) {
    if (!session || !record.itemId) return;
    setBusy(true);
    setError("");
    try {
      const photo = await pickPhoto(camera);
      if (photo)
        onResult(
          await request<ScanRecord>(session, "/photo-checks", {
            method: "POST",
            body: JSON.stringify({
              itemId: record.itemId,
              scanId: record.id,
              photo,
            }),
          }),
        );
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={common.stack}>
      <View
        style={{
          backgroundColor: failed ? palette.paleDanger : palette.paleGreen,
          borderRadius: 25,
          padding: 25,
          alignItems: "center",
          gap: 12,
        }}
      >
        <Garment
          kind={record.kind}
          badge={failed ? "close" : passed ? "check" : "search"}
          size={120}
          color={failed ? "#EEC4BE" : palette.lime}
        />
        <Text style={[common.title, { textAlign: "center", fontSize: 29 }]}>
          {scanLabel(record)}
        </Text>
        <Text style={[common.subtitle, { textAlign: "center" }]}>
          {record.itemName}
        </Text>
      </View>
      <View style={[common.card, { gap: 20 }]}>
        <View style={common.row}>
          <Text
            style={{
              fontFamily: fonts.display,
              fontSize: 25,
              color: palette.blue,
            }}
          >
            01
          </Text>
          <View style={{ flex: 1 }}>
            <Text style={common.sectionTitle}>The tag check</Text>
            <Text style={common.subtitle}>Exact catalog identity</Text>
          </View>
          <Pill
            text={
              record.tag === "matched"
                ? "Matched"
                : record.tag === "not_scanned"
                  ? "Not scanned"
                  : record.tag === "not_found"
                    ? "Not found"
                    : "Mismatch"
            }
            tone={
              record.tag === "matched" ? "green" : failed ? "red" : "neutral"
            }
          />
        </View>
        <View style={{ height: 1, backgroundColor: palette.line }} />
        <View style={common.row}>
          <Text
            style={{
              fontFamily: fonts.display,
              fontSize: 25,
              color: palette.blue,
            }}
          >
            02
          </Text>
          <View style={{ flex: 1 }}>
            <Text style={common.sectionTitle}>The photo check</Text>
            <Text style={common.subtitle}>Appearance comparison</Text>
          </View>
          <Pill
            text={
              record.photo === "pending"
                ? "Next up"
                : record.photo === "consistent"
                  ? "Consistent"
                  : record.photo === "uncertain"
                    ? "Uncertain"
                    : "Mismatch"
            }
            tone={
              record.photo === "consistent"
                ? "green"
                : record.photo === "mismatch"
                  ? "red"
                  : "blue"
            }
          />
        </View>
      </View>
      <Text style={common.text}>{record.explanation}</Text>
      {record.observations.map((observation, index) => (
        <Text key={index} style={common.subtitle}>
          • {observation}
        </Text>
      ))}
      {Boolean(error) && <Notice error>{error}</Notice>}
      {session && record.tag === "matched" && (
        <>
          <Button
            label={
              record.photo === "pending"
                ? "Add the second check"
                : "Check another photo"
            }
            kind="hat"
            badge="camera"
            loading={busy}
            onPress={() => void checkPhoto(false)}
          />
          {Platform.OS !== "web" && (
            <Button
              label="Take a fresh photo"
              badge="camera"
              tone="secondary"
              loading={busy}
              onPress={() => void checkPhoto(true)}
            />
          )}
          <Text style={[common.subtitle, { fontSize: 12 }]}>
            The new and reference photos are sent to Backboard for comparison.
          </Text>
        </>
      )}
      {record.itemId && (
        <Button
          label="Open this piece"
          kind={record.kind}
          tone="secondary"
          disabled={busy}
          onPress={() => onOpenItem(record.itemId!)}
        />
      )}
      <Button
        label="Scan another piece"
        badge="qr"
        tone="secondary"
        disabled={busy}
        onPress={onAgain}
      />
      <Notice>
        {passed
          ? "Both checks passed: the tag matches a catalog record and the photos look consistent. This does not certify authenticity or prove it is the same physical garment."
          : "An exact match needs a registered tag. Photo similarity alone cannot establish size, authenticity, or individual identity."}
      </Notice>
      <Text style={[common.subtitle, { textAlign: "center", fontSize: 11 }]}>
        Saved {new Date(record.createdAt).toLocaleString()} · {record.source}
      </Text>
    </View>
  );
}
