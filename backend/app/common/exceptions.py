"""Standard exception and error responses."""

from fastapi import Request
from fastapi.responses import JSONResponse


class AppError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400, details: dict | None = None):
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(message)


async def app_error_handler(_: Request, exc: AppError):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            'code': exc.code,
            'message': exc.message,
            'details': exc.details,
        },
    )


async def internal_error_handler(_: Request, __: Exception):
    return JSONResponse(
        status_code=500,
        content={
            'code': 'INTERNAL_ERROR',
            'message': '内部服务错误',
            'details': {},
        },
    )
