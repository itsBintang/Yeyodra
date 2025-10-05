import { useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAppDispatch, useAppSelector } from "@/store";
import { setLibrary, setLibraryLoading } from "@/features/librarySlice";
import type { LibraryGame } from "@/types";

export function useLibrary() {
  const dispatch = useAppDispatch();
  const library = useAppSelector((state) => state.library.games);
  const isLoading = useAppSelector((state) => state.library.isLoading);

  const updateLibrary = useCallback(async () => {
    try {
      dispatch(setLibraryLoading(true));
      const games = await invoke<LibraryGame[]>("get_library_games");
      dispatch(setLibrary(games));
      return games;
    } catch (error) {
      console.error("Failed to fetch library:", error);
      dispatch(setLibraryLoading(false));
      return [];
    }
  }, [dispatch]);

  return { library, isLoading, updateLibrary };
}

