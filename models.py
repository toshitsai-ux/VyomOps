from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

# ==============================================================================
# FIRESTORE 'analyses' COLLECTION SCHEMA DEFINITION
# ==============================================================================
# - userId (string): Firebase User UID of the operator running the scan
# - location (string): Location reference name / coordinate zone (e.g. "Mahanadi Delta")
# - timestamp (datetime / Timestamp): Timestamp of when the disaster event occurred
# - before_url (string): Firebase Storage download URL for the pre-event canvas
# - after_url (string): Firebase Storage download URL for the post-event canvas
# - diff_mask_url (string, optional): For future high contrast computed binary mask references
# - bounding_boxes (array of arrays of ints): Array of [x, y, w, h] integers indicating damage bounds
# - change_percentage (float): Quantified physical pixel delta change score
# - risk_score (integer, 1 to 10): Categorized triage threat risk indicator 
# - severity (string enum): "Critical" | "Active" | "Cleared"
# - checklist (array of strings): Prompted actionable defense items for operators
# - status (string enum): "Processing" | "Completed" | "Failed"
# - created_at (datetime / Timestamp): Record creation timestamp
# - processed_at (datetime / Timestamp): AI analysis completion timestamp
# ==============================================================================

class AnalysisSchema(BaseModel):
    userId: str = Field(..., description="Firebase UID of the operating specialist")
    location: str = Field(..., description="Coordinate string or geographical tag")
    timestamp: datetime = Field(..., description="Date of satellite observation reference")
    before_url: str = Field(..., description="Storage URL of early reference image")
    after_url: str = Field(..., description="Storage URL of comparison target image")
    diff_mask_url: Optional[str] = Field(None, description="Optional path to computed difference visual")
    bounding_boxes: List[List[int]] = Field(default_factory=list, description="Anomalous structures coordinate areas as [x, y, w, h]")
    change_percentage: float = Field(..., description="Percentage indicating divergent physical changes")
    risk_score: int = Field(..., ge=1, le=10, description="Risk severity index coefficient between 1 and 10")
    severity: str = Field(..., description="Critical | Active | Cleared enum")
    checklist: List[str] = Field(default_factory=list, description="Emergency checklist generated for ground alignment")
    status: str = Field("Processing", description="Processing | Completed | Failed status flag")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    processed_at: Optional[datetime] = Field(None)

class UserProfileSchema(BaseModel):
    uid: str
    displayName: str
    email: str
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    clearanceLevel: str = "LEVEL_1_REC_FIELD"
    assignedRegion: str = "Global Radar"
