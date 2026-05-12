from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

# Оновили модель: тепер Пітон чекає total_tickets замість кроків і порогів
class PriceRequest(BaseModel):
    sold_tickets: int
    total_tickets: int
    base_price: float
    days_to_event: int

@app.post("/api/calculate-price")
def calculate_dynamic_price(data: PriceRequest):
    # Рахуємо, скільки відсотків залу вже викуплено
    percent_sold = (data.sold_tickets / data.total_tickets) * 100
    
    # Скільки разів ми перетнули межу в 10% проданих квитків (націло)
    # Наприклад, продано 35% -> steps_passed = 3
    steps_passed = int(percent_sold // 10)
    
    # Додаємо по 10% від БАЗОВОЇ ціни за кожен крок
    price_increase = steps_passed * (0.10 * data.base_price)
    new_price = data.base_price + price_increase
    
    # Фіча дефіциту часу (якщо до події менше 5 днів - ще +20% зверху)
    if 0 <= data.days_to_event <= 5:
        new_price = new_price * 1.20
        
    return {
        "new_price": round(new_price, 2),
        "steps_passed": steps_passed
    }