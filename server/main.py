
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Haggle API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def home():
    return {"message": "Haggle API is running"}

@app.get("/api/products")
def get_products():
    return {
        "products": [],
        "message": "Backend connected; live product data is not configured yet."
    }
