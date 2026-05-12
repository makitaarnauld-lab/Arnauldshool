require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const http = require('http');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

app.get("/", (req, res) => {
    res.send("🚀 ArnauldSchool API fonctionne sur Render !");
});
app.get("/", (req, res) => {
    res.send("🚀 ArnauldSchool API fonctionne correctement !");
});

// ===============================
// SOCKET IO
// ===============================

const io = new Server(server, {
    cors: {
        origin: '*'
    }
});

// ===============================
// ENV
// ===============================

const PORT = process.env.PORT || 3000;

const JWT_SECRET = process.env.JWT_SECRET;

const MTN_API_USER = process.env.MTN_API_USER;
const MTN_API_KEY = process.env.MTN_API_KEY;
const MTN_SUBSCRIPTION_KEY = process.env.MTN_SUBSCRIPTION_KEY;
const MTN_TARGET_ENV = process.env.MTN_TARGET_ENV || 'sandbox';

// ===============================
// DOSSIERS
// ===============================

if (!fs.existsSync('./uploads')) {
    fs.mkdirSync('./uploads');
}

if (!fs.existsSync('./database')) {
    fs.mkdirSync('./database');
}

// ===============================
// MIDDLEWARES
// ===============================

app.use(cors());

app.use(express.json());

app.use(helmet());

app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
}));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ===============================
// SQLITE
// ===============================

const db = new sqlite3.Database('./database/arnauldschool.db');

// ===============================
// TABLES
// ===============================

db.serialize(() => {

    // USERS
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT NOT NULL,
            phone TEXT UNIQUE,
            email TEXT UNIQUE,
            password TEXT NOT NULL,
            status TEXT,
            profile_image TEXT,
            subscription_active INTEGER DEFAULT 0,
            subscription_expiry TEXT,
            points INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // COURSES
    db.run(`
        CREATE TABLE IF NOT EXISTS courses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            subject TEXT,
            level TEXT,
            description TEXT,
            pdf_url TEXT,
            thumbnail TEXT,
            is_premium INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // VIDEOS
    db.run(`
        CREATE TABLE IF NOT EXISTS videos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            subject TEXT,
            level TEXT,
            video_url TEXT,
            thumbnail TEXT,
            is_premium INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // QUIZ
    db.run(`
        CREATE TABLE IF NOT EXISTS quiz (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question TEXT,
            options TEXT,
            correct_answer TEXT,
            subject TEXT,
            level TEXT,
            points INTEGER DEFAULT 10
        )
    `);

    // QUIZ RESULTS
    db.run(`
        CREATE TABLE IF NOT EXISTS quiz_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            score INTEGER,
            total_questions INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // PAYMENTS
    db.run(`
        CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            amount REAL,
            phone_number TEXT,
            plan_duration TEXT,
            transaction_id TEXT,
            status TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // MESSAGES
    db.run(`
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_id INTEGER,
            receiver_id INTEGER,
            content TEXT,
            file_url TEXT,
            is_read INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // RESULTS
    db.run(`
        CREATE TABLE IF NOT EXISTS exam_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_name TEXT,
            matricule TEXT,
            exam_type TEXT,
            school TEXT,
            average REAL,
            result TEXT,
            pdf_url TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // NOTIFICATIONS
    db.run(`
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            title TEXT,
            message TEXT,
            is_read INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

});

// ===============================
// MULTER
// ===============================

const storage = multer.diskStorage({

    destination: (req, file, cb) => {
        cb(null, './uploads');
    },

    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage });

// ===============================
// AUTH TOKEN
// ===============================

const authenticateToken = (req, res, next) => {

    const authHeader = req.headers['authorization'];

    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {

        return res.status(401).json({
            message: 'Token requis'
        });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {

        if (err) {

            return res.status(403).json({
                message: 'Token invalide'
            });
        }

        req.user = user;

        next();
    });
};

// ===============================
// PREMIUM CHECK
// ===============================

const checkSubscription = (req, res, next) => {

    db.get(
        'SELECT subscription_active, subscription_expiry FROM users WHERE id = ?',
        [req.user.id],
        (err, user) => {

            if (err || !user) {

                return res.status(500).json({
                    message: 'Erreur serveur'
                });
            }

            if (!user.subscription_active) {

                return res.status(403).json({
                    message: 'Premium requis'
                });
            }

            const now = new Date();

            const expiry = new Date(user.subscription_expiry);

            if (expiry < now) {

                return res.status(403).json({
                    message: 'Abonnement expiré'
                });
            }

            next();
        }
    );
};

// ===============================
// REGISTER
// ===============================

app.post('/api/auth/register', async (req, res) => {

    try {

        const {
            fullName,
            phone,
            email,
            password,
            status
        } = req.body;

        if (!fullName || !password) {

            return res.status(400).json({
                message: 'Champs requis'
            });
        }

        db.get(
            'SELECT id FROM users WHERE email = ? OR phone = ?',
            [email, phone],
            async (err, row) => {

                if (row) {

                    return res.status(400).json({
                        message: 'Utilisateur existe déjà'
                    });
                }

                const hashedPassword = await bcrypt.hash(password, 10);

                db.run(
                    `
                    INSERT INTO users
                    (full_name, phone, email, password, status)
                    VALUES (?, ?, ?, ?, ?)
                    `,
                    [
                        fullName,
                        phone,
                        email,
                        hashedPassword,
                        status
                    ],
                    function(err) {

                        if (err) {

                            return res.status(500).json({
                                message: 'Erreur inscription'
                            });
                        }

                        const token = jwt.sign(
                            {
                                id: this.lastID,
                                email,
                                status
                            },
                            JWT_SECRET,
                            {
                                expiresIn: '30d'
                            }
                        );

                        res.json({
                            success: true,
                            token,
                            user: {
                                id: this.lastID,
                                fullName,
                                email,
                                status
                            }
                        });
                    }
                );
            }
        );

    } catch (error) {

        res.status(500).json({
            message: 'Erreur serveur'
        });
    }
});

// ===============================
// LOGIN
// ===============================

app.post('/api/auth/login', (req, res) => {

    const { login, password } = req.body;

    db.get(
        'SELECT * FROM users WHERE email = ? OR phone = ?',
        [login, login],
        async (err, user) => {

            if (!user) {

                return res.status(401).json({
                    message: 'Identifiants invalides'
                });
            }

            const validPassword = await bcrypt.compare(password, user.password);

            if (!validPassword) {

                return res.status(401).json({
                    message: 'Mot de passe incorrect'
                });
            }

            const token = jwt.sign(
                {
                    id: user.id,
                    email: user.email,
                    status: user.status
                },
                JWT_SECRET,
                {
                    expiresIn: '30d'
                }
            );

            delete user.password;

            res.json({
                success: true,
                token,
                user
            });
        }
    );
});

// ===============================
// PROFILE
// ===============================

app.get('/api/profile', authenticateToken, (req, res) => {

    db.get(
        'SELECT * FROM users WHERE id = ?',
        [req.user.id],
        (err, user) => {

            if (err || !user) {

                return res.status(404).json({
                    message: 'Utilisateur introuvable'
                });
            }

            delete user.password;

            res.json(user);
        }
    );
});

// ===============================
// UPLOAD
// ===============================

app.post(
    '/api/upload',
    authenticateToken,
    upload.single('file'),
    (req, res) => {

        res.json({
            success: true,
            fileUrl: `/uploads/${req.file.filename}`
        });
    }
);

// ===============================
// CREATE COURSE
// ===============================

app.post(
    '/api/courses',
    authenticateToken,
    upload.single('pdf'),
    (req, res) => {

        const {
            title,
            subject,
            level,
            description,
            isPremium
        } = req.body;

        const pdfUrl = req.file
            ? `/uploads/${req.file.filename}`
            : null;

        db.run(
            `
            INSERT INTO courses
            (title, subject, level, description, pdf_url, is_premium)
            VALUES (?, ?, ?, ?, ?, ?)
            `,
            [
                title,
                subject,
                level,
                description,
                pdfUrl,
                isPremium
            ],
            function(err) {

                if (err) {

                    return res.status(500).json({
                        message: 'Erreur création cours'
                    });
                }

                res.json({
                    success: true,
                    courseId: this.lastID
                });
            }
        );
    }
);

// ===============================
// GET COURSES
// ===============================

app.get('/api/courses', (req, res) => {

    db.all(
        'SELECT * FROM courses ORDER BY created_at DESC',
        (err, rows) => {

            if (err) {

                return res.status(500).json({
                    message: 'Erreur chargement'
                });
            }

            res.json(rows);
        }
    );
});

// ===============================
// PREMIUM COURSES
// ===============================

app.get(
    '/api/premium-courses',
    authenticateToken,
    checkSubscription,
    (req, res) => {

        db.all(
            'SELECT * FROM courses WHERE is_premium = 1',
            (err, rows) => {

                if (err) {

                    return res.status(500).json({
                        message: 'Erreur premium'
                    });
                }

                res.json(rows);
            }
        );
    }
);

// ===============================
// QUIZ
// ===============================

app.get('/api/quiz/:subject', authenticateToken, (req, res) => {

    db.all(
        'SELECT * FROM quiz WHERE subject = ? LIMIT 10',
        [req.params.subject],
        (err, rows) => {

            if (err) {

                return res.status(500).json({
                    message: 'Erreur quiz'
                });
            }

            const formatted = rows.map(q => ({
                ...q,
                options: JSON.parse(q.options)
            }));

            res.json(formatted);
        }
    );
});

// ===============================
// QUIZ SUBMIT
// ===============================

app.post('/api/quiz/submit', authenticateToken, (req, res) => {

    const { score, totalQuestions } = req.body;

    db.run(
        `
        INSERT INTO quiz_results
        (user_id, score, total_questions)
        VALUES (?, ?, ?)
        `,
        [
            req.user.id,
            score,
            totalQuestions
        ],
        (err) => {

            if (err) {

                return res.status(500).json({
                    message: 'Erreur sauvegarde'
                });
            }

            db.run(
                'UPDATE users SET points = points + ? WHERE id = ?',
                [score, req.user.id]
            );

            res.json({
                success: true,
                score
            });
        }
    );
});

// ===============================
// LEADERBOARD
// ===============================

app.get('/api/leaderboard', (req, res) => {

    db.all(
        `
        SELECT full_name, status, points
        FROM users
        ORDER BY points DESC
        LIMIT 10
        `,
        (err, rows) => {

            if (err) {

                return res.status(500).json({
                    message: 'Erreur classement'
                });
            }

            res.json(rows);
        }
    );
});

// ===============================
// MTN PAYMENT REAL API
// ===============================

app.post('/api/payments/mtn', authenticateToken, async (req, res) => {

    try {

        const {
            amount,
            phoneNumber,
            planId
        } = req.body;

        const referenceId = uuidv4();

        // ==========================
        // TOKEN
        // ==========================

        const tokenResponse = await axios.post(
            'https://sandbox.momodeveloper.mtn.com/collection/token/',
            {},
            {
                headers: {

                    Authorization:
                        'Basic ' +
                        Buffer
                            .from(`${MTN_API_USER}:${MTN_API_KEY}`)
                            .toString('base64'),

                    'Ocp-Apim-Subscription-Key':
                        MTN_SUBSCRIPTION_KEY
                }
            }
        );

        const accessToken = tokenResponse.data.access_token;

        // ==========================
        // REQUEST TO PAY
        // ==========================

        await axios.post(
            'https://sandbox.momodeveloper.mtn.com/collection/v1_0/requesttopay',
            {
                amount: amount,
                currency: 'XAF',

                externalId: Date.now().toString(),

                payer: {
                    partyIdType: 'MSISDN',
                    partyId: phoneNumber
                },

                payerMessage: 'Paiement Arnauldschool',

                payeeNote: 'Premium Arnauldschool'
            },
            {
                headers: {

                    Authorization: `Bearer ${accessToken}`,

                    'X-Reference-Id': referenceId,

                    'X-Target-Environment': MTN_TARGET_ENV,

                    'Ocp-Apim-Subscription-Key':
                        MTN_SUBSCRIPTION_KEY,

                    'Content-Type': 'application/json'
                }
            }
        );

        // ==========================
        // SAVE PAYMENT
        // ==========================

        db.run(
            `
            INSERT INTO payments
            (user_id, amount, phone_number, plan_duration, transaction_id, status)
            VALUES (?, ?, ?, ?, ?, ?)
            `,
            [
                req.user.id,
                amount,
                phoneNumber,
                planId,
                referenceId,
                'pending'
            ]
        );

        // ==========================
        // PREMIUM
        // ==========================

        const expiryDate = new Date();

        expiryDate.setDate(expiryDate.getDate() + 30);

        db.run(
            `
            UPDATE users
            SET subscription_active = 1,
            subscription_expiry = ?
            WHERE id = ?
            `,
            [
                expiryDate.toISOString(),
                req.user.id
            ]
        );

        res.json({
            success: true,
            message: 'Paiement envoyé',
            referenceId
        });

    } catch (error) {

        console.log(error.response?.data || error.message);

        res.status(500).json({
            success: false,
            message: 'Erreur paiement MTN'
        });
    }
});

// ===============================
// RESULTS
// ===============================

app.get('/api/results/:matricule', (req, res) => {

    db.get(
        'SELECT * FROM exam_results WHERE matricule = ?',
        [req.params.matricule],
        (err, row) => {

            if (!row) {

                return res.status(404).json({
                    message: 'Résultat introuvable'
                });
            }

            res.json(row);
        }
    );
});

// ===============================
// MESSAGES
// ===============================

app.post('/api/messages', authenticateToken, (req, res) => {

    const {
        receiverId,
        content,
        fileUrl
    } = req.body;

    db.run(
        `
        INSERT INTO messages
        (sender_id, receiver_id, content, file_url)
        VALUES (?, ?, ?, ?)
        `,
        [
            req.user.id,
            receiverId,
            content,
            fileUrl
        ],
        function(err) {

            if (err) {

                return res.status(500).json({
                    message: 'Erreur message'
                });
            }

            io.emit('newMessage', {
                id: this.lastID,
                senderId: req.user.id,
                receiverId,
                content
            });

            res.json({
                success: true
            });
        }
    );
});

// ===============================
// SOCKET CHAT
// ===============================

io.on('connection', (socket) => {

    console.log('Utilisateur connecté');

    socket.on('sendMessage', (data) => {

        io.emit('receiveMessage', data);
    });

    socket.on('disconnect', () => {

        console.log('Utilisateur déconnecté');
    });
});

// ===============================
// NOTIFICATIONS
// ===============================

app.get('/api/notifications', authenticateToken, (req, res) => {

    db.all(
        'SELECT * FROM notifications WHERE user_id = ?',
        [req.user.id],
        (err, rows) => {

            if (err) {

                return res.status(500).json({
                    message: 'Erreur notifications'
                });
            }

            res.json(rows);
        }
    );
});

// ===============================
// AI HOMEWORK
// ===============================

app.post('/api/ai/homework', authenticateToken, async (req, res) => {

    const { question } = req.body;

    res.json({
        question,
        response: 'Réponse IA simulée pour aide aux devoirs.'
    });
});

// ===============================
// SERVER
// ===============================

server.listen(PORT, () => {

    console.log(`🚀 Arnauldschool API running on port ${PORT}`);

    console.log(`📚 http://localhost:${PORT}`);
});