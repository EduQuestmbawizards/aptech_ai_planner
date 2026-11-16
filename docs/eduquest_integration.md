# EduQuest Integration Specification

## 1. Overview
The **Aptech AI Career & Study Planner** is an independent application that will integrate with the existing EduQuest Next.js website in a future phase.

The integration enables EduQuest's post-purchase student registration form to securely forward student enrollment payloads to the Career Planner's backend for administrative review and account activation.

```
+------------------------------+                      +------------------------------------+
|  Existing EduQuest Web App   |                      |    Aptech AI Career Planner        |
|  (Next.js)                   |                      |    (FastAPI + Supabase DB)         |
|                              |                      |                                    |
| [Student Registration Form]  |                      |                                    |
|              |               |                      |                                    |
|              v               |  POST /api/integrations/eduquest/student-registration     |
| [Server Route / Webhook]     |=====================>|  1. Validate HMAC signature        |
| (Signs payload with secret)  | (HTTPS + X-Signature)|  2. Check Idempotency key          |
|                              |                      |  3. Deduplicate Email & Student ID |
|                              |                      |  4. Create PENDING Enrollment      |
|                              |                      |  5. Log Audit Event                |
|                              |                      |  6. Notify Admin for Approval      |
+------------------------------+                      +-----------------+------------------+
                                                                        |
                                                                        v
                                                              +--------------------+
                                                              | Admin Approval &   |
                                                              | Account Invitation |
                                                              +--------------------+
```

## 2. API Contract

### Endpoint
`POST /api/integrations/eduquest/student-registration`

### Headers
| Header Name | Type | Description |
|---|---|---|
| `Content-Type` | string | `application/json` |
| `X-EduQuest-Signature` | string | Hex-encoded HMAC-SHA256 signature of the raw JSON body using `EDUQUEST_INTEGRATION_SECRET` |
| `X-Idempotency-Key` | string (UUID) | Unique identifier for deduplicating retries |

### Request Payload (JSON)
```json
{
  "eduquest_registration_id": "EQ-REG-2026-9812",
  "aptech_student_id": "APT-DEL-2026-0042",
  "full_name": "Rohan Sharma",
  "email": "rohan.sharma@example.com",
  "phone": "+91 98765 43210",
  "course_code": "ACCP-PRO-FSWD",
  "payment_reference": "TXN_EDUQUEST_99341",
  "payment_date": "2026-11-03",
  "additional_notes": "Enrolled via EduQuest Career Fair special batch"
}
```

### Success Response (`201 Created` or `200 OK`)
```json
{
  "success": true,
  "message": "Student registration queued for admin verification.",
  "data": {
    "student_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "enrollment_id": "7ca85f64-5717-4562-b3fc-2c963f66afa7",
    "status": "PENDING_ADMIN_APPROVAL"
  }
}
```

### Signature Generation Example (TypeScript / Next.js)
```typescript
import crypto from "crypto";

export function signPayload(body: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}
```

