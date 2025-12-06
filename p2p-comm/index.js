import net from "net";

const myPort = parseInt(process.argv[2], 10) || 5000;
const peers = [];

function removePeer(socket) {
  const index = peers.indexOf(socket);
  if (index !== -1) peers.splice(index, 1);
}

const server = net.createServer((socket) => {
  console.log("New connection established");
  socket.setNoDelay(true);
  peers.push(socket);

  socket.on("data", (data) => {
    console.log(`Received data: ${data}`);
    peers.forEach((peer) => {
      if (peer !== socket && !peer.destroyed && peer.writable) {
        try {
          peer.write(data);
        } catch (error) {
          console.error("Write error to peer:", error);
          removePeer(peer);
          try {
            peer.destroy();
          } catch (e) {}
        }
      }
    });
  });

  socket.on("end", () => {
    console.log("Connection ended");
    removePeer(socket);
  });

  socket.on("close", (hadError) => {
    console.log(`Connection closed${hadError ? " due to error" : ""}`);
    removePeer(socket);
    try {
      socket.destroy();
    } catch (e) {}
  });
});

server.on("error", (err) => {
  console.error("Server error:", err);
});

server.listen(myPort, () => {
  console.log(`Server listening on port ${myPort}`);
});

function connectToPeer(port) {
  const socket = net.connect(port, "127.0.0.1", () => {
    console.log(`Connected to peer on port ${port}`);
    socket.setNoDelay(true);
    peers.push(socket);
  });

  socket.on("data", (data) => {
    console.log(`Received data from peer: ${data}`);
  });

  socket.on("end", () => {
    console.log("Peer connection ended");
    removePeer(socket);
  });

  socket.on("close", () => {
    console.log(`Peer connection closed`);
    removePeer(socket);
  });

  socket.on("error", (err) => {
    console.error("Peer socket error:", err && err.code ? err.code : err);
    removePeer(socket);
    try {
      socket.destroy();
    } catch (e) {}
  });
}

process.stdin.on("data", (data) => {
  peers.forEach((p) => {
    if (!p.destroyed && p.writable) {
      try {
        p.write(data);
      } catch (err) {
        console.error("Error writing to peer from stdin:", err);
        removePeer(p);
        try {
          p.destroy();
        } catch (e) {}
      }
    }
  });
});

process.on("SIGINT", () => {
  console.log("Shutting down gracefully...");
  try {
    server.close();
  } catch (_) {}
  peers.forEach((p) => {
    try {
      p.end();
      p.destroy();
    } catch (_) {}
  });
  process.exit();
});

if (process.argv[3]) {
  const peerPort = parseInt(process.argv[3], 10);
  connectToPeer(peerPort);
}
