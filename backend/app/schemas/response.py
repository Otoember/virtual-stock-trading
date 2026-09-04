from typing import Generic, TypeVar
from pydantic import BaseModel

T = TypeVar("T")


class APIResponse(BaseModel, Generic[T]):
    """统一API响应结构，便于前端处理业务状态。"""

    success: bool = True
    data: T | None = None
    message: str = ""
