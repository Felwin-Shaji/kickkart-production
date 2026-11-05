const express = require('express');
const app = express();
require('dotenv').config;
const path = require('node:path');
const session = require('express-session');
const passport = require('./config/passport');
const nocache = require('nocache');

const database = require('./config/database')
database()

const userRouter = require('./routes/userRouter')
const adminRouter = require('./routes/adminRouter')

app.use(nocache())
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 72 * 60 * 60 * 1000
    }
}))

app.use(passport.initialize());
app.use(passport.session());
app.use((req, res, next) => {
    res.locals.user = req.user || null;
    next();
})

app.set('views', [path.join(__dirname, 'views/user'), path.join(__dirname, 'views/admin')]);
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', userRouter)
app.use('/admin', adminRouter)

app.use('/admin/*', (req, res) => {
    res.status(404).render('adminErrorPage', { message: 'Page not found!' });
});

app.use("/*", (req, res) => {
    res.status(404).render("page-404")
});

app.listen(process.env.PORT || 3003, '0.0.0.0', () => {
    console.log(`Server running on port ${process.env.PORT || 3003}`);
});