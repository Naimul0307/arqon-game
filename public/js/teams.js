
document.getElementById("startBtn").addEventListener("click", () => {
  const team1 = document.getElementById("team1Name").value.trim() || "Team 1";
  const team2 = document.getElementById("team2Name").value.trim() || "Team 2";

  localStorage.setItem("team1Name", team1);
  localStorage.setItem("team2Name", team2);

  window.location.href = "/game";
});