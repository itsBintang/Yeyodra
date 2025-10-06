import { useCallback, useEffect, useState } from "react";
import { useAppDispatch } from "../store";
import { setGenres, setTags } from "../features/catalogueSlice";
import { useNetworkMode } from "@/contexts/network-mode";

// External resources URL - same as Hydra
const EXTERNAL_RESOURCES_URL = "https://assets.hydralauncher.gg";

export function useCatalogue() {
  const dispatch = useAppDispatch();
  const { isLowConnectionMode } = useNetworkMode();

  const [steamPublishers, setSteamPublishers] = useState<string[]>([]);
  const [steamDevelopers, setSteamDevelopers] = useState<string[]>([]);

  const getSteamUserTags = useCallback(async () => {
    if (isLowConnectionMode) {
      console.log("[Low Connection Mode] Skipping external tags fetch");
      return;
    }
    try {
      const response = await fetch(`${EXTERNAL_RESOURCES_URL}/steam-user-tags.json`);
      const data = await response.json();
      dispatch(setTags(data));
    } catch (error) {
      console.error("Failed to fetch steam user tags:", error);
    }
  }, [dispatch, isLowConnectionMode]);

  const getSteamGenres = useCallback(async () => {
    if (isLowConnectionMode) {
      console.log("[Low Connection Mode] Skipping external genres fetch");
      return;
    }
    try {
      const response = await fetch(`${EXTERNAL_RESOURCES_URL}/steam-genres.json`);
      const data = await response.json();
      dispatch(setGenres(data));
    } catch (error) {
      console.error("Failed to fetch steam genres:", error);
    }
  }, [dispatch, isLowConnectionMode]);

  const getSteamPublishers = useCallback(async () => {
    if (isLowConnectionMode) {
      console.log("[Low Connection Mode] Skipping external publishers fetch");
      return;
    }
    try {
      const response = await fetch(`${EXTERNAL_RESOURCES_URL}/steam-publishers.json`);
      const publishers = await response.json();
      setSteamPublishers(publishers);
    } catch (error) {
      console.error("Failed to fetch publishers:", error);
    }
  }, [isLowConnectionMode]);

  const getSteamDevelopers = useCallback(async () => {
    if (isLowConnectionMode) {
      console.log("[Low Connection Mode] Skipping external developers fetch");
      return;
    }
    try {
      const response = await fetch(`${EXTERNAL_RESOURCES_URL}/steam-developers.json`);
      const developers = await response.json();
      setSteamDevelopers(developers);
    } catch (error) {
      console.error("Failed to fetch developers:", error);
    }
  }, [isLowConnectionMode]);

  useEffect(() => {
    getSteamUserTags();
    getSteamGenres();
    getSteamPublishers();
    getSteamDevelopers();
  }, [getSteamUserTags, getSteamGenres, getSteamPublishers, getSteamDevelopers]);

  return { steamPublishers, steamDevelopers };
}

