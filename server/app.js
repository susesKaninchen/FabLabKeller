const express = require('express');
const bodyParser = require('body-parser');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');
const MongoStore = require('connect-mongo')(session);
const mongoose = require('mongoose');
const flash = require('connect-flash');
const { ensureAuthenticated } = require('./auth');
const path = require('path');
const bcrypt = require('bcrypt');
const cron = require('node-cron');
const nodemailer = require('nodemailer');
const emailGen = require('./emailTexte.js');
require('dotenv').config();

// Datenbankverbindung herstellen
mongoose.connect(process.env.MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true });
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB-Verbindungsfehler:'));
db.once('open', function () {
    console.log('MongoDB-Verbindung hergestellt');
});

// Datenbank-Schemas definieren
const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    }
});

userSchema.methods.comparePassword = function (password, callback) {
    if (password == this.password) {
        callback(null, true);
    } else {
        callback(null, false);
    }
};

const itemSchema = new mongoose.Schema({
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    storageDuration: {
        type: Number,
        default: 365
    },
    storageLocation: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: false
    }
});

const User = mongoose.model('User', userSchema);
const Item = mongoose.model('Item', itemSchema);

// Passport-Authentifizierung konfigurieren
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    User.findById(id)
        .then(user => {
            done(null, user);
        })
        .catch(err => {
            done(err, null);
        });
});

// Express-App konfigurieren
const app = express();
app.use(flash());
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: false }));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: new MongoStore({ mongooseConnection: mongoose.connection })
}));

passport.use(new LocalStrategy({ usernameField: 'email' }, (email, password, done) => {
    User.findOne({ email: email })
        .then((user) => {
            if (!user) {
                console.log("User nicht gefunden");
                return done(null, false, { message: 'Incorrect email or password.' });
            }
            user.comparePassword(password, (err, isMatch) => {
                if (err) {
                    console.log("compareError");
                    return done(err);
                }
                if (!isMatch) {
                    console.log("faslches PW");
                    return done(null, false, { message: 'Incorrect email or password.' });
                }
                console.log("anserd");
                return done(null, user);
            });
        })
        .catch((err) => {
            return done(err);
        });
}));

app.use(passport.initialize());
app.use(passport.session());

// Pfad zum Ordner mit statischen Dateien
app.use(express.static(__dirname + '/../public'));

// Routen definieren
app.post('/signup', (req, res, next) => {
    const { email, password } = req.body;
    User.findOne({ email: email })
        .then((user) => {
            if (user) {
                req.flash('error', 'email already exists');
                return res.redirect('/signup.html');
            }
            const newUser = new User({
                email: email,
                password: password
            });
            return newUser.save();
        })
        .then(() => {
            req.flash('success', 'Account created. Please log in.');
            return res.redirect('/login');
        })
        .catch((err) => {
            return next(err);
        });
});

app.get('/login', (req, res) => {
    res.render('login');
});
app.post('/login', passport.authenticate('local', {
    successRedirect: '/items',
    failureRedirect: '/login',
    failureFlash: true
}));
app.get('/logout', (req, res) => {
    req.logout(function (err) {
        if (err) { return next(err); }
        res.redirect('/');
    });
});

app.get('/profile', ensureAuthenticated, (req, res, next) => {
    Item.countDocuments({ owner: req.user.id }).then((count) => {
        res.render('profile', { user: req.user, itemCount: count });
    }).catch((err) => {
        return next(err);
    });
});

app.get('/items', ensureAuthenticated, (req, res) => {
    Item.find({ owner: req.user.id }).then((items) => {
        res.render('items', { items: items, email: req.user.email });
    }).catch((err) => {
        return next(err);
    });
});
app.get('/items/new', ensureAuthenticated, (req, res) => {
    res.render('new-item', { email: req.user.email });
});

// POST route to create a new item
app.post('/items', ensureAuthenticated, (req, res) => {
    const item = new Item({
        owner: req.user.id,
        createdAt: new Date(),
        storageDuration: req.body.duration,
        storageLocation: req.body.location,
        name: req.body.name,
        description: req.body.description
    });
    item.save()
        .then(() => {
            res.redirect('/items');
        })
        .catch((err) => {
            res.status(500).send(err.message);
        });
});

// GET route für Item-Bearbeitungsseite
app.get('/items/:id/edit', ensureAuthenticated, (req, res, next) => {
    Item.findById(req.params.id)
        .then((item) => {
            if (!item) {
                return res.status(404).send('Item not found');
            }
            res.render('edit-item', { item: item });
        })
        .catch((err) => {
            return next(err);
        });
});

// POST route für Item-Aktualisierung
app.post('/items/:id', ensureAuthenticated, (req, res, next) => {
    Item.findById(req.params.id)
        .then((item) => {
            if (!item) {
                return res.status(404).send('Item not found');
            }

            // Aktualisiere die Eigenschaften des Items
            item.name = req.body.name;
            item.description = req.body.description;
            item.storageDuration = req.body.storageDuration;
            item.storageLocation = req.body.storageLocation;

            // Speichere das aktualisierte Item in der Datenbank
            return item.save();
        })
        .then(() => {
            req.flash('success_msg', 'Item erfolgreich aktualisiert');
            res.redirect('/items');
        })
        .catch((err) => {
            return next(err);
        });
});

// DELETE route für Item-Löschung
app.delete('/items/:id', ensureAuthenticated, (req, res, next) => {
    Item.findByIdAndDelete(req.params.id)
        .then(() => {
            req.flash('success_msg', 'Item erfolgreich gelöscht');
            res.status(200).json({ message: 'ok' });
        })
        .catch((err) => {
            return next(err);
        });
});

// POST route für Item-Verlängerung
app.post('/items/:id/extend', ensureAuthenticated, (req, res, next) => {
    Item.findById(req.params.id)
        .then((item) => {
            if (!item) {
                return res.status(404).send('Item not found');
            }

            // Setze das Datum des Items auf heute
            item.createdAt = new Date();

            // Speichere das aktualisierte Item in der Datenbank
            return item.save();
        })
        .then(() => {
            req.flash('success_msg', 'Item erfolgreich verlängert');
            res.redirect('/items');
        })
        .catch((err) => {
            return next(err);
        });
});

// GET Route für die Löschseite
app.get('/delete-account', async (req, res) => {
    try {
      // Finde alle Gegenstände des Benutzers
      const items = await Item.find({ owner: req.user._id });
      // Render die Löschseite und gebe die Gegenstände als Daten mit
      res.render('delete', { items });
    } catch (err) {
      console.error(err);
      res.status(500).send('Interner Serverfehler');
    }
  });
  
  // POST Route für das Löschen des Accounts
  app.post('/delete-account', async (req, res) => {
    try {
      // Finde alle Gegenstände des Benutzers
      const items = await Item.find({ owner: req.user._id });
      // Prüfe, ob der Benutzer noch Gegenstände in der Lagerung hat
      if (items.length > 0) {
        res.render('delete', { items, errorMessage: 'Bitte hole zuerst alle Gegenstände aus der Lagerung, bevor du deinen Account löschst.' });
      } else {
        // Lösche den Benutzer und alle seine Gegenstände aus der Datenbank
        await Promise.all([
          User.findByIdAndDelete(req.user._id),
          Item.deleteMany({ owner: req.user._id })
        ]);
        req.logout(); // Logge den Benutzer aus
        res.redirect('/'); // Weiterleitung zur Startseite
      }
    } catch (err) {
      console.error(err);
      res.status(500).send('Interner Serverfehler');
    }
  });
  

cron.schedule('0 7 * * *', async () => {
    console.log("crown");
    // Berechne das Datum, welches 30 Tage in der Zukunft liegt
    const thresholdDate = new Date();
    const itemstem = await Item.find().populate('owner');
    // Erstelle einen Nodemailer-Transport
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD
        }
      });
    // Iteriere über alle Items und sende eine E-Mail an den Besitzer
    itemstem.forEach(async (item) => {
        remainingDays=Math.round((new Date(item.createdAt.getTime() + item.storageDuration * 24 * 60 * 60 *
          1000) - new Date()) / (24 * 60 * 60 * 1000));
        if (remainingDays == 30 || remainingDays == 7 || remainingDays == 1){
            const mailOptions = {
                from: process.env.SMTP_USER,
                to: 'gabrecht@fablab-luebeck.de',
                subject: `FabLab-Lager: ${item.name} darf nur noch 30 Tage gelagert werden`,
                html: emailGen.createEmail(item, remainingDays, process.env.WEB_URL)
            };
            await transporter.sendMail(mailOptions);
        } else if (remainingDays == 0) {
            const mailOptions = {
                from: process.env.SMTP_USER,
                to: 'gabrecht@fablab-luebeck.de',
                subject: `FabLab-Lager: Die Zeit ist um für ${item.name}`,
                html: emailGen.createEmail(item, remainingDays, process.env.WEB_URL)
            };
            await transporter.sendMail(mailOptions);
            const mailOptions2 = {
                from: process.env.SMTP_USER,
                to: process.env.SMTP_USER,
                subject: `FabLab-Lager: Die Zeit ist um für ${item.name}, von ${item.owner.email}`,
                html: emailGen.createEmail(item, remainingDays, process.env.WEB_URL)
            };
            await transporter.sendMail(mailOptions2);
        } else if (remainingDays < 0) {
            const mailOptions = {
                from: process.env.SMTP_USER,
                to: 'gabrecht@fablab-luebeck.de',
                subject: `FabLab-Lager: Die Zeit ist um für ${item.name}`,
                html: emailGen.createEmail(item, remainingDays, process.env.WEB_URL)
            };
            await transporter.sendMail(mailOptions);
        }
    });
});

// start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});