var BAKAZE_TO_STR, TSUPAIS, TSUPAI_TO_IMAGE_NAME, cloneBoard, comparePais, currentActionId, currentKyokuId, currentViewpoint, deleteTehai, dumpBoard, getCurrentKyoku, goBack, goNext, initPlayers, kyokus, loadAction, paiToImageUrl, parsePai, playerInfos, removeRed, renderAction, renderCurrentAction, renderHo, renderPai, renderPais, ripai, sortPais, _base, _base2;

window.console || (window.console = {});

(_base = window.console).log || (_base.log = function() {});

(_base2 = window.console).error || (_base2.error = function() {});

TSUPAIS = [null, "E", "S", "W", "N", "P", "F", "C"];

TSUPAI_TO_IMAGE_NAME = {
  "E": "ji_e",
  "S": "ji_s",
  "W": "ji_w",
  "N": "ji_n",
  "P": "no",
  "F": "ji_h",
  "C": "ji_c"
};

BAKAZE_TO_STR = {
  "E": "東",
  "S": "南",
  "W": "西",
  "N": "北"
};

kyokus = [];

currentKyokuId = 0;

currentActionId = 0;

currentViewpoint = 0;

playerInfos = [{}, {}, {}, {}];

parsePai = function(pai) {
  if (pai.match(/^([1-9])(.)(r)?$/)) {
    return {
      type: RegExp.$2,
      number: parseInt(RegExp.$1),
      red: RegExp.$3 ? true : false
    };
  } else {
    return {
      type: "t",
      number: TSUPAIS.indexOf(pai),
      red: false
    };
  }
};

comparePais = function(lhs, rhs) {
  var lhsRep, parsedLhs, parsedRhs, rhsRep;
  parsedLhs = parsePai(lhs);
  lhsRep = parsedLhs.type + parsedLhs.number + (parsedLhs.red ? "1" : "0");
  parsedRhs = parsePai(rhs);
  rhsRep = parsedRhs.type + parsedRhs.number + (parsedRhs.red ? "1" : "0");
  if (lhsRep < rhsRep) {
    return -1;
  } else if (lhsRep > rhsRep) {
    return 1;
  } else {
    return 0;
  }
};

sortPais = function(pais) {
  return pais.sort(comparePais);
};

paiToImageUrl = function(pai, pose) {
  var ext, name, parsedPai, redSuffix;
  if (pai) {
    if (pai === "?") {
      name = "bk";
      ext = "gif";
    } else {
      parsedPai = parsePai(pai);
      if (parsedPai.type === "t") {
        name = TSUPAI_TO_IMAGE_NAME[pai];
      } else {
        redSuffix = parsedPai.red ? "r" : "";
        name = "" + parsedPai.type + "s" + parsedPai.number + redSuffix;
      }
      ext = parsedPai.red ? "png" : "gif";
    }
    if (pose === void 0) pose = 1;
    return "http://gimite.net/mjai/images/p_" + name + "_" + pose + "." + ext;
  } else {
    return "http://gimite.net/mjai/images/blank.png";
  }
};

cloneBoard = function(board) {
  var bk, bv, newBoard, newPlayer, pk, player, pv, _i, _len;
  newBoard = {};
  for (bk in board) {
    bv = board[bk];
    if (bk === "players") {
      newBoard[bk] = [];
      for (_i = 0, _len = bv.length; _i < _len; _i++) {
        player = bv[_i];
        newPlayer = {};
        for (pk in player) {
          pv = player[pk];
          newPlayer[pk] = pv;
        }
        newBoard[bk].push(newPlayer);
      }
    } else {
      newBoard[bk] = bv;
    }
  }
  return newBoard;
};

initPlayers = function(board) {
  var player, _i, _len, _ref, _results;
  _ref = board.players;
  _results = [];
  for (_i = 0, _len = _ref.length; _i < _len; _i++) {
    player = _ref[_i];
    player.tehais = null;
    player.furos = [];
    player.ho = [];
    player.reach = false;
    _results.push(player.reachHoIndex = null);
  }
  return _results;
};

removeRed = function(pai) {
  if (!pai) return null;
  if (pai.match(/^(.+)r$/)) {
    return RegExp.$1;
  } else {
    return pai;
  }
};

loadAction = function(action) {
  var actorPlayer, board, furos, i, kyoku, pai, prevBoard, targetPlayer, _i, _j, _len, _len2, _ref, _ref2, _ref3;
  if (kyokus.length > 0) {
    kyoku = kyokus[kyokus.length - 1];
    board = cloneBoard(kyoku.actions[kyoku.actions.length - 1].board);
  } else {
    kyoku = null;
    board = null;
  }
  if (board && ("actor" in action)) {
    actorPlayer = board.players[action.actor];
  } else {
    actorPlayer = null;
  }
  if (board && ("target" in action)) {
    targetPlayer = board.players[action.target];
  } else {
    targetPlayer = null;
  }
  switch (action.type) {
    case "start_game":
      for (i = 0; i < 4; i++) {
        playerInfos[i].name = action.names[i];
      }
      break;
    case "end_game":
      null;
      break;
    case "start_kyoku":
      kyoku = {
        actions: [],
        bakaze: action.bakaze,
        kyokuNum: action.kyoku,
        honba: action.honba
      };
      kyokus.push(kyoku);
      prevBoard = board;
      board = {
        players: [{}, {}, {}, {}],
        doraMarkers: [action.dora_marker]
      };
      initPlayers(board);
      for (i = 0; i < 4; i++) {
        board.players[i].tehais = action.tehais[i];
        if (prevBoard) {
          board.players[i].score = prevBoard.players[i].score;
        } else {
          board.players[i].score = 25000;
        }
      }
      break;
    case "end_kyoku":
      null;
      break;
    case "tsumo":
      actorPlayer.tehais = actorPlayer.tehais.concat([action.pai]);
      break;
    case "dahai":
      deleteTehai(actorPlayer, action.pai);
      actorPlayer.ho = actorPlayer.ho.concat([action.pai]);
      break;
    case "reach":
      actorPlayer.reachHoIndex = actorPlayer.ho.length;
      break;
    case "reach_accepted":
      actorPlayer.reach = true;
      break;
    case "chi":
    case "pon":
    case "daiminkan":
      targetPlayer.ho = targetPlayer.ho.slice(0, (targetPlayer.ho.length - 1));
      _ref = action.consumed;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        pai = _ref[_i];
        deleteTehai(actorPlayer, pai);
      }
      actorPlayer.furos = actorPlayer.furos.concat([
        {
          type: action.type,
          taken: action.pai,
          consumed: action.consumed,
          target: action.target
        }
      ]);
      break;
    case "ankan":
      _ref2 = action.consumed;
      for (_j = 0, _len2 = _ref2.length; _j < _len2; _j++) {
        pai = _ref2[_j];
        deleteTehai(actorPlayer, pai);
      }
      actorPlayer.furos = actorPlayer.furos.concat([
        {
          type: action.type,
          consumed: action.consumed
        }
      ]);
      break;
    case "kakan":
      deleteTehai(actorPlayer, action.pai);
      actorPlayer.furos = actorPlayer.furos.concat([]);
      furos = actorPlayer.furos;
      for (i = 0, _ref3 = furos.length; 0 <= _ref3 ? i < _ref3 : i > _ref3; 0 <= _ref3 ? i++ : i--) {
        if (furos[i].type === "pon" && removeRed(furos[i].taken) === removeRed(action.pai)) {
          furos[i] = {
            type: "kakan",
            taken: action.pai,
            consumed: action.consumed,
            target: furos[i].target
          };
        }
      }
      break;
    case "hora":
    case "ryukyoku":
      null;
      break;
    case "dora":
      board.doraMarkers = board.doraMarkers.concat([action.dora_marker]);
      break;
    case "log":
      if (kyoku) kyoku.actions[kyoku.actions.length - 1].log = action.text;
      break;
    default:
      throw "unknown action: " + action.type;
  }
  if (action.scores) {
    for (i = 0; i < 4; i++) {
      board.players[i].score = action.scores[i];
    }
  }
  if (kyoku) {
    for (i = 0; i < 4; i++) {
      if (action.actor !== void 0 && i !== action.actor) ripai(board.players[i]);
    }
    if (action.type !== "log") {
      action.board = board;
      return kyoku.actions.push(action);
    }
  }
};

deleteTehai = function(player, pai) {
  var idx;
  player.tehais = player.tehais.concat([]);
  idx = player.tehais.lastIndexOf(pai);
  if (idx < 0) idx = player.tehais.lastIndexOf("?");
  if (idx < 0) throw "pai not in tehai";
  return player.tehais[idx] = null;
};

ripai = function(player) {
  var pai;
  if (player.tehais) {
    player.tehais = (function() {
      var _i, _len, _ref, _results;
      _ref = player.tehais;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        pai = _ref[_i];
        if (pai) _results.push(pai);
      }
      return _results;
    })();
    return sortPais(player.tehais);
  }
};

dumpBoard = function(board) {
  var consumedStr, furo, hoStr, i, player, tehaisStr, _i, _len, _ref, _results;
  _results = [];
  for (i = 0; i < 4; i++) {
    player = board.players[i];
    if (player.tehais) {
      tehaisStr = player.tehais.join(" ");
      _ref = player.furos;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        furo = _ref[_i];
        consumedStr = furo.consumed.join(" ");
        tehaisStr += " [" + furo.taken + "/" + consumedStr + "]";
      }
      console.log("[" + i + "] tehais: " + tehaisStr);
    }
    if (player.ho) {
      hoStr = player.ho.join(" ");
      _results.push(console.log("[" + i + "] ho: " + hoStr));
    } else {
      _results.push(void 0);
    }
  }
  return _results;
};

renderPai = function(pai, view, pose) {
  if (pose === void 0) pose = 1;
  view.attr("src", paiToImageUrl(pai, pose));
  switch (pose) {
    case 1:
      view.addClass("pai");
      return view.removeClass("laid-pai");
    case 3:
      view.addClass("laid-pai");
      return view.removeClass("pai");
    default:
      throw "unknown pose";
  }
};

renderPais = function(pais, view, poses) {
  var i, _ref, _results;
  pais || (pais = []);
  poses || (poses = []);
  view.resize(pais.length);
  _results = [];
  for (i = 0, _ref = pais.length; 0 <= _ref ? i < _ref : i > _ref; 0 <= _ref ? i++ : i--) {
    _results.push(renderPai(pais[i], view.at(i), poses[i]));
  }
  return _results;
};

renderHo = function(player, offset, pais, view) {
  var i, reachIndex, _ref, _results;
  if (player.reachHoIndex === null) {
    reachIndex = null;
  } else {
    reachIndex = player.reachHoIndex - offset;
  }
  view.resize(pais.length);
  _results = [];
  for (i = 0, _ref = pais.length; 0 <= _ref ? i < _ref : i > _ref; 0 <= _ref ? i++ : i--) {
    _results.push(renderPai(pais[i], view.at(i), i === reachIndex ? 3 : 1));
  }
  return _results;
};

renderAction = function(action) {
  var dir, displayAction, furo, furoView, ho, i, infoView, j, k, kyoku, laidPos, pais, player, poses, v, view, wanpais, _ref, _ref2, _ref3, _ref4;
  displayAction = {};
  for (k in action) {
    v = action[k];
    if (k !== "board" && k !== "log") displayAction[k] = v;
  }
  $("#action-label").text(JSON.stringify(displayAction));
  $("#log-label").text(action.log || "");
  kyoku = getCurrentKyoku();
  for (i = 0; i < 4; i++) {
    player = action.board.players[i];
    view = Dytem.players.at((i - currentViewpoint + 4) % 4);
    infoView = Dytem.playerInfos.at(i);
    infoView.score.text(player.score);
    infoView.viewpoint.text(i === currentViewpoint ? "+" : "");
    if (!player.tehais) {
      renderPais([], view.tehais);
      view.tsumoPai.hide();
    } else if (player.tehais.length % 3 === 2) {
      renderPais(player.tehais.slice(0, (player.tehais.length - 1)), view.tehais);
      view.tsumoPai.show();
      renderPai(player.tehais[player.tehais.length - 1], view.tsumoPai);
    } else {
      renderPais(player.tehais, view.tehais);
      view.tsumoPai.hide();
    }
    ho = player.ho || [];
    renderHo(player, 0, ho.slice(0, 6), view.hoRows.at(0).pais);
    renderHo(player, 6, ho.slice(6, 12), view.hoRows.at(1).pais);
    renderHo(player, 12, ho.slice(12), view.hoRows.at(2).pais);
    view.furos.resize(player.furos.length);
    if (player.furos) {
      j = player.furos.length - 1;
      while (j >= 0) {
        furo = player.furos[j];
        furoView = view.furos.at(player.furos.length - 1 - j);
        if (furo.type === "ankan") {
          pais = ["?"].concat(furo.consumed.slice(0, 2)).concat(["?"]);
          poses = [1, 1, 1, 1];
        } else {
          dir = (4 + furo.target - i) % 4;
          if ((_ref = furo.type) === "daiminkan" || _ref === "kakan") {
            laidPos = [null, 3, 1, 0][dir];
          } else {
            laidPos = [null, 2, 1, 0][dir];
          }
          pais = furo.consumed.concat([]);
          poses = [1, 1, 1];
          [].splice.apply(pais, [laidPos, laidPos - laidPos].concat(_ref2 = [furo.taken])), _ref2;
          [].splice.apply(poses, [laidPos, laidPos - laidPos].concat(_ref3 = [3])), _ref3;
        }
        renderPais(pais, furoView.pais, poses);
        --j;
      }
    }
  }
  wanpais = ["?", "?", "?", "?", "?", "?"];
  for (i = 0, _ref4 = action.board.doraMarkers.length; 0 <= _ref4 ? i < _ref4 : i > _ref4; 0 <= _ref4 ? i++ : i--) {
    wanpais[i + 2] = action.board.doraMarkers[i];
  }
  return renderPais(wanpais, Dytem.wanpais);
};

getCurrentKyoku = function() {
  return kyokus[currentKyokuId];
};

renderCurrentAction = function() {
  return renderAction(getCurrentKyoku().actions[currentActionId]);
};

goNext = function() {
  if (currentActionId === getCurrentKyoku().actions.length - 1) return;
  ++currentActionId;
  $("#action-id-label").val(currentActionId);
  return renderCurrentAction();
};

goBack = function() {
  if (currentActionId === 0) return;
  --currentActionId;
  $("#action-id-label").val(currentActionId);
  return renderCurrentAction();
};

$(function() {
  var action, bakazeStr, honba, i, j, kyokuNum, label, playerInfoView, playerView, _i, _len, _ref;
  $(window).bind("mousewheel", function(e) {
    e.preventDefault();
    if (e.originalEvent.wheelDelta < 0) {
      return goNext();
    } else if (e.originalEvent.wheelDelta > 0) {
      return goBack();
    }
  });
  $("#prev-button").click(goBack);
  $("#next-button").click(goNext);
  $("#go-button").click(function() {
    currentActionId = parseInt($("#action-id-label").val());
    return renderCurrentAction();
  });
  $("#kyokuSelector").change(function() {
    currentKyokuId = parseInt($("#kyokuSelector").val());
    currentActionId = 0;
    return renderCurrentAction();
  });
  $("#viewpoint-button").click(function() {
    currentViewpoint = (currentViewpoint + 1) % 4;
    return renderCurrentAction();
  });
  for (_i = 0, _len = allActions.length; _i < _len; _i++) {
    action = allActions[_i];
    loadAction(action);
  }
  Dytem.init();
  for (i = 0; i < 4; i++) {
    playerView = Dytem.players.append();
    playerView.addClass("player-" + i);
    for (j = 0; j < 3; j++) {
      playerView.hoRows.append();
    }
    playerInfoView = Dytem.playerInfos.append();
    playerInfoView.index.text(i);
    playerInfoView.name.text(playerInfos[i].name);
  }
  for (i = 0, _ref = kyokus.length; 0 <= _ref ? i < _ref : i > _ref; 0 <= _ref ? i++ : i--) {
    bakazeStr = BAKAZE_TO_STR[kyokus[i].bakaze];
    honba = kyokus[i].honba;
    kyokuNum = kyokus[i].kyokuNum;
    label = "" + bakazeStr + kyokuNum + "局 " + honba + "本場";
    $("#kyokuSelector").get(0).options[i] = new Option(label, i);
  }
  console.log("loaded");
  return renderCurrentAction();
});
