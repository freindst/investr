//mobile app api
var express = require('express');
var router = express.Router();

var Parse = require('parse').Parse;
Parse.initialize("FqNt8xkKnxeEdBqV5te9vJAOQQ7dRNsO69Bqno9y", "yrRCAxIDLnAxnKaBltA2YfznMnh6eEY2uuG0QCDl");

var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;

//testing
router.get('/', function(req, res, next){
	res.send('you are using mobile');
})

//retrieverealtime stock quote
router.post('/quote', function(req, res){
	var stock_symbol = req.body.stock_symbol;
	res.send(getStock(stock_symbol));
})

//get version of quote
router.get('/quote/:stock_symbol', function(req, res) {
	var stock_symbol = req.params.stock_symbol;
	res.send(getStock(stock_symbol));
})

//HTTP Request POST join a new game. Parameter: user_id, game_id
router.post('/joinGame', function(req, res) {
	var user_id = req.body.user_id;
	var game_id = req.body.game_id;
	var NewTransaction = Parse.Object.extend("Transaction");
	var newTransaction = new NewTransaction();
	var userQuery = new Parse.Query("User");
	var gameQuery = new Parse.Query('Game');
	userQuery.get(user_id).then(function(user){
		gameQuery.get(game_id).then(function(game){
			if (game.attributes.CurrentPlayers == null) {
				var currentPlayers = new Array();
			} else {
				var currentPlayers = game.attributes.CurrentPlayers;
			}
			currentPlayers.push(user.attributes.username);
			game.save({CurrentPlayers: currentPlayers});
			newTransaction.save({
				gameName: game.attributes.Name,
				userName: user.attributes.username,
				GameID: { __type: "Pointer", className: "Game", objectId: game_id },
				log: [logGenerator("join")],
				stocksInHand: new Array(),
				currentMoney: 100000
			}).then(function(){
				res.send({
					message: 'success'});
			});
		});
	})
})

//buy stock
router.post('/buy', function(req, res) {
	var transaction_id = req.body.transaction_id;
	var buy_number = req.body.buy_number;
	var stock_symbol = req.body.stock_symbol;
	var stock = getStock(stock_symbol);
	var price = stock.Ask;
	var query = new Parse.Query("Transaction");
	query.get(transaction_id).then(function(transaction) {
		if (transaction.attributes.currentMoney < buy_number * price) {
			res.send({ error: "error" });
		} else {
			var ownedStocks = transaction.attributes.stocksInHand;
			var log = transaction.attributes.log;
			console.log(log);
			var isStockExist = false;
			for (var i in ownedStocks) {
				if (ownedStocks[i].symbol == stock_symbol) {
					isStockExist = true;
					ownedStocks[i].share = (parseFloat(ownedStocks[i].share) + parseFloat(buy_number)).toString();
				} 
			}
			if (!isStockExist) {
				ownedStocks.push({
					share: "" + buy_number,
					symbol: stock_symbol
				});
			}
			log.push(logGenerator("buy-" + stock_symbol + "-" + buy_number + "-$" + (buy_number * price)));
			transaction.save({
				currentMoney: round2DesimalDigit(transaction.attributes.currentMoney - buy_number * price),
				stocksInHand: ownedStocks,
				log: log
			}).then(function(){
				res.send({ message:"success" });
			});
		}
	})
});

//HTTP POST request: sell stock shares. Parameter: transaction_id, sell_number, stock_symbol
router.post('/sell', function(req, res) {
	var transaction_id = req.body.transaction_id;
	var sell_number = req.body.sell_number;
	var stock_symbol = req.body.stock_symbol;
	var stock = getStock(stock_symbol);
	var price = stock.Bid;
	var query = new Parse.Query("Transaction");
	query.get(transaction_id).then(function(transaction) {
		var ownedStocks = transaction.attributes.stocksInHand;
		var currentMoney = transaction.attributes.currentMoney;
		var log = transaction.attributes.log;
		var isTransactionPass = false;
		for (var i in ownedStocks) {
			if (ownedStocks[i].symbol == stock_symbol) {
				if (parseInt(ownedStocks[i].share) >= parseInt(sell_number)) {
					isTransactionPass = true;
					ownedStocks[i].share = ((parseInt(ownedStocks[i].share)) - parseInt(sell_number)).toString();
					log.push(logGenerator("sell-" + stock_symbol + "-" + sell_number + "-$" + (sell_number * price)));
				} else {
					res.send({error:"User does not have enough shares to sell."})
				}
			}
		}
		if (isTransactionPass) {
			transaction.save({
				currentMoney: round2DesimalDigit(transaction.attributes.currentMoney + sell_number * price),
				stocksInHand: ownedStocks,
				log: log
			}).then(function() {
				res.send({ message: "success"});
			});
		} else {
			res.send({ error: "operation failed"});
		}
	});
});

//Performing checkout function by selling all stocks in the end of the game.
//checkout all the players in the game
//HTTP POST request: Parameter: transaction_id
//checkout all the players in the game
router.get("/checkoutAll/:game_id", function (req, res) {
	var game_id = req.params.game_id;
	var query = new Parse.Query("Transaction");
	query.equalTo("GameID", { __type: "Pointer", className: "Game", objectId: game_id });
	query.find().then(function(transactions, err){
		if (err) {
			res.send(err);
		} else {
			var rankArray = new Array();
			for (var i in transactions) {
				var ownedStocks = transactions[i].attributes.stocksInHand;
				var currentMoney = transactions[i].attributes.currentMoney;
				var log = transactions[i].attributes.log;
				for (var n in ownedStocks) {
					if (ownedStocks[n].share != "0") {
						var price = getStock(ownedStocks[n].symbol).Bid;
						currentMoney = round2DesimalDigit(currentMoney + parseFloat(ownedStocks[n].share) * price);
						ownedStocks[n].share = "0";
					}
				}
				log.push(logGenerator("checkout-$" + currentMoney));
				rankArray.push({
					username: transactions[i].attributes.userName,
					wallet: currentMoney
				});
				transactions[i].save({
					currentMoney: currentMoney,
					stocksInHand: ownedStocks,
					log: log
				}).then(function(result, err) {
					if (err) {
						res.send(err);
					}
				});
			}
			rankArray.sort(sort_by("wallet", true, parseFloat));
			var gameQuery = new Parse.Query("Game");
			gameQuery.get(game_id).then(function(game, err) {
				if (err) {
					res.send(err);
				} else {
					var finalStandings = new Array();
					for (var i in rankArray) {
						finalStandings.push(rankArray[i].username);
					}
					game.save({
						isFinished: true,
						finalStandings: finalStandings
					});
					res.send({
						result: "success"
					});
				}
			});
		}
	});
});

router.get("/portfolio/:transaction_id", function(req, res) {
	var transaction_id = req.params.transaction_id;
	var query = new Parse.Query("Transaction");
	query.get(transaction_id).then(function(transaction) {
		var ownedStocks = transaction.attributes.stocksInHand;
		var currentMoney = transaction.attributes.currentMoney;
		for (var i in ownedStocks) {
			if (ownedStocks[i].share != "0") {
				var price = getStock(ownedStocks[i].symbol).Bid;
				currentMoney = round2DesimalDigit(currentMoney + parseFloat(ownedStocks[i].share) * price);
			}
		}
		res.send({
			user: transaction.attributes.userName,
			time: new Date(),
			wallet: transaction.attributes.currentMoney,
			portfolio: currentMoney
		});
	});
});

//get stock info from Yahoo! finance api
function getStock(symbol) {
	var url = "https://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20yahoo.finance.quotes%20where%20symbol%20in%20(%22";
	url = url + symbol + "%22)%0A%09%09&format=json&diagnostics=true&env=http%3A%2F%2Fdatatables.org%2Falltables.env&callback=";
	var Httpreq = new XMLHttpRequest();
	Httpreq.open("GET", url, false);
	Httpreq.send(null);
	var stock = JSON.parse(Httpreq.responseText).query.results.quote;
	return stock;
}

//round to two digits after decimal point
function round2DesimalDigit(value) {
	return Math.round(value * 100) / 100;
}

//generate log text for each operation
function logGenerator(operation) {
	var time_stamp = new Date();
	var operation = operation;
	var json_obj = {
		operation: operation,
		time: time_stamp.toString()		
	};
	return json_obj;
}

module.exports = router;