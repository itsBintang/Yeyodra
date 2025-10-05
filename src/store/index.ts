import { configureStore } from "@reduxjs/toolkit";
import { TypedUseSelectorHook, useDispatch, useSelector } from "react-redux";
import appReducer from "@/features/appSlice";
import catalogueReducer from "@/features/catalogueSlice";
import libraryReducer from "@/features/librarySlice";
import toastReducer from "@/features/toastSlice";
import userReducer from "@/features/userSlice";

export const store = configureStore({
  reducer: {
    app: appReducer,
    catalogue: catalogueReducer,
    library: libraryReducer,
    toast: toastReducer,
    user: userReducer,
  },
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Export typed hooks for use throughout your app
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

