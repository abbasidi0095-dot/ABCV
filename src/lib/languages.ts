import type { LanguageEntry } from "@/lib/schemas";

type LangCode = "en" | "fr" | "es" | "de";

// Display names localized per CV output language.
const NAMES: Record<LangCode, Record<LangCode, string>> = {
  en: { en: "English", fr: "Anglais", es: "Inglés", de: "Englisch" },
  fr: { en: "French", fr: "Français", es: "Francés", de: "Französisch" },
  es: { en: "Spanish", fr: "Espagnol", es: "Español", de: "Spanisch" },
  de: { en: "German", fr: "Allemand", es: "Alemán", de: "Deutsch" },
};

/** Localized proficiency labels for CV templates. */
export const LEVEL_LABELS: Record<LangCode, { high: string; medium: string }> = {
  en: { high: "High", medium: "Medium" },
  fr: { high: "Haut", medium: "Moyen" },
  es: { high: "Alto", medium: "Medio" },
  de: { high: "Hoch", medium: "Mittel" },
};

/** Localized section titles for CV templates. */
export const UI_LABELS: Record<LangCode, { languages: string; skills: string; experience: string; contact: string; summary: string }> = {
  en: { languages: "Languages", skills: "Skills", experience: "Experience", contact: "Contact", summary: "Summary" },
  fr: { languages: "Langues", skills: "Compétences", experience: "Expérience", contact: "Contact", summary: "Profil" },
  es: { languages: "Idiomas", skills: "Habilidades", experience: "Experiencia", contact: "Contacto", summary: "Perfil" },
  de: { languages: "Sprachen", skills: "Fähigkeiten", experience: "Erfahrung", contact: "Kontakt", summary: "Profil" },
};

/**
 * Deterministic languages list — EN/FR/ES always present; + DE when cvLang is "de".
 * The CV's output language is marked "high", the others "medium".
 */
export function buildLanguages(cvLang: string): LanguageEntry[] {
  const safeLang = (NAMES as Record<string, Record<string, string>>)[cvLang] ? cvLang : "en";
  const base: LangCode[] = ["en", "fr", "es"];
  if (safeLang === "de") base.push("de");
  return base.map((code) => ({
    name: NAMES[code][safeLang as LangCode] ?? NAMES[code].en,
    level: code === safeLang ? "high" : "medium",
  }));
}
