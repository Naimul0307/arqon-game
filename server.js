const express = require("express");
const path = require("path");
const os = require("os");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;

function getLocalIP() {
  const interfaces = os.networkInterfaces();

  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }

  return "localhost";
}

const localIP = getLocalIP();

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => res.redirect("/setup"));

app.get("/setup", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "templates", "setup.html"));
});

app.get("/teams", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "templates", "teams.html"));
});

app.get("/team1", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "templates", "team1.html"));
});

app.get("/team2", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "templates", "team2.html"));
});

app.get("/game", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "templates", "game.html"));
});

app.get("/game1", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "templates", "game1.html"));
});

app.get("/game2", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "templates", "game2.html"));
});

let teams = {
  team1: "Team 1",
  team2: "Team 2",
};

let submitted = {
  team1: false,
  team2: false,
};

io.on("connection", (socket) => {
  socket.emit("teamsUpdated", teams);

  socket.on("updateTeam", ({ team, name }) => {
    teams[team] = name;
    submitted[team] = true;

    io.emit("teamsUpdated", teams);

    if (submitted.team1 && submitted.team2) {
      io.emit("goToGame");
    }
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Running at http://${localIP}:${PORT}`);
  console.log(`⚙️ Setup page: http://${localIP}:${PORT}/setup`);
  console.log(`📺 Main teams screen: http://${localIP}:${PORT}/teams`);
  console.log(`🔵 Team 1 device: http://${localIP}:${PORT}/team1`);
  console.log(`🔴 Team 2 device: http://${localIP}:${PORT}/team2`);
});