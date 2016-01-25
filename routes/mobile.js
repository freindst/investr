//mobile app api
var express = require('express');
var router = express.Router();
var rsj = require('rsj');

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

//yahoo finance stock news
router.get('/news/:stock_symbol', function(req, res){
	var stock_symbol = req.params.stock_symbol;
	var query = "http://finance.yahoo.com/rss/headline?s=" + stock_symbol;
	rsj.r2j(query,function(json)
		{
			res.send(json);
		});
})

//yahoo finance historical data
router.post('/historicaldata/', function(req,res) {
	var symbol = req.body.symbol;
	var startdate = req.body.startdate;
	var enddate = req.body.enddate;
	var query = 'https://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20yahoo.finance.historicaldata%20where%20symbol%20%3D%20%22' + symbol + '%22%20and%20startDate%20%3D%20%22' + startdate + '%22%20and%20endDate%20%3D%20%22' + enddate + '%22&format=json&diagnostics=true&env=store%3A%2F%2Fdatatables.org%2Falltableswithkeys&callback=';
	var json_obj = JSON.parse(Get(query));
	var stock = json_obj.query.results.quote;
	res.send(stock);
})

//return historical quote in past one_month, three_months, six_months or one_year
router.post('/historicaldata/timescale', function(req, res) {
	var symbol = req.body.symbol;
	var today = new Date();
	var date = today.getDate();
	var month = today.getMonth() + 1;
	month += '';
	if (month.length == 1)
	{
		month = '0' + month;
	}
	var year = today.getFullYear();
	var enddate = year + '-' + month + '-' + date;
	var time_scale = req.body.time_scale;
	switch (time_scale) {
		case 'one_month':
			var day = 30;
			break;
		case 'three_months':
			var day = 90;
			break;
		case 'six_months':
			var day = 180;
			break;
		case 'one_year':
			var day = 365;
			break;
		default:
			var day = 30;
	};
	var new_day = new Date(today.getTime() - day * 24 * 60 * 60 * 1000);
	var new_date = new_day.getDate();
	var new_month = new_day.getMonth() + 1;
	new_month += '';
	if (new_month.length == 1)
	{
		new_month = '0' + new_month;
	}
	var new_year = new_day.getFullYear();
	var startdate = new_year + '-' + new_month + '-' + new_date;
	console.log(enddate + ' ' + startdate);
	var query = 'https://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20yahoo.finance.historicaldata%20where%20symbol%20%3D%20%22' + symbol + '%22%20and%20startDate%20%3D%20%22' + startdate + '%22%20and%20endDate%20%3D%20%22' + enddate + '%22&format=json&diagnostics=true&env=store%3A%2F%2Fdatatables.org%2Falltableswithkeys&callback=';
	var json_obj = JSON.parse(Get(query));
	var stock = json_obj.query.results.quote;
	res.send(stock);
});

//HTTP Request POST join a new game. Parameter: user_id, game_id
router.post('/joinGame', function(req, res) {
	var user_id = req.body.user_id;
	var game_id = req.body.game_id;
	var userQuery = new Parse.Query("User");
	var gameQuery = new Parse.Query('Game');
	userQuery.get(user_id).then(function(user){
		gameQuery.get(game_id).then(function(game){
			var playCheck = false;
			var currentPlayers;
			if (game.attributes.CurrentPlayers == null) {
				currentPlayers = new Array();
			} else {
				currentPlayers = game.attributes.CurrentPlayers;
				for (var i = 0 in currentPlayers) {
					if (user.attributes.username == currentPlayers[i]) {
						playCheck = true
					}
				}
			}
			if (!playCheck) {
				currentPlayers.push(user.attributes.username);
				game.save({CurrentPlayers: currentPlayers});
				var NewTransaction = Parse.Object.extend("Transaction");
				var newTransaction = new NewTransaction();
				newTransaction.save({
					gameName: game.attributes.Name,
					userName: user.attributes.username,
					GameID: { __type: "Pointer", className: "Game", objectId: game_id },

					stocksInHand: new Array(),
					currentMoney: 100000
				}).then(function(transaction){
					res.send({
						message: "success"
					});
				});
			} else {
				res.send({
					error: "User is already in the game."
				})
			}
		});
	});
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
			var isStockExist = false;
			for (var i in ownedStocks) {
				if (ownedStocks[i].symbol == stock_symbol) {
					isStockExist = true;
					bought_price = round2DesimalDigit((parseFloat(ownedStocks[i].share) * parseFloat(ownedStocks[i].bought_price) + buy_number * price) / (parseFloat(ownedStocks[i].share) + parseFloat(buy_number))).toString();
					ownedStocks[i].share = (parseFloat(ownedStocks[i].share) + parseFloat(buy_number)).toString();

				} 
			}
			if (!isStockExist) {
				ownedStocks.push({
					share: "" + buy_number,
					symbol: stock_symbol,
					bought_price: price
				});				
			}
			log.push({
				operation: "buy",
				symbol: stock_symbol,
				share: buy_number,
				price: price,
				wallet: "" + round2DesimalDigit(transaction.attributes.currentMoney - buy_number * price),
				time: new Date()
			});
			transaction.save({
				currentMoney: round2DesimalDigit(transaction.attributes.currentMoney - buy_number * price),
				stocksInHand: ownedStocks,
				log: log
			}).then(function(){
				res.send({ message: "success" });
			});
		}
	})
});

router.get('/currentGame/:transaction_id', function(req, res) {
	var transaction_id = req.params.transaction_id;
	var query = new Parse.Query('Transaction');
	query.get(transaction_id).then(function(transaction) {
		var queryResult = [];
		var stocks = [];
		var ownedStocks = transaction.attributes.stocksInHand;
		ownedStocks.sort(sort_by('symbol', false, function(a){return a.toUpperCase()}));
		for (var i in ownedStocks) {
			stocks.push(ownedStocks[i].symbol);
		}
		stocks = stocks.sort();
		var bids = getStocks(stocks);
		for (var i = 0; i < stocks.length; i++) {
			queryResult.push(
				{
					symbol: ownedStocks[i].symbol,
					share: ownedStocks[i].share,
					bought_price: ownedStocks[i].bought_price,
					bid_price: bids[i].Bid,
					change: round2DesimalDigit(parseFloat(bids[i].Bid) - parseFloat(ownedStocks[i].bought_price))
				}
			);
		}
		res.send({response: queryResult});
	});
});

//HTTP POST request: sell stock shares. Parameter: transaction_id, sell_number, stock_symbol
router.post('/sell', function(req, res) {
	var transaction_id = req.body.transaction_id;
	var sell_number = req.body.sell_number;
	var stock_symbol = req.body.stock_symbol;
	var stock = getStock(stock_symbol);
	var price = stock.Bid;
	if (price == null)
	{
		res.send({error: "Transaction is denied. Bid price is not available right now."});
	}
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
					log.push({
							operation: "sell",
							symbol: stock_symbol,
							share: sell_number,
							price: price,
							wallet: "" + round2DesimalDigit(transaction.attributes.currentMoney + sell_number * price),
							time: new Date()
						});
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
						var price;
						if (getStock(ownedStocks[n].symbol).Bid != null)
						{
							price = getStock(ownedStocks[n].symbol).Bid;
						}
						else
						{
							price = getStock(ownedStocks[n].symbol).LastTradePriceOnly;
						}
						currentMoney = round2DesimalDigit(currentMoney + parseFloat(ownedStocks[n].share) * price);
						ownedStocks[n].share = "0";
					}
				}
				log.push(
					{
						operation: "checkout",
						wallet: currentMoney,
						time: new Date()
					});
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
					game.save({
						isFinished: true,
						Playing: false,
						finalStandings: rankArray
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
		ownedStocks.sort(sort_by('symbol', false, function(a){return a.toUpperCase()}));
		var currentMoney = transaction.attributes.currentMoney;
		var stockSymbols = [];
		for (var i in ownedStocks) {
			stockSymbols.push(ownedStocks[i].symbol);
		}
		var stocks = getStocks(stockSymbols);
		for (var i = 0; i < stocks.length; i++) {
			if (ownedStocks.length != 0)
			{
				if (ownedStocks[i].share != "0")
				{
					var price;
					if (stocks[i].Bid == null)
					{
						price = stocks[i].LastTradePriceOnly;
					}
					else
					{
						price = stocks[i].Bid;
					}
					currentMoney = round2DesimalDigit(currentMoney + parseFloat(ownedStocks[i].share) * price);
				}
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

router.get("/rank/:game_id", function(req, res){
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
				for (var n in ownedStocks) {
					if (ownedStocks[n].share != "0") {
						//var price = getStock(ownedStocks[n].symbol).Bid;
						var price;
						if (getStock(ownedStocks[n].symbol).Bid == null)
						{
							price = getStock(ownedStocks[n].symbol).LastTradePriceOnly;
						}
						else
						{
							price = getStock(ownedStocks[n].symbol).Bid;
						}
						currentMoney = round2DesimalDigit(currentMoney + parseFloat(ownedStocks[n].share) * price);
					}
				}
				rankArray.push({
					username: transactions[i].attributes.userName,
					wallet: currentMoney
				});
			}
			rankArray.sort(sort_by("wallet", true, parseFloat));
			var gameQuery = new Parse.Query("Game");
			gameQuery.get(game_id).then(function(game, err) {
				if (err) {
					res.send(err);
				} else {
					game.save({
						finalStandings: rankArray
					});
					res.send({
						ranking: rankArray
					});
				}
			});
		}
	});
});

var sort_by = function(field, reverse, primer){

   var key = primer ? 
       function(x) {return primer(x[field])} : 
       function(x) {return x[field]};

   reverse = !reverse ? 1 : -1;

   return function (a, b) {
       return a = key(a), b = key(b), reverse * ((a > b) - (b > a));
     } 
}

function Get(yourUrl) {
	var Httpreq = new XMLHttpRequest(); // a new request
	Httpreq.open("GET",yourUrl,false);
	Httpreq.send(null);
	return Httpreq.responseText;
}

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

function getStocks(symbols) {
	var symbolString = symbols[0];
	if (symbols.length != 1)
	{
		for (var i = 1; i < symbols.length; i++)
		{
			symbolString = symbolString + "%22%2C%22" + symbols[i];
		}
	}
	var result = [];
	var temp = getStock(symbolString);
	if (!Array.isArray(temp))
	{
		result.push(getStock(symbolString));
		return result;
	}
	return getStock(symbolString);
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