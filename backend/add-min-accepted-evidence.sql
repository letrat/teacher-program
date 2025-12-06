-- Add minAcceptedEvidence column to kpis table if it doesn't exist
ALTER TABLE kpis 
ADD COLUMN IF NOT EXISTS minAcceptedEvidence INT NULL;




