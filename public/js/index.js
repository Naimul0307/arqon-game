const state = {
  step: 1,
  difficulty: "easy",
  operations: ["+"],
  scores: { 1: 0, 2: 0 },
  questions: { 1: null, 2: null },
  answers: { 1: "", 2: "" },
  seconds: 0,
  timer: null,
  maxScore: 10
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

const setupScreen = $("#setupScreen");
const gameScreen = $("#gameScreen");
const modal = $("#winnerModal");

const stepCards = {
  1: $("#step1"),
  2: $("#step2"),
  3: $("#step3")
};

function init() {
  bindSetup();
  createKeypads();
  updateStep();
}

function bindSetup() {
  $$(".op-card").forEach(label => {
    const input = label.querySelector("input");

    label.addEventListener("click", () => {
      setTimeout(() => {
        label.classList.toggle("selected", input.checked);
      });
    });
  });

  $$(".level").forEach(button => {
    button.addEventListener("click", () => {
      $$(".level").forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");
      state.difficulty = button.dataset.level;
    });
  });

  $("#nextBtn").addEventListener("click", () => {
    if (state.step < 3) {
      state.step++;
      updateStep();
    }
  });

  $("#backBtn").addEventListener("click", () => {
    if (state.step > 1) {
      state.step--;
      updateStep();
    }
  });

  $("#startBtn").addEventListener("click", startGame);
  $("#playAgainBtn").addEventListener("click", resetGame);
}

function updateStep() {
  Object.values(stepCards).forEach(card => card.classList.add("hidden"));
  stepCards[state.step].classList.remove("hidden");

  $$(".step").forEach(item => {
    item.classList.toggle("active", Number(item.dataset.step) === state.step);
  });

  $("#backBtn").style.visibility = state.step === 1 ? "hidden" : "visible";
  $("#nextBtn").classList.toggle("hidden", state.step === 3);
  $("#startBtn").classList.toggle("hidden", state.step !== 3);
}

function createKeypads() {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "-", "0", "⌫", "C", "OK"];

  $$(".keypad").forEach(pad => {
    const team = Number(pad.dataset.team);

    keys.forEach(key => {
      const button = document.createElement("button");
      button.textContent = key;

      if (key === "OK") button.classList.add("ok");
      if (key === "C") button.classList.add("clear");

      button.addEventListener("click", () => handleKey(team, key));
      pad.appendChild(button);
    });
  });
}

function startGame() {
  const selectedOps = [...$$(".op-card input:checked")].map(input => input.value);

  if (!selectedOps.length) {
    alert("Select at least one operation");
    return;
  }

  state.operations = selectedOps;
  state.difficulty = $(".level.active").dataset.level;
  state.scores = { 1: 0, 2: 0 };
  state.answers = { 1: "", 2: "" };
  state.seconds = 0;

  const name1 = $("#team1Name").value.trim() || "Team 1";
  const name2 = $("#team2Name").value.trim() || "Team 2";

  $("#gameTeam1").textContent = name1;
  $("#gameTeam2").textContent = name2;
  $("#scoreName1").textContent = name1;
  $("#scoreName2").textContent = name2;

  setupScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");
  modal.classList.add("hidden");

  updateScores();
  updateTimer();
  newQuestion(1);
  newQuestion(2);

  clearInterval(state.timer);
  state.timer = setInterval(() => {
    state.seconds++;
    updateTimer();
  }, 1000);
}

function getMaxNumber() {
  if (state.difficulty === "easy") return 10;
  if (state.difficulty === "medium") return 50;
  return 100;
}

function newQuestion(team) {
  const op = state.operations[Math.floor(Math.random() * state.operations.length)];
  const max = getMaxNumber();

  let a = rand(1, max);
  let b = rand(1, max);
  let answer = 0;
  let symbol = op;

  if (op === "+") answer = a + b;

  if (op === "-") {
    if (a < b) [a, b] = [b, a];
    answer = a - b;
  }

  if (op === "*") {
    const small = state.difficulty === "easy" ? 10 : state.difficulty === "medium" ? 12 : 20;
    a = rand(1, small);
    b = rand(1, small);
    answer = a * b;
    symbol = "×";
  }

  if (op === "/") {
    const divisorMax = state.difficulty === "easy" ? 10 : state.difficulty === "medium" ? 12 : 15;
    b = rand(1, divisorMax);
    answer = rand(1, divisorMax);
    a = b * answer;
    symbol = "÷";
  }

  state.questions[team] = {
    answer,
    text: `${a} ${symbol} ${b} = ?`
  };

  state.answers[team] = "";
  $(`#question${team}`).textContent = state.questions[team].text;
  updateAnswerDisplay(team);
}

function handleKey(team, key) {
  if (key === "C") {
    state.answers[team] = "";
    return updateAnswerDisplay(team);
  }

  if (key === "⌫") {
    state.answers[team] = state.answers[team].slice(0, -1);
    return updateAnswerDisplay(team);
  }

  if (key === "OK") {
    return submitAnswer(team);
  }

  if (key === "-") {
    if (!state.answers[team].includes("-") && state.answers[team].length === 0) {
      state.answers[team] = "-";
    }

    return updateAnswerDisplay(team);
  }

  if (state.answers[team].length < 6) {
    state.answers[team] += key;
    updateAnswerDisplay(team);
  }
}

function updateAnswerDisplay(team) {
  $(`#display${team}`).textContent = state.answers[team] || "0";
}

function submitAnswer(team) {
  const value = Number(state.answers[team]);
  const correct = state.questions[team].answer;
  const panel = team === 1 ? $(".blue-panel") : $(".red-panel");

  if (value === correct) {
    state.scores[team]++;
    updateScores();
    pullRope(team);
    newQuestion(team);

    if (state.scores[team] >= state.maxScore) {
      finishGame(team);
    }
  } else {
    panel.classList.remove("wrong");
    void panel.offsetWidth;
    panel.classList.add("wrong");
    state.answers[team] = "";
    updateAnswerDisplay(team);
  }
}

function updateScores() {
  $("#score1").textContent = state.scores[1];
  $("#score2").textContent = state.scores[2];
  $("#team1Correct").textContent = state.scores[1];
  $("#team2Correct").textContent = state.scores[2];

  const diff = state.scores[1] - state.scores[2];

  // Team 1 pulls left, team 2 pulls right.
  const centerLeft = clamp(50 - diff * 5.8, 16, 84);
  $("#ropeCenter").style.left = `${centerLeft}%`;

  $(".player-left").style.left = `${clamp(12 - diff * 1.8, 4, 24)}%`;
  $(".player-right").style.right = `${clamp(12 + diff * 1.8, 4, 24)}%`;
}

function pullRope(team) {
  const arena = $(".arena");
  arena.classList.remove("pull-left", "pull-right");
  void arena.offsetWidth;
  arena.classList.add(team === 1 ? "pull-left" : "pull-right");
}

function finishGame(team) {
  clearInterval(state.timer);

  const winnerName = team === 1
    ? $("#gameTeam1").textContent
    : $("#gameTeam2").textContent;

  $("#winnerTitle").textContent = `${winnerName} wins!`;
  $("#winnerScore").textContent = state.scores[team];
  $("#winnerTime").textContent = formatTime(state.seconds);

  modal.classList.remove("hidden");
  createConfetti();
}

function resetGame() {
  clearInterval(state.timer);

  state.step = 1;
  setupScreen.classList.remove("hidden");
  gameScreen.classList.add("hidden");
  modal.classList.add("hidden");

  updateStep();
}

function updateTimer() {
  $("#timer").textContent = formatTime(state.seconds);
}

function formatTime(total) {
  const min = String(Math.floor(total / 60)).padStart(2, "0");
  const sec = String(total % 60).padStart(2, "0");
  return `${min}:${sec}`;
}

function createConfetti() {
  const colors = ["#ffd761", "#1878ff", "#ff3150", "#18c37e", "#ffffff"];

  for (let i = 0; i < 42; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDelay = `${Math.random() * .45}s`;
    piece.style.transform = `rotate(${Math.random() * 360}deg)`;
    document.body.appendChild(piece);

    setTimeout(() => piece.remove(), 2200);
  }
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

init();
