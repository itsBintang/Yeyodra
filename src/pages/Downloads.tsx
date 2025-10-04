import { useTranslation } from "react-i18next";

export function Downloads() {
  const { t } = useTranslation("header");

  return (
    <div style={{ padding: "2rem" }}>
      <h2>{t("downloads")}</h2>
      <p>Downloads page - coming soon</p>
    </div>
  );
}






