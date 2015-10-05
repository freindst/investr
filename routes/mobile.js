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
				GameID: [{ __type: "Pointer", className: "Game", objectId: game_id }],
				currentMoney: 100000
			}).then(function(){
				res.send('success');
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
			transaction.save({
				currentMoney: round2DesimalDigit(transaction.attributes.currentMoney - buy_number * price),
				stocksInHand: ownedStocks
			}).then(function(){
				res.send({ message:"success" });
			});
		}
	})
});

//HTTP POST request: sell stock shares. Parameter: transaction_id, buy_number, stock_symbol
router.post('/sell', function(req, res) {
	var transaction_id = req.body.transaction_id;
	var sell_number = req.body.sell_number;
	var stock_symbol = req.body.stock_symbol;
	var stock = getStock(stock_symbol);
	var price = stock.Ask;
	var query = new Parse.Query("Transaction");
	query.get(transaction_id).then(function(transaction) {
		var ownedStocks = transaction.attributes.stocksInHand;
		var currentMoney = transaction.attributes.currentMoney;
		var isTransactionPass = false;
		for (var i in ownedStocks) {
			if (ownedStocks[i].symbol == stock_symbol) {
				if (parseInt(ownedStocks[i].share) >= parseInt(sell_number)) {
					isTransactionPass = true;
					ownedStocks[i].share = ((parseInt(ownedStocks[i].share)) - parseInt(sell_number)).toString();
				} else {
					res.send({error:"User does not have enough shares to sell."});
				}
			}
		}
		if (isTransactionPass) {
			transaction.save({
				currentMoney: round2DesimalDigit(transaction.attributes.currentMoney + sell_number * price),
				stocksInHand: ownedStocks
			}).then(function() {
				res.send({ message: "success"});
			});
		} else {
			res.send({ error: "operation failed"});
		}
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

module.exports = router;