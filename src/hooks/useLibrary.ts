import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAppDispatch, useAppSelector } from "@/store";
import { setLibrary } from "@/features/librarySlice";
import type { LibraryGame } from "@/types";

export function useLibrary() {
  const dispatch = useAppDispatch();
  const library = useAppSelector((state) => state.library.games);

  const updateLibrary = useCallback(async () => {
    try {
      const games = await invoke<LibraryGame[]>("get_library_games");
      dispatch(setLibrary(games));
      return games;
    } catch (error) {
      console.error("Failed to fetch library:", error);
      return [];
    }
  }, [dispatch]);

  return { library, updateLibrary };
}

