import React from "react";
import ReactDOM from "react-dom/client";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { Provider } from "react-redux";
import LanguageDetector from "i18next-browser-languagedetector";
import { HashRouter, Route, Routes } from "react-router-dom";

import "@fontsource/noto-sans/400.css";
import "@fontsource/noto-sans/500.css";
import "@fontsource/noto-sans/700.css";

import "react-loading-skeleton/dist/skeleton.css";
import "react-tooltip/dist/react-tooltip.css";

import { App } from "./App";
import { Home } from "./pages/Home";
import { Catalogue } from "./pages/Catalogue";
import { GameDetails } from "./pages/GameDetails";
import { Downloads } from "./pages/Downloads";
import { Settings } from "./pages/Settings/Settings";
import { Profile } from "./pages/Profile/Profile";
import { Achievements } from "./pages/Achievements/Achievements";
import { store } from "./store";
import resources from "./locales";
import { NetworkModeProvider } from "./contexts/network-mode";

// Initialize i18next
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    interpolation: {
      escapeValue: false,
    },
  });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Provider store={store}>
      <NetworkModeProvider>
        <HashRouter>
          <Routes>
            <Route element={<App />}>
                <Route path="/" element={<Home />} />
                <Route path="/catalogue" element={<Catalogue />} />
                <Route path="/game/:shop/:objectId" element={<GameDetails />} />
                <Route path="/game/:shop/:objectId/achievements/:title" element={<Achievements />} />
                <Route path="/downloads" element={<Downloads />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/profile/:userId" element={<Profile />} />
            </Route>
          </Routes>
        </HashRouter>
      </NetworkModeProvider>
    </Provider>
  </React.StrictMode>
);
