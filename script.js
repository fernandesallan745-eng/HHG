// Storage Keys
const STORAGE_KEY = 'voice_notes_app_data';
const STORAGE_SORT_KEY = 'voice_notes_sort_pref';
const STORAGE_THEME_KEY = 'voice_notes_theme_pref';

// DOM Elements
const themeToggleBtn = document.getElementById('themeToggleBtn');
const noteInput = document.getElementById('noteInput');
const saveBtn = document.getElementById('saveBtn');
const clearBtn = document.getElementById('clearBtn');
const micBtn = document.getElementById('micBtn');
const micBtnText = document.getElementById('micBtnText');
const micPulsingDot = document.getElementById('micPulsingDot');
const speechUnsupportedMsg = document.getElementById('speechUnsupportedMsg');
const charCount = document.getElementById('charCount');
const notesList = document.getElementById('notesList');
const emptyState = document.getElementById('emptyState');
const notesBadge = document.getElementById('notesBadge');
const searchInput = document.getElementById('searchInput');
const searchClearBtn = document.getElementById('searchClearBtn');
const tagFilters = document.getElementById('tagFilters');
const sortSelect = document.getElementById('sortSelect');
const toast = document.getElementById('toast');

// State
let notes = [];
let recognition = null;
let isRecording = false;
let toastTimeout = null;
let currentTagFilter = 'all';
let currentSort = localStorage.getItem(STORAGE_SORT_KEY) || 'newest';

// Tag Definitions & Colors Configuration (Apple HIG)
const TAG_CONFIG = {
  study: { label: 'Study', class: 'tag-study' },
  work: { label: 'Work', class: 'tag-work' },
  ideas: { label: 'Ideas', class: 'tag-ideas' },
  personal: { label: 'Personal', class: 'tag-personal' }
};

// Automatic Keyword Tagging Rules
function getAutomaticTag(text) {
  if (!text) return 'personal';
  const lower = text.toLowerCase();

  // 1. Study: exam, assignments, lectures, or notes
  if (/\b(exams?|assignments?|lectures?)\b/i.test(lower) || /\b(?<!voice\s+)notes?\b/i.test(lower)) {
    return 'study';
  }

  // 2. Work: meeting, deadlines, client, or email
  if (/\b(meetings?|deadlines?|clients?|emails?)\b/i.test(lower)) {
    return 'work';
  }

  // 3. Ideas: build project, ideas, or app
  if (/\b(build\s+project|build|projects?|ideas?|apps?)\b/i.test(lower)) {
    return 'ideas';
  }

  // 4. Personal: fallback for everything else
  return 'personal';
}

// Initialize Web Speech Recognition if available
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let speechBaseText = '';

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onstart = () => {
    isRecording = true;
    if (micBtn) micBtn.classList.add('listening');
    if (micBtnText) micBtnText.textContent = 'Listening...';
    showToast('Microphone active. Listening to speech...');
  };

  recognition.onresult = (event) => {
    let finalTranscript = '';
    let interimTranscript = '';

    for (let i = 0; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }

    // Stream recognized text into the note input as you speak
    const currentTranscript = finalTranscript + (interimTranscript ? (finalTranscript ? ' ' : '') + interimTranscript : '');
    noteInput.value = speechBaseText + currentTranscript;
    updateCharCount();
  };

  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    stopRecording();
    if (event.error === 'not-allowed') {
      showToast('Microphone permission denied.');
    } else {
      showToast('Speech recognition error: ' + event.error);
    }
  };

  recognition.onend = () => {
    stopRecording();
  };
} else {
  // If the browser doesn't support speech recognition, hide the button and show a small message instead
  if (micBtn) micBtn.style.display = 'none';
  if (speechUnsupportedMsg) speechUnsupportedMsg.style.display = 'inline-block';
}

function startRecording() {
  if (!recognition) {
    if (micBtn) micBtn.style.display = 'none';
    if (speechUnsupportedMsg) speechUnsupportedMsg.style.display = 'inline-block';
    showToast('Speech recognition not supported in this browser.');
    return;
  }

  // Preserve existing text before speech starts
  speechBaseText = noteInput.value;
  if (speechBaseText && !speechBaseText.endsWith(' ') && !speechBaseText.endsWith('\n')) {
    speechBaseText += ' ';
  }

  try {
    recognition.start();
  } catch (err) {
    console.error('Recognition start error:', err);
  }
}

function stopRecording() {
  isRecording = false;
  if (micBtn) micBtn.classList.remove('listening');
  if (micBtnText) micBtnText.textContent = 'Dictate';
  if (recognition) {
    try {
      recognition.stop();
    } catch (e) {
      // Ignore if already stopped
    }
  }
}

// Toggle voice recording on click
if (micBtn) {
  micBtn.addEventListener('click', () => {
    if (isRecording) {
      stopRecording();
      showToast('Stopped listening');
    } else {
      startRecording();
    }
  });
}

// Load notes and sort settings from localStorage
function loadNotes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    notes = raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to load notes from localStorage:', e);
    notes = [];
  }

  // Restore sort dropdown
  if (sortSelect) {
    sortSelect.value = currentSort;
  }

  renderNotes();
}

// Save notes to localStorage
function persistNotes() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch (e) {
    console.error('Failed to save to localStorage:', e);
    showToast('Storage full or error saving note.');
  }
}

// Format creation date
function formatTimestamp(isoString) {
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return 'Recently';

  const now = new Date();
  const isToday = now.toDateString() === date.toDateString();

  const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });

  if (isToday) {
    return `Today at ${timeStr}`;
  }

  const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  return `${dateStr}, ${timeStr}`;
}

// Update counts on filter buttons
function updateTagCounts() {
  const counts = { all: notes.length, study: 0, work: 0, ideas: 0, personal: 0 };
  notes.forEach(n => {
    const tag = n.tag || getAutomaticTag(n.text);
    if (counts[tag] !== undefined) {
      counts[tag]++;
    } else {
      counts.personal++;
    }
  });

  const countAll = document.getElementById('count-all');
  const countStudy = document.getElementById('count-study');
  const countWork = document.getElementById('count-work');
  const countIdeas = document.getElementById('count-ideas');
  const countPersonal = document.getElementById('count-personal');

  if (countAll) countAll.textContent = counts.all;
  if (countStudy) countStudy.textContent = counts.study;
  if (countWork) countWork.textContent = counts.work;
  if (countIdeas) countIdeas.textContent = counts.ideas;
  if (countPersonal) countPersonal.textContent = counts.personal;
}

// Render notes to DOM (Coordinated Search, Tag Filter, Pinned Priority & Sort Dropdown)
function renderNotes() {
  updateTagCounts();
  const query = searchInput.value.trim().toLowerCase();

  // Toggle search clear button
  if (searchClearBtn) {
    if (query) {
      searchClearBtn.classList.add('visible');
    } else {
      searchClearBtn.classList.remove('visible');
    }
  }

  // 1. Filter by active tag and search input
  let filtered = notes.filter(n => {
    const noteTag = (n.tag || getAutomaticTag(n.text)).toLowerCase();
    const tagLabel = (TAG_CONFIG[noteTag]?.label || noteTag).toLowerCase();

    // Tag filter matching
    const matchesTag = currentTagFilter === 'all' || noteTag === currentTagFilter;

    // Search query matching (matches note text, type/tag, or tag label)
    const matchesQuery = !query || 
      n.text.toLowerCase().includes(query) ||
      noteTag.includes(query) ||
      tagLabel.includes(query);

    return matchesTag && matchesQuery;
  });

  // 2. Sort notes: Pinned notes ALWAYS stay at the top, then sorted by dropdown
  filtered.sort((a, b) => {
    const aPinned = a.isPinned ? 1 : 0;
    const bPinned = b.isPinned ? 1 : 0;
    
    // Pinned notes come first
    if (aPinned !== bPinned) {
      return bPinned - aPinned;
    }

    // Secondary sorting by user dropdown selection
    if (currentSort === 'oldest') {
      return new Date(a.createdAt) - new Date(b.createdAt);
    } else if (currentSort === 'tag') {
      const tagA = (a.tag || getAutomaticTag(a.text)).toLowerCase();
      const tagB = (b.tag || getAutomaticTag(b.text)).toLowerCase();
      if (tagA !== tagB) return tagA.localeCompare(tagB);
      return new Date(b.createdAt) - new Date(a.createdAt);
    } else {
      // Default: newest first
      return new Date(b.createdAt) - new Date(a.createdAt);
    }
  });

  notesBadge.textContent = notes.length;
  notesList.innerHTML = '';

  if (filtered.length === 0) {
    emptyState.classList.add('active');
    if (query && currentTagFilter !== 'all') {
      const activeLabel = TAG_CONFIG[currentTagFilter]?.label || currentTagFilter;
      emptyState.querySelector('h3').textContent = 'No matching notes';
      emptyState.querySelector('p').textContent = `No notes found matching "${query}" in category "${activeLabel}".`;
    } else if (currentTagFilter !== 'all') {
      const activeLabel = TAG_CONFIG[currentTagFilter]?.label || currentTagFilter;
      emptyState.querySelector('h3').textContent = `No ${activeLabel} notes`;
      emptyState.querySelector('p').textContent = `You don't have any notes tagged as "${activeLabel}" yet.`;
    } else if (query) {
      emptyState.querySelector('h3').textContent = 'No matching notes';
      emptyState.querySelector('p').textContent = `No notes found matching "${query}".`;
    } else {
      emptyState.querySelector('h3').textContent = 'No notes yet';
      emptyState.querySelector('p').textContent = 'Type your thoughts above or use voice dictation, then hit Save Note.';
    }
    return;
  }

  emptyState.classList.remove('active');

  // SVG Icons
  const clockSvg = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
  const speakerSvg = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`;
  const copySvg = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
  const editSvg = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
  const pinSvg = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a1 1 0 0 0 0-2H8a1 1 0 0 0 0 2h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>`;
  const trashSvg = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`;

  filtered.forEach(note => {
    const card = document.createElement('article');
    card.className = `note-card ${note.isPinned ? 'is-pinned' : ''}`;
    card.dataset.id = note.id;

    // Determine tag and styling
    const tagKey = note.tag || getAutomaticTag(note.text);
    const tagInfo = TAG_CONFIG[tagKey] || TAG_CONFIG.personal;

    const pinnedBadgeHtml = note.isPinned ? `
      <span class="pinned-badge" title="Pinned to top">
        ${pinSvg}
        <span>Pinned</span>
      </span>
    ` : '';

    card.innerHTML = `
      <div class="note-card-header">
        <div style="display: flex; align-items: center; gap: 6px;">
          <span class="tag-badge ${tagInfo.class}" title="Category: ${tagInfo.label}">
            <span class="tag-dot"></span>
            ${tagInfo.label}
          </span>
          ${pinnedBadgeHtml}
        </div>
      </div>
      <div class="note-content-container">
        <div class="note-content">${escapeHTML(note.text)}</div>
      </div>
      <div class="note-footer">
        <div class="note-timestamp">
          ${clockSvg}
          <span>${formatTimestamp(note.createdAt)}${note.updatedAt ? ' (edited)' : ''}</span>
        </div>
        <div class="note-actions">
          <button class="btn-icon speak-btn" title="Read note aloud" aria-label="Listen to note">
            ${speakerSvg}
          </button>
          <button class="btn-icon copy-btn" title="Copy text" aria-label="Copy note">
            ${copySvg}
          </button>
          <button class="btn-icon edit-btn" title="Edit note" aria-label="Edit note">
            ${editSvg}
          </button>
          <button class="btn-icon pin-btn ${note.isPinned ? 'active' : ''}" title="${note.isPinned ? 'Unpin note' : 'Pin note to top'}" aria-label="Pin note">
            ${pinSvg}
          </button>
          <button class="btn-icon delete delete-btn" title="Delete note" aria-label="Delete note">
            ${trashSvg}
          </button>
        </div>
      </div>
    `;

    // 1. Text to Speech
    const speakBtn = card.querySelector('.speak-btn');
    speakBtn.addEventListener('click', () => speakNote(note.text));

    // 2. Copy note text
    const copyBtn = card.querySelector('.copy-btn');
    copyBtn.addEventListener('click', () => copyNote(note.text));

    // 3. Toggle Pin
    const pinBtn = card.querySelector('.pin-btn');
    pinBtn.addEventListener('click', () => togglePinNote(note.id));

    // 4. Edit note (with automatic retagging)
    const editBtn = card.querySelector('.edit-btn');
    editBtn.addEventListener('click', () => enterEditMode(card, note));

    // 5. Delete note (with quick confirm)
    const deleteBtn = card.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', () => triggerDeleteConfirm(card, note.id));

    notesList.appendChild(card);
  });
}

// Toggle Pin Status
function togglePinNote(id) {
  const target = notes.find(n => n.id === id);
  if (!target) return;

  target.isPinned = !target.isPinned;
  persistNotes();
  renderNotes();
  showToast(target.isPinned ? 'Note pinned to top 📌' : 'Note unpinned');
}

// Enter Edit Mode on Card
function enterEditMode(card, note) {
  const contentContainer = card.querySelector('.note-content-container');
  const footer = card.querySelector('.note-footer');
  if (!contentContainer || !footer) return;

  // Hide standard footer during editing
  footer.style.display = 'none';

  contentContainer.innerHTML = `
    <div class="inline-edit-area">
      <textarea class="inline-edit-textarea" rows="4" spellcheck="true">${escapeHTML(note.text)}</textarea>
      <div class="inline-edit-actions">
        <button class="btn-edit-cancel" type="button">Cancel</button>
        <button class="btn-edit-save" type="button">Save Changes</button>
      </div>
    </div>
  `;

  const editTextarea = contentContainer.querySelector('.inline-edit-textarea');
  const saveEditBtn = contentContainer.querySelector('.btn-edit-save');
  const cancelEditBtn = contentContainer.querySelector('.btn-edit-cancel');

  editTextarea.focus();
  editTextarea.setSelectionRange(editTextarea.value.length, editTextarea.value.length);

  // Cancel Edit
  cancelEditBtn.addEventListener('click', () => {
    renderNotes();
  });

  // Save Edit Function
  const executeSaveEdit = () => {
    const updatedText = editTextarea.value.trim();
    if (!updatedText) {
      showToast('Note cannot be empty!');
      editTextarea.focus();
      return;
    }

    // Update text and rerun automatic tagging
    const newTag = getAutomaticTag(updatedText);
    note.text = updatedText;
    note.tag = newTag;
    note.updatedAt = new Date().toISOString();

    persistNotes();
    renderNotes();
    showToast(`Note updated & tagged as #${newTag}!`);
  };

  saveEditBtn.addEventListener('click', executeSaveEdit);

  // Save on Cmd/Ctrl + Enter
  editTextarea.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      executeSaveEdit();
    }
  });
}

// Trigger Inline Delete Confirmation
function triggerDeleteConfirm(card, id) {
  const footer = card.querySelector('.note-footer');
  if (!footer) return;

  const originalFooterContent = footer.innerHTML;

  footer.innerHTML = `
    <div class="delete-confirm-bar" style="width: 100%;">
      <span class="delete-confirm-text">Delete this note?</span>
      <div class="delete-confirm-btns">
        <button class="btn-confirm-cancel" type="button">Cancel</button>
        <button class="btn-confirm-delete" type="button">Delete</button>
      </div>
    </div>
  `;

  const cancelBtn = footer.querySelector('.btn-confirm-cancel');
  const confirmBtn = footer.querySelector('.btn-confirm-delete');

  cancelBtn.addEventListener('click', () => {
    footer.innerHTML = originalFooterContent;
    // Rebind original footer buttons
    const targetNote = notes.find(n => n.id === id);
    if (targetNote) {
      footer.querySelector('.speak-btn').addEventListener('click', () => speakNote(targetNote.text));
      footer.querySelector('.copy-btn').addEventListener('click', () => copyNote(targetNote.text));
      footer.querySelector('.edit-btn').addEventListener('click', () => enterEditMode(card, targetNote));
      footer.querySelector('.pin-btn').addEventListener('click', () => togglePinNote(id));
      footer.querySelector('.delete-btn').addEventListener('click', () => triggerDeleteConfirm(card, id));
    }
  });

  confirmBtn.addEventListener('click', () => {
    deleteNote(id);
  });
}

// Delete Note
function deleteNote(id) {
  notes = notes.filter(n => n.id !== id);
  persistNotes();
  renderNotes();
  showToast('Note deleted');
}

// Safe HTML escaping
function escapeHTML(str) {
  const p = document.createElement('p');
  p.textContent = str;
  return p.innerHTML;
}

// Text to Speech
function speakNote(text) {
  if (!('speechSynthesis' in window)) {
    showToast('Text-to-speech is not supported.');
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  window.speechSynthesis.speak(utterance);
  showToast('Playing voice note...');
}

// Copy to Clipboard
function copyNote(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('Copied to clipboard!');
    }).catch(() => {
      fallbackCopy(text);
    });
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const temp = document.createElement('textarea');
  temp.value = text;
  document.body.appendChild(temp);
  temp.select();
  document.execCommand('copy');
  document.body.removeChild(temp);
  showToast('Copied to clipboard!');
}

// Save Note
function saveNote() {
  const text = noteInput.value.trim();
  if (!text) {
    showToast('Please type a note first!');
    noteInput.focus();
    return;
  }

  // Stop recording if running
  if (isRecording) {
    stopRecording();
  }

  const tag = getAutomaticTag(text);

  const newNote = {
    id: 'note_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    text: text,
    tag: tag,
    isPinned: false,
    createdAt: new Date().toISOString()
  };

  // Add to notes list
  notes.unshift(newNote);
  persistNotes();
  renderNotes();

  // Reset editor
  noteInput.value = '';
  updateCharCount();
  showToast(`Note saved with #${tag} tag!`);
}

// Clear editor
clearBtn.addEventListener('click', () => {
  if (noteInput.value.trim()) {
    noteInput.value = '';
    updateCharCount();
    showToast('Editor cleared');
  }
  noteInput.focus();
});

// Update character count
function updateCharCount() {
  const len = noteInput.value.length;
  charCount.textContent = `${len} ${len === 1 ? 'character' : 'characters'}`;
}

noteInput.addEventListener('input', updateCharCount);

// Save button click
saveBtn.addEventListener('click', saveNote);

// Keyboard shortcut: Cmd/Ctrl + Enter to save
noteInput.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault();
    saveNote();
  }
});

// Search filter
searchInput.addEventListener('input', renderNotes);

// Clear search button
if (searchClearBtn) {
  searchClearBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchClearBtn.classList.remove('visible');
    renderNotes();
    searchInput.focus();
  });
}

// Tag filters listener (Apple Segmented Control)
if (tagFilters) {
  tagFilters.addEventListener('click', (e) => {
    const btn = e.target.closest('.segment-btn, .filter-chip');
    if (!btn) return;

    tagFilters.querySelectorAll('.segment-btn, .filter-chip').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    currentTagFilter = btn.dataset.tag || 'all';
    renderNotes();
  });
}

// Sort dropdown change listener
if (sortSelect) {
  sortSelect.addEventListener('change', () => {
    currentSort = sortSelect.value;
    localStorage.setItem(STORAGE_SORT_KEY, currentSort);
    renderNotes();
    showToast(`Sorted by ${sortSelect.options[sortSelect.selectedIndex].text.toLowerCase()}`);
  });
}

// Toast notification helper
function showToast(message) {
  if (toastTimeout) clearTimeout(toastTimeout);
  toast.textContent = message;
  toast.classList.add('show');
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 2600);
}

// Theme Management (Light / Dark Appearance with LocalStorage Persistence)
function initTheme() {
  try {
    const savedTheme = localStorage.getItem(STORAGE_THEME_KEY);
    if (savedTheme === 'light' || savedTheme === 'dark') {
      document.documentElement.setAttribute('data-theme', savedTheme);
    } else {
      // Default to dark mode
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  } catch (e) {
    console.error('Failed to read theme from localStorage:', e);
    document.documentElement.setAttribute('data-theme', 'dark');
  }
}

if (themeToggleBtn) {
  themeToggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', nextTheme);
    try {
      localStorage.setItem(STORAGE_THEME_KEY, nextTheme);
    } catch (e) {
      console.error('Failed to save theme preference:', e);
    }
    
    showToast(`Switched to ${nextTheme === 'dark' ? 'Dark' : 'Light'} appearance`);
  });
}

// Initial Boot
initTheme();
loadNotes();
updateCharCount();
