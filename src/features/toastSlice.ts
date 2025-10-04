import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface ToastState {
  title: string;
  message?: string;
  type: "success" | "error" | "warning";
  duration?: number;
  visible: boolean;
}

const initialState: ToastState = {
  title: "",
  message: "",
  type: "success",
  duration: 3000,
  visible: false,
};

export const toastSlice = createSlice({
  name: "toast",
  initialState,
  reducers: {
    showToast: (state, action: PayloadAction<Omit<ToastState, "visible">>) => {
      state.title = action.payload.title;
      state.message = action.payload.message;
      state.type = action.payload.type;
      state.duration = action.payload.duration ?? 3000;
      state.visible = true;
    },
    closeToast: (state) => {
      state.visible = false;
    },
  },
});

export const { showToast, closeToast } = toastSlice.actions;
export default toastSlice.reducer;

