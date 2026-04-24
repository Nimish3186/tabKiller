// background.js

// Background service worker for Tab Killer
// Tracks tab metadata (createdAt, notes)

function initTabTracking() {
  chrome.tabs.query({}, (tabs) => {
    chrome.storage.local.get({ tabMetadata: {} }, (result) => {
      const metadata = result.tabMetadata;
      const now = Date.now();
      
      // Initialize untracked tabs
      tabs.forEach(tab => {
        if (!metadata[tab.id]) {
          metadata[tab.id] = {
            url: tab.url,
            title: tab.title,
            createdAt: now,
            note: ''
          };
        }
      });
      
      chrome.storage.local.set({ tabMetadata: metadata });
    });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  console.log("Tab Killer Extension installed successfully!");
  initTabTracking();
});

// Track new tabs
chrome.tabs.onCreated.addListener((tab) => {
  if (tab.id === chrome.tabs.TAB_ID_NONE) return;
  
  chrome.storage.local.get({ tabMetadata: {} }, (result) => {
    const metadata = result.tabMetadata;
    metadata[tab.id] = {
      url: tab.url,
      title: tab.title,
      createdAt: Date.now(),
      note: ''
    };
    chrome.storage.local.set({ tabMetadata: metadata });
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
