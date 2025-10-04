import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { LibraryGame } from "@/types";

interface LibraryState {
  games: LibraryGame[];
}

const initialState: LibraryState = {
  games: [],
};

const librarySlice = createSlice({
  name: "library",
  initialState,
  reducers: {
    setLibrary: (state, action: PayloadAction<LibraryGame[]>) => {
      state.games = action.payload;
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

export const { setLibrary, addGameToLibrary, removeGameFromLibrary } =
  librarySlice.actions;

export default librarySlice.reducer;

