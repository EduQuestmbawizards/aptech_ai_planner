import os
import logging
import smtplib
from typing import Optional
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.core.config import settings

logger = logging.getLogger(__name__)

class EmailService:
    @staticmethod
    def send_invitation_email(recipient_email: str, student_name: str, invitation_token: str, frontend_url: Optional[str] = None) -> bool:
        base_url = (frontend_url or settings.FRONTEND_URL or "https://ai-planner.eduquest.org.in").rstrip('/')
        if ("localhost" in base_url or "127.0.0.1" in base_url) and (os.getenv("RENDER") or os.getenv("PORT") or os.getenv("RENDER_SERVICE_ID")):
            base_url = "https://ai-planner.eduquest.org.in"
        activation_url = f"{base_url}/activate?token={invitation_token}"
        subject = "Welcome to Aptech AI Career & Study Planner — Activate Your Account"
        
        text_content = f"""Hello {student_name},

Your enrollment in the Aptech AI Career & Study Planner has been approved!
Please set your password and activate your account using the following secure link:

{activation_url}

This invitation link is valid for {settings.INVITATION_TOKEN_EXPIRE_HOURS} hours and can only be used once.

Best regards,
Aptech Learning Administration
"""
        html_content = f"""<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; background-color: #f8fafc; padding: 24px;">
  <div style="max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; padding: 32px;">
    <h2 style="color: #1e40af; margin-top: 0;">Welcome to Aptech AI Career & Study Planner</h2>
    <p>Hello <strong>{student_name}</strong>,</p>
    <p>Your enrollment has been approved by the Aptech Administration. You can now activate your student account and begin generating your personalized AI study schedule.</p>
    <div style="margin: 28px 0; text-align: center;">
      <a href="{activation_url}" style="background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; display: inline-block;">Activate Account & Set Password</a>
    </div>
    <p style="font-size: 13px; color: #64748b;">Or copy and paste this link into your browser:<br/><a href="{activation_url}" style="color: #2563eb;">{activation_url}</a></p>
    <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
    <p style="font-size: 12px; color: #94a3b8;">This invitation link will expire in {settings.INVITATION_TOKEN_EXPIRE_HOURS} hours and is single-use only. If you did not request this, please contact your Aptech center administrator.</p>
  </div>
</body>
</html>"""
        return EmailService._send(recipient_email, subject, text_content, html_content)

    @staticmethod
    def send_password_reset_email(recipient_email: str, reset_token: str, full_name: str = "Student", frontend_url: Optional[str] = None) -> bool:
        base_url = (frontend_url or settings.FRONTEND_URL or "https://ai-planner.eduquest.org.in").rstrip('/')
        if ("localhost" in base_url or "127.0.0.1" in base_url) and (os.getenv("RENDER") or os.getenv("PORT") or os.getenv("RENDER_SERVICE_ID")):
            base_url = "https://ai-planner.eduquest.org.in"
        reset_url = f"{base_url}/reset-password?token={reset_token}"
        subject = "Aptech AI Career & Study Planner — Password Reset Request"
        text_content = f"""Hello {full_name},

We received a request to reset the password for your Aptech AI Career & Study Planner account ({recipient_email}).

Please use the secure link below to set a new password:
{reset_url}

This link is valid for 2 hours and can only be used once.
If you did not request a password reset, you can safely ignore this email.

Best regards,
Aptech Learning Administration
"""
        html_content = f"""<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; background-color: #fcfaf4; padding: 24px;">
  <div style="max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #fde68a; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
    <div style="background-color: #0f1117; padding: 20px 32px; text-align: center; border-bottom: 3px solid #f59e0b;">
      <h2 style="color: #fcd34d; margin: 0; font-size: 20px; letter-spacing: 0.5px;">Aptech Learning</h2>
      <p style="color: #fef08a; margin: 4px 0 0 0; font-size: 12px;">AI Career &amp; Study Planner</p>
    </div>
    <div style="padding: 32px;">
      <h3 style="color: #0f172a; margin-top: 0;">Password Reset Request</h3>
      <p>Hello <strong>{full_name}</strong>,</p>
      <p>We received a request to reset the password for your account (<strong>{recipient_email}</strong>). Click the button below to choose a new password:</p>
      <div style="margin: 28px 0; text-align: center;">
        <a href="{reset_url}" style="background-color: #f59e0b; color: #0f172a; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: bold; display: inline-block;">Reset My Password</a>
      </div>
      <p style="font-size: 13px; color: #64748b;">Or copy and paste this link into your browser:<br/><a href="{reset_url}" style="color: #d97706; word-break: break-all;">{reset_url}</a></p>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="font-size: 12px; color: #94a3b8;">This password reset link is valid for <strong>2 hours</strong> and can only be used once. If you did not request this reset, please ignore this email.</p>
    </div>
  </div>
</body>
</html>"""
        return EmailService._send(recipient_email, subject, text_content, html_content)

    @staticmethod
    def _send(recipient_email: str, subject: str, text_content: str, html_content: str) -> bool:
        logger.info(f"[EMAIL SERVICE] Target: {recipient_email} | Subject: {subject}")
        if not settings.EMAIL_ENABLED or not settings.EMAIL_USERNAME or not settings.EMAIL_PASSWORD:
            logger.info(f"[EMAIL DEV MODE - NOT SENT VIA SMTP] In local/dev mode without SMTP credentials. Email logged securely.")
            return True

        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = settings.EMAIL_FROM
            msg["To"] = recipient_email

            part1 = MIMEText(text_content, "plain")
            part2 = MIMEText(html_content, "html")
            msg.attach(part1)
            msg.attach(part2)

            if settings.EMAIL_PORT == 465:
                # SSL connection (e.g. Gmail port 465) with 12s timeout
                with smtplib.SMTP_SSL(settings.EMAIL_HOST, settings.EMAIL_PORT, timeout=12) as server:
                    server.login(settings.EMAIL_USERNAME, settings.EMAIL_PASSWORD)
                    server.sendmail(settings.EMAIL_FROM, recipient_email, msg.as_string())
            else:
                # STARTTLS connection (e.g. port 587) with 12s timeout
                with smtplib.SMTP(settings.EMAIL_HOST, settings.EMAIL_PORT, timeout=12) as server:
                    server.starttls()
                    server.login(settings.EMAIL_USERNAME, settings.EMAIL_PASSWORD)
                    server.sendmail(settings.EMAIL_FROM, recipient_email, msg.as_string())
            logger.info(f"Email successfully sent to {recipient_email}")
            return True
        except Exception as e:
            logger.error(f"Failed to send email to {recipient_email}: {str(e)}")
            return False

