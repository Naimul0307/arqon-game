const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  invoke: (channel, data) => ipcRenderer.invoke(channel, data),
  on: (channel, callback) => {
    ipcRenderer.on(channel, (_, data) => callback(data));
  },
});