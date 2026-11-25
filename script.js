/* =========================================================
   🧩 BOSHQOTIRMA (PAZL) O'YINI
   ========================================================= */

/* ---------- Konstantalar ---------- */
const STORAGE_KEY = 'puzzle_records_v1';
const SIZE_KEY = 'puzzle_size';
const GAP = 1.6; // kataklar orasidagi masofa (foizda)
const SIZES = [3, 4, 5];

/* ---------- DOM elementlari ---------- */
const boardEl        = document.getElementById('board');
const movesEl        = document.getElementById('moves');
const timerEl        = document.getElementById('timer');
const bestEl         = document.getElementById('best');
const sizeSelect     = document.getElementById('sizeSelect');
const newGameBtn     = document.getElementById('newGameBtn');
const shuffleBtn     = document.getElementById('shuffleBtn');
const recordsList    = document.getElementById('recordsList');
const clearRecordsBtn= document.getElementById('clearRecordsBtn');
const winModal       = document.getElementById('winModal');
const winText        = document.getElementById('winText');
const playAgainBtn   = document.getElementById('playAgainBtn');

/* ---------- O'yin holati ---------- */
let n = 4;              // maydon o'lchami (n × n)
let board = [];         // board[i] = qiymat (0 — bo'sh katak)
let tileEls = [];       // tileEls[qiymat] = DOM elementi
let moves = 0;          // yurishlar soni
let startTime = 0;      // taymer boshlangan vaqt (ms)
let timerId = null;     // setInterval identifikatori
let running = false;    // taymer ishlayaptimi
let solved = false;     // o'yin yakunlanganmi
let finalTime = 0;      // yakuniy vaqt (ms)

/* =========================================================
   1. YORDAMCHI FUNKSIYALAR
   ========================================================= */

function formatTime(ms) {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function isAdjacent(a, b) {
  const ra = Math.floor(a / n), ca = a % n;
  const rb = Math.floor(b / n), cb = b % n;
  return Math.abs(ra - rb) + Math.abs(ca - cb) === 1;
}

function isSolved() {
  const total = n * n;
  for (let i = 0; i < total - 1; i++) {
    if (board[i] !== i + 1) return false;
  }
  return board[total - 1] === 0;
}

/* =========================================================
   2. LOCALSTORAGE — REKORDLAR
   ========================================================= */

function loadRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveRecords(records) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (e) {
    console.warn('Rekordlarni saqlash imkonsiz:', e);
  }
}

function saveRecordIfBest(size, time, moveCount) {
  const records = loadRecords();
  const key = String(size);
  const prev = records[key];

  const isBetter =
    !prev ||
    time < prev.time ||
    (time === prev.time && moveCount < prev.moves);

  if (isBetter) {
    records[key] = {
      time: time,
      moves: moveCount,
      date: new Date().toISOString()
    };
    saveRecords(records);
  }
  return { isNew: !!isBetter };
}

function updateBestDisplay() {
  const records = loadRecords();
  const r = records[String(n)];
  bestEl.textContent = r ? formatTime(r.time) : '—';
}

function renderRecords() {
  const records = loadRecords();
  recordsList.innerHTML = '';

  SIZES.forEach(size => {
    const r = records[String(size)];
    const li = document.createElement('li');

    const sizeSpan = document.createElement('span');
    sizeSpan.className = 'rec-size';
    sizeSpan.textContent = `${size} × ${size}`;
    li.appendChild(sizeSpan);

    if (r) {
      const timeSpan = document.createElement('span');
      timeSpan.className = 'rec-time';
      timeSpan.textContent = formatTime(r.time);
      li.appendChild(timeSpan);

      const movesSpan = document.createElement('span');
      movesSpan.className = 'rec-moves';
      movesSpan.textContent = `${r.moves} yurish`;
      li.appendChild(movesSpan);
    } else {
      const empty = document.createElement('span');
      empty.className = 'rec-empty';
      empty.textContent = '— rekord yo\'q —';
      li.appendChild(empty);
    }

    recordsList.appendChild(li);
  });
}

/* =========================================================
   3. TAYMER
   ========================================================= */

function startTimer() {
  if (running) return;
  running = true;
  startTime = Date.now();
  timerId = setInterval(() => {
    timerEl.textContent = formatTime(Date.now() - startTime);
  }, 200);
}

function stopTimer() {
  if (timerId) clearInterval(timerId);
  timerId = null;
  running = false;
}

function resetTimer() {
  stopTimer();
  startTime = 0;
  finalTime = 0;
  timerEl.textContent = '00:00';
}

/* =========================================================
   4. MAYDONI QURISH VA JOYLASHTIRISH
   ========================================================= */

function buildBoard() {
  boardEl.innerHTML = '';
  board = [];
  tileEls = [];

  const total = n * n;

  // Yechilgan holat: 1, 2, 3, ..., 0 (bo'sh katak oxirida)
  for (let i = 0; i < total; i++) {
    board.push(i === total - 1 ? 0 : i + 1);
  }

  // Katak tugmalarini yaratish
  for (let v = 1; v < total; v++) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'tile';
    el.textContent = v;
    el.addEventListener('click', () => moveTileAt(board.indexOf(v)));
    boardEl.appendChild(el);
    tileEls[v] = el;
  }
}

function placeTile(el, index) {
  const row = Math.floor(index / n);
  const col = index % n;
  const size = (100 - GAP * (n + 1)) / n;

  el.style.width  = size + '%';
  el.style.height = size + '%';
  el.style.left   = (GAP + col * (size + GAP)) + '%';
  el.style.top    = (GAP + row * (size + GAP)) + '%';
}

function layoutAll() {
  const total = n * n;
  for (let v = 1; v < total; v++) {
    const idx = board.indexOf(v);
    placeTile(tileEls[v], idx);
  }
  updateFontSize();
}

function updateFontSize() {
  const w = boardEl.clientWidth;
  if (!w) return;
  const size = (100 - GAP * (n + 1)) / n;
  const tilePx = (w * size) / 100;
  const fs = Math.max(13, tilePx * 0.42);
  boardEl.style.setProperty('--tile-font', fs + 'px');
}

function updateCorrectness() {
  const total = n * n;
  for (let v = 1; v < total; v++) {
    const idx = board.indexOf(v);
    tileEls[v].classList.toggle('correct', idx === v - 1);
  }
}

/* =========================================================
   5. ARALASHTIRISH (yechiladigan holat kafolatlanadi)
   ========================================================= */

function shuffleBoard() {
  const total = n * n;
  let emptyIdx = total - 1;
  let prevEmpty = -1;
  const steps = 300 * n;

  for (let s = 0; s < steps; s++) {
    const r = Math.floor(emptyIdx / n);
    const c = emptyIdx % n;
    const neighbors = [];

    if (r > 0 && emptyIdx - n !== prevEmpty)     neighbors.push(emptyIdx - n);
    if (r < n - 1 && emptyIdx + n !== prevEmpty) neighbors.push(emptyIdx + n);
    if (c > 0 && emptyIdx - 1 !== prevEmpty)     neighbors.push(emptyIdx - 1);
    if (c < n - 1 && emptyIdx + 1 !== prevEmpty) neighbors.push(emptyIdx + 1);

    const pick = neighbors[Math.floor(Math.random() * neighbors.length)];

    board[emptyIdx] = board[pick];
    board[pick] = 0;

    prevEmpty = emptyIdx;
    emptyIdx = pick;
  }

  // Tasodifan yechilgan holat chiqsa — qayta aralashtirish
  if (isSolved()) shuffleBoard();
}

/* =========================================================
   6. O'YIN HARAKATLARI
   ========================================================= */

function moveTileAt(index) {
  if (solved || index < 0) return false;

  const emptyIdx = board.indexOf(0);
  if (!isAdjacent(index, emptyIdx)) return false;

  const value = board[index];

  // Almashtirish
  board[emptyIdx] = value;
  board[index] = 0;

  // Faqat surilgan katakni ko'chirish (CSS transition bilan silliq)
  placeTile(tileEls[value], emptyIdx);

  moves++;
  movesEl.textContent = moves;

  if (!running) startTimer();

  updateCorrectness();
  checkWin();

  return true;
}

function checkWin() {
  if (!isSolved()) return;

  solved = true;
  finalTime = running ? Date.now() - startTime : finalTime;
  stopTimer();
  timerEl.textContent = formatTime(finalTime);

  boardEl.classList.add('win');

  const result = saveRecordIfBest(n, finalTime, moves);

  updateBestDisplay();
  renderRecords();

  let msg = `<strong>${n} × ${n}</strong> o'lchamda ` +
            `<strong>${formatTime(finalTime)}</strong> vaqt va ` +
            `<strong>${moves}</strong> yurish bilan yakunladingiz!`;

  if (result.isNew) {
    msg += '<br><span class="new-record">🏅 Yangi rekord o\'rnatildi!</span>';
  }

  winText.innerHTML = msg;

  setTimeout(() => winModal.classList.add('show'), 450);
}

/* =========================================================
   7. YANGI O'YIN
   ========================================================= */

function startNewGame(size) {
  n = size;
  try { localStorage.setItem(SIZE_KEY, String(size)); } catch (e) {}

  solved = false;
  moves = 0;
  movesEl.textContent = '0';

  resetTimer();
  boardEl.classList.remove('win');
  winModal.classList.remove('show');

  buildBoard();
  shuffleBoard();
  layoutAll();
  updateCorrectness();
  updateBestDisplay();
  renderRecords();
}

/* =========================================================
   8. HODISALAR
   ========================================================= */

newGameBtn.addEventListener('click', () => {
  startNewGame(parseInt(sizeSelect.value, 10));
});

shuffleBtn.addEventListener('click', () => {
  startNewGame(n);
});

sizeSelect.addEventListener('change', () => {
  startNewGame(parseInt(sizeSelect.value, 10));
});

playAgainBtn.addEventListener('click', () => {
  winModal.classList.remove('show');
  startNewGame(n);
});

winModal.addEventListener('click', (e) => {
  if (e.target === winModal) {
    winModal.classList.remove('show');
    boardEl.classList.remove('win');
  }
});

clearRecordsBtn.addEventListener('click', () => {
  if (!confirm('Barcha rekordlarni o\'chirmoqchimisiz?')) return;
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  updateBestDisplay();
  renderRecords();
});

/* Klaviatura boshqaruvi: ↑ ↓ ← → */
document.addEventListener('keydown', (e) => {
  if (solved) return;

  const emptyIdx = board.indexOf(0);
  const row = Math.floor(emptyIdx / n);
  const col = emptyIdx % n;
  let src = -1;

  switch (e.key) {
    case 'ArrowUp':    if (row < n - 1) src = emptyIdx + n; break;
    case 'ArrowDown':  if (row > 0)     src = emptyIdx - n; break;
    case 'ArrowLeft':  if (col < n - 1) src = emptyIdx + 1; break;
    case 'ArrowRight': if (col > 0)     src = emptyIdx - 1; break;
    default: return;
  }

  if (src >= 0) {
    e.preventDefault();
    moveTileAt(src);
  }
});

/* Oyna o'lchami o'zgarganda shriftni yangilash */
window.addEventListener('resize', updateFontSize);

/* =========================================================
   9. ISHGA TUSHIRISH
   ========================================================= */

(function init() {
  let savedSize = NaN;
  try { savedSize = parseInt(localStorage.getItem(SIZE_KEY), 10); } catch (e) {}

  const initialSize = SIZES.includes(savedSize) ? savedSize : 4;
  sizeSelect.value = String(initialSize);

  startNewGame(initialSize);
})();