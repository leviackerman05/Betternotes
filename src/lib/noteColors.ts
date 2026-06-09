import type { CSSProperties } from "react";
import type { NoteColor } from "../types";

export interface NoteColorPreset {
  id: NoteColor;
  label: string;
  bg: string;
  text: string;
  muted: string;
  tagBg: string;
  tagBorder: string;
  checkboxBg: string;
  checkboxBorder: string;
  border: string;
}

export const NOTE_COLORS: NoteColorPreset[] = [
  {
    id: "yellow",
    label: "Yellow",
    bg: "#fef3c7",
    text: "#78350f",
    muted: "#92400e",
    tagBg: "rgba(120, 53, 15, 0.1)",
    tagBorder: "rgba(120, 53, 15, 0.2)",
    checkboxBg: "#fffbeb",
    checkboxBorder: "#b45309",
    border: "#fcd34d",
  },
  {
    id: "blue",
    label: "Blue",
    bg: "#dbeafe",
    text: "#1e3a8a",
    muted: "#1d4ed8",
    tagBg: "rgba(30, 58, 138, 0.1)",
    tagBorder: "rgba(30, 58, 138, 0.2)",
    checkboxBg: "#eff6ff",
    checkboxBorder: "#2563eb",
    border: "#93c5fd",
  },
  {
    id: "teal",
    label: "Teal",
    bg: "#ccfbf1",
    text: "#134e4a",
    muted: "#0f766e",
    tagBg: "rgba(19, 78, 74, 0.1)",
    tagBorder: "rgba(19, 78, 74, 0.2)",
    checkboxBg: "#f0fdfa",
    checkboxBorder: "#0d9488",
    border: "#5eead4",
  },
  {
    id: "purple",
    label: "Purple",
    bg: "#ede9fe",
    text: "#4c1d95",
    muted: "#6d28d9",
    tagBg: "rgba(76, 29, 149, 0.1)",
    tagBorder: "rgba(76, 29, 149, 0.2)",
    checkboxBg: "#f5f3ff",
    checkboxBorder: "#7c3aed",
    border: "#c4b5fd",
  },
  {
    id: "red",
    label: "Red",
    bg: "#fee2e2",
    text: "#7f1d1d",
    muted: "#b91c1c",
    tagBg: "rgba(127, 29, 29, 0.1)",
    tagBorder: "rgba(127, 29, 29, 0.2)",
    checkboxBg: "#fef2f2",
    checkboxBorder: "#dc2626",
    border: "#fca5a5",
  },
];

const DEFAULT_NOTE_VARS: Record<string, string> = {
  "--note-fg": "var(--color-on-surface)",
  "--note-fg-muted": "var(--color-on-surface-muted)",
  "--note-tag-bg": "var(--color-surface-muted)",
  "--note-tag-border": "var(--color-border)",
  "--note-placeholder": "var(--color-on-surface-muted)",
  "--note-caret": "var(--color-on-surface)",
  "--note-link": "var(--color-on-surface)",
  "--note-checkbox-bg": "var(--color-surface)",
  "--note-checkbox-border": "var(--color-border)",
  "--note-border": "var(--color-border)",
};

function presetVars(preset: NoteColorPreset): Record<string, string> {
  return {
    "--note-fg": preset.text,
    "--note-fg-muted": preset.muted,
    "--note-tag-bg": preset.tagBg,
    "--note-tag-border": preset.tagBorder,
    "--note-placeholder": preset.muted,
    "--note-caret": preset.text,
    "--note-link": preset.text,
    "--note-checkbox-bg": preset.checkboxBg,
    "--note-checkbox-border": preset.checkboxBorder,
    "--note-border": preset.border,
  };
}

export function getNoteColorPreset(color?: NoteColor | null): NoteColorPreset | null {
  if (!color) return null;
  return NOTE_COLORS.find((c) => c.id === color) ?? null;
}

export function getNoteColorStyle(color?: NoteColor | null): CSSProperties {
  const preset = getNoteColorPreset(color);
  if (!preset) {
    return {
      ...DEFAULT_NOTE_VARS,
      background: "var(--color-surface)",
      color: "var(--color-on-surface)",
    };
  }
  return {
    ...presetVars(preset),
    background: preset.bg,
    color: preset.text,
    borderColor: preset.border,
  };
}
