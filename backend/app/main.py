from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import auth, market, trading, risk
from app.core.config import get_settings
from app.core.exceptions import AppError, app_error_handler, internal_error_handler
from app.core.logging import setup_logging
from app.db.base import Base
from app.db.session import engine
from app.services.market_data.factory import get_market_provider

settings = get_settings()
setup_logging()

app = FastAPI(title=settings.APP_NAME)
app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(Exception, internal_error_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(auth.router, prefix=settings.API_PREFIX)
app.include_router(market.router, prefix=settings.API_PREFIX)
app.include_router(trading.router, prefix=settings.API_PREFIX)
app.include_router(risk.router, prefix=settings.API_PREFIX)


@app.on_event('startup')
def on_startup():
    Base.metadata.create_all(bind=engine)
    get_market_provider()  # Import/initialize once; do not fetch market data at startup.


@app.get('/healthz')
def healthz():
    return {'status': 'ok'}
