const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const axios = require('axios');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: '../.env' });

const app = express();
app.use(cors());
app.use(express.json());

const SECRET_KEY = "super_secret_kursach_key";
let db;

const authenticate = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: "Неавторизовано" });
    try {
        req.user = jwt.verify(token, SECRET_KEY);
        next();
    } catch (err) {
        res.status(403).json({ error: "Невірний токен" });
    }
};

async function initDB() {
    db = await open({ filename: './database.sqlite', driver: sqlite3.Database });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'user',
            name TEXT
        );
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            total_tickets INTEGER NOT NULL,
            sold_tickets INTEGER DEFAULT 0,
            base_price REAL NOT NULL,
            current_price REAL NOT NULL,
            increase_step REAL NOT NULL,
            threshold INTEGER NOT NULL,
            event_date TEXT NOT NULL,
            organizer_id INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            total_price REAL,
            status TEXT DEFAULT 'pending',
            created_at TEXT
        );
        CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER,
            amount REAL,
            status TEXT DEFAULT 'completed',
            method TEXT DEFAULT 'card',
            created_at TEXT
        );
        CREATE TABLE IF NOT EXISTS tickets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id INTEGER,
            user_id INTEGER,
            order_id INTEGER,
            purchase_price REAL,
            purchase_date TEXT
        );
    `);
    console.log('✅ База даних повністю розгорнута за ТЗ!');
}
initDB();

app.put('/api/profile', authenticate, async (req, res) => {
    const { name } = req.body;
    try {
        await db.run('UPDATE users SET name = ? WHERE id = ?', [name, req.user.id]);
        res.json({ message: "Ім'я оновлено!" });
    } catch (error) {
        res.status(500).json({ error: "Не вдалося оновити профіль" });
    }
});

app.post('/api/register', async (req, res) => {
    const { email, password, role, name } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.run('INSERT INTO users (email, password, role, name) VALUES (?, ?, ?, ?)',
            [email, hashedPassword, role || 'user', name || null]);
        res.json({ message: "Успішно!" });
    } catch (error) {
        res.status(400).json({ error: "Email зайнятий" });
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
        if (user && await bcrypt.compare(password, user.password)) {
            const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, SECRET_KEY, { expiresIn: '24h' });
            res.json({ token, role: user.role, name: user.name || '' });
        } else {
            res.status(401).json({ error: "Невірний email або пароль" });
        }
    } catch (error) {
        res.status(500).json({ error: "Помилка авторизації" });
    }
});

app.get('/api/events', async (req, res) => {
    let { page = 1, limit = 6, search = '', sort = 'id' } = req.query;
    page = Number(page) || 1;
    limit = Number(limit) || 6;
    const offset = (page - 1) * limit;

    const allowedSort = ['id', 'current_price', 'event_date', 'title'];
    if (!allowedSort.includes(sort)) sort = 'id';

    const searchTerm = `%${search}%`;

    try {
        const events = await db.all(`
            SELECT * FROM events
            WHERE title LIKE ?
            ORDER BY ${sort} ASC
            LIMIT ? OFFSET ?
        `, [searchTerm, limit, offset]);

        const { count } = await db.get('SELECT COUNT(*) as count FROM events WHERE title LIKE ?', [searchTerm]);
        res.json({ events, totalPages: Math.max(1, Math.ceil(count / limit)) });
    } catch (error) {
        res.status(500).json({ error: "Помилка БД" });
    }
});

app.get('/api/admin/users', authenticate, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Forbidden" });
    try {
        const users = await db.all('SELECT id, email, role, name FROM users');
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: "Не вдалося отримати користувачів" });
    }
});

app.delete('/api/admin/events/:id', authenticate, async (req, res) => {
    if (req.user.role !== 'admin' && req.user.role !== 'organizer') return res.status(403).json({ error: "Forbidden" });
    try {
        await db.run('DELETE FROM events WHERE id = ?', [req.params.id]);
        res.json({ message: "Видалено" });
    } catch (error) {
        res.status(500).json({ error: "Не вдалося видалити подію" });
    }
});

app.post('/api/events', authenticate, async (req, res) => {
    if (req.user.role !== 'organizer') return res.status(403).json({ error: "Тільки для організаторів" });
    const { title, total_tickets, base_price, increase_step, threshold, event_date } = req.body;
    try {
        await db.run(`
            INSERT INTO events (title, total_tickets, base_price, current_price, increase_step, threshold, event_date, organizer_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [title, total_tickets, base_price, base_price, increase_step, threshold, event_date, req.user.id]);
        res.json({ message: "Подію створено!" });
    } catch (error) {
        res.status(500).json({ error: "Помилка створення" });
    }
});

app.post('/api/buy-ticket', authenticate, async (req, res) => {
    const { eventId } = req.body;
    const today = new Date().toISOString();

    try {
        const event = await db.get('SELECT * FROM events WHERE id = ?', [eventId]);
        if (!event) return res.status(404).json({ error: "Подію не знайдено" });
        if (event.sold_tickets >= event.total_tickets) return res.status(400).json({ error: "No tickets" });

        const orderRes = await db.run('INSERT INTO orders (user_id, total_price, created_at) VALUES (?, ?, ?)',
            [req.user.id, event.current_price, today]);
        const orderId = orderRes.lastID;

        await db.run('INSERT INTO payments (order_id, amount, created_at) VALUES (?, ?, ?)',
            [orderId, event.current_price, today]);

        await db.run('INSERT INTO tickets (event_id, user_id, order_id, purchase_price, purchase_date) VALUES (?, ?, ?, ?, ?)',
            [eventId, req.user.id, orderId, event.current_price, today]);

        const msInDay = 24 * 60 * 60 * 1000;
        const daysToEvent = Math.ceil((new Date(event.event_date) - new Date()) / msInDay);
        const newSold = event.sold_tickets + 1;

        let newPrice = event.current_price;
        try {
            const pythonRes = await axios.post(`http://127.0.0.1:8000/api/calculate-price`, {
                sold_tickets: newSold,
                base_price: event.base_price,
                increase_step: event.increase_step,
                threshold: event.threshold,
                days_to_event: daysToEvent
            });
            newPrice = pythonRes.data.new_price;
        } catch (pyError) {
            console.error('Python Error:', pyError.message);
            return res.status(500).json({ error: "Помилка ШІ-модуля" });
        }

        await db.run('UPDATE events SET sold_tickets = ?, current_price = ? WHERE id = ?', [newSold, newPrice, eventId]);

        res.json({ success: true, new_price: newPrice, new_sold: newSold });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
    }
});

app.get('/api/my-tickets', authenticate, async (req, res) => {
    let { search = '', sort = 'id' } = req.query;
    const allowedSort = {
        id: 't',
        purchase_price: 't',
        event_date: 'e',
        title: 'e'
    };
    if (!Object.prototype.hasOwnProperty.call(allowedSort, sort)) sort = 'id';
    const alias = allowedSort[sort];
    const searchTerm = `%${search}%`;

    try {
        const tickets = await db.all(`
            SELECT t.id, t.purchase_price, t.purchase_date, e.title, e.event_date 
            FROM tickets t JOIN events e ON t.event_id = e.id 
            WHERE t.user_id = ? AND e.title LIKE ?
            ORDER BY ${alias}.${sort} ASC
        `, [req.user.id, searchTerm]);
        res.json(tickets);
    } catch (error) {
        res.status(500).json({ error: "Не вдалося отримати квитки" });
    }
});

app.get('/api/stats', authenticate, async (req, res) => {
    if (req.user.role !== 'organizer') return res.status(403).json({ error: "Доступ заборонено" });
    try {
        const stats = await db.all(`
            SELECT e.title, e.sold_tickets, e.total_tickets, COALESCE(SUM(t.purchase_price), 0) as total_income 
            FROM events e LEFT JOIN tickets t ON e.id = t.event_id 
            WHERE e.organizer_id = ? GROUP BY e.id
        `, [req.user.id]);
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: "Не вдалося отримати статистику" });
    }
});

app.listen(3000, () => console.log('🚀 API на порту 3000'));
