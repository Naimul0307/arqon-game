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

let gameState = {
  difficulty: "easy",
  operations: ["+"],
  scores: { 1: 0, 2: 0 },
  questions: { 1: null, 2: null },
  answers: { 1: "", 2: "" },
  seconds: 0,
  maxScore: 10,
  finished: false,
};

let gameTimer = null;

function getMaxNumber() {
  if (gameState.difficulty === "easy") return 10;
  if (gameState.difficulty === "medium") return 50;
  return 100;
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function newQuestion(team) {
  const op = gameState.operations[Math.floor(Math.random() * gameState.operations.length)];
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
    const small = gameState.difficulty === "easy" ? 10 : gameState.difficulty === "medium" ? 12 : 20;
    a = rand(1, small);
    b = rand(1, small);
    answer = a * b;
    symbol = "×";
  }

  if (op === "/") {
    const divisorMax = gameState.difficulty === "easy" ? 10 : gameState.difficulty === "medium" ? 12 : 15;
    b = rand(1, divisorMax);
    answer = rand(1, divisorMax);
    a = b * answer;
    symbol = "÷";
  }

  gameState.questions[team] = {
    answer,
    text: `${a} ${symbol} ${b} = ?`,
  };

  gameState.answers[team] = "";
}

function resetGame() {
  gameState.scores = { 1: 0, 2: 0 };
  gameState.questions = { 1: null, 2: null };
  gameState.answers = { 1: "", 2: "" };
  gameState.seconds = 0;
  gameState.finished = false;

  newQuestion(1);
  newQuestion(2);

  clearInterval(gameTimer);

  gameTimer = setInterval(() => {
    if (!gameState.finished) {
      gameState.seconds++;
      io.emit("gameStateUpdated", gameState);
    }
  }, 1000);
}

function submitAnswer(team) {
  const value = Number(gameState.answers[team]);
  const correct = gameState.questions[team].answer;

  if (value === correct) {
    gameState.scores[team]++;
    newQuestion(team);

    io.emit("correctAnswer", team);
    io.emit("pullRope", team);

    if (gameState.scores[team] >= gameState.maxScore) {
      gameState.finished = true;
      clearInterval(gameTimer);

      io.emit("gameFinished", {
        winnerTeam: team,
        winnerName: team === 1 ? teams.team1 : teams.team2,
        score: gameState.scores[team],
        seconds: gameState.seconds,
      });
    }
  } else {
    gameState.answers[team] = "";
    io.emit("wrongAnswer", team);
  }

  io.emit("gameStateUpdated", gameState);
}

function handleKey(team, key) {
  if (gameState.finished) return;

  if (key === "C") {
    gameState.answers[team] = "";
    io.emit("gameStateUpdated", gameState);
    return;
  }

  if (key === "⌫") {
    gameState.answers[team] = gameState.answers[team].slice(0, -1);
    io.emit("gameStateUpdated", gameState);
    return;
  }

  if (key === "OK") {
    submitAnswer(team);
    return;
  }

  if (gameState.answers[team].length < 6) {
    gameState.answers[team] += key;
    io.emit("gameStateUpdated", gameState);
  }
}

io.on("connection", (socket) => {
  socket.emit("teamsUpdated", teams);
  socket.emit("gameStateUpdated", gameState);

  socket.on("updateTeam", ({ team, name }) => {
    teams[team] = name;
    submitted[team] = true;

    io.emit("teamsUpdated", teams);

    if (submitted.team1 && submitted.team2) {
      resetGame();
      io.emit("goToGame");
      io.emit("gameStateUpdated", gameState);
    }
  });

  socket.on("teamKey", ({ team, key }) => {
    handleKey(team, key);
  });

  socket.on("playAgain", () => {
    submitted = {
      team1: false,
      team2: false,
    };

    resetGame();
    io.emit("restartSetup");
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Running at http://${localIP}:${PORT}`);
  console.log(`⚙️ Setup page: http://${localIP}:${PORT}/setup`);
  console.log(`📺 Main teams screen: http://${localIP}:${PORT}/teams`);
  console.log(`🔵 Team 1 device: http://${localIP}:${PORT}/team1`);
  console.log(`🔴 Team 2 device: http://${localIP}:${PORT}/team2`);
  console.log(`🎮 Main game screen: http://${localIP}:${PORT}/game`);
  console.log(`🔵 Team 1 game: http://${localIP}:${PORT}/game1`);
  console.log(`🔴 Team 2 game: http://${localIP}:${PORT}/game2`);
});