# 🗡️ Tab Killer

> **A smart Chrome extension to take control of your browser tabs at the end of the day.**

Tab Killer helps you review, organize, group, and clean up your open tabs — without losing important work. Save sessions to a personal vault and restore them anytime.

---

## ✨ Features

### 🧹 Auto Clean
Automatically detect and close **duplicate** and **inactive** tabs in one click, while keeping your active and pinned tabs safe.

### 💾 Save All & Close (End of Day)
Save your entire session to the **Session Vault** with a custom name, then cleanly close all unpinned tabs. Your work is never lost.

### 🔍 Review Tabs
Manually browse through all open tabs, grouped by domain. For each tab you can:
- **Close** — Remove the tab immediately
- **Keep** — Dismiss from the review without closing
- **Save** — Archive the tab to the vault and close it
- **Add a note** — Annotate a tab with context (e.g. *"DSA Practice"*)

### 📁 Tab Groups (New!)
Select multiple tabs using checkboxes and save them together as a named group:
- **Selective Grouping** — Select multiple tabs and save them as a named session group with a sleek **inline input** (no more annoying browser prompts!)
- **Selection Persistence** — Your selected tabs stay selected even when you close other tabs or change notes
- **Add to Existing Group** — Choose any previously saved session from the dropdown to append tabs to it
- **Context-Aware Notes** — Add notes (e.g., "DSA Practice") to tabs that persist until they are saved or closed

### 🗄️ Session Vault
A persistent library of all your saved sessions:
- **Restore** any session — reopens all tabs at once
- **Rename** sessions inline
- **Delete** individual sessions or clear the vault entirely

### ↩️ Restore Last Session
A one-click button to instantly reopen the last auto-saved snapshot of your browser session.

---

## 🚀 How to Install (Developer Mode)

1. Clone or download this repository.
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer Mode** (toggle in the top right corner).
4. Click **Load unpacked** and select the `tabKiller` folder.
5. The Tab Killer icon will appear in your Chrome toolbar.

---

## 🛠️ Tech Stack

- **Manifest V3** Chrome Extension API
- Vanilla **JavaScript** — no frameworks, no dependencies
- **Chrome Storage API** for persistent session data
- **CSS3** with custom properties, glassmorphism effects, and micro-animations
- **Google Fonts** (Inter) for premium typography

---

## 📸 Screenshots

> *(Add screenshots of the popup here)*

---

## 📂 Project Structure

```
tabKiller/
├── manifest.json       # Extension configuration (Manifest V3)
├── background.js       # Service worker for tab metadata tracking
├── popup.html          # Extension popup UI
├── popup.js            # All UI logic, tab management, and vault operations
├── popup.css           # Dark theme styles with premium design
└── icon*.png           # Extension icons
```

---

## 🤝 Contributing

This is a personal productivity project. Feel free to fork it and build on top of it!

---

## 📄 License

MIT License — free to use, share, and modify.

---

*Built with ❤️ to make browser hygiene painless.*
