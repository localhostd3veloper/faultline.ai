from fastapi import APIRouter

from ..schemas.feedback import FeedbackRequest

router = APIRouter()


@router.post("/feedback")
async def post_feedback(request: FeedbackRequest):
    return {"status": "success", "message": "Feedback received"}
