// Rebuild study of sa-m.fr by Samuel Dumez.
// Original concept and design © Samuel Dumez. Rebuilt for study purposes.

// Layout landscape generato e verificato con tools/generate-landscape.js.
const LAYOUTS = {
  portrait: {
    cols: 16,
    rows: 12,
    words: [
      { number: 1, answer: "ANDREA", direction: "across", col: 10, row: 4 },
      { number: 2, answer: "LANDO", direction: "down", col: 6, row: 4 },
      { number: 3, answer: "ACCIAIO", direction: "across", col: 2, row: 5 },
      { number: 4, answer: "ENGINEERING", direction: "down", col: 11, row: 0 },
      { number: 5, answer: "COMPLAIN", direction: "across", col: 5, row: 8 },
      { number: 6, answer: "SPORT", direction: "down", col: 8, row: 7 },
      { number: 7, answer: "ITALY", direction: "down", col: 15, row: 2 },
      { number: 8, answer: "LMINDUSTRY", direction: "across", col: 0, row: 10 },
    ],
  },
  landscape: {
    cols: 15,
    rows: 7,
    words: [
      { number: 1, answer: "ANDREA", direction: "across", col: 9, row: 4 },
      { number: 2, answer: "LANDO", direction: "down", col: 5, row: 0 },
      { number: 3, answer: "ACCIAIO", direction: "down", col: 14, row: 0 },
      { number: 4, answer: "ENGINEERING", direction: "across", col: 1, row: 2 },
      { number: 5, answer: "COMPLAIN", direction: "across", col: 1, row: 0 },
      { number: 6, answer: "SPORT", direction: "across", col: 3, row: 4 },
      { number: 7, answer: "ITALY", direction: "down", col: 9, row: 2 },
      { number: 8, answer: "LMINDUSTRY", direction: "across", col: 0, row: 6 },
    ],
  },
};

const PORTRAIT_BREAKPOINT = window.matchMedia("(max-width: 820px)");

const grid = document.getElementById("grid");
const keyboardInput = document.getElementById("keyboard-input");

// Stato della partita corrente (ricostruito a ogni cambio di layout).
let cells = new Map(); // "col,row" -> { element, solution, letter, fixed, words }
let focusedKey = null;
let focusedDirection = "across";
const solvedNumbers = new Set(); // sopravvive al cambio di layout

main();

function main() {
  applyLayout(selectLayout());
  PORTRAIT_BREAKPOINT.addEventListener("change", () => applyLayout(selectLayout()));
  wireInput();
  hideSpinnerAfterLoad();
  if (isDevEnvironment()) runDevValidation();
}

function selectLayout() {
  return PORTRAIT_BREAKPOINT.matches ? LAYOUTS.portrait : LAYOUTS.landscape;
}

function applyLayout(layout) {
  focusedKey = null;
  renderGrid(layout);
  for (const number of solvedNumbers) revealClue(number);
}

function renderGrid(layout) {
  grid.style.setProperty("--cols", layout.cols);
  grid.style.setProperty("--rows", layout.rows);
  grid.innerHTML = "";
  cells = new Map();

  for (const word of layout.words) {
    word.answer.split("").forEach((letter, index) => {
      const cell = obtainCell(wordCell(word, index), letter);
      cell.words.push({ word, index });
      if (index === 0) markAsHintCell(cell, word);
    });
  }
}

function obtainCell({ col, row }, solution) {
  const key = cellKey({ col, row });
  if (cells.has(key)) return cells.get(key);

  const element = document.createElement("div");
  element.className = "square";
  element.dataset.key = key;
  element.style.gridColumn = col + 1;
  element.style.gridRow = row + 1;
  element.appendChild(buildContentSpan());
  grid.appendChild(element);

  const cell = { element, solution, letter: "", fixed: false, words: [] };
  cells.set(key, cell);
  return cell;
}

function buildContentSpan() {
  const content = document.createElement("span");
  content.className = "content";
  return content;
}

// La prima cella di ogni parola mostra il numero e la prima lettera.
function markAsHintCell(cell, word) {
  const mini = document.createElement("span");
  mini.className = "mini";
  mini.textContent = word.number;
  cell.element.appendChild(mini);

  cell.fixed = true;
  setCellLetter(cell, cell.solution);
}

// ---- Input ----

function wireInput() {
  grid.addEventListener("click", handleCellClick);
  keyboardInput.addEventListener("keydown", handleInput);
  keyboardInput.addEventListener("input", handleTextEntry);
  resetKeyboardInput();
}

function handleCellClick(event) {
  const square = event.target.closest(".square");
  if (!square) return;
  focusCell(square.dataset.key);
  keyboardInput.focus({ preventScroll: true });
}

function handleInput(event) {
  if (event.key === "Backspace") {
    event.preventDefault();
    eraseLetter();
  } else if (isArrowKey(event.key)) {
    event.preventDefault();
    moveFocusByArrow(event.key);
  } else if (isSingleLetter(event.key)) {
    event.preventDefault();
    enterLetter(event.key.toUpperCase());
  }
}

// Tastiere mobile: niente keydown affidabile, si osserva il valore dell'input.
// Un carattere sentinella permette di rilevare il Backspace come cancellazione.
function handleTextEntry() {
  const value = keyboardInput.value;
  if (value.length === 0) {
    eraseLetter();
  } else {
    const typed = value[value.length - 1].toUpperCase();
    if (isSingleLetter(typed)) enterLetter(typed);
  }
  resetKeyboardInput();
}

function resetKeyboardInput() {
  keyboardInput.value = " ";
}

function enterLetter(letter) {
  skipFixedCellsForward();
  const cell = focusedCell();
  if (!cell || cell.fixed) return;
  setCellLetter(cell, letter);
  cell.words.forEach(({ word }) => checkWordCompletion(word));
  stepAlongFocusedWord(1);
}

// Le lettere pre-scritte (prima cella di ogni parola) non si modificano:
// digitando, il focus le scavalca e scrive nella prima cella editabile.
function skipFixedCellsForward() {
  let cell = focusedCell();
  while (cell !== null && cell.fixed) {
    const before = focusedKey;
    stepAlongFocusedWord(1);
    if (focusedKey === before) return;
    cell = focusedCell();
  }
}

function eraseLetter() {
  const cell = focusedCell();
  if (!cell) return;
  if (cell.letter !== "" && !cell.fixed) {
    setCellLetter(cell, "");
  } else {
    stepAlongFocusedWord(-1);
    const previous = focusedCell();
    if (previous && !previous.fixed) setCellLetter(previous, "");
  }
}

function setCellLetter(cell, letter) {
  cell.letter = letter;
  cell.element.querySelector(".content").textContent = letter;
}

// ---- Focus ----

function focusCell(key) {
  const cell = cells.get(key);
  if (!cell) return;

  focusedDirection = pickDirection(cell, key);
  if (focusedKey !== null && cells.has(focusedKey)) {
    cells.get(focusedKey).element.classList.remove("focused");
  }
  focusedKey = key;
  cell.element.classList.add("focused");
}

// Un secondo tap sulla stessa cella d'incrocio cambia direzione.
function pickDirection(cell, key) {
  const directions = cell.words.map(({ word }) => word.direction);
  if (key === focusedKey && directions.length > 1) {
    return focusedDirection === "across" ? "down" : "across";
  }
  if (directions.includes(focusedDirection)) return focusedDirection;
  return directions[0];
}

function stepAlongFocusedWord(delta) {
  const cell = focusedCell();
  if (!cell) return;
  const position = cell.words.find(({ word }) => word.direction === focusedDirection)
    || cell.words[0];
  const nextIndex = position.index + delta;
  if (nextIndex < 0 || nextIndex >= position.word.answer.length) return;
  focusCell(cellKey(wordCell(position.word, nextIndex)));
}

function moveFocusByArrow(key) {
  const steps = {
    ArrowLeft: { col: -1, row: 0 },
    ArrowRight: { col: 1, row: 0 },
    ArrowUp: { col: 0, row: -1 },
    ArrowDown: { col: 0, row: 1 },
  };
  const step = steps[key];
  const [col, row] = focusedKey.split(",").map(Number);
  const targetKey = cellKey({ col: col + step.col, row: row + step.row });
  if (cells.has(targetKey)) focusCell(targetKey);
}

function focusedCell() {
  return focusedKey === null ? null : cells.get(focusedKey);
}

function isArrowKey(key) {
  return key === "ArrowLeft" || key === "ArrowRight" || key === "ArrowUp" || key === "ArrowDown";
}

function isSingleLetter(key) {
  return /^[a-zA-Z]$/.test(key);
}

// ---- Validazione delle risposte e reveal ----

function checkWordCompletion(word) {
  if (solvedNumbers.has(word.number)) return;
  const written = word.answer
    .split("")
    .map((_, index) => cells.get(cellKey(wordCell(word, index))).letter)
    .join("");
  if (written === word.answer) {
    solvedNumbers.add(word.number);
    revealClue(word.number);
  }
}

function revealClue(number) {
  document
    .querySelectorAll(`[data-clue="${number}"]`)
    .forEach((clue) => clue.classList.add("reveal"));
}

// ---- Spinner ----

function hideSpinnerAfterLoad() {
  const spinner = document.getElementById("spinner");
  window.addEventListener("load", () => {
    setTimeout(() => spinner.classList.add("hidden"), 400);
  });
}

// ---- Geometria condivisa ----

function wordCell(word, index) {
  return word.direction === "across"
    ? { col: word.col + index, row: word.row }
    : { col: word.col, row: word.row + index };
}

function cellKey({ col, row }) {
  return `${col},${row}`;
}

// ---- Validazione dei layout (solo dev: ?dev oppure localhost) ----

function isDevEnvironment() {
  return location.search.includes("dev")
    || location.hostname === "localhost"
    || location.hostname === "127.0.0.1";
}

function runDevValidation() {
  for (const [name, layout] of Object.entries(LAYOUTS)) {
    const problems = validateLayout(layout);
    if (problems.length > 0) {
      console.error(`Layout ${name} non valido:`, problems);
    } else {
      console.info(`Layout ${name}: OK`);
    }
  }
}

// Stessa logica di tools/generate-landscape.js: lettere coerenti negli
// incroci, ogni parola incrocia, niente adiacenze fuori incrocio, connessa.
function validateLayout(layout) {
  const problems = [];
  const letters = new Map();
  const wordsAt = new Map();

  for (const word of layout.words) {
    word.answer.split("").forEach((letter, index) => {
      const key = cellKey(wordCell(word, index));
      if (letters.has(key) && letters.get(key) !== letter) {
        problems.push(`conflitto di lettere in ${key}`);
      }
      letters.set(key, letter);
      if (!wordsAt.has(key)) wordsAt.set(key, new Set());
      wordsAt.get(key).add(word.number);
    });
  }

  for (const word of layout.words) {
    const crosses = word.answer
      .split("")
      .some((_, index) => wordsAt.get(cellKey(wordCell(word, index))).size > 1);
    if (!crosses) problems.push(`${word.answer} non incrocia nessuna parola`);
  }

  for (const key of wordsAt.keys()) {
    const [col, row] = key.split(",").map(Number);
    for (const neighborKey of [cellKey({ col: col + 1, row }), cellKey({ col, row: row + 1 })]) {
      if (!wordsAt.has(neighborKey)) continue;
      const shared = [...wordsAt.get(key)].some((n) => wordsAt.get(neighborKey).has(n));
      if (!shared) problems.push(`adiacenza non valida tra ${key} e ${neighborKey}`);
    }
  }

  if (!isLayoutConnected(layout, wordsAt)) problems.push("griglia non connessa");
  return problems;
}

function isLayoutConnected(layout, wordsAt) {
  const links = new Map(layout.words.map((w) => [w.number, new Set()]));
  for (const numbers of wordsAt.values()) {
    for (const a of numbers) for (const b of numbers) {
      if (a !== b) links.get(a).add(b);
    }
  }
  const visited = new Set();
  const queue = [layout.words[0].number];
  while (queue.length > 0) {
    const current = queue.pop();
    if (visited.has(current)) continue;
    visited.add(current);
    queue.push(...links.get(current));
  }
  return visited.size === layout.words.length;
}
