// background.js

// Background service worker for Tab Killer
// Tracks tab metadata (createdAt, notes)

function initTabTracking() {
  chrome.tabs.query({}, (tabs) => {
    chrome.storage.local.get({ tabMetadata: {} }, (result) => {
      const metadata = result.tabMetadata;
      const now = Date.now();
      const activeTabIds = new Set(tabs.map(tab => tab.id));
      let changed = false;
      
      // 1. Garbage Collection: Remove orphaned tab IDs
      for (const tabId in metadata) {
        if (!activeTabIds.has(parseInt(tabId, 10))) {
          delete metadata[tabId];
          changed = true;
        }
      }
      
      // 2. Initialize untracked tabs
      tabs.forEach(tab => {
        if (tab.id !== chrome.tabs.TAB_ID_NONE && !metadata[tab.id]) {
          metadata[tab.id] = {
            url: tab.url,
            title: tab.title,
            createdAt: now,
            note: ''
          };
          changed = true;
        }
      });
      
      if (changed) {
        chrome.storage.local.set({ tabMetadata: metadata });
        console.log("Tab metadata synchronized and cleaned.");
      }
    });
  });
}

// Run on startup
chrome.runtime.onStartup.addListener(() => {
  console.log("Tab Killer: Chrome started, running GC.");
  initTabTracking();
});

chrome.runtime.onInstalled.addListener(() => {
  console.log("Tab Killer Extension installed/updated.");
  initTabTracking();
});

// Also run on service worker wake-up to ensure metadata is fresh
initTabTracking();

// Track new tabs
chrome.tabs.onCreated.addListener((tab) => {
  if (tab.id === chrome.tabs.TAB_ID_NONE) return;
  
  chrome.storage.local.get({ tabMetadata: {} }, (result) => {
    const metadata = result.tabMetadata;
    // Only initialize if not already set (prevents overwriting restored notes)
    if (!metadata[tab.id]) {
      metadata[tab.id] = {
        url: tab.url,
        title: tab.title,
        createdAt: Date.now(),
        note: ''
      };
      chrome.storage.local.set({ tabMetadata: metadata });
    }
  });
});

// Update metadata if URL changes
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.title) {
    chrome.storage.local.get({ tabMetadata: {} }, (result) => {
      const metadata = result.tabMetadata;
      if (metadata[tabId]) {
        if (changeInfo.url) metadata[tabId].url = changeInfo.url;
        if (changeInfo.title) metadata[tabId].title = changeInfo.title;
        chrome.storage.local.set({ tabMetadata: metadata });
      }
    });
  }
});

// Clean up metadata when a tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.get({ tabMetadata: {} }, (result) => {
    const metadata = result.tabMetadata;
    if (metadata[tabId]) {
      delete metadata[tabId];
      chrome.storage.local.set({ tabMetadata: metadata });
    }
  });
});
