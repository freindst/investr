var express = require('express');
var router = express.Router();

var Parse = require('parse').Parse;
Parse.initialize("FqNt8xkKnxeEdBqV5te9vJAOQQ7dRNsO69Bqno9y", "yrRCAxIDLnAxnKaBltA2YfznMnh6eEY2uuG0QCDl");

var braintree = require("braintree");

var gateway = braintree.connect({
  environment: braintree.Environment.Sandbox,
  merchantId: "nbxqn839vhj8tr3z",
  publicKey: "cyc9gssnmpjbzxbq",
  privateKey: "75b2a54536113180c71aab5db13a50d3"
});

var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;

// test server
router.get('/test', function(req, res) {
	res.send("test");
})

router.post('/test', function(req, res) {
	var num = req.body.parameter;
	console.log(num);
	res.send(num);
})

// GET home page.
router.get('/', function(req, res, next) {
	res.render('index', { title: 'Stockr' });
});

router.get("/client_token", function (req, res) {
	gateway.clientToken.generate({}, function (err, response) {
		res.send(response.clientToken);
	});
});

router.post("/payment-methods", function (req, res) {
	var nonce = req.body.payment_method_nonce;
    // Use payment method nonce here
    gateway.transaction.sale({
  	    amount: '10.00',
    	paymentMethodNonce: nonce,
    }, function (err, result) {
    	res.send(result);
    });
});

//quote demo webpage
router.get('/quote', function(req, res){
	res.render('query');
})

//join game page
router.get('/joinGame', function(req, res){
	var userQuery = new Parse.Query("User");
	var gameQuery = new Parse.Query("Game");
	userQuery.find().then(function(users){
		gameQuery.find().then(function(games){
			res.render('joinGame', {
				games: games,
				users: users
			});			
		});
	});
});

//join game function
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
					if (user.attributes.username = currentPlayers[i]) {
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
					log: [logGenerator("join")],
					stocksInHand: new Array(),
					currentMoney: 100000
				}).then(function(transaction){
					res.redirect("/in_game/" + transaction.id);
				});
			} else {
				res.send("You have already joined in the game.")
			}
		});
	});
});

//all game demo webpage
router.get('/all_game', function(req, res) {
	var query = new Parse.Query("Transaction");
	query.find().then(function(results){
		res.render('transaction_list',{
			games: results
		});
	})
})

//demo webpage
router.get('/in_game/:transaction_id', function(req, res){
	var transaction_id = req.params.transaction_id;
	//keep transaction_id in the cookie
	req.session.transaction_id = transaction_id
	var query = new Parse.Query("Transaction");
	query.get(transaction_id).then(function(transaction){
		var stocksQuery = new Parse.Query("Stock");
		stocksQuery.find().then(function(stocks){
			res.render('in_game', {
				stocks: stocks,
				transaction: transaction
			})
		})
	})
})

//webpage
router.get('/findStockBySymbol/:stock_symbol', function(req, res) {
	var stock_symbol = req.params.stock_symbol;
	var stock = getStock(stock_symbol);
	res.render('theStock', {
		stock: stock,
		transaction_id: req.session.transaction_id
	});
});

//webpage
router.post('/findStockBySymbol', function(req, res) {
	var stock_symbol = req.body.stock_symbol;
	var stock = getStock(stock_symbol);
	res.render('theStock', {
		stock: stock,
		transaction_id: req.session.transaction_id
	});
});

//Get real quote
router.post('/quote', function(req, res) {
	var stockname = req.body.stockname;
	var json_obj = JSON.parse(Get(Url(stockname)));
	var stock = json_obj.query.results.quote;
	res.render('stock', {stock: stock});
});

//get stock realtime quote
router.get('/get/:stock_symbol', function(req, res) {
	var stock_symbol = req.params.stock_symbol;
	res.send(getStock(stock_symbol));
});

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
				log.push(logGenerator("buy-" + stock_symbol + "-" + buy_number));
			}
			transaction.save({
				currentMoney: round2DesimalDigit(transaction.attributes.currentMoney - buy_number * price),
				stocksInHand: ownedStocks,
				log: log
			}).then(function(){});
		}		
	});
	res.redirect("/in_game/" + req.session.transaction_id);
});

//sell stock
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
		var log = transaction.attributes.log;
		var isTransactionPass = false;
		for (var i in ownedStocks) {
			if (ownedStocks[i].symbol == stock_symbol) {
				if (parseInt(ownedStocks[i].share) >= parseInt(sell_number)) {
					isTransactionPass = true;
					ownedStocks[i].share = ((parseInt(ownedStocks[i].share)) - parseInt(sell_number)).toString();
					log.push(logGenerator("sell-" + stock_symbol + "-" + sell_number));
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
			}).then(function() {});
		} else {
			res.send({error:"operation failed"});
		}
	});
	res.redirect("/in_game/" + req.session.transaction_id);
});

//list all users
router.get('/user', function(req, res) {
	var userQuery = new Parse.Query("User");
	userQuery.find({
		success: function(users) {
			res.render('user', {
				users: users
			});
		}
	});
});

//Performing checkout function by selling all stocks in the end of the game. Parameter: transaction_id
router.get('/checkout/:transaction_id', function(req, res) {
	var transaction_id = req.params.transaction_id;
	var query = new Parse.Query("Transaction");
	query.get(transaction_id).then(function(transaction) {
		var ownedStocks = transaction.attributes.stocksInHand;
		var currentMoney = transaction.attributes.currentMoney;
		var log = transaction.attributes.log;
		for (var i in ownedStocks) {
			if (ownedStocks[i].share != "0") {
				var price = getStock(ownedStocks[i].symbol).Ask;
				currentMoney = round2DesimalDigit(currentMoney + parseFloat(ownedStocks[i].share) * price);
				ownedStocks[i].share = "0";
			}
		}
		log.push(logGenerator("checkout"));
		transaction.save({
			currentMoney: currentMoney,
			stocksInHand: ownedStocks,
			log: log
		}).then(function(result, err) {
			if (err) {
				res.send({
					error: err
				});
			} else {
				res.redirect("/in_game/" + req.session.transaction_id);
			}
		});
	});
});

router.get("/checkoutAll/:game_id", function (req, res) {
	game_id = req.params.game_id;
	var query = new Parse.Query("Transaction");
	query.equalTo("GameID", { __type: "Pointer", className: "Game", objectId: game_id });
	query.find().then(function(transactions){
		for (var i in transactions) {
			//console.log(transactions[i].id);
			checkout(transactions[i].id);
		}
	});
});

//functions
function Url(company) {
	var result = "https://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20yahoo.finance.quotes%20where%20symbol%20in%20(%22";
	result = result + company + "%22)%0A%09%09&format=json&diagnostics=true&env=http%3A%2F%2Fdatatables.org%2Falltables.env&callback=";
	return result
}

function Get(yourUrl) {
	var Httpreq = new XMLHttpRequest(); // a new request
	Httpreq.open("GET",yourUrl,false);
	Httpreq.send(null);
	return Httpreq.responseText;
}

//Use yahoo finance to get stock realtime quote
function getStock(symbol) {
	var json_obj = JSON.parse(Get(Url(symbol)));
	var stock = json_obj.query.results.quote;
	return stock;
}

function round2DesimalDigit(value) {
	return Math.round(value * 100) / 100;
}

//generate log text string for each operation
function logGenerator(operation) {
	var time_stamp = new Date();
	var operation = operation;
	var json_obj = {
		operation: operation,
		time: time_stamp.toString()		
	};
	return json_obj;
}

function checkout(transaction_id) {
	var query = new Parse.Query("Transaction");
	query.get(transaction_id).then(function(transaction) {
		var ownedStocks = transaction.attributes.stocksInHand;
		var currentMoney = transaction.attributes.currentMoney;
		var log = transaction.attributes.log;
		for (var i in ownedStocks) {
			if (ownedStocks[i].share != "0") {
				var price = getStock(ownedStocks[i].symbol).Ask;
				currentMoney = round2DesimalDigit(currentMoney + parseFloat(ownedStocks[i].share) * price);
				ownedStocks[i].share = "0";
			}
		}
		log.push(logGenerator("checkout"));
		transaction.save({
			currentMoney: currentMoney,
			stocksInHand: ownedStocks,
			log: log
		}).then(function(result, err) {
			if (err) {
				return err;
			} else {
				return {
					result: "success"
				};
			}
		});
	});
}

module.exports = router;