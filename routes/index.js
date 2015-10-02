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
})

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
			var isStockExist = false
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
				currentMoney: transaction.attributes.currentMoney - buy_number * price,
				stocksInHand: ownedStocks
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
		var isTransactionPass = false;
		for (var i in ownedStocks) {
			if (ownedStocks[i].symbol == stock_symbol) {
				if (parseInt(ownedStocks[i].share) >= parseInt(sell_number)) {
					isTransactionPass = true;
					ownedStocks[i].share = ((parseInt(ownedStocks[i].share)) - parseInt(sell_number)).toString();
				} else {
					res.send({error:"User does not have enough shares to sell."})
				}
			}
		}
		if (isTransactionPass) {
			transaction.save({
				currentMoney: transaction.attributes.currentMoney + sell_number * price,
				stocksInHand: ownedStocks
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



//
//below are client api
//

//get version of quote
router.get('/quote/:stock_symbol', function(req, res) {
	var stock_symbol = req.params.stock_symbol;
	res.send(getStock(stock_symbol))
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
			var isStockExist = false
			for (var i in ownedStocks) {
				if (ownedStocks[i].symbol == stock_symbol) {
					isStockExist = true;
					ownedStocks[i].share = (parseFloat(ownedStocks[i].share) + parseFloat(buy_number)).toString();
					console.log(ownedStocks[i].share);
				} 
			}
			if (!isStockExist) {
				ownedStocks.push({
					share: "" + buy_number,
					symbol: stock_symbol
				});
			}
			transaction.save({
				currentMoney: transaction.attributes.currentMoney - buy_number * price,
				stocksInHand: ownedStocks
			}).then(function(){
				res.send({ message:"success" })
			});
		}
	})
});

//HTTP POST request: sell stock shares. Parameter: transaction_id, buy_number, stock_symbol
//need debug
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
					res.send({error:"User does not have enough shares to sell."})
				}
			}
		}
		if (isTransactionPass) {
			transaction.save({
				currentMoney: transaction.attributes.currentMoney + sell_number * price,
				stocksInHand: ownedStocks
			}).then(function() {
				res.send({message:"success"});
			});
		} else {
			res.send({error:"operation failed"});
		}
	});
});





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

module.exports = router;
