const socket = io();
const team = window.TEAM_NUMBER;

const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "C", "OK"];

const $ = (selector) => document.querySelector(selector);

let canAnswer = false;

function setKeypadEnabled(enabled) {
  canAnswer = enabled;

  document.querySelectorAll("#keypad button").forEach((button) => {
    button.disabled = !enabled;
  });

  $("#keypad").classList.toggle("locked", !enabled);
}

function showCountdown(value) {
  $("#countdownOverlay").classList.remove("hidden");
  $("#countdownText").textContent = value;
}

function hideCountdown() {
  $("#countdownOverlay").classList.add("hidden");
}

function flashAnswer(type) {
  const answerBox = document.querySelector(".answer-box");

  answerBox.classList.remove("correct", "wrong");
  void answerBox.offsetWidth;

  answerBox.classList.add(type);

  setTimeout(() => {
    answerBox.classList.remove("correct", "wrong");
  }, 600);
}

function createKeypad() {
  keys.forEach((key) => {
    const button = document.createElement("button");
    button.textContent = key;

    if (key === "OK") button.classList.add("ok");
    if (key === "C") button.classList.add("clear");

    button.addEventListener("click", () => {
      if (!canAnswer) return;

      socket.emit("teamKey", {
        team,
        key,
      });
    });

    $("#keypad").appendChild(button);
  });

  setKeypadEnabled(false);
}

socket.on("teamsUpdated", (teams) => {
  $("#gameTeam").textContent = team === 1 ? teams.team1 : teams.team2;
});

socket.on("gameStateUpdated", (state) => {
  $("#teamCorrect").textContent = state.scores[team];
  $("#question").textContent = state.questions?.[team]?.text || "? + ? = ?";
  $("#display").textContent = state.answers[team] || "0";

  if (!state.started || state.finished) {
    setKeypadEnabled(false);
  }
});

socket.on("countdown", (value) => {
  setKeypadEnabled(false);
  showCountdown(value);
});

socket.on("gameStarted", () => {
  setTimeout(() => {
    hideCountdown();
    setKeypadEnabled(true);
  }, 450);
});

socket.on("correctAnswer", (correctTeam) => {
  if (correctTeam !== team) return;
  flashAnswer("correct");
});

socket.on("wrongAnswer", (wrongTeam) => {
  if (wrongTeam !== team) return;
  flashAnswer("wrong");
});

socket.on("gameFinished", () => {
  setKeypadEnabled(false);

  setTimeout(() => {
    window.location.href = team === 1 ? "/team1" : "/team2";
  }, 5000);
});

socket.on("restartSetup", () => {
  window.location.href = team === 1 ? "/team1" : "/team2";
});

createKeypad();