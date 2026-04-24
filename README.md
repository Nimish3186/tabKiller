# Tab Killer — End-of-Day Tab Cleanup

A Chrome extension I built to solve a simple problem:

> Ending the day with 20–30 tabs open and no idea what half of them were for.

Instead of just closing tabs randomly, this helps you **review, decide, and clean up safely**.

---

## What it does

### 🔘 End Day Button

This is the main entry point.

Click it and you get a quick summary:
- Total tabs
- Duplicates
- Inactive tabs
- Groups

From there you can:
- **Auto Clean** → close duplicates + inactive tabs  
- **Review Tabs** → go through them manually  
- **Save All & Close** → store everything and clean up  

---

### 🧠 “Why did I open this?”

This is the part I personally needed the most.

For each tab, you’ll see:
- When it was opened  
- A hint like:  
  - *“Opened 2h ago • Possibly no longer needed”*

You can also add your own note:
- *“DSA practice”*
- *“Watch later”*

It sounds small, but it really helps when you're staring at a bunch of random tabs.

---

### 📦 Session Vault

Instead of losing everything, you can save tabs as sessions.

Examples:
- “DSA Practice Night”
- “Cybersecurity Research”
- “Random stuff”

You can reopen everything later with one click.

---

### ⚡ Smart Cleanup

- Detects duplicate tabs  
- Flags inactive ones  
- Keeps pinned + active tabs safe  

Nothing gets closed without confirmation.

---

### 🔒 Safety

Before any bulk action:
- A full session snapshot is saved

You can always:
- **Restore Last Session**

---

## Typical flow

1. Open tabs during the day  
2. Click **End Day**  
3. See what’s actually useful  
4. Clean up or save  

That’s it.

---

## Tech stack

- Chrome Extension (Manifest V3)
- JavaScript
- Chrome Tabs API
- Chrome Storage API

---

## Why I built this
When it came time to decide which tabs to close and which to keep, 
-it always felt like a headache. 
-I often had to manually create tab groups just to manage the mess.
-To solve this problem, 
       
I built Tab Killer.



I just wanted something that:
- shows what I opened  
- helps me decide quickly  
- doesn’t lose anything  

---

## Possible improvements

- Better tab categorization  
- Smarter session naming  
- Sync across devices  

---

## How to run

1. Clone the repo  
2. Go to `chrome://extensions/`  
3. Enable Developer Mode  
4. Click “Load unpacked”  
5. Select the project folder  

---

## Author

Nimish Jindal
