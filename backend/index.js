const express = require('express');
const path = require('path');
const mysql = require('mysql2');
const bcrypt = require('bcrypt'); // Ajoutez cette ligne

const app = express();
const port = 3000;

// Configuration de la base de données
const db = mysql.createConnection({
    host: 'localhost',
    user: 'imene',
    password: 'Imeneimene123.',
    database: 'PolyBDD'
});

// ...

app.post('/login', (req, res) => {
    const { username, password, role } = req.body;

    // Vérifier le rôle et exécuter la requête SQL appropriée
    let query = '';
    if (role === 'professeur') {
        query = 'SELECT * FROM professor WHERE username = ?';
    } else if (role === 'etudiant') {
        query = 'SELECT * FROM student WHERE username = ?';
    } else {

    }

    // Exécuter la requête SQL
    db.query(query, [username], (err, results) => {
        if (err) {
            console.error('Erreur lors de la connexion :', err);
            res.status(500).json({ error: 'Erreur serveur' });
        } else {
            // Vérifier si des résultats ont été renvoyés
            if (results.length > 0) {
                const user = results[0];

                // Comparer le mot de passe haché avec le mot de passe fourni
                bcrypt.compare(password, user.password_hash, (compareErr, isMatch) => {
                    if (compareErr) {
                        console.error('Erreur lors de la comparaison des mots de passe :', compareErr);
                        res.status(500).json({ error: 'Erreur serveur' });
                    } else {
                        if (isMatch) {
                            // L'utilisateur est authentifié avec succès
                            // Rediriger ou renvoyer une réponse selon besoins
                            res.json({ success: true, message: 'Connexion réussie' });
                        } else {
                            // Les informations d'identification ne correspondent pas
                            res.status(401).json({ error: 'Nom d\'utilisateur ou mot de passe incorrect' });
                        }
                    }
                });
            } else {
                // Nom d'utilisateur non trouvé
                res.status(401).json({ error: 'Nom d\'utilisateur ou mot de passe incorrect' });
            }
        }
    });
});



// Pages

app.get('/dashboard-professeur', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboardprof.html'));
});

app.get('/dashboard-etudiant', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboardetu.html'));
});

app.get('/accueil', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'accueil.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});


// Style et images 

app.get('/style', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'style.css'));
});

app.get('/logo', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'logo.png'));
});

app.get('/backgroundlogin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'backgroundlogin.png'));
});


// Écoute du serveur
app.listen(port, () => {
    console.log(`Serveur en cours d'exécution sur http://localhost:${port}`);
});
