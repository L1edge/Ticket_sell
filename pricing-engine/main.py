from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class PriceRequest(BaseModel):
    sold_tickets: int
    base_price: float
    increase_step: float
    threshold: int

@app.post("/api/calculate-price")
def calculate_dynamic_price(data: PriceRequest):
    # Рахуємо кроки підвищення (націло)
    steps_passed = data.sold_tickets // data.threshold
    # Нова ціна
    new_price = data.base_price + (steps_passed * data.increase_step)
    
    return {
        "new_price": new_price,
        "steps_passed": steps_passed
    }