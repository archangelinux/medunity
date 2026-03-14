from pydantic import BaseModel


class CreateEntryRequest(BaseModel):
    text: str
    photo_url: str | None = None


class RespondRequest(BaseModel):
    message: str
    resolve: bool = False


class CareRouteQuery(BaseModel):
    ctas_level: int
    latitude: float | None = None
    longitude: float | None = None
