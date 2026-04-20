CREATE DATABASE IF NOT EXISTS event_platform;
USE event_platform;

-- Таблиця подій
CREATE TABLE events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    total_tickets INT NOT NULL,      -- Скільки всього місць (напр. 1000)
    sold_tickets INT DEFAULT 0,      -- Скільки вже продано (на старті 0)
    base_price DECIMAL(10, 2) NOT NULL,   -- Стартова ціна (500)
    current_price DECIMAL(10, 2) NOT NULL,-- Поточна ціна (буде змінюватись)
    increase_step DECIMAL(10, 2) NOT NULL,-- Крок підвищення (50)
    threshold INT NOT NULL           -- Кожні скільки квитків піднімаємо (100)
);

-- Додамо одну тестову подію, щоб було з чим працювати
INSERT INTO events (title, description, total_tickets, base_price, current_price, increase_step, threshold)
VALUES (
    'Tech Conference 2026', 
    'Найбільша ІТ-конференція року', 
    1000, 500.00, 500.00, 50.00, 100
);