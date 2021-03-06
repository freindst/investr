var express = require('express');
var router = express.Router();
var fs = require('fs');
var schedule = require('node-schedule');
var rsj = require('rsj');

Parse = require('parse').Parse;
Parse.initialize("FqNt8xkKnxeEdBqV5te9vJAOQQ7dRNsO69Bqno9y", "yrRCAxIDLnAxnKaBltA2YfznMnh6eEY2uuG0QCDl");

var braintree = require("braintree");

var gateway = braintree.connect({
  environment: braintree.Environment.Sandbox,
  merchantId: "5twc7f5c44t8k6wn",
  publicKey: "s594frh5fpysncx7",
  privateKey: "8e0637645f1067a80e710b2eb36e359c"
});

router.get("/client_token", function (req, res) {
	gateway.clientToken.generate({}, function (err, response) {
		res.send(response.clientToken);
	});
});

router.post("/payment_method_nonce", function(req, res) {
	res.send(req.body.payment_method_nonce);
});

router.post("/payment-methods", function (req, res) {
	var isLoggedIn = false;
	if (!req.session.hasOwnProperty('user')) {
		res.redirect('/login');
	} else {
		var nonce = req.body.payment_method_nonce;
	    // Use payment method nonce here
	    var amount = req.body.amount;
	    if (amount) {
		    gateway.transaction.sale({
		  	    amount: req.body.amount,
		    	paymentMethodNonce: nonce,
		    }, function (err, result) {
		    	var userQuery = new Parse.Query("User");
		    	userQuery.get(req.session.user.objectId).then(function(user) {
		    		var token = parseInt(req.session.tokens) + parseInt(req.body.amount);
		    		req.session.tokens = token;
					var tokenQuery = new Parse.Query('Tokens');
					tokenQuery.equalTo('user', user);
					tokenQuery.find().then(function(tokens) {
						tokens[0].save({
						'token': token
						}).then(function(result) {
						// The save was successful.
						res.redirect('/')
						}, function(error) {
						// The save failed.  Error is an instance of Parse.Error.
						console.log(error)
						});						
					});
		    	});		    	
		    });    	
	    } else {
	    	res.send('no money put in');
	    }		
	}

});

var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;

var schedule_list = [];

(function(){
	var query = new Parse.Query("Game");
	query.find().then(function(games){
		for (var i in games) {
			(function() {
				var j = i
				var currentDate = new Date();
				var StartTime = new Date(games[j].attributes.StartTime);
				var EndTime = new Date(games[j].attributes.EndTime);
				var schedule_i = {
					GameID: games[j].id,
					scheduleStart: null,
					scheduleEnd: null
				};
				if (StartTime.getTime() > currentDate.getTime())
				{
					schedule_i.scheduleStart = schedule.scheduleJob(StartTime, function() {
						games[j].save({Playing: true});
						console.log("start")
					});
				}
				if (EndTime.getTime() > currentDate.getTime())
				{
					schedule_i.scheduleEnd = schedule.scheduleJob(EndTime, function() {
						checkOutGame(games[j].id);
						console.log("end")
					});
				}
				schedule_list.push(schedule_i);
			})();
		}
		console.log(schedule_list);
	});
})();

// test server
router.get('/log', function(req, res) {
	fs.appendFile('message.txt', "10/15",function () {
  		console.log('The "test" was appended to file!');
  	})
	res.send("logegd");
})

router.get('/test/', function(req, res){
	console.log(schedule_list);
	res.send('test');
})

router.get('/inPlay/:username', function(req, res){
	var username = req.params.username;
	var gameQuery = new Parse.Query("Game");
	gameQuery.equalTo("Playing", true);
	gameQuery.find().then(function(games, err){
		if (err) {
			res.send(err);
		} else {
			var query = new Parse.Query("Transaction");
			var GamesID = [];
			for (var i in games)
			{
				GamesID.push({ __type: "Pointer", className: "Game", objectId: games[i].id});
			}
			//must be in playing game
			query.equalTo("userName", username).containedIn("GameID", GamesID);
			query.find().then(function(transactions, err){
				var result = [];
				for (var i in transactions)
				{					
					var data = {
						gameID: transactions[i].attributes.GameID.id,
						portfolio: portfolio(transactions[i])
					};
					result.push(data);
				}
				res.send(result);
			});
		}
	});
});

router.post('/historicaldata/', function(req,res) {
	var symbol = req.body.symbol;
	var startdate = req.body.startdate;
	var enddate = req.body.enddate;
	var query = 'https://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20yahoo.finance.historicaldata%20where%20symbol%20%3D%20%22' + symbol + '%22%20and%20startDate%20%3D%20%22' + startdate + '%22%20and%20endDate%20%3D%20%22' + enddate + '%22&format=json&diagnostics=true&env=store%3A%2F%2Fdatatables.org%2Falltableswithkeys&callback=';
	var json_obj = JSON.parse(Get(query));
	var stock = json_obj.query.results.quote;
	res.send(stock);
})

function portfolio(transaction)
{
	var ownedStocks = transaction.attributes.stocksInHand;
	ownedStocks.sort(sort_by('symbol', false, function(a){return a.toUpperCase()}));
	var currentMoney = transaction.attributes.currentMoney;
	var stockSymbols = [];
	for (var i in ownedStocks) {
		stockSymbols.push(ownedStocks[i].symbol);
	}
	var stocks = getStocks(stockSymbols);
	for (var i = 0; i < ownedStocks.length; i++) {
		if (ownedStocks[i].share != "0") {
			var price = stocks[i].Bid;
			currentMoney = round2DesimalDigit(currentMoney + parseFloat(ownedStocks[i].share) * price);
		}
	}
	return currentMoney;
}

//run schedule checkout for each games
router.get('/run', function(req, res) {
	var query = new Parse.Query("Game");
	query.find().then(function(games){
		for (var i = 0; i < games.length; i++) {
			(function() {
				var j = i
				var date = new Date(games[i].attributes.EndTime);
				var currentDate = new Date();
				if (date.getTime() > currentDate.getTime()) {
					console.log('running checkout ' + games[i].attributes.Name + ' in schedule at ' + date);
					schedule.scheduleJob(date, function() {
						checkOutGame(games[j].id);
					});					
				}
			})()
		}
	});
	res.send("running schedule");
})

router.post('/test', function(req, res) {
	var num = req.body.parameter;
	console.log(num);
	res.send(num);
})

// GET home page.
router.get('/', function(req, res, next) {
	var isLoggedIn = false;
	if (req.session.hasOwnProperty('user'))
	{
		isLoggedIn = true;
		res.render('index', {
			title: 'Investr',
			user: req.session.user,
			token: req.session.tokens,
			isLoggedIn: isLoggedIn
		});
	}
	else {
		res.render('index', { title: 'Investr', isLoggedIn: isLoggedIn, user: null, token: null});		
	}

});

router.get('/buy_token', function(req, res) {
	var isLoggedIn = false;
	if (req.session.hasOwnProperty('user')) {
		isLoggedIn = true;
		res.render('buy_token', {
			title: 'Investr',
			user: req.session.user,
			token: req.session.tokens,
			isLoggedIn: isLoggedIn
		});	
	}
	else {
		res.redirect('/web/login');
	}
});

// old page
router.get('/old', function(req, res) {
	res.render('old/old_index', {
		title: 'Stockr'
	});
});

//quote demo webpage
router.get('/quote', function(req, res){
	res.render('query');
})

//create a game
router.get('/createGame', function(req, res){
	res.render('createGame', {
		title: "Create A New Game"
	});
});


//deal with create game post
router.post('/createGame', function(req, res){
	var gameName = req.body.Name;
	var StartTime = new Date(req.body.StartTime_date + " " +req.body.StartTime_time);
	var EndTime = new Date(req.body.EndTime_date + " " + req.body.EndTime_time);
	var Price = req.body.Price;
	var PotSize = req.body.PotSize;
	var NewGame = Parse.Object.extend("Game");
	var newGame = new NewGame();
	newGame.save({
		Name: gameName,
		Playing: false,
		isFinished: false,
		finalStandings: new Array(),
		CurrentPlayers: new Array(),
		StartTime: StartTime,
		EndTime: EndTime,
		Price: parseFloat(Price),
		PotSize: parseInt(PotSize)
	}).then(function(game, err){
		if (err) {
			res.send(err);
		} else {
			var schedule_i = {
				GameID: game.id,
				scheduleStart: null,
				schduleEnd: null
			};
			var currentDate = new Date();
			if (StartTime.getTime() > currentDate.getTime())
	        {
	          schedule_i.scheduleStart = schedule.scheduleJob(StartTime, function() {
	            game.save({Playing: true});
	          });
	        }
	        if (EndTime.getTime() > currentDate.getTime())
	        {
	          schedule_i.scheduleEnd = schedule.scheduleJob(EndTime, function() {
	            checkOutGame(game.id);
	          });
	        }
			schedule_list.push(schedule_i)
			res.redirect('/all_games');
		}
	});
});

//update a game
router.get("/updateGame/:game_id", function(req, res) {
	var game_id = req.params.game_id;
	var gameQuery = new Parse.Query("Game");
	gameQuery.get(game_id).then(function(game, err) {
		if (err) {
			res.send(err);
		} else {
			res.render("updateGame", {
				title: "Update the Game",
				game: game
			});
		}
	});
});

router.post("/updateGame/", function(req, res) {
	console.log(schedule_list);
	var game_id = req.body.GameID;
	var gameName = req.body.Name;
	var StartTime = new Date(req.body.StartTime_date + " " +req.body.StartTime_time);
	var EndTime = new Date(req.body.EndTime_date + " " + req.body.EndTime_time);
	var Price = req.body.Price;
	var PotSize = req.body.PotSize;
	var Playing = (req.body.Playing === "true");
	var isFinished = (req.body.isFinished === "true");
	var query = new Parse.Query('Game');
	query.get(game_id).then(function(game, err) {
		if (err) {
			res.send(err);
		} else {
			game.save({
				Name: gameName,
				Playing: Playing,
				isFinished: isFinished,
				StartTime: StartTime,
				EndTime: EndTime,
				Price: parseFloat(Price),
				PotSize: parseInt(PotSize),		
			}).then(function(game, err) {
				if (err) {
					res.send(err);
				} else {
					res.redirect('/all_games');
					var isExist = false;
					for (var i in schedule_list) {
						if (schedule_list[i].GameID == game.id) {
							if (schedule_list[i].scheduleStart) {
								schedule_list[i].scheduleStart.cancel();
							}
							if (schedule_list[i].scheduleEnd) {
								schedule_list[i].scheduleEnd.cancel();
							}							
							isExist = true;
							break;
						}
					}
					var schedule_i = {
					  GameID: game.id,
					  scheduleStart: null,
					  schduleEnd: null
					};
					var currentDate = new Date();
					if (StartTime.getTime() > currentDate.getTime())
					    {
					    	console.log("start time is in future")
					      schedule_i.scheduleStart = schedule.scheduleJob(StartTime, function() {
					        game.save({Playing: true});
					      });
					    }
					    if (EndTime.getTime() > currentDate.getTime())
					    {
					    	console.log("end time is in future")
					      schedule_i.scheduleEnd = schedule.scheduleJob(EndTime, function() {
					        checkOutGame(game.id);
					      });
					    }
					schedule_list.push(schedule_i)
					}
			});
		}
	});
});

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
				for (var i in currentPlayers) {
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
					log: [{
						operation: "join",
						wallet: 10000.00,
						time: new Date()
					}],
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
router.get('/all_games', function(req, res) {
	var query = new Parse.Query("Game");
	query.find().then(function(results){
		res.render('game_list',{
			games: results
		});
	})
})

//all game
router.get('/all_transactions', function(req, res) {
	var query = new Parse.Query("Transaction");
	query.find().then(function(results){
		res.render('transaction_list',{
			transactions: results
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
			}).then(function(){});
		}		
	});
	res.redirect("/in_game/" + req.session.transaction_id);
});

router.get('/currentGame/:transaction_id', function(req, res) {
	var transaction_id = req.params.transaction_id;
	var query = new Parse.Query('Transaction');
	query.get(transaction_id).then(function(transaction) {
		var queryResult = [];
		var stocks = [];
		var ownedStocks = transaction.attributes.stocksInHand;
		for (var i in ownedStocks) {
			stocks.push(ownedStocks[i].symbol);
		}
		stocks = stocks.sort();
		var bids = [];
		bids = getStocks(stocks);
		for (var i = 0; i < stocks.length; i++) {
			queryResult.push({
					symbol: ownedStocks[i].symbol,
					share: ownedStocks[i].share,
					bought_price: ownedStocks[i].bought_price,
					change: round2DesimalDigit(parseFloat(ownedStocks[i].bought_price) - parseFloat(bids[i].Bid))
			});
		}
		res.send({response: queryResult});
	});
});

//sell stock
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
				var price = getStock(ownedStocks[i].symbol).Bid;
				currentMoney = round2DesimalDigit(currentMoney + parseFloat(ownedStocks[i].share) * price);
				ownedStocks[i].share = "0";
				log.push({
					operation: "sell",
					symbol: ownedStocks[i].symbol,
					share: ownedStocks[i].share,
					price: price,
					wallet: "" + currentMoney,
					time: new Date()
				});
			}
		}
		log.push({
			operation: "checkout",
			wallet: currentMoney,
			time: new Date()
		});
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

//checkout all the players in the game
router.get("/checkoutAll/:game_id", function (req, res) {
	console.log("clicked");
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
						if (getStock(ownedStocks[n].symbol).Bid == null)
						{
							price = getStock(ownedStocks[n].symbol).LastTradePriceOnly;
						}
						else
						{
							price = getStock(ownedStocks[n].symbol).Bid;
						}
						currentMoney = round2DesimalDigit(currentMoney + parseFloat(ownedStocks[n].share) * price);
						ownedStocks[n].share = "0";
						log.push({
							operation: "sell",
							symbol: ownedStocks[n].symbol,
							share: ownedStocks[n].share,
							price: price,
							wallet: currentMoney,
							time: new Date()
						});
					}
				}
				log.push({
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
						result: "checkout success"
					});
				}
			});
		}
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
						var price = getStock(ownedStocks[n].symbol).Bid;
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

function checkOutGame(game_id) {
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
				log.push({
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
					var finalStandings = new Array();
					for (var i in rankArray) {
						finalStandings.push(rankArray[i].username);
					}
					game.save({
						Playing: false,
						isFinished: true,
						finalStandings: finalStandings
					});
					console.log({
						result: "checkout success"
					});
				}
			});
		}
	});
}

module.exports = router;