var express = require('express');
var router = express.Router();

//web
router.get('/', function(req, res, next) {
  res.send('respond with a resource in web');
});

//login
router.get('/login', function(req, res) {
	if (req.session.hasOwnProperty('user'))
	{
		res.redirect('/');
	}
	else
	{
		var userQuery = new Parse.Query("User");
		userQuery.find().then(function(users){
			res.render('web/login', {
				title: 'login',
				users: users
			});
		});
	}
});

router.get('/login/:userid', function(req, res) {
	var userid = req.params.userid;
	var userQuery = new Parse.Query('User');
	userQuery.get(userid).then(function(user) {
		var tokenQuery = new Parse.Query('Tokens');
		tokenQuery.equalTo('user', user);
		tokenQuery.find().then(function(token) {
			req.session.user = user;
			req.session.tokens = token[0].attributes.token;
			res.redirect('/');
		});
	});
});

router.get('/log_out/', function(req, res) {
	delete req.session.user;
	delete req.session.tokens;
	res.redirect('/');
});

router.get('/all_games', function(req, res) {
	var user = null;
	var isLoggedIn = false;
	if (req.session.hasOwnProperty('user'))
	{
		user = req.session.user;
		isLoggedIn = true;
	}
	var gameQuery = new Parse.Query("Game");
	gameQuery.find().then(function(games) {
		res.render('web/all_games', {
			title: "All Games",
			isLoggedIn: isLoggedIn,
			user: user,
			games: games
		});
	});
});

module.exports = router;
