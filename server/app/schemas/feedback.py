from typing import Optional

from pydantic import BaseModel


class FeedbackRequest(BaseModel):
    job_id: str
    is_useful: bool
    comment: Optional[str] = None
