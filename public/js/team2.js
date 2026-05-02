const socket = io();

document.getElementById("saveBtn").addEventListener("click", () => {
  const name = document.getElementById("teamName").value.trim() || "Team 2";

  socket.emit("updateTeam", {
    team: "team2",
    name,
  });

  document.getElementById("saveBtn").disabled = true;
  document.getElementById("saveBtn").textContent = "WAITING...";
});

socket.on("goToGame", () => {
  window.location.href = "/game2";
});