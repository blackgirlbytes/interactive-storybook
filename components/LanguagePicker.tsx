"use client";
import { LANGUAGES, type LanguageCode } from "@/lib/languages";

export default function LanguagePicker({ value, onChange, disabled }: { value: LanguageCode; onChange: (code: LanguageCode) => void; disabled?: boolean }) {
  return <label className="language-picker">
    <span>Story language</span>
    <select value={value} disabled={disabled} onChange={e => onChange(e.target.value as LanguageCode)}>
      {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.native === l.name ? l.name : `${l.native} · ${l.name}`}</option>)}
    </select>
  </label>;
}
