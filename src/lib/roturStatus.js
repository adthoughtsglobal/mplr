import { createSignal, untrack } from "solid-js";
import md5 from "blueimp-md5";

let ws = null;
let connected = false;

const [authenticated, setAuthenticated] = createSignal(false);
let rooms = ["rotur"];
let reconnectTimer = null;

let authKey = localStorage.getItem("rotur_token") || "";
let activityId = "mplr";

function send(data) {
  if (ws && connected) {
    ws.send(JSON.stringify(data));
  }
}

async function gravatarRetro(input, size = 200) {
  return `https://www.gravatar.com/avatar/${md5(input.trim().toLowerCase())}?d=retro&s=${size}`;
}

function connect() {
  if (ws || !authKey) return;

  ws = new WebSocket("wss://api.rotur.dev/status/ws");

  ws.onopen = () => {
    connected = true;

    send({
      cmd: "auth",
      key: authKey
    });
  };

  ws.onmessage = ({ data }) => {
    const msg = JSON.parse(data);

    switch (msg.cmd) {
      case "ready":
        setAuthenticated(true);

        if (rooms.length) {
          send({
            cmd: "join",
            rooms
          });
        }

        break;

      case "error":
        if (msg.message === "activity not found") {
          return;
        }

        console.error(msg.message);
        break;
    }
  };

  ws.onclose = () => {
    connected = false;
    setAuthenticated(false);
    ws = null;

    reconnectTimer = setTimeout(connect, 3000);
  };
}
import { createRoot, createEffect } from "solid-js";
import { store, currentTrack } from "../store/store";

export function initRoturStatus() {
  if (!authKey) return;

  connect();

  createRoot(() => {
    createEffect(() => {
      if (!authenticated()) return;

      const enabled = store.roturPresence;
      const playing = store.playing;
      const track = currentTrack();

      if (!enabled) {
        console.log("disabled");
        clearMusicActivity();
        setPresence("online", "");
        return;
      }

      if (!track) {
        console.log("no track");
        clearMusicActivity();
        return;
      }

      if (!playing) {
        console.log("not playing");
        setPresence("idle", "Paused");
        clearMusicActivity();
        return;
      }

      setMusicActivity({
        title: track.title,
        artist: track.artist,
        album: track.album,
        duration: track.duration,
        currentTime: untrack(() => store.currentTime)
      });
      setPresence("online", "Listening to music");

    });
  });
}

export function setPresence(presence, status) {
  if (!authenticated()) return;

  const payload = {
    cmd: "set_status"
  };

  if (presence) payload.presence = presence;
  if (status !== undefined) payload.status = status;

  send(payload);
}

export async function setMusicActivity(track) {
  if (!authenticated() || !track) return;

  const now = Date.now();
  const currentTime = Number(track.currentTime);
  const duration = Number(track.duration);

  const start = Math.floor(now - currentTime * 1000);
  const end = Math.floor(start + duration * 1000);
  const img = await gravatarRetro(track.title);

  send({
    cmd: "add_activity",
    id: activityId,
    title: "Listening to music",
    image: img,
    application: {
      name: "MPLR"
    },
    media: {
      title: track.title,
      artist: track.artist,
      album: track.album,
      start,
      end
    }
  });
}
export function clearMusicActivity() {
  if (!authenticated()) return;

  send({
    cmd: "remove_activity",
    id: activityId
  });
}

export function authenticateRotur() {
  if (authKey) {
    connect();
    return Promise.resolve(authKey);
  }

  return new Promise((resolve, reject) => {
    const overlay = document.createElement("div");
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 99999;
    `;

    const iframe = document.createElement("iframe");
    iframe.src = "https://rotur.dev/auth";
    iframe.style.cssText = `
      width: 400px;
      height: 500px;
      border: none;
      border-radius: 8px;
      background: white;
    `;

    overlay.appendChild(iframe);
    document.body.appendChild(overlay);

    function cleanup() {
      window.removeEventListener("message", onMessage);
      overlay.remove();
    }

    function onMessage(event) {
      if (event.origin !== "https://rotur.dev") return;

      if (event.data.type !== "rotur-auth-token") return;

      authKey = event.data.token;
      localStorage.setItem("rotur_token", authKey);

      cleanup();

      connect();

      resolve(authKey);
    }

    window.addEventListener("message", onMessage);
  });
}