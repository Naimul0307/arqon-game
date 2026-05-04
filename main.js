const { app, BrowserWindow, ipcMain, globalShortcut, shell } = require("electron");
const path = require("path");
const fs = require("fs");

const serverControl = require("./server");

app.setAppUserModelId("com.arqon.game");

let mainWindow;
let appServerUrl = "";

const bundledPublicDir = path.join(__dirname, "public");
const editablePublicDir = path.join(app.getPath("userData"), "public");

const cssPath = path.join(editablePublicDir, "css", "base.css");
const fontDir = path.join(editablePublicDir, "font");

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function copyPublicIfMissing() {
  if (!fs.existsSync(editablePublicDir)) {
    fs.cpSync(bundledPublicDir, editablePublicDir, { recursive: true });
  }
}

function readCssVariables() {
  if (!fs.existsSync(cssPath)) return {};

  const css = fs.readFileSync(cssPath, "utf8");
  const rootMatch = css.match(/:root\s*{([\s\S]*?)}/);

  if (!rootMatch) return {};

  const vars = {};
  const regex = /(--[\w-]+)\s*:\s*([^;]+);/g;
  let match;

  while ((match = regex.exec(rootMatch[1])) !== null) {
    vars[match[1]] = match[2].trim();
  }

  return vars;
}

function updateCssVariables(updatedVars) {
  if (!fs.existsSync(cssPath)) return false;

  let css = fs.readFileSync(cssPath, "utf8");

  for (const [name, value] of Object.entries(updatedVars)) {
    const regex = new RegExp(`(${name}\\s*:\\s*)([^;]+)(;)`, "i");

    if (regex.test(css)) {
      css = css.replace(regex, `$1${value}$3`);
    }
  }

  fs.writeFileSync(cssPath, css, "utf8");
  return true;
}

function getFontFormat(fileName) {
  const ext = path.extname(fileName).toLowerCase();

  if (ext === ".ttf") return "truetype";
  if (ext === ".otf") return "opentype";
  if (ext === ".woff") return "woff";
  if (ext === ".woff2") return "woff2";

  return null;
}

function getFontFamilyFromFile(fileName) {
  return path
    .basename(fileName, path.extname(fileName))
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getFontFiles() {
  ensureDir(fontDir);

  return fs
    .readdirSync(fontDir)
    .filter((file) =>
      [".ttf", ".otf", ".woff", ".woff2"].includes(
        path.extname(file).toLowerCase()
      )
    )
    .sort((a, b) =>
      a.localeCompare(b, undefined, {
        numeric: true,
        sensitivity: "base",
      })
    );
}

function buildFontFaceCss() {
  return getFontFiles()
    .map((file) => {
      const family = getFontFamilyFromFile(file);
      const format = getFontFormat(file);

      return `@font-face {
  font-family: '${family}';
  src: url('../font/${file}') format('${format}');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}`;
    })
    .join("\n\n");
}

function syncFontFacesToBaseCss() {
  if (!fs.existsSync(cssPath)) return;

  let css = fs.readFileSync(cssPath, "utf8");

  const startMarker = "/* FONT_FACE_START */";
  const endMarker = "/* FONT_FACE_END */";
  const fontFaceBlock = buildFontFaceCss();

  const replacement = `${startMarker}
${fontFaceBlock}
${endMarker}`;

  const regex = /\/\* FONT_FACE_START \*\/[\s\S]*?\/\* FONT_FACE_END \*\//;

  if (regex.test(css)) {
    css = css.replace(regex, replacement);
  } else {
    css = `${replacement}\n\n${css}`;
  }

  fs.writeFileSync(cssPath, css, "utf8");
}

function getFontsPayload() {
  return getFontFiles().map((file) => ({
    file,
    family: getFontFamilyFromFile(file),
    relativePath: `font/${file}`,
  }));
}

function reloadAllStyles() {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send("reload-styles");
  });
}

function goToSetupPage() {
  if (mainWindow && !mainWindow.isDestroyed() && appServerUrl) {
    mainWindow.loadURL(`${appServerUrl}/setup`);
    mainWindow.focus();
  }
}

function createWindow(serverUrl) {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    autoHideMenuBar: true,
    backgroundColor: "#d8f0ff",
    icon: path.join(editablePublicDir, "background", "favicon.ico"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.loadURL(`${serverUrl}/teams`);
}

app.whenReady().then(async () => {
  copyPublicIfMissing();

  process.env.PUBLIC_DIR = editablePublicDir;

  ensureDir(fontDir);
  syncFontFacesToBaseCss();

  const serverInfo = await serverControl.start();
  appServerUrl = serverInfo.url;

  createWindow(appServerUrl);

  globalShortcut.register("F2", () => {
    goToSetupPage();
  });

  ipcMain.handle("get-css-variables", () => ({
    success: true,
    variables: readCssVariables(),
  }));

  ipcMain.handle("update-css-variables", (event, variables) => {
    const ok = updateCssVariables(variables || {});

    reloadAllStyles();
    serverControl.sendReloadToClients();

    return { success: ok };
  });

  ipcMain.handle("get-fonts", () => ({
    success: true,
    fonts: getFontsPayload(),
  }));

  ipcMain.handle("upload-font-file", (event, file) => {
    try {
      if (!file?.name || !file?.buffer) {
        return {
          success: false,
          message: "No font selected",
        };
      }

      const ext = path.extname(file.name).toLowerCase();

      if (![".ttf", ".otf", ".woff", ".woff2"].includes(ext)) {
        return {
          success: false,
          message: "Only .ttf, .otf, .woff, .woff2 allowed",
        };
      }

      ensureDir(fontDir);

      const safeName = path.basename(file.name);
      const destPath = path.join(fontDir, safeName);

      fs.writeFileSync(destPath, Buffer.from(file.buffer));

      syncFontFacesToBaseCss();
      reloadAllStyles();
      serverControl.sendReloadToClients();

      return {
        success: true,
        fonts: getFontsPayload(),
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || "Font upload failed",
      };
    }
  });

  ipcMain.handle("delete-font-file", (event, fileName) => {
    try {
      const safeName = path.basename(fileName);
      const filePath = path.join(fontDir, safeName);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      syncFontFacesToBaseCss();
      reloadAllStyles();
      serverControl.sendReloadToClients();

      return {
        success: true,
        fonts: getFontsPayload(),
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || "Font delete failed",
      };
    }
  });

  ipcMain.handle("open-public-folder", () => {
    shell.openPath(editablePublicDir);

    return {
      success: true,
      path: editablePublicDir,
    };
  });

  ipcMain.handle("get-public-folder-path", () => ({
    success: true,
    path: editablePublicDir,
  }));
});

app.on("window-all-closed", () => {
  globalShortcut.unregisterAll();

  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0 && appServerUrl) {
    createWindow(appServerUrl);
  }
});