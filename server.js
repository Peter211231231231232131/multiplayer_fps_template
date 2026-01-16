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

const GameEngine = require('./GameEngine');
const gameEngine = new GameEngine();

io.on('connection', (socket) => {
  console.log('a user connected: ' + socket.id);

  gameEngine.addPlayer(socket.id);

  // Send the current player list to the new player
  socket.emit('currentPlayers', gameEngine.getState());
  socket.emit('mapData', gameEngine.getMap());

  // Notify other players about the new player
  socket.broadcast.emit('newPlayer', {
    playerId: socket.id,
    playerInfo: gameEngine.getState()[socket.id]
  });

  socket.on('disconnect', () => {
    console.log('user disconnected: ' + socket.id);
    gameEngine.removePlayer(socket.id);
    io.emit('disconnect', socket.id);
  });

  socket.on('playerInput', (inputData) => {
    gameEngine.handleInput(socket.id, inputData);
  });
});

// Server Loop
const TICK_RATE = 60;
setInterval(() => {
  gameEngine.update(1 / TICK_RATE);
  io.emit('gameState', gameEngine.getState());
}, 1000 / TICK_RATE);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
