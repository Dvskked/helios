'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const CHANNELS_FLAG = '--helios-channels=';
const channelsArg = process.argv.find((arg) => arg.startsWith(CHANNELS_FLAG));
const channels = channelsArg ? JSON.parse(channelsArg.slice(CHANNELS_FLAG.length)) : {};

contextBridge.exposeInMainWorld('helios', {
  channels,

  health: () => ipcRenderer.invoke(channels.HEALTH),

  on: (channel, listener) => {
    if (!Object.values(channels).includes(channel)) return () => {};
    const wrapped = (_event, payload) => listener(payload);
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.removeListener(channel, wrapped);
  },
});
