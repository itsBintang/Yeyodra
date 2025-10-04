import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components";
import { SettingsGeneral } from "./SettingsGeneral";
import "./Settings.scss";

export function Settings() {
  const { t } = useTranslation("settings");
  const [currentTab, setCurrentTab] = useState(0);

  const tabs = [
    { label: t("general") },
    { label: t("download_sources") },
    { label: t("account") },
  ];

  const renderContent = () => {
    if (currentTab === 0) return <SettingsGeneral />;
    if (currentTab === 1) return <div>Coming soon...</div>;
    return <div>Coming soon...</div>;
  };

  return (
    <section className="settings__container">
      <div className="settings__content">
        <section className="settings__categories">
          {tabs.map((tab, index) => (
            <Button
              key={index}
              theme={currentTab === index ? "primary" : "outline"}
              onClick={() => setCurrentTab(index)}
            >
              {tab.label}
            </Button>
          ))}
        </section>

        <h2>{tabs[currentTab].label}</h2>

        {renderContent()}
      </div>
    </section>
  );
}

