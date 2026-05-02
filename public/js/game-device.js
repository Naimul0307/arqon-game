const socket = io();
const team = window.TEAM_NUMBER;

const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "C", "OK"];

const $ = (selector) => document.querySelector(selector);

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
      socket.emit("teamKey", {
        team,
        key,
      });
    });

    $("#keypad").appendChild(button);
  });
}

socket.on("teamsUpdated", (teams) => {
  $("#gameTeam").textContent = team === 1 ? teams.team1 : teams.team2;
});

socket.on("gameStateUpdated", (state) => {
  $("#teamCorrect").textContent = state.scores[team];
  $("#question").textContent = state.questions[team].text;
  $("#display").textContent = state.answers[team] || "0";
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
  document.querySelectorAll("button").forEach((button) => {
    button.disabled = true;
  });

  setTimeout(() => {
    window.location.href = team === 1 ? "/team1" : "/team2";
  }, 5000);
});

socket.on("restartSetup", () => {
  window.location.href = team === 1 ? "/team1" : "/team2";
});

createKeypad();