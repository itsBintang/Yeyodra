import { useTranslation } from "react-i18next";

export function Settings() {
  const { t } = useTranslation("header");

  return (
    <div style={{ padding: "2rem" }}>
      <h2>{t("settings")}</h2>
      <p>Settings page - coming soon</p>
    </div>
  );
}




