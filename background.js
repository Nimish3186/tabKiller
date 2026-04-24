// background.js

// Background service worker for Tab Killer
// This file runs in the background and can be used for more advanced features later,
// like scheduling tab cleanups, handling keyboard shortcuts, or maintaining state.

chrome.runtime.onInstalled.addListener(() => {
  console.log("Tab Killer Extension installed successfully!");
});

// We could add listeners here to track when tabs are created or removed,
// but for a simple "end of day" manual cleanup, this is mostly a placeholder
// for future modularity and features.
