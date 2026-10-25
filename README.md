# Voice Note — Hacker House Goa 2026

An Apple HIG-inspired, fluid voice and text note taking web application built with plain HTML, CSS, and JavaScript.

Built with **Wispr Flow** for **Hacker House Goa 2026**.

## Features

- **Voice Dictation**: Real-time speech recognition via the browser's Web Speech API with pulsing recording indicator and seamless streaming into the note editor.
- **Automatic Keyword Tagging**: Automatically categorizes notes into:
  - 📘 **Study**: Mentions exam, assignments, lectures, notes
  - 📙 **Work**: Mentions meeting, deadlines, client, email
  - 📗 **Ideas**: Mentions build project, ideas, app
  - 🟣 **Personal**: All other general notes
- **Multi-Factor Filter & Search**:
  - Filter by category with live counts
  - Interactive search bar supporting keyword and tag searches
  - Sort by newest first, oldest first, or by tag
- **Card Actions**:
  - 📌 **Pin to Top**: Keep important notes pinned to the top
  - ✏️ **Inline Editing**: Edit note text in-place with automatic retagging
  - 🗑️ **Safe Deletion**: Two-step inline confirmation
  - 🗣️ **Text-to-Speech**: Listen to your notes read aloud
  - 📋 **Copy to Clipboard**: Quick copy with instant feedback
- **Appearance**:
  - Apple Human Interface Guidelines-inspired liquid glass aesthetics, fluid spring animations, and refined typography
  - Dark mode and Light mode toggle with persistent `localStorage` preference
  - Responsive mobile design with neatly wrapping full-width filter controls

## Running Locally

Clone this repository and open `index.html` in your browser, or start a local HTTP server:

```bash
python3 -m http.server 3000
```

Then navigate to `http://localhost:3000`.
