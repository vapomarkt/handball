import {
  CourtMode,
  TacticBoardData,
  TacticKeyframe,
  TacticToken,
} from "../schemas/tactic";

export type HandballPresetType = "6_0" | "5_1" | "3_2_1" | "7_6" | "FAST_BREAK";

/**
 * Koordinatensystem: 0..1000 x 0..1000 (SVG-unabhängig, JSON-serialisierbar).
 * Halbfeld: Tor oben bei y=60, 6m-Kreis ~y=280, 9m-Linie ~y=410, Mittellinie y=940.
 * Ganzfeld: Tor links x=40, Tor rechts x=960, Mittellinie x=500.
 */
export function createFormationPreset(preset: HandballPresetType): {
  courtMode: CourtMode;
  boardData: TacticBoardData;
} {
  if (preset === "FAST_BREAK") {
    const tokens: TacticToken[] = [
      { id: "tw", kind: "GOALKEEPER", label: "TW", x: 95, y: 500 },
      { id: "la", kind: "ATTACKER", label: "LA", x: 380, y: 165 },
      { id: "ra", kind: "ATTACKER", label: "RA", x: 350, y: 835 },
      { id: "rl", kind: "ATTACKER", label: "RL", x: 260, y: 340 },
      { id: "rm", kind: "ATTACKER", label: "RM", x: 230, y: 515 },
      { id: "rr", kind: "ATTACKER", label: "RR", x: 270, y: 690 },
      { id: "km", kind: "ATTACKER", label: "KM", x: 310, y: 500 },
      { id: "d1", kind: "DEFENDER", label: "1", x: 560, y: 260 },
      { id: "d2", kind: "DEFENDER", label: "2", x: 540, y: 460 },
      { id: "d3", kind: "DEFENDER", label: "3", x: 545, y: 670 },
      { id: "dtw", kind: "DEFENDER", label: "TW", x: 910, y: 500 },
      { id: "ball", kind: "BALL", label: "", x: 135, y: 485 },
    ];
    return {
      courtMode: "FULL_COURT",
      boardData: {
        version: 1,
        keyframes: [
          {
            id: "kf-1",
            label: "Ballgewinn & 1. Welle",
            notes: "Torwart eröffnet direkt auf den startenden Linksaußen.",
            durationMs: 1400,
            tokens,
            drawings: [
              { id: "dr-1", kind: "PASS", x1: 135, y1: 485, x2: 530, y2: 185 },
              { id: "dr-2", kind: "RUN", x1: 380, y1: 165, x2: 760, y2: 240 },
            ],
          },
        ],
      },
    };
  }

  // Standard-Angriffsaufstellung Halbfeld
  const attackers: TacticToken[] = [
    { id: "la", kind: "ATTACKER", label: "LA", x: 110, y: 240 },
    { id: "rl", kind: "ATTACKER", label: "RL", x: 255, y: 610 },
    { id: "rm", kind: "ATTACKER", label: "RM", x: 500, y: 695 },
    { id: "rr", kind: "ATTACKER", label: "RR", x: 745, y: 610 },
    { id: "ra", kind: "ATTACKER", label: "RA", x: 890, y: 240 },
    { id: "km", kind: "ATTACKER", label: "KM", x: 565, y: 365 },
  ];

  if (preset === "7_6") {
    attackers.push({
      id: "km2",
      kind: "ATTACKER",
      label: "KM2",
      x: 385,
      y: 365,
    });
  }

  let defenders: TacticToken[];
  if (preset === "5_1") {
    defenders = [
      { id: "d1", kind: "DEFENDER", label: "1", x: 225, y: 285 },
      { id: "d2", kind: "DEFENDER", label: "2", x: 350, y: 350 },
      { id: "d3", kind: "DEFENDER", label: "3", x: 500, y: 365 },
      { id: "d4", kind: "DEFENDER", label: "4", x: 650, y: 350 },
      { id: "d5", kind: "DEFENDER", label: "5", x: 775, y: 285 },
      { id: "d6", kind: "DEFENDER", label: "V", x: 500, y: 540 },
    ];
  } else if (preset === "3_2_1") {
    defenders = [
      { id: "d1", kind: "DEFENDER", label: "1", x: 235, y: 290 },
      { id: "d2", kind: "DEFENDER", label: "HM", x: 500, y: 345 },
      { id: "d3", kind: "DEFENDER", label: "6", x: 765, y: 290 },
      { id: "d4", kind: "DEFENDER", label: "HL", x: 335, y: 455 },
      { id: "d5", kind: "DEFENDER", label: "HR", x: 665, y: 455 },
      { id: "d6", kind: "DEFENDER", label: "V", x: 500, y: 565 },
    ];
  } else {
    // 6:0-Abwehr (Standard)
    defenders = [
      { id: "d1", kind: "DEFENDER", label: "1", x: 215, y: 270 },
      { id: "d2", kind: "DEFENDER", label: "2", x: 330, y: 345 },
      { id: "d3", kind: "DEFENDER", label: "3", x: 445, y: 375 },
      { id: "d4", kind: "DEFENDER", label: "4", x: 555, y: 375 },
      { id: "d5", kind: "DEFENDER", label: "5", x: 670, y: 345 },
      { id: "d6", kind: "DEFENDER", label: "6", x: 785, y: 270 },
    ];
  }

  const tokens: TacticToken[] = [
    { id: "tw", kind: "GOALKEEPER", label: "TW", x: 500, y: 120 },
    ...attackers,
    ...defenders,
    { id: "ball", kind: "BALL", label: "", x: 530, y: 660 },
  ];

  return {
    courtMode: "HALF_COURT",
    boardData: {
      version: 1,
      keyframes: [
        {
          id: "kf-1",
          label: "Ausgangsstellung",
          notes: "Grundaufstellung – ziehe Spieler oder zeichne Lauf- und Passwege.",
          durationMs: 1400,
          tokens,
          drawings: [],
        },
      ],
    },
  };
}

function easeInOutCubic(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return clamped < 0.5
    ? 4 * clamped * clamped * clamped
    : 1 - Math.pow(-2 * clamped + 2, 3) / 2;
}

/**
 * Reine Interpolations-Funktion für die 60fps-Schritt-für-Schritt-Animation
 * zwischen zwei Keyframes (mit kubischer Ease-in-out-Bewegung).
 */
export function interpolateKeyframeTokens(
  fromFrame: TacticKeyframe,
  toFrame: TacticKeyframe,
  rawProgress: number
): TacticToken[] {
  const eased = easeInOutCubic(rawProgress);
  const toById = new Map<string, TacticToken>();
  for (const t of toFrame.tokens) {
    toById.set(t.id, t);
  }

  const result: TacticToken[] = [];
  for (const fromToken of fromFrame.tokens) {
    const target = toById.get(fromToken.id);
    if (!target) {
      result.push(fromToken);
      continue;
    }
    result.push({
      ...fromToken,
      x: Math.round((fromToken.x + (target.x - fromToken.x) * eased) * 10) / 10,
      y: Math.round((fromToken.y + (target.y - fromToken.y) * eased) * 10) / 10,
    });
  }

  return result;
}
