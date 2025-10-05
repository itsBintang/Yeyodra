# 📊 Profile Implementation Analysis - Hydra to Chaos

## 🎯 Overview
Dokumentasi lengkap tentang implementasi profile system di Hydra untuk di-clone ke Chaos.

---

## 🏗️ Architecture Overview

### **Hydra Profile System**
```
┌─────────────────────────────────────────────────────┐
│                   FRONTEND LAYER                     │
├─────────────────────────────────────────────────────┤
│ 1. SidebarProfile Component (Sidebar)               │
│    - Display user avatar, name, status              │
│    - Show friend request badge                      │
│    - Navigate to profile page                       │
│                                                      │
│ 2. Profile Page (/profile/:userId)                  │
│    ├── ProfileHero (Header section)                 │
│    │   - Avatar, display name, badges               │
│    │   - Background image/gradient                  │
│    │   - Action buttons (Edit/Sign Out/Add Friend)  │
│    │   - Current game playing status                │
│    │                                                 │
│    └── ProfileContent (Main content)                │
│        ├── User Stats Box                           │
│        ├── Recent Games Box                         │
│        ├── Friends Box                              │
│        ├── Pinned Games Grid                        │
│        └── Library Games Grid                       │
│                                                      │
│ 3. Context & State Management                       │
│    ├── UserProfileContextProvider                   │
│    ├── useUserDetails Hook                          │
│    └── Redux Store (userDetails slice)              │
└─────────────────────────────────────────────────────┘
                        ↕ IPC
┌─────────────────────────────────────────────────────┐
│                   BACKEND LAYER                      │
├─────────────────────────────────────────────────────┤
│ Electron Main Process (window.electron API)         │
│                                                      │
│ Authentication & User Management:                    │
│ - openAuthWindow(AuthPage.SignIn)                   │
│ - getMe() → UserDetails                             │
│ - signOut()                                          │
│ - updateProfile(UpdateProfileRequest)               │
│                                                      │
│ Profile Data:                                        │
│ - getUser(userId) → UserProfile                     │
│ - getUserStats(userId) → UserStats                  │
│ - getUserLibrary(userId, limit, offset, sortBy)     │
│                                                      │
│ Social Features:                                     │
│ - getFriendRequests() → FriendRequest[]             │
│ - sendFriendRequest(userId)                         │
│ - updateFriendRequest(userId, action)               │
│ - undoFriendship(userId)                            │
│ - blockUser(userId)                                 │
│ - unblockUser(userId)                               │
│                                                      │
│ Badges & Achievements:                              │
│ - getBadges() → Badge[]                             │
└─────────────────────────────────────────────────────┘
                        ↕ HTTP
┌─────────────────────────────────────────────────────┐
│                   API LAYER                          │
├─────────────────────────────────────────────────────┤
│ Hydra Backend API (hydra-api-us-east-1...)          │
│                                                      │
│ Endpoints:                                           │
│ - POST /auth/sign-in                                │
│ - GET  /users/me                                    │
│ - GET  /users/:userId                               │
│ - PATCH /users/me                                   │
│ - GET  /users/:userId/stats                         │
│ - GET  /users/:userId/library                       │
│ - GET  /friend-requests                             │
│ - POST /friend-requests                             │
│ - PATCH /friend-requests/:id                        │
│ - GET  /badges                                      │
└─────────────────────────────────────────────────────┘
```

---

## 📦 Data Structures

### **1. UserDetails (Current User)**
```typescript
interface UserDetails {
  id: string;
  displayName: string;
  username: string;
  profileImageUrl?: string;
  subscription: Subscription | null;
  featurebaseJwt: string;
}

interface Subscription {
  expiresAt: Date;
  plan: string;
}
```

### **2. UserProfile (Any User)**
```typescript
interface UserProfile {
  id: string;
  displayName: string;
  username: string;
  profileImageUrl?: string;
  backgroundImageUrl?: string;
  badges: string[];  // Badge names
  profileVisibility: "PUBLIC" | "PRIVATE" | "FRIENDS";
  
  // Relationship data
  relation: FriendRelation | null;
  
  // Social
  friends: Friend[];
  
  // Current activity
  currentGame?: {
    objectId: string;
    title: string;
    sessionDurationInSeconds: number;
  };
}

interface FriendRelation {
  AId: string;  // Requester
  BId: string;  // Receiver
  status: "PENDING" | "ACCEPTED" | "REFUSED" | "CANCELLED";
}
```

### **3. UserStats**
```typescript
interface UserStats {
  libraryCount: number;
  achievementCount: number;
  totalPlaytime: number;  // in hours
}
```

### **4. UserGame (Library Game)**
```typescript
interface UserGame {
  objectId: string;
  title: string;
  shop: string;
  iconUrl?: string;
  
  // Stats (changes based on sortBy)
  playtimeInSeconds?: number;
  achievementCount?: number;
  lastPlayedAt?: Date;
}
```

### **5. Badge**
```typescript
interface Badge {
  name: string;
  description: string;
  badge: {
    url: string;
  };
}
```

---

## 🎨 Frontend Components

### **1. SidebarProfile Component**

**Location:** `src/components/sidebar/sidebar-profile.tsx`

**Features:**
- Display user avatar (or placeholder if not signed in)
- Show display name or "Sign in" text
- Friend request badge with count
- Navigate to profile page on click
- Show current game running with icon

**Key Logic:**
```typescript
const handleProfileClick = () => {
  if (userDetails === null) {
    // Open authentication window
    window.electron.openAuthWindow(AuthPage.SignIn);
    return;
  }
  
  // Navigate to user's profile
  navigate(`/profile/${userDetails.id}`);
};
```

**Dependencies:**
- `useUserDetails()` hook
- `useAppSelector()` for gameRunning state
- `Avatar` component
- `@primer/octicons-react` (PeopleIcon)

---

### **2. Profile Page**

**Location:** `src/pages/profile/profile.tsx`

**Structure:**
```tsx
<UserProfileContextProvider userId={userId}>
  <SkeletonTheme>
    <div className="profile__wrapper">
      <ProfileContent />
    </div>
  </SkeletonTheme>
</UserProfileContextProvider>
```

**URL Pattern:** `/profile/:userId`

---

### **3. ProfileHero Component**

**Location:** `src/pages/profile/profile-hero/profile-hero.tsx`

**Features:**
- **Background:** Gradient generated from avatar color OR custom uploaded image
- **Avatar:** 96x96px, clickable to edit (if own profile)
- **Display Name:** With badges displayed inline
- **Current Game:** Shows game title and play duration
- **Action Buttons:** Context-aware based on relationship:

**Button States:**
```typescript
// Own Profile (isMe = true)
- Edit Profile (opens modal)
- Sign Out

// Other User - No Relation
- Add Friend
- Block User

// Other User - Friends
- Block User
- Undo Friendship

// Other User - Pending Request (sent by me)
- Cancel Request

// Other User - Pending Request (received)
- Accept Request
- Ignore Request
```

**Background Generation:**
```typescript
// Extract dominant color from avatar
const output = await average(profileImageUrl, {
  amount: 1,
  format: "hex",
});

// Create gradient
const gradient = `linear-gradient(135deg, 
  ${darkenColor(output, 0.5)}, 
  ${darkenColor(output, 0.6, 0.5)}
)`;
```

---

### **4. ProfileContent Component**

**Location:** `src/pages/profile/profile-content/profile-content.tsx`

**Layout:**
```
┌──────────────────────────────────────────────────┐
│              Profile Hero                        │
└──────────────────────────────────────────────────┘
┌─────────────────────────┬────────────────────────┐
│                         │  User Stats Box        │
│  Pinned Games (Grid)    │  - Library Count       │
│                         │  - Achievement Count   │
│  ┌────┐ ┌────┐ ┌────┐  │  - Total Playtime      │
│  │Game│ │Game│ │Game│  ├────────────────────────┤
│  └────┘ └────┘ └────┘  │  Recent Games Box      │
│                         │  - Last 5 played       │
│  Library (Grid)         ├────────────────────────┤
│                         │  Friends Box           │
│  ┌────┐ ┌────┐ ┌────┐  │  - Friend avatars      │
│  │Game│ │Game│ │Game│  │  - Friend count        │
│  └────┘ └────┘ └────┘  ├────────────────────────┤
│  ┌────┐ ┌────┐ ┌────┐  │  Report Profile        │
│  │Game│ │Game│ │Game│  │                        │
│  └────┘ └────┘ └────┘  │                        │
└─────────────────────────┴────────────────────────┘
```

**Features:**
- **Sort Options:** playtime | achievementCount | playedRecently
- **Collapsible Sections:** Pinned games can be collapsed
- **Privacy:** Lock profile if visibility is PRIVATE or FRIENDS (and not friends)
- **Empty State:** Show telescope icon if no games
- **Animated Stats:** Game cards cycle through different stats

**Privacy Logic:**
```typescript
const shouldLockProfile =
  userProfile.profileVisibility === "PRIVATE" ||
  (userProfile.profileVisibility === "FRIENDS" && !usersAreFriends);

if (!isMe && shouldLockProfile) {
  return <LockedProfile />;
}
```

---

## 🔧 State Management

### **1. Redux Slice (userDetails)**

**Location:** `src/features/userDetailsSlice.ts`

**State:**
```typescript
interface UserDetailsState {
  userDetails: UserDetails | null;
  profileBackground: string | null;
  friendRequests: FriendRequest[];
  friendRequestCount: number;
  isFriendsModalVisible: boolean;
  friendModalUserId: string | null;
  friendRequetsModalTab: UserFriendModalTab;
}
```

**Actions:**
- `setUserDetails(userDetails)`
- `setProfileBackground(background)`
- `setFriendRequests(requests)`
- `setFriendsModalVisible({ initialTab, userId })`
- `setFriendsModalHidden()`

---

### **2. useUserDetails Hook**

**Location:** `src/hooks/use-user-details.ts`

**Provides:**
```typescript
{
  // State
  userDetails: UserDetails | null;
  profileBackground: string | null;
  friendRequests: FriendRequest[];
  friendRequestCount: number;
  hasActiveSubscription: boolean;
  
  // Actions
  fetchUserDetails: () => Promise<UserDetails>;
  signOut: () => Promise<void>;
  updateUserDetails: (details: UserDetails) => Promise<void>;
  patchUser: (values: UpdateProfileRequest) => Promise<void>;
  
  // Friend Management
  sendFriendRequest: (userId: string) => Promise<void>;
  fetchFriendRequests: () => Promise<void>;
  updateFriendRequestState: (userId, action) => Promise<void>;
  undoFriendship: (userId: string) => Promise<void>;
  blockUser: (userId: string) => Promise<void>;
  unblockUser: (userId: string) => Promise<void>;
  
  // Modal
  showFriendsModal: (tab, userId) => void;
  hideFriendsModal: () => void;
}
```

**Key Methods:**

```typescript
// Fetch current user
const fetchUserDetails = async () => {
  return window.electron.getMe().then((userDetails) => {
    if (userDetails == null) {
      clearUserDetails();
    }
    window["userDetails"] = userDetails;
    return userDetails;
  });
};

// Sign out
const signOut = async () => {
  clearUserDetails();
  return window.electron.signOut();
};

// Update profile
const patchUser = async (values: UpdateProfileRequest) => {
  const response = await window.electron.updateProfile(values);
  return updateUserDetails({
    ...response,
    username: userDetails?.username || "",
    subscription: userDetails?.subscription || null,
    featurebaseJwt: userDetails?.featurebaseJwt || "",
  });
};
```

---

### **3. UserProfileContext**

**Location:** `src/context/user-profile/user-profile.context.tsx`

**Purpose:** Manage state for viewing ANY user's profile (not just current user)

**Provides:**
```typescript
{
  userProfile: UserProfile | null;
  heroBackground: string;
  isMe: boolean;  // Is viewing own profile?
  userStats: UserStats | null;
  badges: Badge[];
  libraryGames: UserGame[];
  pinnedGames: UserGame[];
  backgroundImage: string;
  
  getUserProfile: () => Promise<void>;
  getUserLibraryGames: (sortBy?: string) => Promise<void>;
  setSelectedBackgroundImage: (image: string) => void;
}
```

**Key Logic:**
```typescript
// Determine if viewing own profile
const isMe = userDetails?.id === userProfile?.id;

// Fetch profile data
const getUserProfile = async () => {
  getUserStats();
  getUserLibraryGames();
  
  return window.electron.getUser(userId).then((userProfile) => {
    if (userProfile) {
      setUserProfile(userProfile);
      
      // Generate hero background from avatar
      if (userProfile.profileImageUrl) {
        getHeroBackgroundFromImageUrl(userProfile.profileImageUrl)
          .then((color) => setHeroBackground(color));
      }
    } else {
      showErrorToast(t("user_not_found"));
      navigate(-1);
    }
  });
};

// Fetch library games with sorting
const getUserLibraryGames = async (sortBy?: string) => {
  const response = await window.electron.getUserLibrary(
    userId,
    12,  // limit
    0,   // offset
    sortBy
  );
  
  if (response) {
    setLibraryGames(response.library);
    setPinnedGames(response.pinnedGames);
  }
};
```

---

## 🔌 Backend Implementation (Electron IPC)

### **Electron Preload API**

```typescript
// window.electron API
interface ElectronAPI {
  // Authentication
  openAuthWindow: (page: AuthPage) => void;
  getMe: () => Promise<UserDetails | null>;
  signOut: () => Promise<void>;
  updateProfile: (values: UpdateProfileRequest) => Promise<UserDetails>;
  
  // User Profiles
  getUser: (userId: string) => Promise<UserProfile | null>;
  getUserStats: (userId: string) => Promise<UserStats>;
  getUserLibrary: (
    userId: string,
    limit: number,
    offset: number,
    sortBy?: string
  ) => Promise<{ library: UserGame[]; pinnedGames: UserGame[] }>;
  
  // Friends
  getFriendRequests: () => Promise<FriendRequest[]>;
  sendFriendRequest: (userId: string) => Promise<void>;
  updateFriendRequest: (userId: string, action: FriendRequestAction) => Promise<void>;
  undoFriendship: (userId: string) => Promise<void>;
  blockUser: (userId: string) => Promise<void>;
  unblockUser: (userId: string) => Promise<void>;
  syncFriendRequests: () => void;
  
  // Badges
  getBadges: () => Promise<Badge[]>;
}
```

---

## 🎯 Implementation Plan for Chaos

### **Phase 1: Basic Structure (No Auth)**
```
✅ Create placeholder SidebarProfile component
✅ Add "Sign in" text and avatar placeholder
✅ Create Profile page route (/profile/:userId)
✅ Create basic ProfileHero component
✅ Create basic ProfileContent component
```

### **Phase 2: Backend API Integration**
```
⬜ Implement Tauri commands for user API:
   - get_user_profile(user_id)
   - get_user_stats(user_id)
   - get_user_library(user_id, limit, offset, sort_by)
   - get_badges()

⬜ Create Rust structs matching TypeScript interfaces:
   - UserProfile
   - UserStats
   - UserGame
   - Badge

⬜ Implement HTTP client to Hydra API
```

### **Phase 3: Authentication System**
```
⬜ Implement OAuth flow (similar to Hydra)
⬜ Create auth window/modal
⬜ Store auth token securely
⬜ Implement get_me() command
⬜ Implement sign_out() command
⬜ Add token refresh logic
```

### **Phase 4: State Management**
```
⬜ Create userSlice in Redux
⬜ Create useUserDetails hook
⬜ Create UserProfileContext
⬜ Implement local storage persistence
```

### **Phase 5: Profile Features**
```
⬜ Implement profile visibility logic
⬜ Add background image upload
⬜ Add avatar upload
⬜ Implement edit profile modal
⬜ Add badges display
⬜ Show current game playing
```

### **Phase 6: Social Features**
```
⬜ Implement friend request system
⬜ Add friend list display
⬜ Implement block/unblock
⬜ Add friend modal
⬜ Implement friend notifications
```

---

## 🔐 Authentication Flow

### **Sign In Process**
```
1. User clicks "Sign in" in sidebar
   ↓
2. Open auth window (Tauri window or external browser)
   ↓
3. User enters credentials on Hydra auth page
   ↓
4. Hydra redirects to callback URL with token
   ↓
5. Chaos captures token from callback
   ↓
6. Store token in secure storage (Tauri store)
   ↓
7. Fetch user details (get_me)
   ↓
8. Update Redux store
   ↓
9. Save to localStorage for persistence
   ↓
10. Update UI (show avatar, name)
```

### **Token Management**
```rust
// Tauri secure storage
use tauri_plugin_store::StoreExt;

#[tauri::command]
async fn save_auth_token(token: String) -> Result<(), String> {
    let store = app.store("auth.json")?;
    store.set("token", token);
    store.save()?;
    Ok(())
}

#[tauri::command]
async fn get_auth_token() -> Result<Option<String>, String> {
    let store = app.store("auth.json")?;
    Ok(store.get("token"))
}
```

---

## 📝 Key Differences: Hydra vs Chaos

| Feature | Hydra (Electron) | Chaos (Tauri) |
|---------|------------------|---------------|
| **Backend** | Node.js + Python | Rust |
| **IPC** | `window.electron.*` | `invoke()` commands |
| **Storage** | LevelDB | Tauri Store / SQLite |
| **Auth Window** | BrowserWindow | Tauri Window / External |
| **HTTP Client** | axios | reqwest |
| **State** | Redux | Redux (same) |

---

## 🎨 Styling Notes

### **Colors & Theme**
- Primary: `#ADFF2F` (lime green)
- Background: `#121212` (dark)
- Card background: `#1c1c1c`
- Border: `rgba(255, 255, 255, 0.08)`

### **Avatar Component**
```tsx
<Avatar
  size={35}  // Sidebar
  size={96}  // Profile hero
  src={userDetails?.profileImageUrl}
  alt={userDetails?.displayName}
/>
```

### **Badge Display**
```tsx
{userProfile.badges.map((badgeName) => {
  const badge = badges.find((b) => b.name === badgeName);
  return (
    <img
      src={badge.badge.url}
      alt={badge.name}
      width={24}
      height={24}
      data-tooltip-content={badge.description}
    />
  );
})}
```

---

## 🚀 Quick Start Implementation

### **Step 1: Create Types**
```typescript
// src/types/user.ts
export interface UserDetails {
  id: string;
  displayName: string;
  username: string;
  profileImageUrl?: string;
}

export interface UserProfile extends UserDetails {
  backgroundImageUrl?: string;
  badges: string[];
  profileVisibility: "PUBLIC" | "PRIVATE" | "FRIENDS";
  relation: FriendRelation | null;
  friends: Friend[];
}

export interface UserStats {
  libraryCount: number;
  achievementCount: number;
  totalPlaytime: number;
}
```

### **Step 2: Create Rust Backend**
```rust
// src-tauri/src/user.rs
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct UserProfile {
    pub id: String,
    pub display_name: String,
    pub username: String,
    pub profile_image_url: Option<String>,
    pub background_image_url: Option<String>,
    pub badges: Vec<String>,
    pub profile_visibility: String,
}

#[tauri::command]
pub async fn get_user_profile(user_id: String) -> Result<UserProfile, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/users/{}", API_URL, user_id);
    
    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", get_token()?))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    let profile = response
        .json::<UserProfile>()
        .await
        .map_err(|e| e.to_string())?;
    
    Ok(profile)
}
```

### **Step 3: Create Redux Slice**
```typescript
// src/features/userSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { UserDetails } from '@/types';

interface UserState {
  userDetails: UserDetails | null;
  isAuthenticated: boolean;
}

const initialState: UserState = {
  userDetails: null,
  isAuthenticated: false,
};

export const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setUserDetails: (state, action: PayloadAction<UserDetails | null>) => {
      state.userDetails = action.payload;
      state.isAuthenticated = action.payload !== null;
    },
  },
});

export const { setUserDetails } = userSlice.actions;
export default userSlice.reducer;
```

---

## 📚 Resources & References

### **Hydra Codebase Files**
- `src/renderer/src/components/sidebar/sidebar-profile.tsx`
- `src/renderer/src/pages/profile/profile.tsx`
- `src/renderer/src/pages/profile/profile-hero/profile-hero.tsx`
- `src/renderer/src/pages/profile/profile-content/profile-content.tsx`
- `src/renderer/src/hooks/use-user-details.ts`
- `src/renderer/src/context/user-profile/user-profile.context.tsx`

### **API Endpoints**
- Base URL: `https://hydra-api-us-east-1.losbroxas.org`
- Auth: `/auth/sign-in`, `/auth/sign-out`
- Users: `/users/me`, `/users/:id`, `/users/:id/stats`, `/users/:id/library`
- Social: `/friend-requests`, `/friend-requests/:id`

---

## ✅ Checklist untuk Clone ke Chaos

### **Frontend**
- [ ] Create UserDetails, UserProfile, UserStats types
- [ ] Create userSlice in Redux
- [ ] Create useUser hook
- [ ] Update SidebarProfile component
- [ ] Create Profile page route
- [ ] Create ProfileHero component
- [ ] Create ProfileContent component
- [ ] Create Avatar component
- [ ] Add profile translations

### **Backend**
- [ ] Create user.rs module
- [ ] Implement get_user_profile command
- [ ] Implement get_user_stats command
- [ ] Implement get_user_library command
- [ ] Implement authentication flow
- [ ] Add secure token storage
- [ ] Implement HTTP client with auth headers

### **Styling**
- [ ] Create profile.scss
- [ ] Create profile-hero.scss
- [ ] Create profile-content.scss
- [ ] Add responsive layout
- [ ] Add animations

---

**Status:** 📖 Documentation Complete - Ready for Implementation
