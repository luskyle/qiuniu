export type NoteDuration = 1 | 2 | 4 | 8 | 16;

export interface ScoreNote {
  id: string;
  diatonicStep: number;
  duration: NoteDuration;
}

export interface ScoreModel {
  schemaVersion: 1;
  notes: ScoreNote[];
}

const pitchNames: Readonly<Record<number, string>> = {
  "-9": "c",
  "-8": "d",
  "-7": "e",
  "-6": "f",
  "-5": "g",
  "-4": "a",
  "-3": "b",
  "-2": "c'",
  "-1": "d'",
  "0": "e'",
  "1": "f'",
  "2": "g'",
  "3": "a'",
  "4": "b'",
  "5": "c''",
  "6": "d''",
  "7": "e''",
  "8": "f''",
  "9": "g''",
  "10": "a''",
  "11": "b''",
  "12": "c'''",
  "13": "d'''",
  "14": "e'''"
};

export function createEmptyScore(): ScoreModel {
  return { schemaVersion: 1, notes: [] };
}

export function serializeScore(score: ScoreModel): string {
  if (score.schemaVersion !== 1) {
    throw new Error(`Unsupported score model version: ${score.schemaVersion}`);
  }

  const music = score.notes
    .map((note) => {
      const pitch = pitchNames[note.diatonicStep];
      if (!pitch) {
        throw new Error(`Unsupported staff position: ${note.diatonicStep}`);
      }
      if (![1, 2, 4, 8, 16].includes(note.duration)) {
        throw new Error(`Unsupported note duration: ${note.duration}`);
      }
      return `${pitch}${note.duration}`;
    })
    .join(" ");

  return [
    '\\version "2.26.0"',
    "",
    "\\score {",
    "  \\new Staff {",
    `    ${music}`,
    "  }",
    "  \\layout { }",
    "}"
  ].join("\n");
}
