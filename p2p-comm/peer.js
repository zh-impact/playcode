import net from "net";
import os from "node:os";
import readline from "node:readline";

import { probeDefaultRoute } from "./route.js";

const myPort = parseInt(process.argv[2], 10) || 5000;
const peers = new Map();

async function getLocalIP() {
  try {
    return await probeDefaultRoute();
  } catch (err) {
    console.log(err);
  }
  // return "10.0.0.111";
  // const interfaces = os.networkInterfaces();
  // for (const name of Object.keys(interfaces)) {
  //   for (const iface of interfaces[name]) {
  //     console.log(iface);
  //     if (iface.family === "IPv4" && !iface.internal) {
  //       return iface.address;
  //     }
  //   }
  // }
  return "127.0.0.1";
}

const server = net.createServer((socket) => {
  const addr = `${socket.remoteAddress}:${socket.remotePort}`;
  console.log(`[+] Node connected: ${addr}`);
  peers.set(socket, { host: socket.remoteAddress, port: socket.remotePort });

  socket.on("data", (data) => {
    console.log(`[${addr}] ${data.toString().trim()}`);
    broadcast(data, socket);
  });

  socket.on("close", () => {
    console.log(`[-] Node disconnected: ${addr}`);
    peers.delete(socket);
  });

  socket.on("error", (err) => {
    console.log(`[!] Error ${addr}: ${err.message}`);
    peers.delete(socket);
  });
});

server.listen(myPort, "0.0.0.0", async () => {
  const localIp = await getLocalIP();
  console.log(`===================================================`);
  console.log(`This node address: ${localIp}:${myPort}`);
  console.log(`Other machine could connect by follow command:`);
  console.log(`  node peer.js <port> ${localIp}:${myPort}`);
  console.log(`===================================================\n`);
});

function connectToPeer(host, port) {
  const socket = net.connect(port, host, () => {
    console.log(`[+] Node connected: ${host}:${port}`);
    peers.set(socket, { host, port });
  });

  socket.on("data", (data) => {
    console.log(`[${host}:${port}] ${data.toString().trim()}`);
    broadcast(data, socket);
  });

  socket.on("close", () => {
    console.log(`[-] Node disconnected: ${host}:${port}`);
    peers.delete(socket);
  });

  socket.on("error", (err) => {
    console.log(`[!] Failed to connect to ${host}:${port}: ${err.message}`);
  });
}

function broadcast(data, exclude) {
  for (const [socket] of peers) {
    if (socket !== exclude && !socket.destroyed) {
      socket.write(data);
    }
  }
}

for (let i = 3; i < process.argv.length; i++) {
  const [host, port] = process.argv[i].split(":");
  if (host & port) {
    connectToPeer(host, parseInt(port, 10));
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
rl.on("line", async (line) => {
  const localIp = await getLocalIP();

  if (line.startsWith("/connect ")) {
    const [host, port] = line.slice(9).split(":");
    connectToPeer(host, parseInt(port, 10));
  } else if (line === "/peers") {
    console.log(
      "Already connected nodes:",
      [...peers.values()].map((p) => `${p.host}:${p.port}`)
    );
  } else {
    const msg = Buffer.from(`[${localIp}] ${line}\n`);
    broadcast(msg, null);
  }
});
