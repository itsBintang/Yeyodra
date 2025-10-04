import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { SidebarSection } from "../SidebarSection/SidebarSection";
import type { ShopDetails } from "@/types";
import "./GameLanguageSection.scss";

interface GameLanguageSectionProps {
  shopDetails: ShopDetails;
}

interface Language {
  language: string;
  hasAudio: boolean;
}

export function GameLanguageSection({ shopDetails }: GameLanguageSectionProps) {
  const { t } = useTranslation("game_details");

  const languages = useMemo<Language[]>(() => {
    const supportedLanguages = shopDetails.supported_languages;
    if (!supportedLanguages) return [];

    // Steam API returns languages in HTML format like:
    // "English<strong>*</strong>, French, German<strong>*</strong><br><strong>*</strong>languages with full audio support"
    // Split by <br> to get only the language list part
    const languagesString = supportedLanguages.split("<br>")[0];
    
    // Split by comma to get individual languages
    const languageArray = languagesString?.split(",") || [];

    return languageArray.map((lang) => ({
      // Remove <strong>*</strong> markers and trim whitespace
      language: lang.replace(/<\/?strong>/g, "").replace(/\*/g, "").trim(),
      // Check if this language has audio support (marked with *)
      hasAudio: lang.includes("*"),
    }));
  }, [shopDetails.supported_languages]);

  // Don't render if no languages
  if (languages.length === 0) {
    return null;
  }

  return (
    <SidebarSection title={t("language")}>
      <div className="game-language-section">
        {/* Table Header */}
        <div className="game-language-section__header">
          <div className="game-language-section__header-item">
            <span>{t("language")}</span>
          </div>
          <div className="game-language-section__header-item game-language-section__header-item--center">
            <span>{t("caption")}</span>
          </div>
          <div className="game-language-section__header-item game-language-section__header-item--center">
            <span>{t("audio")}</span>
          </div>
        </div>

        {/* Table Body */}
        <div className="game-language-section__content">
          {languages.map((lang) => (
            <div key={lang.language} className="game-language-section__row">
              {/* Language Name */}
              <div
                className="game-language-section__cell game-language-section__cell--language"
                title={lang.language}
              >
                {lang.language}
              </div>
              
              {/* Caption Support (always checked - all languages have captions/subtitles) */}
              <div className="game-language-section__cell game-language-section__cell--center">
                <svg
                  className="game-language-section__check"
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                >
                  <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"></path>
                </svg>
              </div>
              
              {/* Audio Support (checked if hasAudio, X if not) */}
              <div className="game-language-section__cell game-language-section__cell--center">
                {lang.hasAudio ? (
                  <svg
                    className="game-language-section__check"
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                  >
                    <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"></path>
                  </svg>
                ) : (
                  <svg
                    className="game-language-section__cross"
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                  >
                    <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"></path>
                  </svg>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </SidebarSection>
  );
}

