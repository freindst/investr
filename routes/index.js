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
	var stock_symbol = "aapl";
	var json_obj = JSON.parse(Get(Url(stock_symbol)));
	var stock = json_obj.query.results.quote;
	var price = json_obj.query.results.quote.Ask;
	console.log(price);
	res.send(stock);
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
	req.session.transaction_id = transaction_id
	var query = new Parse.Query("Transaction");
	query.get(transaction_id).then(function(transaction){
		var stocksQuery = new Parse.Query("CurrentQuote");
		stocksQuery.find().then(function(stocks){
			res.render('in_game', {
				stocks: stocks,
				transaction: transaction
			})
		})
	})
})

//webpage
router.post('/findStockById', function(req, res){
	console.log(req.session.transaction_id);
	var stock_id = req.body.stock_id;
	var query = new Parse.Query('CurrentQuote');
	query.get(stock_id).then(function(stock){
		price = (+stock.attributes.QueryResult.Bid/2 + +stock.attributes.QueryResult.Ask/2);
		console.log(price);
		res.render('theStock', {
			stock: stock,
			price: price,
			transaction_id: req.session.transaction_id
		});
	});
})

/*router.post('/quote', function(req, res){
	var stockname = req.body.stockname;
	var json_obj = JSON.parse(Get(Url(stockname)));
	var stock = json_obj.query.results.quote;
	res.render('stock', {stock: stock});
})*/

//get stock realtime quote
router.get('/get/:stock_symbol', function(req, res) {
	var stockname = req.params.stock_symbol;
	var json_obj = JSON.parse(Get(Url(stockname)));
	var stock = json_obj.query.results.quote;
	res.send(stock);
})

//buy stock
router.post('/bid', function(req, res) {
	var bid_number = req.body.share_number;
	var stock_symbol = req.body.stock_symbol;
	var price = req.body.price;
	console.log(price);
	var query = new Parse.Query("Transaction");
	query.get(req.session.transaction_id).then(function(transaction){
		if (transaction.attributes.currentMoney < bid_number * price) {
			res.send('You do not have enough money');
		} else {
			temp = transaction.attributes.stocksInHand;
			for (var i in temp) {
				if (temp[i].symbol == stock_symbol) {
					temp[i].share = bid_number;
				}
			}
			transaction.save({
				currentMoney: transaction.attributes.currentMoney - bid_number * price,
				stocksInHand: temp
			}).then(function(){});
		}
		res.redirect('/in_game/' + req.session.transaction_id);
	})
})

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
})

//retrieve all stock info into parse
router.get('/queryAllQuotes', function(req, res) {
	var query = new Parse.Query("CurrentQuote");
	var n = 0;
	var stockSymbols = "";
	query.find().then(function(stocks){
		for(var i in stocks) {
			if (n == 0) {
				stockSymbols = stocks[i].attributes.Symbol;
				n++;
			} else if (n == 1 || n == 2) {
				stockSymbols = stockSymbols + "%22%2C%22" + stocks[i].attributes.Symbol;
				n++;
			} else if (n == 3) {
				stockSymbols = stockSymbols + "%22%2C%22" + stocks[i].attributes.Symbol;
				var queryResults = JSON.parse(Get(Url(stockSymbols))).query.results.quote;
				for (var m =0; m < 4; m++) {
					stocks[i - m].save({QueryResult: queryResults[3 - m]}).then(function(){});
				}
				n = 0;
				stockSymbols = "";
			}
		}
		res.redirect('/');
	}, function(error){
		res.send(error);
	});
})

//list all stock info in parse
router.get('/listAllQuotes', function(req, res) {
	var query = new Parse.Query("CurrentQuote");
	query.find().then(function(results){
		var stocks = new Array();
		for (var i in results) {
			stocks.push({
				name: results[i].attributes.Name, 
				symbol: results[i].attributes.Symbol, 
				last_price: results[i].attributes.QueryResult.Bid,
				day_change: results[i].attributes.QueryResult.Change_PercentChange
			});
		}
		return stocks;
	}).then(function(stocks){
		res.render('stocks', {stocks: stocks});
	})
})


//
//below are client api
//

//retrieverealtime stock quote
router.post('/quote', function(req, res){
	var stockname = req.body.stockname;
	var json_obj = JSON.parse(Get(Url(stockname)));
	var stock = json_obj.query.results.quote;
	res.send(stock);
})

//get version of quote
router.get('/quote/:stockname', function(req, res) {
	var stockname = req.params.stockname;
	var json_obj = JSON.parse(Get(Url(stockname)));
	var stock = json_obj.query.results.quote;
	res.send(stock);
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
	var buy_number = req.body.share_number;
	var stock_symbol = req.body.stock_symbol;
	var json_obj = JSON.parse(Get(Url(stock_symbol)));
	var stock = json_obj.query.results.quote;
	var price = stock.Ask;
	var query = new Parse.Query("Transaction");
	query.get(transaction_id).then(function(transaction) {
		if (transaction.attributes.currentMoney < buy_number * price) {
			res.send({ error: "error" });
		} else {
			ownedStocks = transaction.attributes.stocksInHand;
			var isStockExist = false
			for (var i in ownedStocks) {
				if (ownedStocks[i].symbol == stock_symbol) {
					isStockExist = true;
					ownedStocks[i].share = ownedStocks[i].share + buy_number;
				} 
			}
			if (!isStockExist) {
				ownedStocks.push({
					share: buy_number,
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
})







function Url(company) {
	var result = "https://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20yahoo.finance.quotes%20where%20symbol%20in%20(%22";
	result = result + company + "%22)%0A%09%09&format=json&diagnostics=true&env=http%3A%2F%2Fdatatables.org%2Falltables.env&callback=";
	return result
}

function Get(yourUrl){
	var Httpreq = new XMLHttpRequest(); // a new request
	Httpreq.open("GET",yourUrl,false);
	Httpreq.send(null);
	return Httpreq.responseText;
}

module.exports = router;
