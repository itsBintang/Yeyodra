import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { invoke } from "@tauri-apps/api/core";
import type { UserProfile } from "@/types";

interface UserState {
  userProfile: UserProfile | null;
  isInitialized: boolean;
  isLoading: boolean;
}

const initialState: UserState = {
  userProfile: null,
  isInitialized: false,
  isLoading: false,
};

// Async thunk to load user profile from Tauri backend
export const loadUserProfile = createAsyncThunk(
  "user/loadProfile",
  async () => {
    const profile = await invoke<UserProfile>("get_user_profile");
    return profile;
  }
);

// Async thunk to save user profile
export const saveUserProfile = createAsyncThunk(
  "user/saveProfile",
  async (profile: UserProfile) => {
    const savedProfile = await invoke<UserProfile>("update_user_profile_data", { profile });
    return savedProfile;
  }
);

export const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    setUserProfile: (state, action: PayloadAction<UserProfile>) => {
      state.userProfile = action.payload;
      state.isInitialized = true;
    },
    updateUserProfileLocal: (state, action: PayloadAction<Partial<UserProfile>>) => {
      if (state.userProfile) {
        state.userProfile = { ...state.userProfile, ...action.payload };
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadUserProfile.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(loadUserProfile.fulfilled, (state, action) => {
        state.userProfile = action.payload;
        state.isInitialized = true;
        state.isLoading = false;
      })
      .addCase(loadUserProfile.rejected, (state) => {
        state.isLoading = false;
        state.isInitialized = true;
      })
      .addCase(saveUserProfile.fulfilled, (state, action) => {
        state.userProfile = action.payload;
      });
  },
});

export const { setUserProfile, updateUserProfileLocal } = userSlice.actions;
export default userSlice.reducer;
