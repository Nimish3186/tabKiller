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

  // --- State ---
  let currentTabs = [];
  let processedTabs = [];
  let groupedTabs = {};
  let sessionSavedThisRun = false;
  const INACTIVE_THRESHOLD_MS = 60 * 60 * 1000; // 60 minutes

  // --- Initialization ---
  init();

  function init() {
    fetchCurrentTabs();
    setupEventListeners();
  }

  // --- Data Processing ---

  function fetchCurrentTabs() {
    chrome.tabs.query({ currentWindow: true }, (tabs) => {
      currentTabs = tabs;
      processTabs();
      generateSummary();
      renderGroupedTabs();
    });
  }

  function processTabs() {
    const urlSet = new Set();
    processedTabs = [];
    groupedTabs = {};

    currentTabs.forEach(tab => {
      const isImportant = tab.active || tab.pinned;
      const isDuplicate = !isImportant && urlSet.has(tab.url); // Don't mark active as duplicate
      urlSet.add(tab.url);

      // Check inactivity
      let isInactive = false;
      if (!isImportant) {
        if (tab.lastAccessed) {
          isInactive = (Date.now() - tab.lastAccessed) > INACTIVE_THRESHOLD_MS;
        } else {
          // Fallback if lastAccessed not supported: everything not active/pinned is inactive
          isInactive = true; 
        }
      }

      // Determine domain
      let domain = 'other';
      try {
        const urlObj = new URL(tab.url);
        domain = urlObj.hostname.replace(/^www\./, '');
      } catch(e) {
        // Handle chrome:// or other invalid URLs
        domain = tab.url.split('/')[2] || 'other'; 
      }

      const processedTab = { ...tab, isImportant, isDuplicate, isInactive, domain };
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
    // ALWAYS keep the active tab and pinned tabs
    const tabsToKeep = processedTabs.filter(t => t.isImportant);
    const tabsToProcess = processedTabs.filter(t => !t.isImportant); 
    
    if (tabsToProcess.length === 0) {
      alert("Only important tabs (active/pinned) remain.");
      return;
    }

    const confirmMsg = `You are about to:
- Save and close ${tabsToProcess.length} tabs
- Keep ${tabsToKeep.length} tabs (active + pinned)

Do you want to continue?`;

    if (confirm(confirmMsg)) {
      saveSessionSnapshot(() => {
        // Save to "Saved Tabs"
        const tabsData = tabsToProcess.map(t => ({
          title: t.title,
          url: t.url,
          favIconUrl: t.favIconUrl,
          savedAt: Date.now()
        }));

        chrome.storage.local.get({ savedTabs: [] }, (result) => {
          const updatedSavedTabs = [...result.savedTabs, ...tabsData];
          chrome.storage.local.set({ savedTabs: updatedSavedTabs }, () => {
            const idsToClose = tabsToProcess.map(t => t.id);
            
            // Safety: If no tabs remain (which shouldn't happen due to isImportant, but just in case)
            if (tabsToKeep.length === 0) {
              chrome.tabs.create({}, () => {
                chrome.tabs.remove(idsToClose, () => window.close());
              });
            } else {
              chrome.tabs.remove(idsToClose, () => window.close());
            }
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
      header.textContent = `${domain} (${groupTabs.length})`;
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

    li.innerHTML = `
      ${labelsHtml ? `<div class="tab-labels">${labelsHtml}</div>` : ''}
      <div class="tab-info">
        <img src="${faviconUrl}" class="tab-favicon" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjOTRhM2I4IiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTEzIDJINnYxNm03LTE2djRjMCAxLjEgLjkgMiAyIDJoNG0tNi02aDZsOCA4djgiLz48L3N2Zz4='">
        <div class="tab-text">
          <div class="tab-title" title="${escapeHtml(tab.title)}">${escapeHtml(tab.title)}</div>
          <div class="tab-url" title="${escapeHtml(tab.url)}">${escapeHtml(tab.url)}</div>
        </div>
      </div>
      <div class="tab-actions">
        <button class="action-btn close-btn" data-action="close">Close</button>
        <button class="action-btn keep-btn" data-action="keep">Keep</button>
        <button class="action-btn save-btn" data-action="save">Save</button>
      </div>
    `;

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
      saveSessionSnapshot(() => {
        const tabData = { title: tab.title, url: tab.url, favIconUrl: tab.favIconUrl, savedAt: Date.now() };
        chrome.storage.local.get({ savedTabs: [] }, (result) => {
          chrome.storage.local.set({ savedTabs: [...result.savedTabs, tabData] }, () => {
            chrome.tabs.remove(tab.id, () => fetchCurrentTabs());
          });
        });
      });
    });

    return li;
  }

  // --- Saved Tabs Logic ---

  function renderSavedTabs() {
    savedTabList.innerHTML = '<div class="loading-state">Loading...</div>';
    chrome.storage.local.get({ savedTabs: [] }, (result) => {
      const tabs = result.savedTabs;
      savedTabList.innerHTML = '';
      
      if (tabs.length === 0) {
        savedTabList.innerHTML = '<div class="empty-state">No saved tabs yet.</div>';
        clearSavedBtn.classList.add('hidden');
        return;
      }

      clearSavedBtn.classList.remove('hidden');
      tabs.sort((a, b) => b.savedAt - a.savedAt).forEach((tab, index) => {
        const li = document.createElement('li');
        li.className = 'tab-card';
        const dateStr = new Date(tab.savedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        const faviconUrl = tab.favIconUrl || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjOTRhM2I4IiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTEzIDJINnYxNm03LTE2djRjMCAxLjEgLjkgMiAyIDJoNG0tNi02aDZsOCA4djgiLz48L3N2Zz4=';

        li.innerHTML = `
          <div class="tab-info">
            <img src="${faviconUrl}" class="tab-favicon" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjOTRhM2I4IiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTEzIDJINnYxNm03LTE2djRjMCAxLjEgLjkgMiAyIDJoNG0tNi02aDZsOCA4djgiLz48L3N2Zz4='">
            <div class="tab-text">
              <div class="tab-title" title="${escapeHtml(tab.title)}">${escapeHtml(tab.title)}</div>
              <div class="tab-url" title="${escapeHtml(tab.url)}">${escapeHtml(tab.url)} - ${dateStr}</div>
            </div>
          </div>
          <div class="tab-actions">
            <button class="action-btn open-btn">Open</button>
            <button class="action-btn close-btn">Delete</button>
          </div>
        `;

        li.querySelector('.open-btn').addEventListener('click', () => {
          chrome.tabs.create({ url: tab.url, active: false });
          removeSavedTab(index, li);
        });

        li.querySelector('.close-btn').addEventListener('click', () => removeSavedTab(index, li));
        savedTabList.appendChild(li);
      });
    });
  }

  function removeSavedTab(index, card) {
    chrome.storage.local.get({ savedTabs: [] }, (result) => {
      const newTabs = result.savedTabs.filter((_, idx) => idx !== index);
      chrome.storage.local.set({ savedTabs: newTabs }, () => {
        card.style.opacity = '0';
        setTimeout(() => renderSavedTabs(), 200);
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
      renderSavedTabs();
    });

    backBtns.forEach(btn => btn.addEventListener('click', () => showView('summary')));

    clearSavedBtn.addEventListener('click', () => {
      if(confirm('Delete all saved tabs?')) {
        chrome.storage.local.set({ savedTabs: [] }, () => renderSavedTabs());
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
