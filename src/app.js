require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const path = require('path');

const lineRouter = require('./routes/line');
const facebookRouter = require('./routes/facebook');
const dashboardRouter = require('./routes/dashboard');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Parse JSON for webhooks — LINE and Facebook send JSON bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/line', lineRouter);
app.use('/facebook', facebookRouter);
app.use('/', dashboardRouter);

// 404
app.use((req, res) => res.status(404).send('Not found'));

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Server error');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  Oakwood Leads running → http://localhost:${PORT}\n`);
});

module.exports = app;
