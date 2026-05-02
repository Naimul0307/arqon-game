const express = require("express");
const path = require("path");

const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.redirect("/setup");
});

app.get("/setup", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "templates", "setup.html"));
});

app.get("/teams", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "templates", "teams.html"));
});

app.get("/game", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "templates", "game.html"));
});

app.listen(PORT, () => {
  console.log(`✅ Running at http://localhost:${PORT}`);
});