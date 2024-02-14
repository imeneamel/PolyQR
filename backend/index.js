/**
 * Module principal de l'application.
 * @module app
 */

const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');

const app = express();
const port = 3000;

// Middleware pour parser les requêtes URL encodées et JSON
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Configuration de la base de données
const db = mysql.createConnection({
    host: 'localhost',
    user: 'imene',
    password: 'Imeneimene123.',
    database: 'PolyBDD'
});


/**
 * Fonction pour gérer la connexion des utilisateurs.
 * @name Connexion
 * @route {POST} /signin
 * @param {string} email - L'adresse e-mail de l'utilisateur.
 * @param {string} pass - Le mot de passe de l'utilisateur.
 * @returns {Object} - Redirige vers le tableau de bord de l'utilisateur ou renvoie une erreur d'authentification.
 */
app.post('/signin', (req, res) => {
    const { email, pass } = req.body;

     // Vérifier si l'utilisateur vient de la page /presqr
     const isFromPresQR = req.headers.referer && req.headers.referer.includes('/presqr');

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

                                            if (isFromPresQR) {
                                                // Marquer l'élève comme présent dans la table de présence
                                                const courseId = extractCourseIdFromURL(req.headers.referer);
                                                markStudentPresent(user.user_id, courseId);
                                            }

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


/**
 * Fonction pour extraire l'ID du cours à partir de l'URL de référence.
 * @name extractCourseIdFromURL
 * @function
 * @param {string} referer - L'URL de référence.
 * @returns {string} - L'ID du cours extrait de l'URL.
 */
const extractCourseIdFromURL = (referer) => {
    const url = new URL(referer);
    const courseIdParam = url.searchParams.get('courseId');
    return courseIdParam;
};

/**
 * Fonction pour marquer l'élève comme présent dans la table de présence.
 * @name markStudentPresent
 * @function
 * @param {string} studentId - L'ID de l'étudiant.
 * @param {string} courseId - L'ID du cours.
 */
const markStudentPresent = (studentId, courseId) => {
    const insertQuery = 'INSERT INTO presence (student_id, course_id, is_present) VALUES (?, ?, ?)';
    const values = [studentId, courseId, true];

    db.query(insertQuery, values, (insertErr, insertResults) => {
        if (insertErr) {
            console.error('Erreur lors de l\'insertion de la présence :', insertErr);
        } else {
            console.log('Étudiant marqué présent avec succès.');
        }
    });
};



/**
 * Fonction pour gérer l'inscription des utilisateurs.
 * @name Inscription
 * @route {POST} /signup
 * @param {string} username - Le nom d'utilisateur.
 * @param {string} pass - Le mot de passe.
 * @param {string} mail - L'adresse e-mail.
 * @param {string} status - Le statut de l'utilisateur (professeur ou étudiant).
 * @param {string} eventId - L'ID de l'événement.
 * @returns {Object} - Redirige vers le tableau de bord de l'utilisateur nouvellement inscrit ou renvoie une erreur.
 */
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
                console.log('requete : ', insertUserQuery);
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

/**
 * Endpoint pour la modification des informations utilisateur.
 * @param {Object} req - Requête HTTP (Express).
 * @param {Object} res - Réponse HTTP (Express).
 */
app.post('/modification', async (req, res) => {
    const { username, pass, confirmPass, mail } = req.body;
    console.log('Données reçues du formulaire :', req.body);

    // Récupérer l'ID de l'utilisateur depuis la route
    var currentUrl = req.get('Referer');
    var match = currentUrl.match(/\/profile\/(\d+)/);

    // Vérifier si la correspondance a été trouvée
    if (!match || !match[1]) {
        return res.status(400).json({ error: 'ID utilisateur non trouvé dans l\'URL' });
    }

    var userId = match[1];
    var status; // Déclarer la variable status à l'extérieur de la condition

    // Récupérer les informations mises à jour de l'utilisateur
    const updatedUserQuery = 'SELECT * FROM professor WHERE user_id = ?';
    const [updatedUserResults] = await db.promise().query(updatedUserQuery, [userId]);

    // Vérifier si des résultats ont été obtenus
    if (updatedUserResults && updatedUserResults.length > 0) {
        // L'utilisateur a été trouvé dans la table professor
        status = 'professeur';
    } else {
        // L'utilisateur n'a pas été trouvé dans la table professor, vérifier dans la table student
        const studentUserQuery = 'SELECT * FROM student WHERE user_id = ?';
        const [studentUserResults] = await db.promise().query(studentUserQuery, [userId]);

        if (studentUserResults && studentUserResults.length > 0) {
            // L'utilisateur a été trouvé dans la table student
            status = 'étudiant';
        } else {
            // Aucun résultat trouvé dans les deux tables, gérer l'erreur
            console.error('Aucune information mise à jour trouvée pour l\'utilisateur');
            return res.status(404).json({ error: 'Aucune information mise à jour trouvée pour l\'utilisateur' });
        }
    }

    // Vérifier si les mots de passe correspondent
    if (pass !== confirmPass) {
        return res.status(400).json({ error: 'Les mots de passe ne correspondent pas' });
    }

    try {
        console.log('ID utilisateur récupéré :', userId);

        // Modifier l'utilisateur dans la base de données
        const updateUserQuery = (status === 'professeur') ? 'UPDATE professor SET username = ?, email = ?, password_hash = ? WHERE user_id = ?' : 'UPDATE student SET username = ?, email = ?, password_hash = ? WHERE user_id = ?';

        console.log('Requête SQL pour mettre à jour l\'utilisateur :', updateUserQuery);

        const queryParams = [username, mail];

        if (pass) {
            const hashedPassword = await bcrypt.hash(pass, 10);
            queryParams.push(hashedPassword);
        }

        queryParams.push(userId);

        await db.promise().query(updateUserQuery, queryParams);

        // Récupérer les informations mises à jour de l'utilisateur
        const updatedUserQuery = (status === 'professeur') ? 'SELECT * FROM professor WHERE user_id = ?' : 'SELECT * FROM student WHERE user_id = ?';

        const [updatedUserResults] = await db.promise().query(updatedUserQuery, [userId]);

        // Vérifier si des résultats ont été obtenus
        if (updatedUserResults && updatedUserResults.length > 0) {
            // Rediriger vers le tableau de bord approprié avec l'identifiant unique
            const dashboardRoute = (status === 'professeur') ? `/dashboard-professeur/${userId}` : `/dashboard-etudiant/${userId}`;

            // Rediriger vers la page de profil avec les informations préremplies dans les champs
            res.redirect(`/profile/${userId}?username=${updatedUserResults[0].username}&email=${updatedUserResults[0].email}`);
        } else {
            // Gérer le cas où aucun résultat n'a été trouvé
            console.error('Aucune information mise à jour trouvée pour l\'utilisateur');
            res.status(404).json({ error: 'Aucune information mise à jour trouvée pour l\'utilisateur' });
        }

    } catch (error) {
        console.error('Erreur lors de la modification des informations :', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Route pour récupérer les données de présence d'un professeur spécifique
app.get('/api/attendance/:professorId', (req, res) => {
    const professorId = req.params.professorId;

    // Effectuer une requête à la base de données pour récupérer les données de présence
    db.query('SELECT * FROM attendance WHERE course_id IN (SELECT course_id FROM course WHERE professor_id = ?)', [professorId], (error, results) => {
        if (error) {
            console.error('Erreur lors de la récupération des données de présence :', error);
            res.status(500).json({ error: 'Erreur lors de la récupération des données de présence' });
        } else {
            res.json(results);
        }
    });
});


/**
 * Endpoint pour récupérer les cours et événements passés d'un utilisateur.
 * @param {Object} req - Requête HTTP (Express).
 * @param {Object} res - Réponse HTTP (Express).
 */
app.get('/api/past-events/:userId', (req, res) => {
    const userId = req.params.userId;

    // Requête SQL pour récupérer les cours et événements passés de l'utilisateur
    // A vérifier pour les injections SQL
    const pastEventsQuery = `
        SELECT title, description, eventdate AS date, start_time AS time FROM course
        WHERE professor_id = ? AND (eventdate < CURRENT_DATE OR (eventdate = CURRENT_DATE AND end_time < CURRENT_TIME()))
        UNION
        SELECT title, description, eventdate AS date, start_time AS time FROM event
        WHERE organizer_id = ? AND end_time < NOW();   
    `;

    db.query(pastEventsQuery, [userId, userId], (err, results) => {
        if (err) {
            console.error('Erreur lors de la récupération des cours et événements passés :', err);
            res.status(500).json({ error: 'Erreur serveur' });
        } else {
            res.json(results);
        }
    });
});


/**
 * Endpoint pour récupérer les cours et événements à venir d'un utilisateur.
 * @param {Object} req - Requête HTTP (Express).
 * @param {Object} res - Réponse HTTP (Express).
 */
app.get('/api/upcoming-events/:userId', (req, res) => {
    const userId = req.params.userId;

    // Requête SQL pour récupérer les cours et événements passés de l'utilisateur
    // A vérifier pour les injections SQL
    const pastEventsQuery = `
        SELECT title, description, eventdate AS date, start_time AS time FROM course
        WHERE professor_id = ? AND (eventdate > CURRENT_DATE OR (eventdate = CURRENT_DATE AND end_time > CURRENT_TIME()))
        UNION
        SELECT title, description, eventdate AS date, start_time AS time FROM event
        WHERE organizer_id = ? AND end_time > NOW();   
    `;

    db.query(pastEventsQuery, [userId, userId], (err, results) => {
        if (err) {
            console.error('Erreur lors de la récupération des cours et événements passés :', err);
            res.status(500).json({ error: 'Erreur serveur' });
        } else {
            res.json(results);
        }
    });
});






/**
 * Page du tableau de bord d'un professeur.
 * @param {Object} req - Requête HTTP (Express).
 * @param {Object} res - Réponse HTTP (Express).
 */
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


/**
 * Page du tableau de bord d'un étudiant.
 * @param {Object} req - Requête HTTP (Express).
 * @param {Object} res - Réponse HTTP (Express).
 */
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

/**
 * Page d'accueil.
 * @param {Object} req - Requête HTTP (Express).
 * @param {Object} res - Réponse HTTP (Express).
 */
app.get('/accueil', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'accueil.html'));
});

/**
 * Page de connexion.
 * @param {Object} req - Requête HTTP (Express).
 * @param {Object} res - Réponse HTTP (Express).
 */
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});



/**
 * Endpoint pour générer une URL unique.
 * @param {string} id - Identifiant.
 * @param {string} title - Titre.
 * @param {string} date - Date.
 * @param {string} time - Heure.
 * @returns {string} URL unique générée.
 */
const generateUniqueURL = (id, title, date, time) => {
    // Implémentation de votre logique pour générer l'URL unique
    return `${id}-${title}-${date}-${time}`;
};

/**
 * Redirection vers une URL unique générée menant vers l'affichage du QR Code.
 * @param {Object} req - Requête HTTP (Express).
 * @param {Object} res - Réponse HTTP (Express).
 */
app.get('/presqr', (req, res) => {
    const { id, title, date, time } = req.query;

    // Utilisez la fonction de génération d'URL avec les paramètres de requête
    const uniqueURL = generateUniqueURL(id, title, date, time);

    // Redirigez vers l'URL générée
    res.redirect(`/presqr/${uniqueURL}`);
});


/**
 * Page de profil utilisateur.
 * @param {Object} req - Requête HTTP (Express).
 * @param {Object} res - Réponse HTTP (Express).
 */
app.get('/profile/:id', (req, res) => {
    const userId = req.params.id;
    // Récupérer les données spécifiques à l'utilisateur dans la base de données
    const getUserDataQuery = 'SELECT * FROM professor WHERE user_id = ? UNION SELECT * FROM student WHERE user_id = ?';
    db.query(getUserDataQuery, [userId, userId], (err, results) => {
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
                    res.sendFile(path.join(__dirname, 'public', 'profile.html'));
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


/**
 * Page des événements.
 * @param {Object} req - Requête HTTP (Express).
 * @param {Object} res - Réponse HTTP (Express).
 */
app.get('/events/:id', (req, res) => {
    const userId = req.params.id;
    // Récupérer les données spécifiques à l'utilisateur dans la base de données
    const getUserDataQuery = 'SELECT * FROM professor WHERE user_id = ? UNION SELECT * FROM student WHERE user_id = ?';
    db.query(getUserDataQuery, [userId, userId], (err, results) => {
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
                    res.sendFile(path.join(__dirname, 'public', 'events.html'));
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


// Style et images 

/**
 * Récupération du fichier de style CSS.
 * @param {Object} req - Requête HTTP (Express).
 * @param {Object} res - Réponse HTTP (Express).
 */
app.get('/style', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'style.css'));
});

/**
 * Récupération du logo.
 * @param {Object} req - Requête HTTP (Express).
 * @param {Object} res - Réponse HTTP (Express).
 */
app.get('/logo', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'logo.png'));
});

/**
 * Récupération du background connexion.
 * @param {Object} req - Requête HTTP (Express).
 * @param {Object} res - Réponse HTTP (Express).
 */
app.get('/backgroundlogin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'backgroundlogin.png'));
});


/**
 * Écoute du serveur.
 */
app.listen(port, () => {
    console.log(`Serveur en cours d'exécution sur http://localhost:${port}`);
});
