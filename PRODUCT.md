# MEDQCM L1

## Product

MEDQCM L1 is a monthly QCM training service for first-year medical students in France. A student pays for a 30-day access cycle, submits a payment receipt, and is manually validated by the doctor. Once validated, the same student account receives one subject for the cycle and unlimited practice series drawn from that subject.

The student portal and the doctor portal are separate interfaces with separate public entry points, but they share one data model. The student never sees the doctor workspace. The doctor manages requests, students, subjects, assignments, and corrections; the student only sees their own access, series, results, and history.

## Users

- **Student**: creates an account, submits a receipt, waits for validation, logs in, trains on one active subject, reviews corrections, and renews access when the cycle expires.
- **Doctor**: validates or rejects requests, manages the subject queue, assigns subjects, follows student activity, and handles renewals. Visible product label is **Docteur**.

## Core rules

- One active subject per student at a time.
- Access lasts 30 days from validation, not from signup.
- On approval, the student receives the oldest never-assigned, non-archived subject that contains questions.
- On renewal approval, the next never-assigned subject is assigned automatically for a new 30-day cycle.
- A series targets 20 questions, but uses the actual question bank size when it contains fewer. The interface never claims 20 questions when the bank is smaller.
- Answers are a checklist: one or more choices can be selected.
- Scoring is exact-match only: +1 if all correct choices and no incorrect choices are selected; otherwise 0. No partial credit, no negative points.
- Total score is the number of questions in the series.
- The correction is visible only after the series is submitted: the student answer, the expected answer, and the explanation.
- The doctor supplies the subject and its correction key; the doctor does not enter individual student grades.
- Expired or rejected students may renew by submitting a new receipt. Access opens only after validation.
- If no next subject is available, a renewal remains pending and the interface must not promise an immediately available subject.
- Expired students keep read-only access to their history; they cannot launch a new series until renewal.

## Portals

- Student public landing: `/etudiant`
- Student signup: `/etudiant/inscription`
- Student login: `/etudiant/connexion`
- Student workspace: `/app`, `/app/entrainement`, `/app/resultat/:attemptId`, `/app/historique`
- Pending: `/en-attente`
- Expired or rejected: `/expiration`
- Renewal: `/reinscription`
- Doctor login: `/connexion`
- Doctor workspace: `/admin/*`

## Constraints

- No AI-generated photography or decorative stock imagery.
- The product is a calm, editorial "carnet de préparation", not a gamified quiz app.
- One primary action per screen; only necessary buttons.
- French interface.
- The current demo stores data in the browser. Production requires a shared backend for cross-device access, server-side access checks, secure receipt storage, and separate student/doctor sessions.
