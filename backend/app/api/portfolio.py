from fastapi import APIRouter

from app.schemas.portfolio import PortfolioAnalyticsRequest
from app.services.portfolio import PortfolioAnalyticsService

router = APIRouter(prefix="/portfolio", tags=["portfolio"])

service = PortfolioAnalyticsService()


@router.post("/analytics")
def portfolio_analytics(request: PortfolioAnalyticsRequest):
    result = service.analyze_asset_curve(request.asset_values)
    result["industry_distribution"] = service.industry_distribution(request.positions)
    return result
