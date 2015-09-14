var express = require('express');
var router = express.Router();

var Parse = require('parse').Parse;
Parse.initialize("FqNt8xkKnxeEdBqV5te9vJAOQQ7dRNsO69Bqno9y", "yrRCAxIDLnAxnKaBltA2YfznMnh6eEY2uuG0QCDl");

var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;

router.get('/', function(req, res, next){
	res.send('in stocks');
})

router.get('/getAllQuotes', function(req, res) {
	var Query = new Parse.Query("CurrentQuote");
	var n = 0;
	var stockSymbols = "";
	Query.find().then(function(stocks){
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
		if (stockSymbols != "") {
			var queryResults = JSON.parse(Get(Url(stockSymbols))).query.results.quote;
			for (var m in queryResults) {
				stocks[stocks.length -1 - m].save({QueryResult: queryResults[queryResults.length -1 - m]}).then(function(){});
			}
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