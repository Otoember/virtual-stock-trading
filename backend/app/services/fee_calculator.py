from decimal import Decimal, ROUND_HALF_UP
from app.core.config import get_settings


class FeeCalculator:
    def __init__(self):
        settings = get_settings()
        self.commission_rate = Decimal(settings.COMMISSION_RATE)
        self.min_commission = Decimal(settings.MIN_COMMISSION)
        self.stamp_tax_rate = Decimal(settings.STAMP_TAX_RATE)
        self.transfer_fee_rate = Decimal(settings.TRANSFER_FEE_RATE)

    def calculate(self, side: str, amount: Decimal) -> Decimal:
        commission = max(amount * self.commission_rate, self.min_commission)
        stamp_tax = amount * self.stamp_tax_rate if side == 'SELL' else Decimal('0')
        transfer_fee = amount * self.transfer_fee_rate
        fee = commission + stamp_tax + transfer_fee
        return fee.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
