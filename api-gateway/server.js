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

const SECRET_KEY = "super_secret_kursach_key"; // Ключ для токенів
let db;

// === ІНІЦІАЛІЗАЦІЯ БАЗИ ДАНИХ ===
async function initDB() {
    db = await open({ filename: './database.sqlite', driver: sqlite3.Database });

    // Таблиця подій
    await db.exec(`
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            total_tickets INTEGER NOT NULL,
            sold_tickets INTEGER DEFAULT 0,
            base_price REAL NOT NULL,
            current_price REAL NOT NULL,
            increase_step REAL NOT NULL,
            threshold INTEGER NOT NULL
        )
    `);

    // Таблиця користувачів
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'user'
        )
    `);
    console.log('✅ База даних успішно підключена та оновлена!');
}
initDB();

// === АВТОРИЗАЦІЯ ТА РЕЄСТРАЦІЯ ===
app.post('/api/register', async (req, res) => {
    const { email, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.run('INSERT INTO users (email, password) VALUES (?, ?)', [email, hashedPassword]);
        res.json({ message: "Успішно зареєстровано!" });
    } catch (error) {
        res.status(400).json({ error: "Користувач з таким email вже існує" });
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
        
        if (user && await bcrypt.compare(password, user.password)) {
            const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, SECRET_KEY, { expiresIn: '24h' });
            res.json({ token, user: { email: user.email, role: user.role } });
        } else {
            res.status(401).json({ error: "Невірний email або пароль" });
        }
    } catch (error) {
        res.status(500).json({ error: "Помилка авторизації" });
    }
});

// === УПРАВЛІННЯ ПОДІЯМИ ===

// Отримати всі події
app.get('/api/events', async (req, res) => {
    try {
        const events = await db.all('SELECT * FROM events');
        res.json(events);
    } catch (error) {
        res.status(500).json({ error: "Не вдалося отримати список подій" });
    }
});

// Створити нову подію
app.post('/api/events', async (req, res) => {
    const { title, total_tickets, base_price, increase_step, threshold } = req.body;
    try {
        await db.run(`
            INSERT INTO events (title, total_tickets, base_price, current_price, increase_step, threshold)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [title, total_tickets, base_price, base_price, increase_step, threshold]);
        res.json({ message: "Подію успішно створено!" });
    } catch (error) {
        res.status(500).json({ error: "Помилка створення події" });
    }
});

// Отримати конкретну подію (для головної сторінки фронтенду)
app.get('/api/event', async (req, res) => {
    try {
        const event = await db.get('SELECT * FROM events WHERE id = 1'); // Для тесту повертаємо першу
        if (!event) return res.status(404).json({ error: "Подію не знайдено" });
        res.json(event);
    } catch (error) {
        res.status(500).json({ error: "Помилка бази даних" });
    }
});

// === КУПІВЛЯ КВИТКА (ДИНАМІЧНЕ ЦІНОУТВОРЕННЯ) ===
app.post('/api/buy-ticket', async (req, res) => {
    const { eventId, amount = 1 } = req.body;

    try {
        // 1. Знаходимо подію
        const event = await db.get('SELECT * FROM events WHERE id = ?', [eventId]);
        if (!event) return res.status(404).json({ error: "Подію не знайдено" });
        
        // 2. Перевіряємо наявність квитків
        if (event.sold_tickets + amount > event.total_tickets) {
            return res.status(400).json({ error: "Недостатньо квитків" });
        }

        const newSold = event.sold_tickets + amount;

        // 3. Звертаємось до мікросервісу на Python для розрахунку нової ціни
        let newPrice = event.current_price;
        try {
            const pythonRes = await axios.post(`http://127.0.0.1:8000/api/calculate-price`, {
                sold_tickets: newSold,
                base_price: event.base_price,
                increase_step: event.increase_step,
                threshold: event.threshold
            });
            newPrice = pythonRes.data.new_price;
        } catch (pyError) {
            console.error("❌ Помилка зв'язку з Python:", pyError.message);
            // Якщо Python недоступний, повертаємо помилку (згідно з ТЗ про обов'язковість модуля)
            return res.status(500).json({ error: "Сервіс ціноутворення недоступний" });
        }

        // 4. Оновлюємо дані в БД (транзакція: кількість та нова ціна)
        await db.run('UPDATE events SET sold_tickets = ?, current_price = ? WHERE id = ?', [newSold, newPrice, eventId]);

        // 5. Відправляємо результат на фронтенд для миттєвого оновлення
        res.json({
            success: true,
            message: `Успішно куплено!`,
            paid_price: event.current_price,
            new_current_price: newPrice,
            new_sold_tickets: newSold
        });

    } catch (error) {
        console.error("❌ Помилка при покупці:", error);
        res.status(500).json({ error: "Внутрішня помилка сервера" });
    }
});

app.listen(3000, () => console.log('🚀 Node.js API сервер запущено на http://localhost:3000'));