document.addEventListener('DOMContentLoaded', () => {
  // --- DOM Elements ---
  const views = {
    summary: document.getElementById('summary-view'),
    review: document.getElementById('review-view'),
    saved: document.getElementById('saved-tabs-section')
  };

  // Stats
  const statTotal = document.getElementById('stat-total');
  const statDupes = document.getElementById('stat-dupes');
  const statInactive = document.getElementById('stat-inactive');
  const statGroups = document.getElementById('stat-groups');
  const statToClose = document.getElementById('stat-to-close');
  const statToKeep = document.getElementById('stat-to-keep');
  const staleTabsMsg = document.getElementById('stale-tabs-msg');

  // Smart Actions
  const btnAutoClean = document.getElementById('btn-auto-clean');
  const btnSaveClose = document.getElementById('btn-save-close');
  const btnReview = document.getElementById('btn-review');
  const btnViewSavedHome = document.getElementById('btn-view-saved-home');
  const restoreSessionBtn = document.getElementById('restore-session-btn');

  // Review & Saved Views
  const groupedTabList = document.getElementById('grouped-tab-list');
  const tabCount = document.getElementById('tab-count');
  const savedTabList = document.getElementById('saved-tab-list');
  const clearSavedBtn = document.getElementById('clear-saved-btn');
  const backBtns = document.querySelectorAll('.back-to-home-btn');
  const selectAllTabs = document.getElementById('select-all-tabs');
  const selectionBar = document.getElementById('selection-bar');
  const selectionCountText = document.getElementById('selection-count-text');
  const btnSaveSelected = document.getElementById('btn-save-selected');
  const groupSelect = document.getElementById('group-select');
  const newGroupNameInput = document.getElementById('new-group-name');

  // --- State ---
  let currentTabs = [];
  let processedTabs = [];
  let groupedTabs = {};
  let selectedTabs = new Set();
  let sessionSavedThisRun = false;
  const INACTIVE_THRESHOLD_MS = 60 * 60 * 1000; // 60 minutes

  // --- Initialization ---
  init();

  function init() {
    migrateLegacySavedTabs(() => {
      fetchCurrentTabs();
      setupEventListeners();
    });
  }

  function migrateLegacySavedTabs(callback) {
    chrome.storage.local.get(['savedTabs', 'vaultSessions'], (result) => {
      if (result.savedTabs && result.savedTabs.length > 0) {
        const vault = result.vaultSessions || [];
        vault.push({
          id: 'legacy_' + Date.now(),
          title: 'Legacy Saved Tabs',
          tabs: result.savedTabs,
          createdAt: Date.now()
        });
        chrome.storage.local.set({ vaultSessions: vault }, () => {
          chrome.storage.local.remove('savedTabs', callback);
        });
      } else {
        callback();
      }
    });
  }

  // --- Data Processing ---

  function fetchCurrentTabs() {
    chrome.tabs.query({ currentWindow: true }, (tabs) => {
      chrome.storage.local.get({ tabMetadata: {} }, (result) => {
        currentTabs = tabs;
        processTabs(result.tabMetadata);
        generateSummary();
        renderGroupedTabs();
      });
    });
  }

  function processTabs(metadata) {
    const urlSet = new Set();
    processedTabs = [];
    groupedTabs = {};
    const now = Date.now();

    currentTabs.forEach(tab => {
      const isImportant = tab.active || tab.pinned;
      const isDuplicate = !isImportant && urlSet.has(tab.url); // Don't mark active as duplicate
      urlSet.add(tab.url);

      // Metadata info
      const tabMeta = metadata[tab.id] || { createdAt: now, note: '' };
      const ageMs = now - tabMeta.createdAt;
      const ageHours = Math.floor(ageMs / (1000 * 60 * 60));

      // Check inactivity
      let isInactive = false;
      if (!isImportant) {
        if (tab.lastAccessed) {
          isInactive = (now - tab.lastAccessed) > INACTIVE_THRESHOLD_MS;
        } else {
          // Fallback if lastAccessed not supported: everything not active/pinned is inactive
          isInactive = true; 
        }
      }

      // Mark as stale if it's inactive AND older than 60 mins
      const isStale = isInactive && ageMs > INACTIVE_THRESHOLD_MS;

      // Determine domain
      let domain = 'other';
      try {
        const urlObj = new URL(tab.url);
        domain = urlObj.hostname.replace(/^www\./, '');
      } catch(e) {
        // Handle chrome:// or other invalid URLs
        domain = tab.url.split('/')[2] || 'other'; 
      }

      const processedTab = { 
        ...tab, isImportant, isDuplicate, isInactive, isStale, domain, 
        ageHours, note: tabMeta.note 
      };
      processedTabs.push(processedTab);

      if (!groupedTabs[domain]) {
        groupedTabs[domain] = [];
      }
      groupedTabs[domain].push(processedTab);
    });
  }

  // --- Modular Getters ---

  function getDuplicateTabs() {
    return processedTabs.filter(t => t.isDuplicate);
  }

  function getInactiveTabs() {
    return processedTabs.filter(t => t.isInactive);
  }

  function generateSummary() {
    const total = processedTabs.length;
    const dupes = getDuplicateTabs().length;
    const inactive = getInactiveTabs().length;
    const groups = Object.keys(groupedTabs).length;

    statTotal.textContent = total;
    statDupes.textContent = dupes;
    statInactive.textContent = inactive;
    statGroups.textContent = groups;

    // Calculate action impact
    const tabsToClose = processedTabs.filter(t => (t.isDuplicate || t.isInactive) && !t.isImportant).length;
    const tabsToKeep = total - tabsToClose;
    
    if (statToClose) statToClose.textContent = tabsToClose;
    if (statToKeep) statToKeep.textContent = tabsToKeep;

    const staleCount = processedTabs.filter(t => t.isStale).length;
    if (staleTabsMsg) {
      staleTabsMsg.textContent = staleCount > 0 
        ? `${staleCount} tabs haven't been used in a while.` 
        : `All tabs are recently used.`;
    }
  }

  // --- UI View Logic ---

  function showView(viewName) {
    Object.values(views).forEach(v => v.classList.add('hidden'));
    if (views[viewName]) {
      views[viewName].classList.remove('hidden');
    }
  }

  // --- Smart Actions ---

  function autoCleanTabs() {
    const duplicateTabs = getDuplicateTabs().filter(t => !t.isImportant);
    const inactiveTabs = getInactiveTabs().filter(t => !t.isImportant && !t.isDuplicate); // Avoid double counting
    const tabsToClose = [...duplicateTabs, ...inactiveTabs];
    
    if (tabsToClose.length === 0) {
      alert("No duplicate or inactive tabs found to clean.");
      return;
    }

    const tabsToKeep = processedTabs.length - tabsToClose.length;
    
    // Provide an example domain for duplicates to make it trustworthy
    let dupeExample = '';
    if (duplicateTabs.length > 0) {
      const exampleDomain = duplicateTabs[0].domain;
      dupeExample = `\n  (e.g., duplicates from ${exampleDomain})`;
    }

    const confirmMsg = `You are about to:
- Close ${duplicateTabs.length} duplicate tabs${dupeExample}
- Close ${inactiveTabs.length} inactive tabs
- Keep ${tabsToKeep} tabs (active + pinned)

Do you want to continue?`;

    if (confirm(confirmMsg)) {
      saveSessionSnapshot(() => {
        const idsToClose = tabsToClose.map(t => t.id);
        chrome.tabs.remove(idsToClose, () => {
          fetchCurrentTabs(); // Refresh state
        });
      });
    }
  }

  function endDayFlow() {
    // Save ALL tabs in the window
    const tabsToProcess = [...processedTabs]; 
    
    if (tabsToProcess.length === 0) {
      alert("No tabs to save.");
      return;
    }

    const staleCount = tabsToProcess.filter(t => t.isStale).length;
    let staleNudge = '';
    if (staleCount > 0) {
      staleNudge = `\n  (Warning: Includes ${staleCount} stale tabs opened over an hour ago. Still needed?)`;
    }

    const confirmMsg = `You are about to:
- Save ALL ${tabsToProcess.length} tabs in this window${staleNudge}
- Close the entire browser window

Do you want to continue?`;

    if (confirm(confirmMsg)) {
      const suggestedName = prompt("Save as:", "End of Day Session");
      if (suggestedName === null) return; // Cancelled

      saveSessionSnapshot(() => {
        saveSession(tabsToProcess, suggestedName || "End of Day Session", () => {
          const idsToClose = tabsToProcess.map(t => t.id);
          chrome.tabs.remove(idsToClose, () => {
             // If for some reason the window doesn't close when all tabs close, force it:
             window.close(); // Closes the extension popup
          });
        });
      });
    }
  }

  // --- Session Safety ---

  function saveSessionSnapshot(callback) {
    if (sessionSavedThisRun) {
      if (callback) callback();
      return;
    }

    const timestamp = Date.now();
    const sessionData = currentTabs.map(tab => ({
      title: tab.title, url: tab.url, timestamp: timestamp
    }));

    chrome.storage.local.set({ lastSession: sessionData }, () => {
      sessionSavedThisRun = true;
      if (callback) callback();
    });
  }

  // --- Review View Rendering ---

  function renderGroupedTabs() {
    groupedTabList.innerHTML = '';
    tabCount.textContent = processedTabs.length.toString();
    // Persistence: Don't clear selectedTabs if we are just re-rendering existing data
    // But we should remove IDs that no longer exist
    const currentTabIds = new Set(processedTabs.map(t => t.id));
    for (let id of selectedTabs) {
      if (!currentTabIds.has(id)) {
        selectedTabs.delete(id);
      }
    }
    
    updateSelectionUI();
    populateGroupSelect();

    if (processedTabs.length === 0) {
      groupedTabList.innerHTML = '<div class="empty-state">No tabs to clean up!</div>';
      return;
    }

    // Sort domains: domains with most tabs first
    const domains = Object.keys(groupedTabs).sort((a, b) => groupedTabs[b].length - groupedTabs[a].length);

    domains.forEach(domain => {
      const groupTabs = groupedTabs[domain];
      
      const groupContainer = document.createElement('div');
      
      const header = document.createElement('div');
      header.className = 'domain-group-header';
      header.innerHTML = `<span>${domain} (${groupTabs.length})</span>`;
      
      groupContainer.appendChild(header);

      const ul = document.createElement('ul');
      ul.className = 'tab-list';

      groupTabs.forEach(tab => {
        const card = createTabCard(tab, ul);
        ul.appendChild(card);
      });

      groupContainer.appendChild(ul);
      groupedTabList.appendChild(groupContainer);
    });
  }

  function createTabCard(tab, container) {
    const li = document.createElement('li');
    li.className = 'tab-card';
    
    let labelsHtml = '';
    if (tab.isImportant) labelsHtml += `<span class="label label-important">Important</span>`;
    if (tab.isDuplicate) labelsHtml += `<span class="label label-duplicate">Duplicate</span>`;
    if (tab.isInactive) labelsHtml += `<span class="label label-inactive">Inactive</span>`;

    const faviconUrl = tab.favIconUrl || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjOTRhM2I4IiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTEzIDJINnYxNm03LTE2djRjMCAxLjEgLjkgMiAyIDJoNG0tNi02aDZsOCA4djgiLz48L3N2Zz4=';

    let ageText = tab.ageHours > 0 ? `Opened ${tab.ageHours}h ago` : `Opened <1h ago`;
    let contextLine = '';
    let textColor = 'var(--text-secondary)';

    if (tab.note) {
      contextLine = `${escapeHtml(tab.note)} • ${ageText}`;
    } else if (tab.isStale) {
      contextLine = `${ageText} • Possibly no longer needed`;
      textColor = 'var(--warning-color)';
    } else {
      contextLine = `${ageText}`;
    }

    let staleNudgeHtml = `<div class="age-nudge" style="color: ${textColor}">${contextLine}</div>`;

    li.innerHTML = `
      <input type="checkbox" class="tab-checkbox custom-checkbox" data-id="${tab.id}" ${selectedTabs.has(tab.id) ? 'checked' : ''}>
      <div class="tab-main-content">
        ${labelsHtml ? `<div class="tab-labels">${labelsHtml}</div>` : ''}
        <div class="tab-info">
          <img src="${faviconUrl}" class="tab-favicon" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjOTRhM2I4IiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTEzIDJINnYxNm03LTE2djRjMCAxLjEgLjkgMiAyIDJoNG0tNi02aDZsOCA4djgiLz48L3N2Zz4='">
          <div class="tab-text">
            <div class="tab-title" title="${escapeHtml(tab.title)}">${escapeHtml(tab.title)}</div>
            <div class="tab-url" title="${escapeHtml(tab.url)}">${escapeHtml(tab.url)}</div>
          </div>
        </div>
        ${staleNudgeHtml}
        <input type="text" class="tab-note-input" placeholder="Add a note... (e.g. DSA Practice)" value="${escapeHtml(tab.note)}">
        <div class="tab-actions" style="margin-top: 0.25rem;">
          <button class="action-btn close-btn" data-action="close">Close</button>
          <button class="action-btn keep-btn" data-action="keep">Keep</button>
          <button class="action-btn save-btn" data-action="save">Save</button>
        </div>
      </div>
    `;

    // Selection logic
    const checkbox = li.querySelector('.tab-checkbox');
    checkbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        selectedTabs.add(tab.id);
      } else {
        selectedTabs.delete(tab.id);
      }
      updateSelectionUI();
    });

    // Note saving logic
    const noteInput = li.querySelector('.tab-note-input');
    noteInput.addEventListener('input', (e) => {
      chrome.storage.local.get({ tabMetadata: {} }, (result) => {
        const metadata = result.tabMetadata || {};
        if (!metadata[tab.id]) {
          metadata[tab.id] = { url: tab.url, title: tab.title, createdAt: Date.now(), note: '' };
        }
        metadata[tab.id].note = e.target.value;
        chrome.storage.local.set({ tabMetadata: metadata });
      });
    });

    // Actions
    li.querySelector('.close-btn').addEventListener('click', () => {
      saveSessionSnapshot(() => {
        chrome.tabs.remove(tab.id, () => fetchCurrentTabs());
      });
    });

    li.querySelector('.keep-btn').addEventListener('click', () => {
      li.style.opacity = '0';
      setTimeout(() => li.remove(), 200);
      // We don't remove the tab, just hide from review
    });

    li.querySelector('.save-btn').addEventListener('click', () => {
      const tabData = { 
        title: tab.title, 
        url: tab.url, 
        favIconUrl: tab.favIconUrl, 
        domain: tab.domain,
        note: noteInput.value
      };

      saveSessionSnapshot(() => {
        const suggestedName = prompt("Name this group:", tab.domain ? `${tab.domain.charAt(0).toUpperCase() + tab.domain.slice(1)} Session` : "New Session");
        if (suggestedName === null) return;
        saveSession([tabData], suggestedName, () => {
          chrome.tabs.remove(tab.id, () => fetchCurrentTabs());
        });
      });
    });

    return li;
  }

  function updateSelectionUI() {
    if (selectedTabs.size > 0) {
      selectionBar.classList.remove('hidden');
      selectionCountText.textContent = `${selectedTabs.size} tab${selectedTabs.size > 1 ? 's' : ''} selected`;
    } else {
      selectionBar.classList.add('hidden');
    }
    
    if (processedTabs.length > 0 && selectedTabs.size === processedTabs.length) {
      selectAllTabs.checked = true;
    } else {
      selectAllTabs.checked = false;
    }
  }

  function populateGroupSelect() {
    if (!groupSelect) return;
    const currentValue = groupSelect.value;
    chrome.storage.local.get({ vaultSessions: [] }, (result) => {
      const sessions = result.vaultSessions;
      groupSelect.innerHTML = '<option value="new">+ New Group</option>';
      sessions.forEach(session => {
        const option = document.createElement('option');
        option.value = session.id;
        option.textContent = session.title;
        groupSelect.appendChild(option);
      });
      
      // Restore value if it still exists, otherwise default to new
      if (currentValue && [...groupSelect.options].some(o => o.value === currentValue)) {
        groupSelect.value = currentValue;
      }
      
      if (groupSelect.value === 'new') {
        newGroupNameInput.classList.remove('hidden');
      } else {
        newGroupNameInput.classList.add('hidden');
      }
    });
  }

  function saveSession(tabsToSave, customTitle = null, callback = null) {
    if (!tabsToSave || tabsToSave.length === 0) return;

    let title = customTitle;
    if (!title) {
      // Auto-name based on most frequent domain
      const domainCounts = {};
      let maxDomain = '';
      let maxCount = 0;
      tabsToSave.forEach(t => {
        let d = t.domain || 'other';
        domainCounts[d] = (domainCounts[d] || 0) + 1;
        if (domainCounts[d] > maxCount) {
          maxCount = domainCounts[d];
          maxDomain = d;
        }
      });
      
      if (maxDomain && maxDomain !== 'other') {
        title = `${maxDomain.charAt(0).toUpperCase() + maxDomain.slice(1)} Session`;
      } else {
        title = `Session (${tabsToSave.length} tabs)`;
      }
    }

    const sessionData = {
      id: 'session_' + Date.now(),
      title: title,
      tabs: tabsToSave.map(t => ({
        title: t.title,
        url: t.url,
        favIconUrl: t.favIconUrl,
        domain: t.domain,
        note: t.note || ''
      })),
      createdAt: Date.now()
    };

    chrome.storage.local.get({ vaultSessions: [] }, (result) => {
      const updatedVault = [sessionData, ...result.vaultSessions];
      chrome.storage.local.set({ vaultSessions: updatedVault }, () => {
        if (callback) callback();
      });
    });
  }

  // --- Saved Tabs Logic ---

  function renderVaultSessions() {
    savedTabList.innerHTML = '<div class="loading-state">Loading...</div>';
    chrome.storage.local.get({ vaultSessions: [] }, (result) => {
      const sessions = result.vaultSessions;
      savedTabList.innerHTML = '';
      
      if (sessions.length === 0) {
        savedTabList.innerHTML = '<div class="empty-state">No saved sessions yet.</div>';
        clearSavedBtn.classList.add('hidden');
        return;
      }

      clearSavedBtn.classList.remove('hidden');
      sessions.forEach((session, index) => {
        const li = document.createElement('li');
        li.className = 'session-card';
        const ageMs = Date.now() - session.createdAt;
        const ageHours = Math.floor(ageMs / (1000 * 60 * 60));
        let timeStr = ageHours > 0 ? `${ageHours} hours ago` : `Just now`;

        li.innerHTML = `
          <div class="session-header">
            <input type="text" class="session-title-input" value="${escapeHtml(session.title)}">
          </div>
          <div class="session-meta">
            ${session.tabs.length} tabs • ${timeStr}
          </div>
          <div class="tab-actions" style="margin-top: 0.5rem;">
            <button class="action-btn open-btn">Restore</button>
            <button class="action-btn close-btn">Delete</button>
          </div>
        `;

        // Rename logic
        const titleInput = li.querySelector('.session-title-input');
        titleInput.addEventListener('change', (e) => {
          session.title = e.target.value;
          chrome.storage.local.set({ vaultSessions: sessions });
        });

        li.querySelector('.open-btn').addEventListener('click', () => {
          session.tabs.forEach(tab => {
            chrome.tabs.create({ url: tab.url, active: false }, (newTab) => {
              if (tab.note) {
                chrome.storage.local.get({ tabMetadata: {} }, (result) => {
                  const metadata = result.tabMetadata || {};
                  metadata[newTab.id] = {
                    url: tab.url,
                    title: tab.title,
                    createdAt: Date.now(),
                    note: tab.note
                  };
                  chrome.storage.local.set({ tabMetadata: metadata });
                });
              }
            });
          });
          removeSession(index, li);
        });

        li.querySelector('.close-btn').addEventListener('click', () => removeSession(index, li));
        savedTabList.appendChild(li);
      });
    });
  }

  function removeSession(index, card) {
    chrome.storage.local.get({ vaultSessions: [] }, (result) => {
      const newSessions = result.vaultSessions.filter((_, idx) => idx !== index);
      chrome.storage.local.set({ vaultSessions: newSessions }, () => {
        card.style.opacity = '0';
        setTimeout(() => renderVaultSessions(), 200);
      });
    });
  }

  // --- Events & Utilities ---

  function setupEventListeners() {
    btnAutoClean.addEventListener('click', autoCleanTabs);
    btnSaveClose.addEventListener('click', endDayFlow);
    
    btnReview.addEventListener('click', () => showView('review'));
    btnViewSavedHome.addEventListener('click', () => {
      showView('saved');
      renderVaultSessions();
    });

    backBtns.forEach(btn => btn.addEventListener('click', () => showView('summary')));

    if (groupSelect) {
      groupSelect.addEventListener('change', () => {
        if (groupSelect.value === 'new') {
          newGroupNameInput.classList.remove('hidden');
          newGroupNameInput.focus();
        } else {
          newGroupNameInput.classList.add('hidden');
        }
      });
    }

    if (selectAllTabs) {
      selectAllTabs.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        const checkboxes = document.querySelectorAll('.tab-checkbox');
        
        checkboxes.forEach(cb => {
          cb.checked = isChecked;
          const id = parseInt(cb.dataset.id, 10);
          if (isChecked) {
            selectedTabs.add(id);
          } else {
            selectedTabs.delete(id);
          }
        });
        updateSelectionUI();
      });
    }

    if (btnSaveSelected) {
      btnSaveSelected.addEventListener('click', () => {
        if (selectedTabs.size === 0) return;
        
        const tabsToSave = processedTabs.filter(t => selectedTabs.has(t.id));
        const selectedGroupId = groupSelect ? groupSelect.value : 'new';
        
        if (selectedGroupId === 'new') {
          const suggestedName = newGroupNameInput.value.trim() || "New Group Session";
          
          saveSessionSnapshot(() => {
            saveSession(tabsToSave, suggestedName, () => {
              const idsToClose = tabsToSave.map(t => t.id);
              chrome.tabs.remove(idsToClose, () => {
                newGroupNameInput.value = '';
                newGroupNameInput.classList.add('hidden');
                fetchCurrentTabs(); // Refresh UI
              });
            });
          });
        } else {
          // Add to existing group
          saveSessionSnapshot(() => {
            chrome.storage.local.get({ vaultSessions: [] }, (result) => {
              let vault = result.vaultSessions;
              const sessionIndex = vault.findIndex(s => s.id === selectedGroupId);
              if (sessionIndex !== -1) {
                const newTabs = tabsToSave.map(t => ({
                  title: t.title,
                  url: t.url,
                  favIconUrl: t.favIconUrl,
                  domain: t.domain,
                  note: t.note || ''
                }));
                vault[sessionIndex].tabs = [...vault[sessionIndex].tabs, ...newTabs];
                chrome.storage.local.set({ vaultSessions: vault }, () => {
                  const idsToClose = tabsToSave.map(t => t.id);
                  chrome.tabs.remove(idsToClose, () => {
                    fetchCurrentTabs(); // Refresh UI
                  });
                });
              }
            });
          });
        }
      });
    }

    clearSavedBtn.addEventListener('click', () => {
      if(confirm('Delete all saved sessions in the vault?')) {
        chrome.storage.local.set({ vaultSessions: [] }, () => renderVaultSessions());
      }
    });

    restoreSessionBtn.addEventListener('click', () => {
      chrome.storage.local.get({ lastSession: [] }, (result) => {
        const session = result.lastSession;
        if (!session || session.length === 0) return alert('No previous session found.');
        if (confirm(`Restore ${session.length} tabs from the last session?`)) {
          session.forEach(tab => chrome.tabs.create({ url: tab.url, active: false }));
        }
      });
    });
  }

  function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
});
