import { useState } from "react";
import { Image, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { ClothingItem, StoreSession } from "../../shared/model";
import { request } from "../api";
import { Garment } from "../components/Garment";
import { Button, common, Notice, Pill } from "../components/UI";
import { pickPhoto } from "../photos";
import { palette } from "../theme";

export function ItemDetail({
  item,
  session,
  onUpdated,
  onScan,
  onConnect,
}: {
  item: ClothingItem;
  session: StoreSession | null;
  onUpdated: (item: ClothingItem) => void;
  onScan: () => void;
  onConnect: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const qr = `threadcheck://item?barcode=${encodeURIComponent(item.barcode)}&serial=${encodeURIComponent(item.serial)}`;
  return (
    <View style={common.stack}>
      <View
        style={{
          alignItems: "center",
          padding: 24,
          borderRadius: 25,
          backgroundColor: palette.paleSage,
        }}
      >
        {item.photo ? (
          <Image
            source={{ uri: item.photo }}
            style={{
              width: 210,
              height: 210,
              borderRadius: 24,
              resizeMode: "contain",
            }}
          />
        ) : (
          <Garment
            kind={item.kind}
            size={170}
            color={item.kind === "pants" ? "#8BAAC5" : palette.sage}
            face
          />
        )}
        {!item.photo && (
          <Text style={[common.subtitle, { fontSize: 11 }]}>
            Illustration · add a real reference photo below
          </Text>
        )}
      </View>
      <Text style={common.eyebrow}>{item.brand}</Text>
      <Text style={common.title}>{item.name}</Text>
      <View style={common.row}>
        <Pill text={item.color} />
        <Pill text={`Size ${item.size}`} />
        <Pill
          text={item.serial ? "Serialized item" : "Product variant"}
          tone="blue"
        />
      </View>
      {Boolean(error) && <Notice error>{error}</Notice>}
      <Button
        label="Check this exact piece"
        badge="qr"
        onPress={session ? onScan : onConnect}
      />
      <View style={[common.card, { gap: 12 }]}>
        <Text style={common.sectionTitle}>The details that make it, it.</Text>
        <Text style={common.text}>Product code: {item.barcode}</Text>
        {Boolean(item.serial) && (
          <Text style={common.text}>Serial: {item.serial}</Text>
        )}
        <Text style={common.subtitle}>
          {item.serial
            ? "Both the product code and registered serial must match. A copied tag still cannot prove physical authenticity."
            : "This tag identifies this product, color, and size. Add a serial when registering an individually tracked garment."}
        </Text>
      </View>
      <View style={[common.card, { gap: 15 }]}>
        <Text style={common.sectionTitle}>Check 02 · The photo</Text>
        <Pill
          text={item.photo ? "Reference photo saved" : "Reference photo needed"}
          tone={item.photo ? "green" : "neutral"}
        />
        <Text style={common.subtitle}>
          Your fresh scan is compared against this saved photo using Backboard.
        </Text>
        <Button
          label={item.photo ? "Replace reference photo" : "Add reference photo"}
          kind="hat"
          badge="camera"
          loading={busy}
          tone="secondary"
          onPress={async () => {
            if (!session) {
              onConnect();
              return;
            }
            setBusy(true);
            setError("");
            try {
              const photo = await pickPhoto(false);
              if (photo)
                onUpdated(
                  await request<ClothingItem>(
                    session,
                    `/items/${item.id}/photo`,
                    { method: "PATCH", body: JSON.stringify({ photo }) },
                  ),
                );
            } catch (failure) {
              setError((failure as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      </View>
      <View style={[common.card, { alignItems: "center", gap: 16 }]}>
        <Text style={common.sectionTitle}>This piece’s QR tag</Text>
        <View style={{ padding: 16, backgroundColor: palette.white }}>
          <QRCode
            value={qr}
            size={175}
            color={palette.ink}
            backgroundColor={palette.white}
          />
        </View>
        <Text
          selectable
          style={[common.subtitle, { textAlign: "center", fontSize: 12 }]}
        >
          {item.barcode}
          {item.serial ? ` / ${item.serial}` : ""}
        </Text>
        <Text style={[common.subtitle, { textAlign: "center", fontSize: 12 }]}>
          Scan on another device or screenshot to print a label. A 2D store
          scanner can read this QR.
        </Text>
      </View>
    </View>
  );
}
