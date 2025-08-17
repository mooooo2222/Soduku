/*
  sudoku solver utilities - ES module

  Exports:
  - solve(grid): returns a solved grid (deep copy) or null if unsolvable
  - countSolutions(grid, limit=2): returns number of solutions up to `limit`
  - isValidPlacement(grid, row, col, num): boolean
  Grid format: Array of 9 arrays, each with 9 numbers (0 for empty)
*/

function cloneGrid(grid) {
  return grid.map(row => row.slice());
}

export function isValidPlacement(grid, row, col, num) {
  if (num < 1 || num > 9) return false;
  // Row & column
  for (let i = 0; i < 9; i++) {
    if (grid[row][i] === num) return false;
    if (grid[i][col] === num) return false;
  }
  // 3x3 box
  const br = Math.floor(row / 3) * 3;
  const bc = Math.floor(col / 3) * 3;
  for (let r = br; r < br + 3; r++) {
    for (let c = bc; c < bc + 3; c++) {
      if (grid[r][c] === num) return false;
    }
  }
  return true;
}

function findEmpty(grid) {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] === 0) return [r, c];
    }
  }
  return null;
}

// Classic backtracking solver. Returns true if solved and mutates grid in-place.
function backtrackSolve(grid) {
  const empty = findEmpty(grid);
  if (!empty) return true;
  const [r, c] = empty;
  for (let n = 1; n <= 9; n++) {
    if (isValidPlacement(grid, r, c, n)) {
      grid[r][c] = n;
      if (backtrackSolve(grid)) return true;
      grid[r][c] = 0;
    }
  }
  return false;
}

// Exposed solve: returns a deep-copied solved grid or null
export function solve(grid) {
  const copy = cloneGrid(grid);
  const ok = backtrackSolve(copy);
  return ok ? copy : null;
}

// Count number of solutions up to 'limit' (default 2)
export function countSolutions(grid, limit = 2) {
  let count = 0;
  const g = cloneGrid(grid);

  function backtrackCount() {
    if (count >= limit) return;
    const empty = findEmpty(g);
    if (!empty) {
      count++;
      return;
    }
    const [r, c] = empty;
    for (let n = 1; n <= 9; n++) {
      if (isValidPlacement(g, r, c, n)) {
        g[r][c] = n;
        backtrackCount();
        g[r][c] = 0;
        if (count >= limit) return;
      }
    }
  }

  backtrackCount();
  return count;
}
