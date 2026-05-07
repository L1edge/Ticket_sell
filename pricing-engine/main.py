from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class PriceRequest(BaseModel):
    sold_tickets: int
    base_price: float
    increase_step: float
    threshold: int
    days_to_event: int  # Новий параметр для ШІ

@app.post("/api/calculate-price")
def calculate_dynamic_price(data: PriceRequest):
    # Базова логіка зміни від кількості проданих
    steps_passed = data.sold_tickets // data.threshold
    new_price = data.base_price + (steps_passed * data.increase_step)

    # "ШІ" логіка: залежність від часу
    # Якщо до події залишилося 5 або менше днів (і вона ще не пройшла), накидаємо 20%
    if 0 <= data.days_to_event <= 5:
        new_price = new_price * 1.20

    return {
        "new_price": round(new_price, 2),
        "steps_passed": steps_passed
    }
