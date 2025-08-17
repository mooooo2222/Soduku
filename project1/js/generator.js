/*
  generator.js - Sudoku puzzle generator (ES module)

  Exports:
  - generatePuzzle(difficulty): returns { puzzle, solution }
    where puzzle and solution are 9x9 arrays (0 for empty cells)
  Difficulty: 'easy' | 'medium' | 'hard'

  Implementation:
  - generate a complete filled grid using randomized backtracking
  - remove numbers randomly until the target number of givens for the difficulty
    is reached, ensuring uniqueness by checking solver.countSolutions === 1
*/

import { countSolutions, solve } from './solver.js';

function cloneGrid(grid) {
  return grid.map(row => row.slice());
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Generate a fully filled valid Sudoku grid
export function generateCompleteGrid() {
  // Start with empty grid
  const grid = Array.from({ length: 9 }, () => Array(9).fill(0));

  // Helper to find next empty
  function findEmpty() {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (grid[r][c] === 0) return [r, c];
      }
    }
    return null;
  }

  function isValid(gridLocal, row, col, num) {
    for (let i = 0; i < 9; i++) {
      if (gridLocal[row][i] === num) return false;
      if (gridLocal[i][col] === num) return false;
    }
    const br = Math.floor(row / 3) * 3;
    const bc = Math.floor(col / 3) * 3;
    for (let r = br; r < br + 3; r++) {
      for (let c = bc; c < bc + 3; c++) {
        if (gridLocal[r][c] === num) return false;
      }
    }
    return true;
  }

  function backtrack() {
    const empty = findEmpty();
    if (!empty) return true;
    const [r, c] = empty;
    const nums = shuffle([1,2,3,4,5,6,7,8,9].slice());
    for (const n of nums) {
      if (isValid(grid, r, c, n)) {
        grid[r][c] = n;
        if (backtrack()) return true;
        grid[r][c] = 0;
      }
    }
    return false;
  }

  const ok = backtrack();
  if (!ok) throw new Error('Failed to generate complete grid');
  return grid;
}

// Remove numbers from a full grid to produce a puzzle with a unique solution
// Difficulty controls target givens count
function removeNumbersForDifficulty(fullGrid, difficulty) {
  let minGivens, maxGivens;
  switch (difficulty) {
    case 'easy':
      minGivens = 36; maxGivens = 45; break;
    case 'medium':
      minGivens = 28; maxGivens = 35; break;
    case 'hard':
      minGivens = 22; maxGivens = 27; break;
    default:
      minGivens = 28; maxGivens = 35;
  }
  const targetGivens = Math.floor(Math.random() * (maxGivens - minGivens + 1)) + minGivens;
  const puzzle = cloneGrid(fullGrid);
  const positions = [];
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) positions.push([r,c]);
  shuffle(positions);

  let removed = 0;
  const maxAttempts = 10000;
  let attempts = 0;

  // We will attempt removals in randomized order, reverting any removal that causes multiple solutions.
  for (const [r,c] of positions) {
    if (81 - removed <= targetGivens) break; // reached target givens
    attempts++;
    if (attempts > maxAttempts) break;

    const backup = puzzle[r][c];
    puzzle[r][c] = 0;

    // Quick check: ensure still has unique solution
    // Use countSolutions with a small limit (2)
    const sols = countSolutions(puzzle, 2);
    if (sols !== 1) {
      // Revert removal
      puzzle[r][c] = backup;
    } else {
      removed++;
    }
  }

  return puzzle;
}

// Exported function to generate puzzles; returns puzzle and solution
export async function generatePuzzle(difficulty = 'medium') {
  // generate full grid
  let full = generateCompleteGrid();
  // puzzle by removing numbers while ensuring uniqueness
  const puzzle = removeNumbersForDifficulty(full, difficulty);

  // produce solution (solved grid) - should be same as full, but use solver to be safe
  const solution = solve(puzzle) || full;

  return { puzzle, solution };
}
