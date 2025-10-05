import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { UserProfile } from "@/types";

interface UserState {
  userProfile: UserProfile | null;
  isInitialized: boolean;
}

// Default local user profile
const DEFAULT_USER_PROFILE: UserProfile = {
  id: "local-user",
  displayName: "Local User",
  createdAt: new Date().toISOString(),
};

// Load from localStorage if exists
const loadUserProfileFromStorage = (): UserProfile => {
  try {
    const stored = localStorage.getItem("userProfile");
    if (stored) {
      const parsed = JSON.parse(stored);
      // Ensure it has required fields
      if (parsed.id && parsed.displayName) {
        return parsed;
      }
    }
  } catch (error) {
    console.error("Failed to load user profile from storage:", error);
  }
  return DEFAULT_USER_PROFILE;
};

const initialState: UserState = {
  userProfile: null,
  isInitialized: false,
};

export const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    setUserProfile: (state, action: PayloadAction<UserProfile>) => {
      state.userProfile = action.payload;
      state.isInitialized = true;
      // Save to localStorage
      localStorage.setItem("userProfile", JSON.stringify(action.payload));
    },
    updateUserProfile: (state, action: PayloadAction<Partial<UserProfile>>) => {
      if (state.userProfile) {
        state.userProfile = { ...state.userProfile, ...action.payload };
        // Save to localStorage
        localStorage.setItem("userProfile", JSON.stringify(state.userProfile));
      }
    },
    initializeDefaultUser: (state) => {
      if (!state.userProfile) {
        // Load from localStorage or use default
        state.userProfile = loadUserProfileFromStorage();
        state.isInitialized = true;
      }
    },
  },
});

export const { setUserProfile, updateUserProfile, initializeDefaultUser } = userSlice.actions;
export default userSlice.reducer;
