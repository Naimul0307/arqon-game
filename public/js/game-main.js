const socket = io();
const $ = (selector) => document.querySelector(selector);

function formatTime(total) {
  const min = String(Math.floor(total / 60)).padStart(2, "0");
  const sec = String(total % 60).padStart(2, "0");
  return `${min}:${sec}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

socket.on("teamsUpdated", (teams) => {
  $("#scoreName1").textContent = teams.team1;
  $("#scoreName2").textContent = teams.team2;
});

socket.on("gameStateUpdated", (state) => {
  $("#score1").textContent = state.scores[1];
  $("#score2").textContent = state.scores[2];
  $("#timer").textContent = formatTime(state.seconds);

  const diff = state.scores[1] - state.scores[2];

  $("#ropeCenter").style.left = `${clamp(50 - diff * 5.8, 16, 84)}%`;
  $(".player-left").style.left = `${clamp(12 - diff * 1.8, 4, 24)}%`;
  $(".player-right").style.right = `${clamp(12 + diff * 1.8, 4, 24)}%`;
});

socket.on("pullRope", (team) => {
  const arena = $(".arena");

  arena.classList.remove("pull-left", "pull-right");
  void arena.offsetWidth;

  arena.classList.add(team === 1 ? "pull-left" : "pull-right");
});

socket.on("gameFinished", (data) => {
  $("#winnerTitle").textContent = `${data.winnerName} wins!`;
  $("#winnerScore").textContent = data.score;
  $("#winnerTime").textContent = formatTime(data.seconds);
  $("#winnerModal").classList.remove("hidden");

  setTimeout(() => {
    socket.emit("playAgain");
  }, 5000);
});

$("#playAgainBtn").addEventListener("click", () => {
  socket.emit("playAgain");
});

socket.on("restartSetup", () => {
  window.location.href = "/teams";
});