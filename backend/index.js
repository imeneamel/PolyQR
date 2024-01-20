const express = require('express');
const path = require('path');
const mysql = require('mysql2');

const app = express();
const port = 3000;

// Configuration de la base de données
const db = mysql.createConnection({
    host: 'localhost',
    user: 'imene',
    password: 'Imeneimene123.',
    database: 'PolyBDD'
});

// Vérification de la connexion à la base de données
db.connect((err) => {
    if (err) {
        console.error('Erreur de connexion à la base de données :', err);
    } else {
        console.log('Connexion à la base de données réussie');
    }
});

// Middleware pour servir des fichiers statiques depuis le répertoire 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint pour récupérer les événements passés
app.get('/api/evenements-passes', (req, res) => {
    db.query('SELECT * FROM event WHERE end_time < NOW()', (err, results) => {
        if (err) {
            console.error('Erreur lors de la récupération des événements passés :', err);
            res.status(500).json({ error: 'Erreur serveur' });
        } else {
            res.json(results);
        }
    });
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Écoute du serveur
app.listen(port, () => {
    console.log(`Serveur en cours d'exécution sur http://localhost:${port}`);
});
