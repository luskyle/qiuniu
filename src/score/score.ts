export type NoteDuration = 1 | 2 | 4 | 8 | 16;
export type TimeSignature = "2/4" | "3/4" | "4/4" | "6/8" | "12/8";
export type KeySignature =
  | "C major"
  | "G major"
  | "D major"
  | "F major"
  | "Bb major"
  | "A minor"
  | "E minor"
  | "D minor";

export interface ScoreNote {
  id: string;
  diatonicStep: number;
  duration: NoteDuration;
  accidental?: -1 | 0 | 1;
  dotted?: boolean;
}

export interface ScoreRest {
  id: string;
  type: "rest";
  duration: NoteDuration;
  dotted?: boolean;
}

export interface ScoreSpacer {
  id: string;
  type: "spacer";
  duration: NoteDuration;
  dotted?: boolean;
}

export type ScoreEvent = ScoreNote | ScoreRest | ScoreSpacer;

export interface ScoreModel {
  schemaVersion: 1;
  title: string;
  tempo: number;
  timeSignature: TimeSignature;
  keySignature: KeySignature;
  notes: ScoreEvent[];
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
  return {
    schemaVersion: 1,
    title: "",
    tempo: 100,
    timeSignature: "4/4",
    keySignature: "C major",
    notes: []
  };
}

export function parseScore(source: string): ScoreModel {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch (error) {
    const details = error instanceof Error ? error.message : "Invalid JSON.";
    throw new Error(`Invalid .music file: ${details}`);
  }

  if (!isRecord(value) || value.schemaVersion !== 1) {
    throw new Error("Unsupported or invalid .music score version.");
  }
  if (!Array.isArray(value.notes)) {
    throw new Error("Invalid .music file: notes must be an array.");
  }
  const tempo =
    value.tempo === undefined
      ? 100
      : typeof value.tempo === "number" &&
          Number.isInteger(value.tempo) &&
          value.tempo >= 40 &&
          value.tempo <= 240
        ? value.tempo
        : undefined;
  if (tempo === undefined) {
    throw new Error("Invalid .music file: tempo must be an integer from 40 to 240 BPM.");
  }
  const title =
    value.title === undefined
      ? ""
      : typeof value.title === "string" && value.title.length <= 200
        ? value.title
        : undefined;
  if (title === undefined) {
    throw new Error("Invalid .music file: title must be a string of at most 200 characters.");
  }
  const timeSignature = isTimeSignature(value.timeSignature)
    ? value.timeSignature
    : value.timeSignature === undefined
      ? "4/4"
      : undefined;
  if (!timeSignature) {
    throw new Error("Invalid .music file: unsupported time signature.");
  }
  const keySignature = isKeySignature(value.keySignature)
    ? value.keySignature
    : value.keySignature === undefined
      ? "C major"
      : undefined;
  if (!keySignature) {
    throw new Error("Invalid .music file: unsupported key signature.");
  }

  const ids = new Set<string>();
  const notes = value.notes.map((note, index): ScoreEvent => {
    if (!isRecord(note)) {
      throw new Error(
        `Invalid .music file: event ${index + 1} must be an object.`
      );
    }
    if (typeof note.id !== "string" || note.id.length === 0) {
      throw new Error(`Invalid .music file: event ${index + 1} has no ID.`);
    }
    if (ids.has(note.id)) {
      throw new Error(`Invalid .music file: duplicate event ID "${note.id}".`);
    }
    ids.add(note.id);

    if (
      note.type !== undefined &&
      note.type !== "note" &&
      note.type !== "rest" &&
      note.type !== "spacer"
    ) {
      throw new Error(
        `Invalid .music file: event ${index + 1} has an unsupported type.`
      );
    }
    if (
      typeof note.duration !== "number" ||
      !isNoteDuration(note.duration)
    ) {
      throw new Error(
        `Invalid .music file: event ${index + 1} has an unsupported duration.`
      );
    }
    if (note.dotted !== undefined && typeof note.dotted !== "boolean") {
      throw new Error(
        `Invalid .music file: event ${index + 1} has an invalid dotted flag.`
      );
    }

    if (note.type === "rest") {
      return {
        id: note.id,
        type: "rest",
        duration: note.duration,
        ...(note.dotted ? { dotted: true } : {})
      };
    }
    if (note.type === "spacer") {
      return {
        id: note.id,
        type: "spacer",
        duration: note.duration,
        ...(note.dotted ? { dotted: true } : {})
      };
    }

    if (
      typeof note.diatonicStep !== "number" ||
      !Number.isInteger(note.diatonicStep) ||
      note.diatonicStep < -9 ||
      note.diatonicStep > 14
    ) {
      throw new Error(
        `Invalid .music file: note ${index + 1} has an unsupported pitch.`
      );
    }
    if (
      note.accidental !== undefined &&
      note.accidental !== -1 &&
      note.accidental !== 0 &&
      note.accidental !== 1
    ) {
      throw new Error(
        `Invalid .music file: note ${index + 1} has an unsupported accidental.`
      );
    }

    return {
      id: note.id,
      diatonicStep: note.diatonicStep,
      duration: note.duration,
      ...(note.accidental === undefined ? {} : { accidental: note.accidental }),
      ...(note.dotted ? { dotted: true } : {})
    };
  });

  return { schemaVersion: 1, title, tempo, timeSignature, keySignature, notes };
}

export function serializeScoreFile(score: ScoreModel): string {
  return `${JSON.stringify(score, null, 2)}\n`;
}

export function serializeScore(score: ScoreModel): string {
  if (score.schemaVersion !== 1) {
    throw new Error(`Unsupported score model version: ${score.schemaVersion}`);
  }

  const timeSignature = score.timeSignature ?? "4/4";
  const keySignature = score.keySignature ?? "C major";
  const title = score.title ?? "";
  const tempo = score.tempo ?? 100;
  if (!isTimeSignature(timeSignature) || !isKeySignature(keySignature)) {
    throw new Error("Unsupported score key or time signature.");
  }
  if (typeof title !== "string" || title.length > 200) {
    throw new Error("Unsupported score title: expected a string of at most 200 characters.");
  }
  if (!Number.isInteger(tempo) || tempo < 40 || tempo > 240) {
    throw new Error("Unsupported score tempo: expected an integer from 40 to 240 BPM.");
  }
  const measureTicks = getMeasureTicks(timeSignature);
  const measuresPerPdfPage = 16;
  let elapsedTicks = 0;
  let measuresOnPdfPage = 0;
  const musicTokens: string[] = [];
  const addBarline = () => {
    musicTokens.push("|");
    measuresOnPdfPage += 1;
    if (measuresOnPdfPage === measuresPerPdfPage) {
      musicTokens.push("\\pageBreak");
      measuresOnPdfPage = 0;
    }
  };
  score.notes.forEach((event, index) => {
    const eventTicks = getEventTicks(event);
    if (elapsedTicks > 0 && elapsedTicks + eventTicks > measureTicks) {
      addBarline();
      elapsedTicks = 0;
    }
    musicTokens.push(serializeEvent(event));
    elapsedTicks += eventTicks;
    if (elapsedTicks >= measureTicks && index < score.notes.length - 1) {
      addBarline();
      elapsedTicks = 0;
    }
  });
  const music = musicTokens.join(" ");
  const [numerator, denominator] = timeSignature.split("/");
  const titleHeader = title.trim()
    ? [
        "\\header {",
        `  title = "${escapeLilyPondString(title.trim())}"`,
        "}",
        ""
      ]
    : [];

  return [
    '\\version "2.26.0"',
    "",
    ...titleHeader,
    "\\score {",
    "  \\new Staff {",
    `    \\key ${keyNames[keySignature]} \\${keySignature.includes("minor") ? "minor" : "major"}`,
    `    \\time ${numerator}/${denominator}`,
    `    \\tempo 4 = ${tempo}`,
    `    ${music}`,
    "  }",
    "  \\layout { }",
    "}"
  ].join("\n");
}

function escapeLilyPondString(value: string): string {
  return value
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNoteDuration(value: number): value is NoteDuration {
  return (
    value === 1 ||
    value === 2 ||
    value === 4 ||
    value === 8 ||
    value === 16
  );
}

function serializeEvent(event: ScoreEvent): string {
  if (!isNoteDuration(event.duration)) {
    throw new Error(`Unsupported note duration: ${event.duration}`);
  }
  const duration = `${event.duration}${event.dotted ? "." : ""}`;
  if ("type" in event && event.type === "rest") {
    return `r${duration}`;
  }
  if ("type" in event && event.type === "spacer") {
    return `s${duration}`;
  }
  if (
    event.accidental !== undefined &&
    event.accidental !== -1 &&
    event.accidental !== 0 &&
    event.accidental !== 1
  ) {
    throw new Error(`Unsupported accidental: ${event.accidental}`);
  }
  const pitch = pitchNames[event.diatonicStep];
  if (!pitch) {
    throw new Error(`Unsupported staff position: ${event.diatonicStep}`);
  }
  const accidental =
    event.accidental === 1
      ? "is"
      : event.accidental === -1
        ? "es"
        : "";
  const pitchWithAccidental =
    event.accidental === 0
      ? `${pitch}!`
      : accidental
        ? pitch.replace(/('+)?$/, `${accidental}$1`)
        : pitch;
  return `${pitchWithAccidental}${duration}`;
}

function getEventTicks(event: ScoreEvent): number {
  const ticks = 16 / event.duration;
  return event.dotted ? ticks * 1.5 : ticks;
}

function getMeasureTicks(timeSignature: TimeSignature): number {
  const [numerator, denominator] = timeSignature.split("/").map(Number);
  return numerator * (16 / denominator);
}

function isTimeSignature(value: unknown): value is TimeSignature {
  return (
    value === "2/4" ||
    value === "3/4" ||
    value === "4/4" ||
    value === "6/8" ||
    value === "12/8"
  );
}

function isKeySignature(value: unknown): value is KeySignature {
  return (
    value === "C major" ||
    value === "G major" ||
    value === "D major" ||
    value === "F major" ||
    value === "Bb major" ||
    value === "A minor" ||
    value === "E minor" ||
    value === "D minor"
  );
}

const keyNames: Readonly<Record<KeySignature, string>> = {
  "C major": "c",
  "G major": "g",
  "D major": "d",
  "F major": "f",
  "Bb major": "bes",
  "A minor": "a",
  "E minor": "e",
  "D minor": "d"
};
