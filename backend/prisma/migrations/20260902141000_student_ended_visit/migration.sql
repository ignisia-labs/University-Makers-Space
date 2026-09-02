-- A team leader ending their own session closes the visit for a reason that is
-- neither a lab check-out nor an automatic sweep; recording it distinctly keeps
-- attendance honest about who ended the session.
ALTER TYPE "VisitCloseReason" ADD VALUE IF NOT EXISTS 'STUDENT_ENDED';
