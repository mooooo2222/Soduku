// sudoku.js - main application logic for the Sudoku web app
// Uses modules:
//  - ./generator.js (generatePuzzle)
//  - ./solver.js (isValidPlacement, solve)
//  - ./storage.js (saveCurrent, loadCurrent, saveManual)
//
// Responsibilities:
//  - Render 9x9 grid and notes
//  - Handle cell selection, number input (keyboard + numpad)
//  - Notes (pencil) mode, erase, undo/redo
//  - Timer, move counter
//  - New game, save/load, hint
//  - Basic error highlighting and completion detection

import { generatePuzzle } from './generator.js';
import { isValidPlacement, solve } from './solver.js';
import { saveCurrent, loadCurrent, saveManual, listSavedGames } from './storage.js';

const sudokuContainer = document.getElementById('sudoku');
const difficultySelect = document.getElementById('difficulty');
const newGameBtn = document.getElementById('newGameBtn');
const hintBtn = document.getElementById('hintBtn');
const saveBtn = document.getElementById('saveBtn');
const loadBtn = document.getElementById('loadBtn');
const notesCheckbox = document.getElementById('notesMode');
const timerEl = document.getElementById('timer');
const movesEl = document.getElementById('moves');
const statusEl = document.getElementById('status');
const eraseBtn = document.getElementById('eraseBtn');
const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');
const numButtons = Array.from(document.querySelectorAll('.num-btn'));

let state = {
  puzzle: null,      // starting givens (9x9)
  solution: null,    // solved grid (9x9)
  grid: null,        // current grid (9x9)
  notes: null,       // 9x9 sets for pencil marks
  selected: null,    // [r,c]
  startTime: null,
  elapsed: 0,        // seconds
  moves: 0,
  givensMask: null   // 9x9 boolean indicating given cells
};

let timerInterval = null;
let undoStack = [];
let redoStack = [];

function makeEmptyGrid() {
  return Array.from({ length: 9 }, () => Array(9).fill(0));
}

function makeEmptyNotes() {
  return Array.from({ length: 9 }, () =>
    Array.from({ length: 9 }, () => new Set())
  );
}

function deepCloneStateForHistory() {
  return {
    grid: state.grid.map(r => r.slice()),
    notes: state.notes.map(row => row.map(s => new Set([...s]))),
    elapsed: state.elapsed,
    moves: state.moves
  };
}

function pushHistory() {
  undoStack.push(deepCloneStateForHistory());
  if (undoStack.length > 200) undoStack.shift();
  // clear redo on new action
  redoStack = [];
  updateUndoRedoButtons();
}

function undo() {
  if (!undoStack.length) return;
  const snapshot = undoStack.pop();
  redoStack.push(deepCloneStateForHistory());
  state.grid = snapshot.grid.map(r => r.slice());
  state.notes = snapshot.notes.map(row => row.map(s => new Set([...s])));
  state.elapsed = snapshot.elapsed;
  state.moves = snapshot.moves;
  renderGrid();
  renderStats();
  updateUndoRedoButtons();
  saveCurrentState();
}

function redo() {
  if (!redoStack.length) return;
  const snapshot = redoStack.pop();
  undoStack.push(deepCloneStateForHistory());
  state.grid = snapshot.grid.map(r => r.slice());
  state.notes = snapshot.notes.map(row => row.map(s => new Set([...s])));
  state.elapsed = snapshot.elapsed;
  state.moves = snapshot.moves;
  renderGrid();
  renderStats();
  updateUndoRedoButtons();
  saveCurrentState();
}

function updateUndoRedoButtons() {
  undoBtn.disabled = undoStack.length === 0;
  redoBtn.disabled = redoStack.length === 0;
}

function formatTime(s) {
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function startTimer() {
  if (timerInterval) return;
  state.startTime = Date.now() - state.elapsed * 1000;
  timerInterval = setInterval(() => {
    state.elapsed = Math.floor((Date.now() - state.startTime) / 1000);
    timerEl.textContent = formatTime(state.elapsed);
  }, 500);
}

function stopTimer() {
  if (!timerInterval) return;
  clearInterval(timerInterval);
  timerInterval = null;
}

function renderStats() {
  timerEl.textContent = formatTime(state.elapsed);
  movesEl.textContent = state.moves;
}

function createCellElement(r, c) {
  const el = document.createElement('div');
  el.className = 'cell';
  el.dataset.row = String(r);
  el.dataset.col = String(c);
  el.setAttribute('role', 'gridcell');
  el.tabIndex = 0;

  const value = document.createElement('div');
  value.className = 'value';
  el.appendChild(value);

  const notes = document.createElement('div');
  notes.className = 'notes';
  el.appendChild(notes);

  // Event handlers
  el.addEventListener('click', (e) => {
    selectCell(r, c);
  });

  el.addEventListener('keydown', (e) => {
    if (e.key >= '1' && e.key <= '9') {
      handleNumberInput(Number(e.key));
      e.preventDefault();
    } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
      handleErase();
      e.preventDefault();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      navigateSelection(e.key);
      e.preventDefault();
    }
  });

  return el;
}

function renderGrid() {
  sudokuContainer.innerHTML = '';
  // generate 9x9 cells
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const cellEl = createCellElement(r, c);
      // thicker borders for blocks
      if (c % 3 === 2 && c !== 8) cellEl.style.borderRightWidth = '2px';
      if (r % 3 === 2 && r !== 8) cellEl.style.borderBottomWidth = '2px';
      sudokuContainer.appendChild(cellEl);
    }
  }
  updateGridUI();
}

function updateGridUI() {
  const cells = sudokuContainer.querySelectorAll('.cell');
  cells.forEach(el => {
    const r = Number(el.dataset.row);
    const c = Number(el.dataset.col);
    const val = state.grid[r][c];
    const given = state.givensMask[r][c];

    el.classList.toggle('given', !!given);
    el.classList.toggle('selected', state.selected && state.selected[0] === r && state.selected[1] === c);

    const valueEl = el.querySelector('.value');
    const notesEl = el.querySelector('.notes');
    notesEl.innerHTML = '';
    valueEl.textContent = '';

    if (val !== 0) {
      valueEl.textContent = val;
      // hide notes if value present
      notesEl.style.display = 'none';
    } else {
      notesEl.style.display = 'grid';
      // render notes for this cell
      const set = state.notes[r][c];
      for (let n = 1; n <= 9; n++) {
        const small = document.createElement('div');
        small.textContent = set.has(n) ? String(n) : '';
        notesEl.appendChild(small);
      }
    }
  });

  // highlight conflicts
  highlightConflicts();

  // if selected cell is not focusable (e.g., hidden), ensure focus
  if (state.selected) {
    const selector = `.cell[data-row="${state.selected[0]}"][data-col="${state.selected[1]}"]`;
    const el = sudokuContainer.querySelector(selector);
    if (el) el.focus();
  }
}

function selectCell(r, c) {
  const prevSelected = state.selected;
  state.selected = [r, c];
  renderGrid();
  // start timer if first action
  startTimer();
  // no history push on selection change
}

function navigateSelection(key) {
  if (!state.selected) {
    selectCell(0,0);
    return;
  }
  let [r,c] = state.selected;
  if (key === 'ArrowUp') r = (r + 8) % 9;
  if (key === 'ArrowDown') r = (r + 1) % 9;
  if (key === 'ArrowLeft') c = (c + 8) % 9;
  if (key === 'ArrowRight') c = (c + 1) % 9;
  selectCell(r,c);
}

function getConflicts(grid) {
  const conflicts = new Set();
  // rows
  for (let r = 0; r < 9; r++) {
    const seen = new Map();
    for (let c = 0; c < 9; c++) {
      const v = grid[r][c];
      if (v === 0) continue;
      if (!seen.has(v)) seen.set(v, []);
      seen.get(v).push([r,c]);
    }
    for (const [v, positions] of seen.entries()) {
      if (positions.length > 1) positions.forEach(p => conflicts.add(p.join(',')));
    }
  }
  // cols
  for (let c = 0; c < 9; c++) {
    const seen = new Map();
    for (let r = 0; r < 9; r++) {
      const v = grid[r][c];
      if (v === 0) continue;
      if (!seen.has(v)) seen.set(v, []);
      seen.get(v).push([r,c]);
    }
    for (const [v, positions] of seen.entries()) {
      if (positions.length > 1) positions.forEach(p => conflicts.add(p.join(',')));
    }
  }
  // boxes
  for (let br = 0; br < 3; br++) {
    for (let bc = 0; bc < 3; bc++) {
      const seen = new Map();
      for (let r = br*3; r < br*3+3; r++) {
        for (let c = bc*3; c < bc*3+3; c++) {
          const v = grid[r][c];
          if (v === 0) continue;
          if (!seen.has(v)) seen.set(v, []);
          seen.get(v).push([r,c]);
        }
      }
      for (const [v, positions] of seen.entries()) {
        if (positions.length > 1) positions.forEach(p => conflicts.add(p.join(',')));
      }
    }
  }
  return conflicts;
}

function highlightConflicts() {
  const conflicts = getConflicts(state.grid);
  const cells = sudokuContainer.querySelectorAll('.cell');
  cells.forEach(el => {
    const key = `${el.dataset.row},${el.dataset.col}`;
    el.classList.toggle('error', conflicts.has(key));
  });
}

function handleNumberInput(n) {
  if (!state.selected) return;
  const [r,c] = state.selected;
  if (state.givensMask[r][c]) return; // cannot change givens

  pushHistory();
  if (notesCheckbox.checked) {
    // toggle note
    const set = state.notes[r][c];
    if (set.has(n)) set.delete(n); else set.add(n);
  } else {
    state.grid[r][c] = n;
    // clear notes when value placed
    state.notes[r][c].clear();
    state.moves++;
  }

  updateAfterChange();
}

function handleErase() {
  if (!state.selected) return;
  const [r,c] = state.selected;
  if (state.givensMask[r][c]) return;
  pushHistory();
  state.grid[r][c] = 0;
  state.notes[r][c].clear();
  state.moves++;
  updateAfterChange();
}

function updateAfterChange() {
  renderGrid();
  renderStats();
  saveCurrentState();
  checkCompletion();
}

function checkCompletion() {
  // if any zeros, not complete
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (state.grid[r][c] === 0) return false;
    }
  }
  // validate solution
  const solved = solve(state.grid);
  if (solved) {
    stopTimer();
    statusEl.textContent = `Completed in ${formatTime(state.elapsed)} with ${state.moves} moves.`;
    return true;
  } else {
    statusEl.textContent = 'All cells filled but solution invalid.';
    return false;
  }
}

async function newGame(difficulty = 'medium') {
  statusEl.textContent = 'Generating puzzle...';
  stopTimer();
  // small delay to allow UI update
  await Promise.resolve();
  const { puzzle, solution } = await generatePuzzle(difficulty);
  state.puzzle = puzzle;
  state.solution = solution;
  state.grid = puzzle.map(r => r.slice());
  state.notes = makeEmptyNotes();
  state.givensMask = puzzle.map(r => r.map(v => v !== 0));
  state.selected = null;
  state.elapsed = 0;
  state.moves = 0;
  undoStack = [];
  redoStack = [];
  renderGrid();
  renderStats();
  statusEl.textContent = `New ${difficulty} puzzle generated.`;
  saveCurrentState();
}

function saveCurrentState() {
  const payload = {
    puzzle: state.puzzle,
    solution: state.solution,
    grid: state.grid,
    notes: state.notes.map(row => row.map(s => [...s])),
    givensMask: state.givensMask,
    elapsed: state.elapsed,
    moves: state.moves
  };
  try {
    saveCurrent(payload);
  } catch (e) {
    console.error('Auto-save failed', e);
  }
}

function manualSave() {
  const payload = {
    puzzle: state.puzzle,
    solution: state.solution,
    grid: state.grid,
    notes: state.notes.map(row => row.map(s => [...s])),
    givensMask: state.givensMask,
    elapsed: state.elapsed,
    moves: state.moves
  };
  const key = saveManual(payload);
  if (key) {
    statusEl.textContent = 'Game saved.';
  } else {
    statusEl.textContent = 'Save failed (localStorage).';
  }
}

function manualLoad() {
  const raw = loadCurrent();
  if (!raw) {
    statusEl.textContent = 'No saved game found.';
    return;
  }
  const meta = raw;
  const payload = meta.state;
  if (!payload || !payload.grid) {
    statusEl.textContent = 'Saved data corrupted.';
    return;
  }
  state.puzzle = payload.puzzle;
  state.solution = payload.solution;
  state.grid = payload.grid.map(r => r.slice());
  state.notes = payload.notes.map(row => row.map(arr => new Set(arr)));
  state.givensMask = payload.givensMask;
  state.elapsed = payload.elapsed || 0;
  state.moves = payload.moves || 0;
  renderGrid();
  renderStats();
  statusEl.textContent = 'Loaded saved game.';
  startTimer();
}

function giveHint() {
  if (!state.selected) {
    statusEl.textContent = 'Select a cell for a hint.';
    return;
  }
  const [r,c] = state.selected;
  if (state.givensMask[r][c]) {
    statusEl.textContent = 'Cannot hint a given cell.';
    return;
  }
  if (!state.solution) {
    statusEl.textContent = 'No solution available.';
    return;
  }
  pushHistory();
  state.grid[r][c] = state.solution[r][c];
  state.notes[r][c].clear();
  state.moves++;
  updateAfterChange();
  statusEl.textContent = 'Hint applied.';
}

function wireControls() {
  newGameBtn.addEventListener('click', () => newGame(difficultySelect.value));
  hintBtn.addEventListener('click', () => giveHint());
  saveBtn.addEventListener('click', () => manualSave());
  loadBtn.addEventListener('click', () => manualLoad());
  eraseBtn.addEventListener('click', () => handleErase());
  undoBtn.addEventListener('click', () => undo());
  redoBtn.addEventListener('click', () => redo());

  numButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const n = Number(btn.dataset.num);
      handleNumberInput(n);
    });
  });

  // global keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (!state.selected) return;
    if (e.key >= '1' && e.key <= '9') {
      handleNumberInput(Number(e.key));
      e.preventDefault();
    } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
      handleErase();
      e.preventDefault();
    } else if (e.key === 'n' && (e.metaKey || e.ctrlKey)) {
      // new game shortcut
      newGame(difficultySelect.value);
      e.preventDefault();
    }
  });

  // start a default game if none loaded
  window.addEventListener('beforeunload', () => {
    saveCurrentState();
  });
}

function init() {
  // wire up controls first
  wireControls();

  // try to load a saved current game; if none, start a new one
  const saved = loadCurrent();
  if (saved && saved.state && saved.state.grid) {
    // load saved
    const payload = saved.state;
    state.puzzle = payload.puzzle;
    state.solution = payload.solution;
    state.grid = payload.grid.map(r => r.slice());
    state.notes = payload.notes.map(row => row.map(arr => new Set(arr)));
    state.givensMask = payload.givensMask;
    state.elapsed = payload.elapsed || 0;
    state.moves = payload.moves || 0;
    renderGrid();
    renderStats();
    statusEl.textContent = 'Loaded previous game.';
    startTimer();
  } else {
    // create new default medium puzzle
    newGame(difficultySelect.value);
  }
  updateUndoRedoButtons();
}

init();
