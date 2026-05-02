const socket = io();

socket.on("teamsUpdated", (teams) => {
  document.getElementById("team1Display").textContent = teams.team1;
  document.getElementById("team2Display").textContent = teams.team2;
});

socket.on("goToGame", () => {
  window.location.href = "/game";
});