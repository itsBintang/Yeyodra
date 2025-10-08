// Configuration for game cracking module
// Adapted from BetterSteamAutoCracker

// S3 bucket base URL hosting Goldberg DLLs and Steamless
// Using the official BetterSteamAutoCracker S3 URL
pub const S3: &str = "https://s3.lillianne.solutions/";

// Application folder name for storing cache data
pub const FOLDER: &str = "com.chaoslauncher.dev"; // Must match tauri.conf.json's identifier

// Steam API key for getting achievements (optional - can be empty)
// Get a key from: https://steamcommunity.com/dev/apikey
pub const STEAM_API_KEY: &str = ""; // Can be empty, achievements still work

