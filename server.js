const express = require("express");
const path = require("path");
const os = require("os");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const START_PORT = 3000;

let ioRef = null;

/* =========================
   GET LOCAL WIFI IP
========================= */
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

/* =========================
   STATIC FILES
========================= */
app.use(express.static(path.join(__dirname, "public")));

/* =========================
   ROUTES
========================= */
app.get("/", (req, res) => res.redirect("/setup"));

app.get("/setup", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "templates", "setup.html"))
);

app.get("/teams", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "templates", "teams.html"))
);

app.get("/team1", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "templates", "team1.html"))
);

app.get("/team2", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "templates", "team2.html"))
);

app.get("/game", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "templates", "game.html"))
);

app.get("/game1", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "templates", "game1.html"))
);

app.get("/game2", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "templates", "game2.html"))
);

/* =========================
   ✅ WIFI API (IMPORTANT)
========================= */
app.get("/api/server-info", (req, res) => {
  const port = server.address()?.port || START_PORT;

  res.json({
    ip: localIP,
    port,
    setupUrl: `http://${localIP}:${port}/setup`,
    teamsUrl: `http://${localIP}:${port}/teams`,
    team1Url: `http://${localIP}:${port}/team1`,
    team2Url: `http://${localIP}:${port}/team2`,
    gameUrl: `http://${localIP}:${port}/game`,
  });
});

/* =========================
   GAME STATE
========================= */
let teams = {
  team1: "Team 1",
  team2: "Team 2",
};

let submitted = {
  team1: false,
  team2: false,
};

let gameState = {
  scores: { 1: 0, 2: 0 },
  questions: { 1: null, 2: null },
  answers: { 1: "", 2: "" },
  seconds: 0,
  maxScore: 10,
  finished: false,
  started: false,
};

let gameTimer = null;
let countdownTimer = null;

/* =========================
   GAME LOGIC
========================= */
function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function newQuestion(team) {
  const a = rand(1, 10);
  const b = rand(1, 10);

  gameState.questions[team] = {
    answer: a + b,
    text: `${a} + ${b} = ?`,
  };

  gameState.answers[team] = "";
}

function resetGame() {
  clearInterval(gameTimer);
  clearInterval(countdownTimer);

  gameState = {
    scores: { 1: 0, 2: 0 },
    questions: { 1: null, 2: null },
    answers: { 1: "", 2: "" },
    seconds: 0,
    maxScore: 10,
    finished: false,
    started: false,
  };

  newQuestion(1);
  newQuestion(2);
}

function startCountdown() {
  let count = 3;

  io.emit("countdown", count);

  countdownTimer = setInterval(() => {
    count--;

    if (count > 0) {
      io.emit("countdown", count);
      return;
    }

    if (count === 0) {
      io.emit("countdown", "GO!");
      return;
    }

    clearInterval(countdownTimer);

    gameState.started = true;
    io.emit("gameStarted");
    io.emit("gameStateUpdated", gameState);

    gameTimer = setInterval(() => {
      if (!gameState.finished) {
        gameState.seconds++;
        io.emit("gameStateUpdated", gameState);
      }
    }, 1000);
  }, 1000);
}

function submitAnswer(team) {
  if (!gameState.started || gameState.finished) return;

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
  if (!gameState.started || gameState.finished) return;

  if (key === "C") {
    gameState.answers[team] = "";
  } else if (key === "⌫") {
    gameState.answers[team] = gameState.answers[team].slice(0, -1);
  } else if (key === "OK") {
    submitAnswer(team);
    return;
  } else {
    if (gameState.answers[team].length < 6) {
      gameState.answers[team] += key;
    }
  }

  io.emit("gameStateUpdated", gameState);
}

/* =========================
   SOCKET
========================= */
io.on("connection", (socket) => {
  ioRef = io; // 👈 IMPORTANT

  socket.emit("teamsUpdated", teams);
  socket.emit("gameStateUpdated", gameState);

  socket.on("updateTeam", ({ team, name }) => {
    teams[team] = name;
    submitted[team] = true;

    io.emit("teamsUpdated", teams);

    if (submitted.team1 && submitted.team2) {
      resetGame();
      io.emit("goToGame");

      setTimeout(() => {
        startCountdown();
      }, 800);
    }
  });

  socket.on("teamKey", ({ team, key }) => {
    handleKey(team, key);
  });

  socket.on("playAgain", () => {
    submitted = { team1: false, team2: false };
    resetGame();
    io.emit("restartSetup");
  });
});

/* =========================
   START SERVER
========================= */
function startServer(port) {
  server
    .listen(port, "0.0.0.0")
    .on("listening", () => {
      console.log(`✅ Running at http://${localIP}:${port}`);
      console.log(`📺 Main: http://${localIP}:${port}/teams`);
      console.log(`🔵 Team1: http://${localIP}:${port}/team1`);
      console.log(`🔴 Team2: http://${localIP}:${port}/team2`);
      console.log(`🎮 Game: http://${localIP}:${port}/game`);
    })
    .on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.log(`⚠️ Port ${port} busy, trying ${port + 1}...`);
        startServer(port + 1);
      } else {
        console.error(err);
      }
    });
}

startServer(START_PORT);

module.exports = {
  sendReloadToClients: () => {
    if (ioRef) {
      ioRef.emit("reload-client");
    }
  },
};