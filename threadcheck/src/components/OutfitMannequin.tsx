import { useId } from "react";
import { ImageSourcePropType, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, ClipPath, Defs, G, Image, Path } from "react-native-svg";
import { Outfit, placements } from "../../shared/drip";
import { dripColors } from "../drip-theme";

export type ClothingImages = Record<
  Outfit["head"],
  { source: ImageSourcePropType; name: string }
>;

type GarmentPose = {
  layer: number;
  label: string;
  instruction: string;
  labelY: number;
} & (
  | { wrap: "hoodie" | "pants" }
  | { x: number; y: number; width: number; height: number; rotation: number }
);

const poses: Record<keyof Outfit, Record<Outfit["head"], GarmentPose>> = {
  head: {
    hoodie: {
      wrap: "hoodie",
      layer: 3,
      label: "head",
      instruction: "tie into a durag",
      labelY: 38,
    },
    pants: {
      wrap: "pants",
      layer: 3,
      label: "head",
      instruction: "tie into a head wrap",
      labelY: 32,
    },
    hat: {
      x: 56,
      y: 8,
      width: 68,
      height: 54,
      rotation: 0,
      layer: 3,
      label: "head",
      instruction: "wear on head",
      labelY: 34,
    },
  },
  body: {
    hoodie: {
      x: 20,
      y: 65,
      width: 140,
      height: 138,
      rotation: 0,
      layer: 2,
      label: "torso",
      instruction: "wear as a hoodie",
      labelY: 125,
    },
    pants: {
      x: 30,
      y: 102,
      width: 120,
      height: 150,
      rotation: 0,
      layer: 1,
      label: "torso",
      instruction: "hook waistband onto sleeves",
      labelY: 128,
    },
    hat: {
      x: 58,
      y: 160,
      width: 64,
      height: 58,
      rotation: 0,
      layer: 4,
      label: "hips",
      instruction: "cover crotch with cap",
      labelY: 186,
    },
  },
  feet: {
    hoodie: {
      x: 30,
      y: 148,
      width: 120,
      height: 192,
      rotation: 180,
      layer: 1,
      label: "legs",
      instruction: "flip hoodie upside down",
      labelY: 261,
    },
    pants: {
      x: 42,
      y: 168,
      width: 96,
      height: 142,
      rotation: 0,
      layer: 1,
      label: "legs",
      instruction: "wear as trousers",
      labelY: 255,
    },
    hat: {
      x: 58,
      y: 174,
      width: 64,
      height: 58,
      rotation: 0,
      layer: 4,
      label: "hips",
      instruction: "cover crotch with cap",
      labelY: 202,
    },
  },
};

export function OutfitMannequin({
  outfit,
  clothing,
}: {
  outfit: Outfit;
  clothing: ClothingImages;
}) {
  const legsClipId = useId();
  const garments = placements.map((place) => ({
    place,
    kind: outfit[place],
    pose: poses[place][outfit[place]],
  }));

  return (
    <View
      style={styles.figure}
      accessible
      accessibilityLabel={garments
        .map(({ kind, pose }) => `${clothing[kind].name}: ${pose.instruction}`)
        .join(". ")}
    >
      <Svg width={180} height={320} viewBox="0 0 180 320">
        <Defs>
          <ClipPath id={legsClipId}>
            <Path d="M59 174H121L120 198L114 306H96L90 220L84 306H66L60 198Z" />
          </ClipPath>
        </Defs>
        <G
          fill="#303338"
          stroke="#555A61"
          strokeWidth={1.2}
          strokeLinejoin="round"
        >
          <Circle cx={90} cy={43} r={22} />
          <Path d="M81 64V77L57 85Q49 88 45 104L25 172Q23 181 30 184Q37 186 40 177L60 123L59 170Q56 181 60 198L66 296Q66 303 77 303H83L88 210H92L97 303H104Q115 303 114 296L120 198Q124 181 121 170L120 123L140 177Q143 186 150 184Q157 181 155 172L135 104Q131 88 123 85L99 77V64" />
          <Path d="M67 301L61 310H84V301M97 301V310H120L113 301" />
        </G>
        {garments
          .slice()
          .sort((first, second) => first.pose.layer - second.pose.layer)
          .map(({ place, kind, pose }) =>
            "wrap" in pose ? (
              <HeadWrap
                key={place}
                source={clothing[kind].source}
                kind={pose.wrap}
              />
            ) : (
              <G
                key={place}
                clipPath={
                  place === "feet" && kind !== "hat"
                    ? `url(#${legsClipId})`
                    : undefined
                }
              >
                {place === "body" && kind === "pants" && (
                  <>
                    <Path
                      d="M65 116C44 116 39 95 47 88C56 79 65 93 62 105M115 116C136 116 141 95 133 88C124 79 115 93 118 105"
                      fill="none"
                      stroke="#54738C"
                      strokeWidth={8}
                      strokeLinecap="round"
                    />
                    <Path
                      d="M65 116C44 116 39 95 47 88C56 79 65 93 62 105M115 116C136 116 141 95 133 88C124 79 115 93 118 105"
                      fill="none"
                      stroke="#A3A08B"
                      strokeWidth={1}
                      strokeDasharray="2 3"
                    />
                  </>
                )}
                <Image
                  href={clothing[kind].source}
                  x={pose.x}
                  y={pose.y}
                  width={pose.width}
                  height={pose.height}
                  preserveAspectRatio="none"
                  transform={`rotate(${pose.rotation} ${pose.x + pose.width / 2} ${pose.y + pose.height / 2})`}
                />
              </G>
            ),
          )}
      </Svg>
      {garments.map(({ place, pose }) => (
        <View key={place} style={[styles.label, { top: pose.labelY }]}>
          <View style={styles.line} />
          <Text style={styles.labelText}>{pose.label}</Text>
        </View>
      ))}
    </View>
  );
}

function HeadWrap({
  source,
  kind,
}: {
  source: ImageSourcePropType;
  kind: "hoodie" | "pants";
}) {
  const clipId = useId();
  const hoodie = kind === "hoodie";
  const wrap = hoodie
    ? "M63 42Q57 12 85 9Q111 7 117 31L113 47Q89 37 63 46Z M115 31Q130 22 137 29L130 45L119 43Z M119 40L133 44Q131 76 148 98L132 105Q116 75 116 48Z M116 42L124 47L124 85L112 89L109 48Z M111 31Q122 27 128 37L121 47L111 41Z"
    : "M65 15Q88 4 111 16L120 28L113 47Q89 37 63 46L57 30Z M115 26Q133 9 146 14L137 35L120 39Z M119 34L140 39L150 69L135 72L119 47Z M112 24Q124 22 128 33L122 45L111 39Z";

  return (
    <G>
      <Defs>
        <ClipPath id={clipId}>
          <Path d={wrap} />
        </ClipPath>
      </Defs>
      <Path d={wrap} fill="#303338" />
      <G clipPath={`url(#${clipId})`}>
        <Image
          href={source}
          x={29}
          y={hoodie ? -30 : -57}
          width={150}
          height={161}
          preserveAspectRatio="none"
        />
      </G>
      <Path
        d={wrap}
        fill="none"
        stroke={hoodie ? "#B9B2A1" : "#728394"}
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
      <Path
        d={
          hoodie
            ? "M64 36Q88 28 113 37M87 12Q93 22 93 32M117 34L122 41M123 49Q122 72 139 97M116 49L117 81"
            : "M62 31Q86 19 113 32M64 38Q89 28 111 38M118 28L122 38M128 29L138 21M128 45L141 65"
        }
        fill="none"
        stroke={hoodie ? "#756E61" : "#182733"}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </G>
  );
}

const styles = StyleSheet.create({
  figure: { width: 250, height: 320 },
  label: {
    position: "absolute",
    left: 165,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  line: { width: 12, height: 1, backgroundColor: dripColors.line },
  labelText: { color: dripColors.blue, fontSize: 12 },
});
