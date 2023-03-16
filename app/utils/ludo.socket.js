const { Server } = require("socket.io");
const { v4: uuidv4 } = require('uuid')
const { validate: uuidValidate } = require('uuid')
const jwt = require('jsonwebtoken');
const config = require("../config/auth.config.js");

var io, allRooms
const ROOM_STATUSES = {
    WAITING: 'WAITING',
    READY: 'READY',
    STARTED: 'STARTED',
    GAME_OVER: 'GAME_OVER'
}
const MIN_PLAYERS_PER_ROOM = 2
const MAX_PLAYERS_PER_ROOM = 4
const BOARD_HOUSE_COLORS = ['#c31307', '#00a300', '#ffc400', '#008cf8']

let playersInQueue = []

const init = (server) => {
    io = new Server(server, {
        cors: {
            origins: ['http://localhost:4200']
        }
    });
    authenticate()
    allRooms = io.of("/ludo").adapter.rooms
    onConnection()
}

authenticate = () => {
    io.of('/ludo').use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            if (token) {
                const payload = await jwt.verify(token, config.secret);
                socket.userId = payload.id;
                console.log(`User: ${socket.userId} authenticated`)
                next();
            } else {
                next(new Error('No token'))
            }
        } catch (err) {
            console.log(err)
            next(err);
        }
    });
}

onConnection = () => {
    io.of("/ludo").on('connection', (socket) => {
        console.log(`User: ${socket.userId} connected`)
        onLudoConnect(socket)
        onStartGame(socket)
        OnDiceValue(socket)
        OnUpdateTurn(socket)
        onMovePawn(socket)
        onPlayerWin(socket)
        onGameOver(socket)
        onUpdatePawn(socket)
        onScoreUpdate(socket)
        onDisconnect(socket)
    });
}
onDisconnect = (socket) => {
    socket.on('disconnect', () => {
        if(socket.isMatching) {
            removePlayerFromQueue(socket.userId, socket.matchlimit)
        }
        console.log('a user disconnected!');
    });
}

filterPlayersInQueue = (limit, currentPlayerId) => {
    let players = playersInQueue.filter(p => p.limit === limit && p.id !== currentPlayerId)
    if(players.length === limit - 1) {
        return players
    }
    return []
}

removePlayerFromQueue = (playerId, limit) => {
    const index = playersInQueue.findIndex(p => p.id === playerId && p.limit === limit)
    if(index > -1) {
        playersInQueue.splice(index, 1)
    }
}

let gameStates = []

onLudoConnect = (socket) => {
    socket.on('ludo-connect', (data) => {
        if (data) {
            const limit = data.limit ? data.limit : MIN_PLAYERS_PER_ROOM
            const filteredPlayers = filterPlayersInQueue(limit, socket.userId)
            const currentPlayer = {
                id: socket.userId,
                socketId: socket.id,
                limit: limit
            }
            if(filteredPlayers.length > 0) {
                filteredPlayers.push(currentPlayer)
                removePlayerFromQueue(currentPlayer.id, limit)
                filteredPlayers.sort(function(a, b) {
                    return (a.id - b.id);
                });
                const gameId = uuidv4()
                const roomId = uuidv4()
                const playersData = filteredPlayers.map((p, i) => {
                    removePlayerFromQueue(p.id, limit)
                    const opponentSocket = io.of('/ludo').sockets.get(p.socketId)
                    if(opponentSocket) {
                        opponentSocket.roomId = roomId
                        opponentSocket.gameId = gameId
                        opponentSocket.join(roomId)
                        return {
                            id: p.id,
                            name: p.id,
                            color: BOARD_HOUSE_COLORS[i],
                            pawns: [0, 0, 0, 0],
                            score: 0
                        }
                    }
                })
                const state = {
                    id: gameId,
                    roomId: roomId,
                    status: ROOM_STATUSES.READY,
                    players: playersData
                }
                gameStates.push(state)
                io.of("/ludo").to(roomId).emit('ludo-connect', state);
            } else {
                playersInQueue.push(currentPlayer)
                socket.isMatching = true
                socket.matchlimit = limit
                io.of("/ludo").to(socket.id).emit('ludo-connect', {
                    status: ROOM_STATUSES.WAITING
                });
            }
        }
    });
}

onStartGame = (socket) => {
    socket.on('start-game', () => {
        const state = updateState(socket, {
            action: 'TURN',
            value: '',
            status: ROOM_STATUSES.STARTED
        })
        socket.to(socket.roomId).emit('game-state', state);
    })
}

OnDiceValue = (socket) => {
    socket.on('ludo-dice-value', (value) => {
        const state = updateState(socket, {
            action: 'DICE',
            value: value,
            status: ROOM_STATUSES.STARTED
        })

        socket.to(socket.roomId).emit('game-state', state);
    })
}

OnUpdateTurn = (socket) => {
    socket.on('ludo-turn', (turn) => {
        const state = updateState(socket, {
            action: 'TURN',
            value: turn,
            status: ROOM_STATUSES.STARTED
        })
        io.of("/ludo").to(socket.roomId).emit('game-state', state);
    })
}

updateTurn = (players, currentTurn) => {
    let currentIndex = players.findIndex(p => p.id === currentTurn)
    if (currentIndex === -1) {
        return players[0].id
    }
    for (currentIndex += 1; currentIndex < players.length; ++currentIndex) {
      if (players[currentIndex] !== -1 && players[currentIndex].score < 4) {
        return players[currentIndex].id;
      }
    }
    if(currentIndex === players.length) {
        return players[0].id
    }
}

updateState = (socket, options) => {
    const gameId = socket.gameId
    const index = gameStates.findIndex(g => g.id === gameId)
    if(index > -1) {
        const action = options.action
        const value = options.value
        const status = options.status
        gameStates[index].status = status
        gameStates[index].action = {
            key: action,
            value: value
        }
        let players = gameStates[index].players
        switch(action) {
            case 'TURN': {
                const turn = updateTurn(players, value)
                gameStates[index].turn = turn
                break
            }
            case 'DICE': {
                gameStates[index].diceValue = value
                break
            }
            case 'UPDATE_PAWN': {
                const pawn = value
                const position = pawn.position
                const playerIndex = players.findIndex(p => p.id === pawn.playerId)
                const panwId = parseInt(pawn.id)
                const pawnIndex = panwId - 1
                players[playerIndex].pawns[pawnIndex] = position
                gameStates[index].players = players
                break
            }
            case 'UPDATE_SCORE': {
                const playerIndex = players.findIndex(p => p.id === value.id)
                if(index > -1) {
                    players[playerIndex].score = value.score
                    gameStates[index].players = players
                    gameStates[index].action = null
                }
                break
            }
        }
        return gameStates[index]
    }
}

onMovePawn = (socket) => {
    socket.on('move-pawn', (pawn) => {
        const kill = pawn.kill
        const state = updateState(socket, {
            action: kill ? 'KILL_PAWN' : 'MOVE_PAWN',
            value: pawn,
            status: ROOM_STATUSES.STARTED
        })
        socket.to(socket.roomId).emit('game-state', state);
    })
}

onPlayerWin = (socket) => {
    socket.on('player-won', (id) => {
        const state = updateState(socket, {
            action: 'PLAYER_WON',
            value: id,
            status: ROOM_STATUSES.STARTED
        })
        socket.to(socket.roomId).emit('game-state', state);
    })
}

onGameOver = (socket) => {
    socket.on('game-over', (id) => {
        const state = updateState(socket, {
            action: ROOM_STATUSES.GAME_OVER,
            value: id,
            status: ROOM_STATUSES.GAME_OVER
        })
        io.of("/ludo").to(socket.roomId).emit('game-state', state);
    })
}

onUpdatePawn = (socket) => {
    socket.on('update-pawn', (pawn) => {
        const state = updateState(socket, {
            action: 'UPDATE_PAWN',
            value: pawn,
            status: ROOM_STATUSES.STARTED
        })
        socket.to(socket.roomId).emit('game-state', state);
    }) 
}

onScoreUpdate = (socket) => {
    socket.on('update-score', (player) => {
        const state = updateState(socket, {
            action: 'UPDATE_SCORE',
            value: player,
            status: ROOM_STATUSES.STARTED
        })
        socket.to(socket.roomId).emit('game-state', state);
    }) 
}

updatePawn = (pawn, state) => {
    const position = pawn.position
    const playerIndex = state.players.findIndex(p => p.id === pawn.playerId)
    const panwId = parseInt(pawn.id)
    const pawnIndex = panwId - 1
    state.players[playerIndex].pawns[pawnIndex] = position
    return state
}

module.exports = {
    init
}