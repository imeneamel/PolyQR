const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');

const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Configuration de la base de données
const db = mysql.createConnection({
    host: 'localhost',
    user: 'imene',
    password: 'Imeneimene123.',
    database: 'PolyBDD'
});


// Connexion
app.post('/signin', (req, res) => {
    const { email, pass } = req.body;

    // Première requête pour obtenir le nom de la table
    db.query('SELECT role FROM professor WHERE email = ? UNION SELECT role FROM student WHERE email = ?', [email, email], (roleErr, roleResults) => {
        if (roleErr) {
            console.error('Erreur lors de la récupération du rôle :', roleErr);
            res.status(500).json({ error: 'Erreur serveur' });
        } else {
            if (roleResults.length > 0) {
                // Utiliser le nom de la première table trouvée comme rôle
                const role = roleResults[0].role;

                // Deuxième requête pour vérifier les informations d'identification
                db.query('SELECT user_id, email, password_hash as password_hash FROM ?? WHERE email = ?', [role, email], (err, results) => {
                    if (err) {
                        console.error('Erreur lors de la connexion :', err);
                        res.status(500).json({ error: 'Erreur serveur1' });
                    } else {
                        console.log('Résultats de la deuxième requête:', results); // Ajout de ce log
                        // Comparer le mot de passe haché avec le mot de passe fourni
                        if (results.length > 0) {
                            const user = results[0];
                            if (user.password_hash) {
                                bcrypt.compare(pass, user.password_hash, (compareErr, isMatch) => {
                                    if (compareErr) {
                                        console.log('Mot de passe fourni :', pass);
                                        console.log('Mot de passe haché dans la base de données :', user.password_hash);
                                        console.log('Résultat de la comparaison :', isMatch);
                                        console.error('Erreur lors de la comparaison des mots de passe :', compareErr);
                                        res.status(500).json({ error: 'Erreur serveur2' });
                                    } else {
                                        if (isMatch) {
                                            // L'utilisateur est authentifié avec succès
                                            // Rediriger vers le tableau de bord approprié
                                            const dashboardRoute = (role === 'professor') ? `/dashboard-professeur/${user.user_id}` : `/dashboard-etudiant/${user.user_id}`;
                                            res.redirect(dashboardRoute);
                                        } else {
                                            // Les informations d'identification ne correspondent pas
                                            res.status(401).json({ error: 'Nom d\'utilisateur ou mot de passe incorrect' });
                                        }
                                    }
                                });
                            } else {
                                res.status(401).json({ error: 'Nom d\'utilisateur ou mot de passe incorrect' });
                            }
                        } else {
                            // Nom d'utilisateur non trouvé
                            res.status(401).json({ error: 'Nom d\'utilisateur ou mot de passe incorrect' });
                        }
                    }
                });
            } else {
                // Aucun utilisateur trouvé avec cet e-mail
                res.status(401).json({ error: 'Nom d\'utilisateur ou mot de passe incorrect' });
            }
        }
    });
});




// Inscription
app.post('/signup', async (req, res) => {
    const { username, pass, mail, status, eventId } = req.body;

    // Vérifier si l'utilisateur existe déjà
    const userExistsQuery = (status === 'professeur') ? 'SELECT * FROM professor WHERE username = ?' : 'SELECT * FROM student WHERE username = ?';

    db.query(userExistsQuery, [username], async (userErr, userResults) => {
        if (userErr) {
            console.error('Erreur lors de la vérification de l\'existence de l\'utilisateur :', userErr);
            res.status(500).json({ error: 'Erreur serveur' });
        } else {
            if (userResults.length > 0) {
                res.status(409).json({ error: 'Nom d\'utilisateur déjà utilisé' });
            } else {
                // Hacher le mot de passe
                const hashedPassword = await bcrypt.hash(pass, 10);

                // Insérer l'utilisateur dans la base de données
                const insertUserQuery = (status === 'professeur') ? 'INSERT INTO professor (username, password_hash, name, email) VALUES (?, ?, ?, ?)' : 'INSERT INTO student (username, password_hash, name, email) VALUES (?, ?, ?, ?)';

                db.query(insertUserQuery, [username, hashedPassword, username, mail], (insertErr, result) => {
                    if (insertErr) {
                        console.error('Erreur lors de l\'inscription :', insertErr);
                        res.status(500).json({ error: 'Erreur serveur' });
                    } else {
                        // Récupérer l'identifiant unique généré lors de l'inscription
                        const user_id = result.insertId;

                        // Rediriger vers le tableau de bord approprié avec l'identifiant unique
                        const dashboardRoute = (status === 'professeur') ? `/dashboard-professeur/${user_id}` : `/dashboard-etudiant/${user_id}`;
                        res.redirect(dashboardRoute);
                    }
                });
            }
        }
    });
});


// Pages

app.get('/dashboard-professeur/:id', (req, res) => {
    const userId = req.params.id;

    // Récupérer les données spécifiques à l'utilisateur dans la base de données
    const getUserDataQuery = 'SELECT * FROM professor WHERE user_id = ?';
    db.query(getUserDataQuery, [userId], (err, results) => {
        if (err) {
            console.error('Erreur lors de la récupération des données utilisateur :', err);
            res.status(500).send('Erreur serveur');
        } else {
            // Vérifier si des résultats ont été renvoyés
            if (results.length > 0) {
                const userData = results[0];

                // Vérifier l'authenticité de l'utilisateur (ajuster cette logique selon vos besoins)
                const userIsAuthorized = true;

                if (userIsAuthorized) {
                    // Envoyer la page du tableau de bord avec les données spécifiques à l'utilisateur
                    res.sendFile(path.join(__dirname, 'public', 'dashboardprof.html'));
                } else {
                    res.status(403).send('Accès non autorisé');
                }
            } else {
                // Aucun utilisateur trouvé avec cet ID
                res.status(404).send('Utilisateur non trouvé');
            }
        }
    });
});

app.get('/dashboard-etudiant/:id', (req, res) => {
    const userId = req.params.id;

    // Récupérer les données spécifiques à l'utilisateur dans la base de données
    const getUserDataQuery = 'SELECT * FROM student WHERE user_id = ?';
    db.query(getUserDataQuery, [userId], (err, results) => {
        if (err) {
            console.error('Erreur lors de la récupération des données utilisateur :', err);
            res.status(500).send('Erreur serveur');
        } else {
            // Vérifier si des résultats ont été renvoyés
            if (results.length > 0) {
                const userData = results[0];

                // Vérifier l'authenticité de l'utilisateur (ajuster cette logique selon vos besoins)
                const userIsAuthorized = true;

                if (userIsAuthorized) {
                    // Envoyer la page du tableau de bord avec les données spécifiques à l'utilisateur
                    res.sendFile(path.join(__dirname, 'public', 'dashboardetu.html'));
                } else {
                    res.status(403).send('Accès non autorisé');
                }
            } else {
                // Aucun utilisateur trouvé avec cet ID
                res.status(404).send('Utilisateur non trouvé');
            }
        }
    });
});


app.get('/accueil', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'accueil.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/events', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'events.html'));
});

app.get('/profile', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'profile.html'));
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
