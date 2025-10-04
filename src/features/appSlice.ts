import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface AppState {
  isLoading: boolean;
  error: string | null;
  headerTitle: string;
}

const initialState: AppState = {
  isLoading: false,
  error: null,
  headerTitle: "",
};

export const appSlice = createSlice({
  name: "app",
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
    setHeaderTitle: (state, action: PayloadAction<string>) => {
      state.headerTitle = action.payload;
    },
  },
});

export const { setLoading, setError, clearError, setHeaderTitle } = appSlice.actions;
export default appSlice.reducer;

