from datetime import datetime
from zoneinfo import ZoneInfo
from app.core.config import get_settings


class TradingCalendar:
    def __init__(self):
        self.settings = get_settings()
        self.tz = ZoneInfo(self.settings.MARKET_TZ)

    def now_local(self) -> datetime:
        return datetime.now(self.tz)

    def is_open(self) -> bool:
        if self.settings.ALLOW_OFF_HOURS_TRADING:
            return True
        now = self.now_local()
        if now.weekday() >= 5:
            return False
        hhmm = now.strftime('%H:%M')
        return (
            self.settings.SESSION_AM_START <= hhmm <= self.settings.SESSION_AM_END
            or self.settings.SESSION_PM_START <= hhmm <= self.settings.SESSION_PM_END
        )
