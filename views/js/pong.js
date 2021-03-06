var pongSocket = io('/pong');

var gameProperties = {
  players: [{
    id: '',
    side: '',
  }, {
    id: '',
    side: '',
  }],

  spaces: ['L', 'R'],

  maxPlayers: 2,

  screenWidth: 32,
  screenHeight: 32,
  dashSize: 2,

  paddleLeft_x: 1,
  paddleRight_x: 31,
  paddleLeftAi: true,
  paddleRightAi: true,
  paddleAiVelocity: 14,
  paddleSegmentsMax: 4,
  paddleSegmentHeight: 1,
  paddleSegmentAngle: 15,

  ballVelocity: 35,
  ballStartDelay: 2,
  ballRandomStartingAngleLeft: [-120, 120],
  ballRandomStartingAngleRight: [-60, 60],

  scoreToWin: 4,
};

var graphicsAssets = {
  ballURL: 'assets/ball.png',
  ballName: 'ball',

  lPaddleURL: 'assets/lPaddle.png',
  lPaddleName: 'lPaddle',

  rPaddleURL: 'assets/rPaddle.png',
  rPaddleName: 'rPaddle',
};

var fontAssets = {
  scoreLeft_x: gameProperties.screenWidth * 0.25,
  scoreRight_x: gameProperties.screenWidth * 0.75,
  scoreTop_y: 0,

  scoreFontStyle: {
    font: '8px monospace',
    fill: '#FFFFFF',
    align: 'center'
  },

  winFontStyle: {
    font: '10px monospace',
    fill: '',
    align: 'center'
  },
};

var mainState = function(game) {
  this.backgroundGraphics;

  this.ballSprite;

  this.paddleLeftSprite;
  this.paddleRightSprite;
  this.paddleGroup;

  this.missedSide;

  this.scoreLeft = 0;
  this.scoreRight = 0;

  this.tf_scoreLeft;
  this.tf_scoreRight;
  this.tf_winner = {
    text: '',
  };
  this.tf_winner_wins = {
    text: '',
  };
};

mainState.prototype = {
  preload: function() {
    game.stage.disableVisibilityChange = true;

    game.load.image(graphicsAssets.ballName, graphicsAssets.ballURL);
    game.load.image(graphicsAssets.lPaddleName, graphicsAssets.lPaddleURL);
    game.load.image(graphicsAssets.rPaddleName, graphicsAssets.rPaddleURL);
  },

  create: function() {
    pongSocket.connect();

    this.initGraphics();
    this.initPhysics();
    this.createSocketListeners();
    this.startDemo();
  },

  update: function() {
    this.moveAiPaddles();
    game.physics.arcade.overlap(this.ballSprite, this.paddleGroup, this.collideWithPaddle, null, this);
  },

  shutdown: function() {
    this.deletePlayerFromArray(0);
    this.deletePlayerFromArray(1);
    gameProperties.spaces = ['L', 'R'];
    this.removeSocketListeners();
    pongSocket.close();
  },

  initPhysics: function() {
    game.physics.startSystem(Phaser.Physics.ARCADE);
    game.physics.enable(this.ballSprite);
    this.ballSprite.checkWorldBounds = true;
    this.ballSprite.body.collideWorldBounds = true;
    this.ballSprite.body.immovable = true;
    this.ballSprite.body.bounce.set(1);
    this.ballSprite.events.onOutOfBounds.add(this.ballOutOfBounds, this);

    this.paddleGroup = game.add.group();
    this.paddleGroup.enableBody = true;
    this.paddleGroup.physicsBodyType = Phaser.Physics.ARCADE;

    this.paddleGroup.add(this.paddleLeftSprite);
    this.paddleGroup.add(this.paddleRightSprite);

    this.paddleGroup.setAll('checkWorldBounds', true);
    this.paddleGroup.setAll('body.collideWorldBounds', true);
    this.paddleGroup.setAll('body.immovable', true);
  },

  createSocketListeners: function() {
    pongSocket.on('Lcontrol message', function(data) {
      if (data.id === gameProperties.players[0].id) {
        this.playerMoveLeftPaddle(data.direction);
      }
    }.bind(this));

    pongSocket.on('Rcontrol message', function(data) {
      if (data.id === gameProperties.players[1].id) {
        this.playerMoveRightPaddle(data.direction);
      }
    }.bind(this));

    pongSocket.on('check', function() {
      this.sendAvailableSpaces();
    }.bind(this));

    pongSocket.on('join', function(data) {
      this.addPlayer(data);
    }.bind(this));

    pongSocket.on('disconnect', function(id) {
      this.removePlayer(id);
    }.bind(this));

    pongSocket.on('newGame', function() {
      this.startGame();
    }.bind(this));
  },

  removeSocketListeners: function() {
    pongSocket.removeAllListeners();
  },

  sendAvailableSpaces: function() {
    pongSocket.emit('spaces', gameProperties.spaces);
  },

  addPlayer: function(data) {
    console.log(data.id + ' Connecting');
    if (data.side === 'L') {
      gameProperties.spaces[0] = '';
      if (gameProperties.players[0].side !== 'L') {
        gameProperties.players[0] = data;
        gameProperties.paddleLeftAi = false;
        this.paddleLeftSprite.body.velocity.y = 0;
      } else {}
    } else if (data.side === 'R') {
      gameProperties.spaces[1] = '';
      if (gameProperties.players[1].side !== 'R') {
        gameProperties.players[1] = data;
        gameProperties.paddleRightAi = false;
        this.paddleRightSprite.body.velocity.y = 0;
      } else {}
    }
    this.sendAvailableSpaces();
    this.startGame();
  },

  removePlayer: function(id) {
    console.log(id + ' disconnected');
    var pos = gameProperties.players.map(function(e) {
      return e.id;
    }).indexOf(id);

    if (pos > -1) {
      this.deletePlayerFromArray(pos)
    }
  },

  deletePlayerFromArray: function(pos) {
    this.returnAi(gameProperties.players[pos]);
    gameProperties.spaces[pos] = gameProperties.players[pos].side;
    gameProperties.players[pos] = {
      id: '',
      side: '',
    };
  },

  returnAi: function(player) {
    if (player.side === 'L') {
      gameProperties.paddleLeftAi = true;
    } else if (player.side === 'R') {
      gameProperties.paddleRightAi = true;
    }
  },

  startDemo: function() {
    this.resetBall();
    this.resetScores();
    this.enablePaddles(false);
    this.enableBoundaires(true);
  },

  startGame: function() {
    this.enablePaddles(true);
    this.resetPaddles();
    this.enableBoundaires(false);
    this.resetBall();
    this.resetScores();
  },

  resetBall: function() {
    game.time.events.add(Phaser.Timer.SECOND * gameProperties.ballStartDelay, this.startBall, this);
    this.ballSprite.reset(game.world.centerX, game.rnd.between(0, gameProperties.screenHeight));
    this.ballSprite.visible = false;
  },

  enablePaddles: function(enabled) {
    this.paddleGroup.setAll('visible', enabled);
    this.paddleGroup.setAll('body.enable', enabled);
  },

  enableBoundaires: function(enabled) {
    game.physics.arcade.checkCollision.left = enabled;
    game.physics.arcade.checkCollision.right = enabled;
  },

  moveAiPaddles: function() {
    if (gameProperties.paddleLeftAi) {
      this.aiMoveLeftPaddle();
    }
    if (gameProperties.paddleRightAi) {
      this.aiMoveRightPaddle();
    }
  },

  playerMoveLeftPaddle: function(direction) {
    if (direction === 'up') {
      this.paddleLeftSprite.y--;
    } else if (direction === 'down') {
      this.paddleLeftSprite.y++;
    }
  },

  aiMoveLeftPaddle: function() {
    if (this.ballSprite.visible) {
      if (this.ballSprite.y <= this.paddleLeftSprite.body.y) {
        this.paddleLeftSprite.body.velocity.y = -gameProperties.paddleAiVelocity;
      } else if (this.ballSprite.y >= this.paddleLeftSprite.body.y) {
        this.paddleLeftSprite.body.velocity.y = gameProperties.paddleAiVelocity;
      } else {
        this.paddleLeftSprite.body.velocity.y = 0;
      }
    } else {
      this.paddleLeftSprite.body.velocity.y = 0;
    }
  },

  playerMoveRightPaddle: function(direction) {
    if (direction === 'up') {
      this.paddleRightSprite.y--;
    } else if (direction === 'down') {
      this.paddleRightSprite.y++;
    }
  },

  aiMoveRightPaddle: function() {
    if (this.ballSprite.visible) {
      if (this.ballSprite.y <= this.paddleRightSprite.body.y) {
        this.paddleRightSprite.body.velocity.y = -gameProperties.paddleAiVelocity;
      } else if (this.ballSprite.y >= this.paddleRightSprite.body.y) {
        this.paddleRightSprite.body.velocity.y = gameProperties.paddleAiVelocity;
      } else {
        this.paddleRightSprite.body.velocity.y = 0;
      }
    } else {
      this.paddleRightSprite.body.velocity.y = 0;
    }
  },

  collideWithPaddle: function(ball, paddle) {
    var returnAngle;
    var segmentHit = Math.floor((ball.y - paddle.y) / gameProperties.paddleSegmentHeight);

    if (segmentHit >= gameProperties.paddleSegmentsMax) {
      segmentHit = gameProperties.paddleSegmentsMax - 1;
    } else if (segmentHit <= -gameProperties.paddleSegmentsMax) {
      segmentHit = -(gameProperties.paddleSegmentsMax - 1);
    }

    if (paddle.x < gameProperties.screenWidth * 0.5) {
      returnAngle = segmentHit * gameProperties.paddleSegmentAngle;
      game.physics.arcade.velocityFromAngle(returnAngle, gameProperties.ballVelocity, this.ballSprite.body.velocity);
    } else {
      returnAngle = 180 - (segmentHit * gameProperties.paddleSegmentAngle);
      if (returnAngle > 180) {
        returnAngle -= 360;
      }

      game.physics.arcade.velocityFromAngle(returnAngle, gameProperties.ballVelocity, this.ballSprite.body.velocity);
    }
  },

  ballOutOfBounds: function() {
    if (this.ballSprite.x < 0) {
      this.missedSide = 'left';
      this.scoreRight++;
    } else if (this.ballSprite.x > gameProperties.screenWidth) {
      this.missedSide = 'right';
      this.scoreLeft++;
    }
    this.updateScoreTextFields();
    this.broadcastScore();
    this.checkForWinner();
  },

  checkForWinner: function() {
    if (this.scoreLeft >= gameProperties.scoreToWin) {
      fontAssets.winFontStyle.fill = '#FF0000';
      this.displayWinner("Red");
      game.time.events.add(Phaser.Timer.SECOND * 7, this.startDemo, this);
    } else if (this.scoreRight >= gameProperties.scoreToWin) {
      fontAssets.winFontStyle.fill = '#00FF00';
      this.displayWinner("Green");
      game.time.events.add(Phaser.Timer.SECOND * 7, this.startDemo, this);
    } else {
      this.resetBall();
    }
  },

  displayWinner: function(winner) {
    this.tf_winner = game.add.text(game.world.centerX, game.world.centerY, winner, fontAssets.winFontStyle);
    this.tf_winner.anchor.set(0.5, 0);
    this.tf_winner_wins = game.add.text(game.world.centerX, game.world.centerY + 9, 'wins', fontAssets.scoreFontStyle);
    this.tf_winner_wins.anchor.set(0.5, 0);
    this.broadcastGameOver(winner);
  },

  broadcastScore: function() {
    pongSocket.emit('score', {
      score: (this.scoreLeft + ',' + this.scoreRight)
    });
  },

  broadcastGameOver: function(winner) {
    pongSocket.emit('winner', winner);
  },

  resetScores: function() {
    this.scoreLeft = 0;
    this.scoreRight = 0;
    this.updateScoreTextFields();
    this.broadcastScore();
    this.clearWinner();
  },

  clearWinner: function() {
    this.tf_winner.text = '';
    this.tf_winner_wins.text = '';
  },

  resetPaddles: function() {
    this.paddleGroup.setAll('y', game.world.centerY);
  },

  updateScoreTextFields: function() {
    this.tf_scoreLeft.text = this.scoreLeft;
    this.tf_scoreRight.text = this.scoreRight;
  },

  startBall: function() {
    this.ballSprite.visible = true;

    var randomAngle = game.rnd.pick(gameProperties.ballRandomStartingAngleRight.concat(gameProperties.ballRandomStartingAngleLeft));

    if (this.missedSide === 'right') {
      randomAngle = game.rnd.pick(gameProperties.ballRandomStartingAngleRight);
    } else if (this.missedSide === 'left') {
      randomAngle = game.rnd.pick(gameProperties.ballRandomStartingAngleLeft);
    }

    game.physics.arcade.velocityFromAngle(randomAngle, gameProperties.ballVelocity, this.ballSprite.body.velocity);
  },

  initGraphics: function() {
    this.backgroundGraphics = game.add.graphics(0, 0);
    this.backgroundGraphics.lineStyle(1, 0xFFFFFF, 1);

    for (var y = 0; y < gameProperties.screenHeight; y += gameProperties.dashSize * 2) {
      this.backgroundGraphics.moveTo(game.world.centerX, y);
      this.backgroundGraphics.lineTo(game.world.centerX, y + gameProperties.dashSize);
    }

    this.ballSprite = game.add.sprite(game.world.centerX, game.world.centerY, graphicsAssets.ballName);
    this.ballSprite.anchor.set(0.5, 0.5);

    this.paddleLeftSprite = game.add.sprite(gameProperties.paddleLeft_x, game.world.centerY, graphicsAssets.lPaddleName);
    this.paddleLeftSprite.anchor.set(0.5, 0.5);

    this.paddleRightSprite = game.add.sprite(gameProperties.paddleRight_x, game.world.centerY, graphicsAssets.rPaddleName);
    this.paddleRightSprite.anchor.set(0.5, 0.5);

    this.tf_scoreLeft = game.add.text(fontAssets.scoreLeft_x, fontAssets.scoreTop_y, '0', fontAssets.scoreFontStyle);
    this.tf_scoreLeft.anchor.set(0.5, 0);

    this.tf_scoreRight = game.add.text(fontAssets.scoreRight_x, fontAssets.scoreTop_y, '0', fontAssets.scoreFontStyle);
    this.tf_scoreRight.anchor.set(0.5, 0);
  },
};

createPongGame = function(gameDiv) {
  game = new Phaser.Game(gameProperties.screenWidth, gameProperties.screenHeight, Phaser.AUTO, gameDiv, null, false, false);
  game.state.add('main', mainState);
  game.state.start('main');
};
