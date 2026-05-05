const express = require("express");
const path = require("path");
const os = require("os");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
app.use(express.json());
const server = http.createServer(app);
const io = new Server(server);
const fs = require("fs");

const START_PORT = 3000;

const DEFAULT_GAME_SETTINGS = {
  operations: ["+"],
  difficulty: "easy",
};

function getSettingsPath() {
  return path.join(getPublicDir(), "json", "game-settings.json");
}

function readGameSettings() {
  try {
    const filePath = getSettingsPath();

    if (!fs.existsSync(filePath)) {
      writeGameSettings(DEFAULT_GAME_SETTINGS);
      return DEFAULT_GAME_SETTINGS;
    }

    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

    return {
      operations: Array.isArray(data.operations) && data.operations.length
        ? data.operations
        : ["+"],
      difficulty: data.difficulty || "easy",
    };
  } catch {
    return DEFAULT_GAME_SETTINGS;
  }
}

function writeGameSettings(settings) {
  const filePath = getSettingsPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), "utf8");
}

/*
  Same as arena image limit.
  Frontend image moves: diff * 25
  Max movement: 150px
  6 * 25 = 150px
*/
const WIN_PULL = 6;

let ioRef = null;

function getPublicDir() {
  return process.env.PUBLIC_DIR || path.join(__dirname, "public");
}

function getLocalIP() {
  const interfaces = os.networkInterfaces();

  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }

  return "127.0.0.1";
}

const localIP = getLocalIP();

app.use((req, res, next) => {
  express.static(getPublicDir())(req, res, next);
});

app.get("/", (req, res) => res.redirect("/teams"));

app.get("/setup", (req, res) =>
  res.sendFile(path.join(getPublicDir(), "templates", "setup.html"))
);

app.get("/teams", (req, res) =>
  res.sendFile(path.join(getPublicDir(), "templates", "teams.html"))
);

app.get("/team1", (req, res) =>
  res.sendFile(path.join(getPublicDir(), "templates", "team1.html"))
);

app.get("/team2", (req, res) =>
  res.sendFile(path.join(getPublicDir(), "templates", "team2.html"))
);

app.get("/game", (req, res) =>
  res.sendFile(path.join(getPublicDir(), "templates", "game.html"))
);

app.get("/game1", (req, res) =>
  res.sendFile(path.join(getPublicDir(), "templates", "game1.html"))
);

app.get("/game2", (req, res) =>
  res.sendFile(path.join(getPublicDir(), "templates", "game2.html"))
);

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
  winPull: WIN_PULL,
  finished: false,
  started: false,
};

let gameTimer = null;
let countdownTimer = null;

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getNumberRange(difficulty) {
  if (difficulty === "medium") return [5, 30];
  if (difficulty === "hard") return [10, 99];
  return [1, 10];
}

function newQuestion(team) {
  const settings = readGameSettings();
  const [min, max] = getNumberRange(settings.difficulty);

  let operation =
    settings.operations[rand(0, settings.operations.length - 1)];

  const operationMap = {
    add: "+",
    plus: "+",
    subtract: "-",
    minus: "-",
    multiply: "*",
    multiplication: "*",
    divide: "/",
    division: "/",
  };

  operation = operationMap[operation] || operation;

  let a = rand(min, max);
  let b = rand(min, max);
  let answer;
  let symbol = operation;

  if (operation === "+") {
    answer = a + b;
  } else if (operation === "-") {
    if (b > a) {
      const temp = a;
      a = b;
      b = temp;
    }

    answer = a - b;
  } else if (operation === "*") {
    const maxTable = settings.difficulty === "hard" ? 12 : 10;
    a = rand(1, maxTable);
    b = rand(1, maxTable);
    answer = a * b;
    symbol = "×";
  } else if (operation === "/") {
    const maxTable = settings.difficulty === "hard" ? 12 : 10;
    b = rand(1, maxTable);
    answer = rand(1, maxTable);
    a = b * answer;
    symbol = "÷";
  } else {
    answer = a + b;
    symbol = "+";
  }

  gameState.questions[team] = {
    answer,
    text: `${a} ${symbol} ${b} = ?`,
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
    winPull: WIN_PULL,
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

function finishGame(team) {
  gameState.finished = true;
  clearInterval(gameTimer);

  io.emit("gameStateUpdated", gameState);

  io.emit("gameFinished", {
    winnerTeam: team,
    winnerName: team === 1 ? teams.team1 : teams.team2,
    score: gameState.scores[team],
    seconds: gameState.seconds,
  });
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

    const diff = gameState.scores[1] - gameState.scores[2];

    if (diff >= WIN_PULL) {
      finishGame(1);
      return;
    }

    if (diff <= -WIN_PULL) {
      finishGame(2);
      return;
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

app.get("/api/game-settings", (req, res) => {
  res.json({
    success: true,
    settings: readGameSettings(),
  });
});

app.post("/api/game-settings", (req, res) => {
  const settings = {
    operations: Array.isArray(req.body.operations) && req.body.operations.length
      ? req.body.operations
      : ["+"],
    difficulty: req.body.difficulty || "easy",
  };

  writeGameSettings(settings);

  res.json({
    success: true,
    settings,
  });
});

io.on("connection", (socket) => {
  ioRef = io;

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

function start() {
  return new Promise((resolve, reject) => {
    function tryPort(port) {
      server
        .listen(port, "0.0.0.0")
        .once("listening", () => {
          console.log(`✅ Running at http://${localIP}:${port}`);

          resolve({
            port,
            url: `http://127.0.0.1:${port}`,
            localIP,
          });
        })
        .once("error", (err) => {
          if (err.code === "EADDRINUSE") {
            tryPort(port + 1);
          } else {
            reject(err);
          }
        });
    }

    tryPort(START_PORT);
  });
}

module.exports = {
  start,
  sendReloadToClients: () => {
    if (ioRef) {
      ioRef.emit("reload-client");
    }
  },
};