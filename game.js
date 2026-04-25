// ── Supabase ──────────────────────────────────────────────────
const SUPABASE_URL = 'https://ebxsuoqsmpnszrzvyhhv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_TWlRRylADlwBWgwSC24omQ_r37VwXqa';
const { createClient } = window.supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const GRID_SIZE = 4;
const WIN_TILE  = 2048;


// ── State ─────────────────────────────────────────────────────
let grid             = [];
let score            = 0;
let bestScore        = parseInt(localStorage.getItem('2048-best') || '0');
let continueAfterWin = false;
let tileIdSeq        = 0;

// ── DOM refs ──────────────────────────────────────────────────
const scoreEl         = document.getElementById('score');
const bestScoreEl     = document.getElementById('best-score');
const scoreContainer  = document.getElementById('score-container');
const tileContainer   = document.getElementById('tile-container');
const boardGrid       = document.getElementById('board-grid');
const gameMessage     = document.getElementById('game-message');
const messageText     = document.getElementById('message-text');
const btnNew          = document.getElementById('btn-new');
const btnContinue     = document.getElementById('btn-continue');
const btnRetry        = document.getElementById('btn-retry');
const btnShare         = document.getElementById('btn-share');
const nicknameOverlay  = document.getElementById('nickname-overlay');
const nicknameInput    = document.getElementById('nickname-input');
const nicknameSubmit   = document.getElementById('nickname-submit');
const leaderboardBody  = document.getElementById('leaderboard-body');

// ── Utils ─────────────────────────────────────────────────────
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showToast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}

// ── Nickname ──────────────────────────────────────────────────
function initNickname() {
  const saved = localStorage.getItem('2048-nickname');
  if (saved) {
    nicknameOverlay.classList.add('hidden');
  } else {
    nicknameOverlay.classList.remove('hidden');
    nicknameInput.focus();
  }
}

function saveNickname() {
  const name = nicknameInput.value.trim();
  if (!name) {
    nicknameInput.focus();
    return;
  }
  localStorage.setItem('2048-nickname', name);
  nicknameOverlay.classList.add('hidden');
}

// ── Leaderboard ───────────────────────────────────────────────
async function fetchLeaderboard() {
  try {
    const { data, error } = await db
      .from('leaderboard')
      .select('nickname, best_score')
      .order('best_score', { ascending: false })
      .limit(10);
    if (error) throw error;
    renderLeaderboard(data);
  } catch {
    leaderboardBody.innerHTML =
      '<tr><td colspan="3" class="leaderboard-empty">리더보드를 불러올 수 없습니다</td></tr>';
  }
}

function renderLeaderboard(rows) {
  const myName = localStorage.getItem('2048-nickname');
  if (!rows || !rows.length) {
    leaderboardBody.innerHTML =
      '<tr><td colspan="3" class="leaderboard-empty">아직 기록이 없습니다</td></tr>';
    return;
  }
  leaderboardBody.innerHTML = rows.map((row, i) => `
    <tr class="${row.nickname === myName ? 'leaderboard-me' : ''}">
      <td class="col-rank">${i + 1}</td>
      <td>${escapeHtml(row.nickname)}</td>
      <td class="col-score">${row.best_score.toLocaleString()}</td>
    </tr>
  `).join('');
}

async function submitScore(finalScore) {
  const nickname = localStorage.getItem('2048-nickname');
  if (!nickname || finalScore <= 0) return;
  try {
    const { data: existing } = await db
      .from('leaderboard')
      .select('best_score')
      .eq('nickname', nickname)
      .maybeSingle();
    if (existing && existing.best_score >= finalScore) return;
    await db.from('leaderboard').upsert(
      { nickname, best_score: finalScore, updated_at: new Date().toISOString() },
      { onConflict: 'nickname' }
    );
  } catch (err) {
    console.warn('점수 제출 실패:', err);
  }
}

// ── Service Worker ────────────────────────────────────────────
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(err =>
      console.warn('SW 등록 실패:', err)
    );
  }
}

// ── Init ──────────────────────────────────────────────────────
function init() {
  buildBoardCells();
  bestScoreEl.textContent = bestScore;
  registerServiceWorker();
  initNickname();
  fetchLeaderboard();
  newGame();
  attachInputs();
}

function newGame() {
  grid             = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
  score            = 0;
  continueAfterWin = false;

  updateScore(0);
  hideMessage();
  addRandomTile();
  addRandomTile();
  renderAll();
}

// ── Board scaffold ────────────────────────────────────────────
function buildBoardCells() {
  for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
    const cell = document.createElement('div');
    cell.className = 'grid-cell';
    boardGrid.appendChild(cell);
  }
}

// ── Tile helpers ──────────────────────────────────────────────
function newTile(value) {
  return { value, id: ++tileIdSeq, isNew: true, isMerged: false };
}

function addRandomTile() {
  const empty = [];
  for (let r = 0; r < GRID_SIZE; r++)
    for (let c = 0; c < GRID_SIZE; c++)
      if (!grid[r][c]) empty.push([r, c]);
  if (!empty.length) return;
  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  grid[r][c] = newTile(Math.random() < 0.9 ? 2 : 4);
}

// ── Render ────────────────────────────────────────────────────
const tileElMap = {};

function renderAll() {
  const boardIds = new Set();
  for (let r = 0; r < GRID_SIZE; r++)
    for (let c = 0; c < GRID_SIZE; c++)
      if (grid[r][c]) boardIds.add(grid[r][c].id);

  Object.keys(tileElMap).forEach(id => {
    if (!boardIds.has(Number(id))) {
      tileElMap[id].remove();
      delete tileElMap[id];
    }
  });

  const boardPx = tileContainer.offsetWidth;
  const gapPx   = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gap')) || 15;
  const cellPx  = (boardPx - gapPx * (GRID_SIZE + 1)) / GRID_SIZE;

  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const tile = grid[r][c];
      if (!tile) continue;

      const left = gapPx + c * (cellPx + gapPx);
      const top  = gapPx + r * (cellPx + gapPx);

      let el = tileElMap[tile.id];
      if (!el) {
        el = document.createElement('div');
        el.className = 'tile';
        tileContainer.appendChild(el);
        tileElMap[tile.id] = el;
      }

      el.style.width   = cellPx + 'px';
      el.style.height  = cellPx + 'px';
      el.style.left    = left + 'px';
      el.style.top     = top  + 'px';
      el.textContent = tile.value;
      el.dataset.value = tile.value;

      el.classList.remove('is-new', 'is-merged', 'tile-super');
      if (tile.isNew)       el.classList.add('is-new');
      if (tile.isMerged)    el.classList.add('is-merged');
      if (tile.value > WIN_TILE) el.classList.add('tile-super');

      tile.isNew    = false;
      tile.isMerged = false;
    }
  }
}

// ── Move logic ────────────────────────────────────────────────
function slide(dir) {
  let gained = 0;

  const transpose   = (g) => g[0].map((_, c) => g.map(row => row[c]));
  const reverseRows = (g) => g.map(r => [...r].reverse());

  let g = grid.map(r => [...r]);
  if (dir === 'up'    || dir === 'down')  g = transpose(g);
  if (dir === 'right' || dir === 'down')  g = reverseRows(g);

  g = g.map(row => {
    let cells = row.filter(Boolean);
    for (let i = 0; i < cells.length - 1; i++) {
      if (cells[i].value === cells[i + 1].value) {
        const merged = newTile(cells[i].value * 2);
        merged.isMerged = true;
        gained += merged.value;
        cells[i]     = merged;
        cells[i + 1] = null;
        i++;
      }
    }
    cells = cells.filter(Boolean);
    while (cells.length < GRID_SIZE) cells.push(null);
    return cells;
  });

  if (dir === 'right' || dir === 'down') g = reverseRows(g);
  if (dir === 'up'    || dir === 'down') g = transpose(g);

  let moved = false;
  outer: for (let r = 0; r < GRID_SIZE; r++)
    for (let c = 0; c < GRID_SIZE; c++) {
      const a = grid[r][c], b = g[r][c];
      if ((!a && b) || (a && !b) || (a && b && a.id !== b.id)) {
        moved = true;
        break outer;
      }
    }

  return { newGrid: g, gained, moved };
}

function makeMove(dir) {
  const { newGrid, gained, moved } = slide(dir);
  if (!moved) return;

  grid   = newGrid;
  score += gained;
  updateScore(score, gained);

  renderAll();

  setTimeout(() => {
    addRandomTile();
    renderAll();

    if (!continueAfterWin) {
      for (let r = 0; r < GRID_SIZE; r++)
        for (let c = 0; c < GRID_SIZE; c++)
          if (grid[r][c]?.value === WIN_TILE) {
            showWin();
            return;
          }
    }

    if (!canMove()) showOver();
  }, 130);
}

function canMove() {
  for (let r = 0; r < GRID_SIZE; r++)
    for (let c = 0; c < GRID_SIZE; c++) {
      if (!grid[r][c]) return true;
      if (c < GRID_SIZE - 1 && grid[r][c].value === grid[r][c + 1]?.value) return true;
      if (r < GRID_SIZE - 1 && grid[r][c].value === grid[r + 1]?.[c]?.value) return true;
    }
  return false;
}

// ── Score UI ──────────────────────────────────────────────────
function updateScore(val, gained) {
  scoreEl.textContent = val;
  if (val > bestScore) {
    bestScore = val;
    localStorage.setItem('2048-best', bestScore);
    bestScoreEl.textContent = bestScore;
  }
  if (gained) {
    scoreContainer.classList.remove('bump');
    void scoreContainer.offsetWidth;
    scoreContainer.classList.add('bump');
    showScoreAddition(gained);
  }
}

function showScoreAddition(amount) {
  const el = document.createElement('div');
  el.className = 'score-addition';
  el.textContent = '+' + amount;
  document.querySelector('.scores-container').appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}

// ── Overlays ──────────────────────────────────────────────────
function showWin() {
  messageText.textContent = 'You win!';
  gameMessage.classList.remove('hidden', 'game-over');
  gameMessage.classList.add('game-won');
  btnContinue.classList.remove('hidden');
  submitScore(score).then(() => fetchLeaderboard());
}

function showOver() {
  messageText.textContent = 'Game over!';
  gameMessage.classList.remove('hidden', 'game-won');
  gameMessage.classList.add('game-over');
  btnContinue.classList.add('hidden');
  submitScore(score).then(() => fetchLeaderboard());
}

function hideMessage() {
  gameMessage.classList.add('hidden');
  gameMessage.classList.remove('game-won', 'game-over');
}

// ── Input handling ────────────────────────────────────────────
function attachInputs() {
  const dirMap = {
    ArrowLeft: 'left', ArrowRight: 'right',
    ArrowUp:   'up',   ArrowDown:  'down',
  };

  document.addEventListener('keydown', (e) => {
    const dir = dirMap[e.key];
    if (!dir) return;
    e.preventDefault();
    if (!gameMessage.classList.contains('hidden') && !continueAfterWin) return;
    makeMove(dir);
  });

  let touchStartX, touchStartY;
  const board = document.querySelector('.game-container');

  board.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  board.addEventListener('touchend', (e) => {
    const dx    = e.changedTouches[0].clientX - touchStartX;
    const dy    = e.changedTouches[0].clientY - touchStartY;
    const absDx = Math.abs(dx), absDy = Math.abs(dy);
    if (Math.max(absDx, absDy) < 20) return;

    const dir = absDx > absDy ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    if (!gameMessage.classList.contains('hidden') && !continueAfterWin) return;
    makeMove(dir);
  }, { passive: true });

  btnNew.addEventListener('click', newGame);
  btnContinue.addEventListener('click', () => {
    continueAfterWin = true;
    hideMessage();
  });
  btnRetry.addEventListener('click', newGame);
  nicknameSubmit.addEventListener('click', saveNickname);
  nicknameInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') saveNickname();
  });
  btnShare.addEventListener('click', () => {
    navigator.clipboard.writeText(location.href)
      .then(() => showToast('링크가 복사됐어요! 🎉'))
      .catch(() => showToast('복사 실패 — 주소창에서 직접 복사해주세요'));
  });
}

// ── Start ─────────────────────────────────────────────────────
window.addEventListener('load', init);
window.addEventListener('resize', renderAll);
