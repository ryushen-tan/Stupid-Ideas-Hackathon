import Svg, { Circle, G, Path, Rect } from "react-native-svg";
import { GarmentKind } from "../../shared/model";
import { palette } from "../theme";

export type Badge =
  | "plus"
  | "qr"
  | "check"
  | "search"
  | "history"
  | "settings"
  | "camera"
  | "arrow"
  | "close";

export function Garment({
  kind = "shirt",
  size = 72,
  color = palette.sage,
  badge,
  face = false,
}: {
  kind?: GarmentKind;
  size?: number;
  color?: string;
  badge?: Badge;
  face?: boolean;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <G
        stroke={palette.ink}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {kind === "shirt" && (
          <>
            <Path
              d="M34 19 20 25 8 43 24 54 30 45 30 83Q50 89 70 83L70 45 76 54 92 43 80 25 66 19Z"
              fill={color}
            />
            <Path d="M37 20Q50 39 63 20M34 77H66" fill="none" />
          </>
        )}
        {kind === "hoodie" && (
          <>
            <Path
              d="M31 25Q30 6 50 7Q70 6 69 25L81 31 93 67 78 74 71 51 74 89H26L29 51 22 74 7 67 19 31Z"
              fill={color}
            />
            <Path
              d="M31 25 50 40 69 25M41 36 39 53M59 36 61 53M39 67 34 79H66L61 67ZM29 83H71"
              fill="none"
            />
            <Path d="M38 23Q50 10 62 23L50 34Z" fill="#FFFFFF" />
          </>
        )}
        {kind === "hat" && (
          <>
            <Path d="M23 59Q18 21 52 20Q80 20 80 60L55 70Z" fill={color} />
            <Path
              d="M23 58Q9 61 9 69Q34 88 82 73Q97 67 83 60Q58 48 23 58Z"
              fill={color}
            />
            <Path d="M51 21Q34 35 39 55M28 65Q54 78 79 65" fill="none" />
            <Path d="M46 18Q51 13 56 18" fill="none" />
          </>
        )}
        {kind === "pants" && (
          <>
            <Path d="M26 12H74L80 88 57 90 50 44 43 90 20 88Z" fill={color} />
            <Path
              d="M26 23H74M50 23V39M30 25Q32 38 42 37M70 25Q68 38 58 37M23 81 43 83M57 83 77 81"
              fill="none"
            />
            <Circle cx="50" cy="18" r="1" fill={palette.ink} />
          </>
        )}
        {kind === "bag" && (
          <>
            <Path d="M22 34H78L84 85Q50 96 16 85Z" fill={color} />
            <Path d="M36 41V25Q36 7 50 7Q64 7 64 25V41" fill="none" />
            <Path d="M26 78Q50 85 74 78" fill="none" />
          </>
        )}
        {kind === "shoe" && (
          <>
            <Path
              d="M17 32Q26 46 40 37L51 25 71 48 88 55Q95 59 92 74H9V56Z"
              fill={color}
            />
            <Path
              d="M9 74H92V82H9ZM47 40 58 36M54 47 65 42M61 54 72 49M14 60Q24 63 34 57"
              fill="white"
            />
          </>
        )}
        {kind === "can" && (
          <>
            <Rect x="29" y="12" width="42" height="78" rx="10" fill={color} />
            <Path
              d="M30 24H70M30 79H70M44 16H56M53 34 40 55H52L46 70 64 46H51Z"
              fill="white"
            />
          </>
        )}
        {kind === "snack" && (
          <>
            <Path
              d="M25 13 32 18 39 13 46 18 53 13 60 18 67 13 75 18 71 83 64 88 57 83 50 88 43 83 36 88 25 83 29 25Z"
              fill={color}
            />
            <Path d="M29 27H71M28 75H72" fill="none" />
            <Circle cx="50" cy="51" r="15" fill="white" />
            <Path d="m43 49 7-7 7 7-7 12Z" fill={color} />
          </>
        )}
        {face && !badge && (
          <>
            <Circle cx="43" cy="57" r="2" fill={palette.ink} />
            <Circle cx="57" cy="57" r="2" fill={palette.ink} />
            <Path d="M44 64Q50 70 56 64" fill="none" />
          </>
        )}
      </G>
      {badge && (
        <G transform="translate(50 57)">
          <Circle r="19" fill="white" stroke={palette.ink} strokeWidth="2.5" />
          <Mark badge={badge} />
        </G>
      )}
    </Svg>
  );
}

function Mark({ badge }: { badge: Badge }) {
  return (
    <G
      stroke={palette.ink}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      {badge === "plus" && <Path d="M-8 0H8M0-8V8" />}
      {badge === "check" && <Path d="m-8 0 5 5 11-11" />}
      {badge === "arrow" && <Path d="M-8 0H8M2-6 8 0 2 6" />}
      {badge === "close" && <Path d="m-6-6 12 12M6-6-6 6" />}
      {badge === "search" && (
        <>
          <Circle cx="-2" cy="-2" r="6" />
          <Path d="m3 3 6 6" />
        </>
      )}
      {badge === "qr" && (
        <>
          <Rect x="-9" y="-9" width="6" height="6" />
          <Rect x="3" y="-9" width="6" height="6" />
          <Rect x="-9" y="3" width="6" height="6" />
          <Path d="M3 3H9V9H3M0-1V1" />
        </>
      )}
      {badge === "history" && (
        <>
          <Path d="M-9-3A10 10 0 1 1-8 6M-10-9V-2H-3M0-6V0L5 3" />
        </>
      )}
      {badge === "camera" && (
        <>
          <Path d="M-10-5H-5L-3-8H3L5-5H10V8H-10Z" />
          <Circle r="4" />
        </>
      )}
      {badge === "settings" && (
        <>
          <Circle r="5" />
          <Path d="M0-11V-8M0 8V11M-11 0H-8M8 0H11M-8-8-6-6M8 8 6 6M-8 8-6 6M8-8 6-6" />
        </>
      )}
    </G>
  );
}
