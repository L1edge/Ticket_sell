@echo off

echo [1/3] Запускаємо Python (Pricing Engine) на порту 8000...
start cmd /k "cd pricing-engine && python -m uvicorn main:app --reload --port 8000"

echo [2/3] Запускаємо Node.js (API Gateway + SQLite) на порту 3000...
start cmd /k "cd api-gateway && node server.js"

echo [3/3] Запускаємо React (Frontend)...
start cmd /k "cd frontend && npm run dev"

echo 🌐 Відкрий браузер: http://localhost:5173
pause