from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(
    title="Medunity API",
    description="Longitudinal health agent for Canadians",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from backend.api.entries import router as entries_router
from backend.api.clinics import router as clinics_router
from backend.api.overview import router as overview_router
from backend.api.locations import router as locations_router

app.include_router(entries_router)
app.include_router(clinics_router)
app.include_router(overview_router)
app.include_router(locations_router)


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "medunity-api"}
