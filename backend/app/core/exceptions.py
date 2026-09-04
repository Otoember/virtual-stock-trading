"""Compatibility wrapper for common exception module."""

from app.common.exceptions import AppError, app_error_handler, internal_error_handler

__all__ = ['AppError', 'app_error_handler', 'internal_error_handler']
