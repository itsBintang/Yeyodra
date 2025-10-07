# Yeyodra - Modern Game Launcher

A modern desktop game launcher application built with Tauri v2, React, TypeScript, and Redux Toolkit.

## 🚀 Tech Stack

### Frontend
- ⚛️ **React 18** - UI library
- 📘 **TypeScript** - Type safety
- ⚡ **Vite** - Build tool & dev server
- 🗂️ **Redux Toolkit** - State management
- 🧭 **React Router** - Client-side routing
- 🌍 **i18next** - Internationalization
- 💅 **SCSS** - Styling
- 🎨 **Framer Motion** - Animations

### Backend
- 🦀 **Rust** - Backend logic
- 🖥️ **Tauri v2** - Desktop framework

## 📁 Project Structure

```
yeyodra/
├── src/
│   ├── assets/          # Static assets (images, fonts, etc)
│   ├── components/      # Reusable React components
│   ├── features/        # Redux slices
│   ├── hooks/           # Custom React hooks
│   ├── locales/         # Translation files
│   ├── pages/           # Page components
│   ├── store/           # Redux store configuration
│   ├── types/           # TypeScript type definitions
│   ├── utils/           # Utility functions
│   ├── App.tsx          # Main app component
│   ├── App.scss         # Global styles
│   └── main.tsx         # Application entry point
├── src-tauri/           # Rust/Tauri backend
│   ├── src/
│   │   ├── main.rs      # Rust main file
│   │   └── lib.rs       # Rust library
│   └── tauri.conf.json  # Tauri configuration
└── index.html           # HTML entry point
```

## 🛠️ Development

### Prerequisites
- Node.js (v18+)
- Rust (latest stable)
- npm or yarn

### Install Dependencies
```bash
npm install
```

### Run Development Server
```bash
npm run tauri:dev
```

### Build for Production
```bash
npm run tauri:build
```

## 📝 Available Scripts

- `npm run dev` - Start Vite dev server only
- `npm run build` - Build the frontend
- `npm run preview` - Preview production build
- `npm run tauri:dev` - Start Tauri in development mode
- `npm run tauri:build` - Build Tauri application for production

## 🎯 Features

- ✅ React with TypeScript
- ✅ Redux Toolkit for state management
- ✅ React Router for navigation
- ✅ i18next for internationalization
- ✅ SCSS for styling
- ✅ Framer Motion for animations
- ✅ Modern project structure similar to Hydra
- ✅ Path aliases for clean imports
- ✅ Hot Module Replacement (HMR)

## 🔧 Configuration

### Path Aliases
The following path aliases are configured:
- `@/` → `src/`
- `@components/` → `src/components/`
- `@pages/` → `src/pages/`
- `@hooks/` → `src/hooks/`
- `@store/` → `src/store/`
- `@utils/` → `src/utils/`
- `@assets/` → `src/assets/`

## 📚 Learn More

- [Tauri Documentation](https://tauri.app)
- [React Documentation](https://react.dev)
- [Redux Toolkit Documentation](https://redux-toolkit.js.org)
- [Vite Documentation](https://vite.dev)

## 📄 License

MIT
