const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const path = require('path');

app.use(express.static('public'));
app.use('/build/', express.static(path.join(__dirname, 'node_modules/three/build')));
app.use('/jsm/', express.static(path.join(__dirname, 'node_modules/three/examples/jsm')));

const players = {};

io.on('connection', (socket) => {
  console.log('a user connected: ' + socket.id);

  players[socket.id] = {
    x: 0,
    y: 1, // Start slightly above ground
    z: 0,
    rotation: 0
  };

  // Send the current player list to the new player
  socket.emit('currentPlayers', players);

  // Notify other players about the new player
  socket.broadcast.emit('newPlayer', {
    playerId: socket.id,
    playerInfo: players[socket.id]
  });

  socket.on('disconnect', () => {
    console.log('user disconnected: ' + socket.id);
    delete players[socket.id];
    io.emit('disconnect', socket.id);
  });

  socket.on('playerMovement', (movementData) => {
    if (players[socket.id]) {
      players[socket.id].x = movementData.x;
      players[socket.id].y = movementData.y;
      players[socket.id].z = movementData.z;
      players[socket.id].rotation = movementData.rotation;

      // Emit the update to all other players
      socket.broadcast.emit('playerMoved', {
        playerId: socket.id,
        playerInfo: players[socket.id]
      });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
