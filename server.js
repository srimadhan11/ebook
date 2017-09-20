const env = require('env2')('.env');
const express = require('express');
const path = require('path');
const mysql = require('mysql');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const session = require('express-session');
const fs = require('fs');
const app = express();
const port = process.env.NODE_PORT;
const date = new Date();

var accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), {flags: 'w'}); //flags: 'a' to append and 'w' to overwrite existing file
app.use(morgan('combined', {stream: accessLogStream}));
app.use(bodyParser.json());
app.use(session({
          secret : process.env.SESSION_SECRET,
          resave: true,
          saveUninitialized: true,
          cookie : {
            maxAge : 1000 * 60 * 60 * 24
          }
        })
);

//custom logger
var logger = {
  data: '',
  info: function(at, message, clientIp) {
    this.data += '<br> [INFO]  [' + date.toISOString() + ']@ ' + at + ' \'' + message + '\' -> from:' + clientIp;
  },
  error: function(type,at,message,clientIp) {
    this.data += '<br> [ERROR] [' + date.toISOString() + ']@ ' + at + ' \'' + message + '\' -> from:' + clientIp;
  },
  log: function(message) {
    this.data += '<br> ' + message;
  }
};

//mysql config object and creating a connection
var sqlConnection = mysql.createConnection( {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_DATABASE
});
sqlConnection.connect(function(err) {
  if (err)
    logger.error('sqlConnection', err, 'nodejsServer');
  else
    logger.log('mysql server is connected!');
});

function validateUser(request) {
  return ( (typeof request.session.userId) !== 'undefined');
}
function logFiller(content) {
  return `<!DOCTYPE html>
          <html lang="en">
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <title>Ebook Management System</title>
              <script src="https://ajax.googleapis.com/ajax/libs/jquery/3.2.1/jquery.min.js"></script>
              <script src="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/js/bootstrap.min.js"></script>
              <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap.min.css">
              <style></style>
              <script></script>
            </head>
            <body>
            <br>
            ${ content.length !=0 ? content : 'No log found!' }
            <br>
            </body>
          </html>`;
};

var books = process.env.BOOKS.split(' ');
for ( book in books) {
  app.get('/book/' + books[book], function (req, res) {
    res.sendFile(path.join(__dirname, 'ebooks', books[book] + '.pdf'));
  });
}
//GET resource
app.get('/schema', function (req, res) {
  res.sendFile(path.join(__dirname, 'schema.png'));
});
app.get('/favicon.ico', function (req, res) {
  res.sendFile(path.join(__dirname, 'favicon.ico'));
});
app.get('/accountSettings', function (req, res) {
  res.sendFile(path.join(__dirname, 'accountSettings.html'));
});
app.get('/loginRegister', function (req, res) {
  res.sendFile(path.join(__dirname, 'loginRegister.html'));
});
app.get('/passwordReset', function (req, res) {
  res.sendFile(path.join(__dirname, 'passwordReset.html'));
});
app.get('/cart', function (req, res) {
  res.sendFile(path.join(__dirname, 'cart.html'));
});
app.get('/orders', function (req, res) {
  res.sendFile(path.join(__dirname, 'orders.html'));
});
app.get('/paymentPage', function (req, res) {
  res.sendFile(path.join(__dirname, 'paymentPage.html'));
});
app.get('/home', function (req, res) {
  res.sendFile(path.join(__dirname, 'home.html'));
});

//ajax calls get method
app.get('/get/bestDeal', function (req, res) {
  sqlConnection.query('SELECT * FROM book WHERE id IN (SELECT bookId FROM bestDeals)', function (err, result) {
    if (err) {
      logger.error('/get/bestDeal', err, req._remoteAddress);
      res.status(500).send('internal server error');
    } else {
      res.status(200).send(JSON.stringify(result));
    }
  });
});
app.get('/get/newOffer', function (req, res) {
  sqlConnection.query('SELECT * FROM book WHERE id IN (SELECT bookId FROM newOffers)', function (err, result) {
    if (err) {
      logger.error('/get/newOffer', err, req._remoteAddress);
      res.status(500).send('internal server error');
    } else {
      res.status(200).send(JSON.stringify(result));
    }
  });
});
app.get('/get/search', function (req, res) {
  const query = sqlConnection.escape('%' + req.query.query + '%');
  sqlConnection.query('SELECT * FROM book WHERE LOWER(name) LIKE LOWER(' + query + ')', function (err, result) {
    if (err) {
      logger.error('/get/search', err, req._remoteAddress);
      res.status(500).send('internal server error');
    } else {
      res.status(200).send(JSON.stringify(result));
    }
  });
});
app.get('/get/cart', function (req, res) {
  if (!validateUser(req)) {
    logger.info('/get/cart', 'user validation failed', req._remoteAddress);
    res.status(401).send('unauthorised');
  } else {
    sqlConnection.query('SELECT * FROM book WHERE id IN (SELECT bookId FROM cart WHERE userId = ' + req.session.userId + ')', function (err, result) {
      if (err) {
        logger.error('/get/cart', err, req._remoteAddress);
        res.status(500).send('internal server error');
      } else {
        res.status(200).send(JSON.stringify(result));
      }
    });
  }
});
app.get('/get/order', function (req, res) {
  if (!validateUser(req)) {
    logger.info('/get/order', 'user validation failed', req._remoteAddress);
    res.status(401).send('unauthorised');
  } else {
    sqlConnection.query('SELECT * FROM book WHERE id IN (SELECT bookId FROM orders WHERE userId = ' + req.session.userId + ')', function (err, result) {
      if (err) {
        logger.error('/get/order', err, req._remoteAddress);
        res.status(500).send('internal server error');
      } else {
        res.status(200).send(JSON.stringify(result));
      }
    });
  }
});
app.get('/get/orderCost', function (req, res) {
  if (!validateUser(req)) {
    logger.info('/get/order', 'user validation failed', req._remoteAddress);
    res.status(401).send('unauthorised');
  } else {
    sqlConnection.query('SELECT SUM(cost) as cost FROM book WHERE id IN (SELECT bookId FROM cart WHERE userId = ' + req.session.userId + ')', function (err, result) {
      if (err) {
        logger.error('/get/orderCost', err, req._remoteAddress);
        res.status(500).send('internal server error');
      } else {
        res.status(200).send(JSON.stringify(result));
      }
    });
  }
});
app.get('/get/isUserLogged', function (req, res) {
  res.status(200).send(validateUser(req));
});
app.get('/get/username', function (req, res) {
  if (!validateUser(req)) {
    logger.info('/get/username', 'user validation failed', req._remoteAddress);
    res.status(401).send('unauthorised');
  } else {
    sqlConnection.query('SELECT name FROM user WHERE id = ' + req.session.userId, function (err, result) {
      if (err) {
        logger.error('/get/username', err, req._remoteAddress);
        res.status(500).send('internal server error');
      } else {
        res.status(200).send(JSON.stringify(result));
      }
    });
  }
});
app.get('/get/logout', function (req, res) {
  if (!validateUser(req)) {
    logger.info('/get/logout', 'user validation failed', req._remoteAddress);
    res.status(401).send('unauthorised');
  } else {
    delete req.session.userId;
    res.status(200).send('success');
  }
});

//ajax calls post method
app.post('/post/addToCart', function (req, res) {
  if (!validateUser(req)) {
    logger.info('/post/addToCart', 'user validation failed', req._remoteAddress);
    res.status(401).send('unauthorised');
  } else {
    var bookId=req.body.bookId;
    sqlConnection.query('INSERT INTO cart(userId, bookId) VALUES(' + req.session.userId + ', ' + sqlConnection.escape(bookId) + ')', function (err, result, fields) {
      if (err) {
        logger.error('/post/addToCart', err, req._remoteAddress);
        res.status(400).send('bad request');
      } else if (result.affectedRows === 1) {
        res.status(200).send('success');
      } else {
        res.status(500).send('internal server error');
      }
    });
  }
});
app.post('/post/pay', function (req, res) {
  if (!validateUser(req)) {
    logger.info('/post/pay', 'user validation failed', req._remoteAddress);
    res.status(401).send('unauthorised');
  } else {
    sqlConnection.query('INSERT INTO orders(userId, bookId) SELECT userId, bookId FROM cart WHERE userId = ' + req.session.userId, function (err, result, fields) {
      if (err) {
        logger.error('/post/pay-query1', err, req._remoteAddress);
        res.status(400).send('bad request');
      } else if (result.affectedRows === 1) {
        sqlConnection.query('DELETE FROM cart WHERE userId = ' + req.session.userId, function (err2, result2, fields2) {
          if (err2) {
            logger.error('/post/pay-query2', err2, req._remoteAddress);
            res.status(400).send('bad request');
          } else if (result2.affectedRows === 1) {
            res.status(200).send('success');
          } else {
            res.status(500).send('internal server error');
          }
        });
      } else {
        res.status(500).send('internal server error');
      }
    });
  }
});
app.post('/post/passwordChange', function (req, res) {
  if (!validateUser(req)) {
    logger.info('/post/passwordChange', 'user validation failed', req._remoteAddress);
    res.status(401).send('unauthorised');
  } else {
    var oldPassword=req.body.oldPassword;
    var newPassword=req.body.newPassword;
    var query = 'UPDATE user SET password = ' + sqlConnection.escape(newPassword)
                  + ' WHERE password = ' + sqlConnection.escape(oldPassword)
                  + ' AND id = ' + req.session.userId;
    sqlConnection.query(query, function (err, result, fields) {
      if (err){
        logger.error('/post/passwordChange', err, req._remoteAddress);
        res.status(400).send('bad data');
      }else {
        res.status(200).send(result.affectedRows == 1 ? 'success' : 'failed');
      }
    });
  }
});
app.post('/post/login', function (req, res) {
  var username=req.body.username;
  var password=req.body.password;
  var query = 'SELECT id FROM user WHERE name = ' + sqlConnection.escape(username) + ' AND password = ' + sqlConnection.escape(password);
  sqlConnection.query(query, function (err, result) {
    if (err) {
      logger.error('/post/login', err, req._remoteAddress);
      res.status(400).send('bad request');
    } else {
      if (result.length != 0) {
        req.session.userId = result[0].id;
        res.status(200).send('user found');
      } else {
        res.status(401).send('user not found');
      }
    }
  });
});
app.post('/post/register', function (req, res) {
  var username=req.body.username;
  var password=req.body.password;
  var securityQuestion=req.body.securityQuestion;
  var answer=req.body.answer;
  var arguments = {
    name: sqlConnection.escape(username),
    securityQuestion: sqlConnection.escape(securityQuestion),
    answer: sqlConnection.escape(answer),
    password: sqlConnection.escape(password)
  };
  sqlConnection.query('INSERT INTO user SET ?', arguments, function (err, result, fields) {
    if (err) {
      logger.error('/post/register', err, req._remoteAddress);
      res.status(500).send('internal server error');
    }else {
      req.session.userId = result.insertid;
      res.status(200).send('logged in and registered');
    }
  });
});
app.post('/post/passwordReset', function (req, res) {
  var username=req.body.username;
  var securityQuestion=req.body.securityQuestion;
  var answer=req.body.answer;
  var password=req.body.password;
  var query = 'UPDATE user SET password = ' + sqlConnection.escape(password)
              + ' WHERE name = ' + sqlConnection.escape(username)
              + ' AND securityQuestion = ' + sqlConnection.escape(securityQuestion)
              + ' AND answer = ' + sqlConnection.escape(answer);
  sqlConnection.query(query, function (err, result,fields) {
    if (err) {
      logger.error('/post/passwordReset', err, req._remoteAddress);
      res.status(400).send('bad request');
    } else if (result.affectedRows === 1) {
      res.status(200).send('success');
    } else {
      res.status(500).send('internal server error');
    }
  });
});
app.post('/post/deleteCartItem', function (req, res) {
  if (!validateUser(req)) {
    logger.info('/post/deleteCartItem', 'user validation failed', req._remoteAddress);
    res.status(401).send('unauthorised');
  } else {
    var bookId=req.body.bookId;
    sqlConnection.query('DELETE FROM cart WHERE userId = ' + req.session.userId + ' AND bookId = ' + sqlConnection.escape(bookId), function (err, result, fields) {
      if (err) {
        logger.error('/post/deleteCartItem', err, req._remoteAddress);
        res.status(400).send('bad request');
      } else if (result.affectedRows === 1) {
        res.status(200).send('success');
      } else {
        res.status(500).send('internal server error');
      }
    });
  }
});

//GET logs
app.get('/log', function (req, res) {
  res.send(logFiller(logger.data));
});
app.get('/accessLog', function (req, res) {
  var content=fs.readFileSync('access.log', 'utf8');
  res.send(logFiller(content.split('\n').join('<br>')));
});

//make the server to listen at the port
app.listen(port, '192.168.0.100', function () {
  logger.log(`Ebook Management System app is listening on port ${port}!`);
});
