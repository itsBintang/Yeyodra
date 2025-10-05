import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { LibraryGame } from "@/types";

interface LibraryState {
  games: LibraryGame[];
  isLoading: boolean;
}

const initialState: LibraryState = {
  games: [],
  isLoading: false,
};

const librarySlice = createSlice({
  name: "library",
  initialState,
  reducers: {
    setLibraryLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setLibrary: (state, action: PayloadAction<LibraryGame[]>) => {
      state.games = action.payload;
      state.isLoading = false;
    },
    addGameToLibrary: (state, action: PayloadAction<LibraryGame>) => {
      const existingIndex = state.games.findIndex(
        (game) => game.id === action.payload.id
      );
      if (existingIndex >= 0) {
        state.games[existingIndex] = action.payload;
      } else {
        state.games.push(action.payload);
      }
    },
    removeGameFromLibrary: (state, action: PayloadAction<string>) => {
      state.games = state.games.filter((game) => game.id !== action.payload);
    },
  },
});

export const { setLibraryLoading, setLibrary, addGameToLibrary, removeGameFromLibrary } =
  librarySlice.actions;

export default librarySlice.reducer;

