import imaplib
import smtplib
import email as email_lib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
from email.utils import parseaddr, parsedate_to_datetime
import logging
import re
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


class GmailService:
    def __init__(self, email_addr, password):
        self.email = email_addr
        self.password = password
        self.imap_server = "imap.gmail.com"
        self.smtp_server = "smtp.gmail.com"
        self.smtp_port = 587
        self.connected = False
        self.last_error = ""

    def test_connection(self):
        try:
            mail = imaplib.IMAP4_SSL(self.imap_server)
            mail.login(self.email, self.password)
            mail.logout()
            self.connected = True
            self.last_error = ""
            logger.info("Gmail IMAP connection successful")
            return True
        except imaplib.IMAP4.error as e:
            err_msg = str(e)
            if 'AUTHENTICATIONFAILED' in err_msg:
                self.last_error = "Authentication failed. Gmail requires an App Password for IMAP access. Go to Google Account > Security > 2-Step Verification > App Passwords to generate one."
            else:
                self.last_error = f"IMAP error: {err_msg}"
            logger.error(f"Gmail IMAP connection failed: {self.last_error}")
            self.connected = False
            return False
        except Exception as e:
            self.last_error = f"Connection error: {str(e)}"
            logger.error(f"Gmail connection failed: {e}")
            self.connected = False
            return False

    def read_emails(self, folder="INBOX", limit=50, since=None):
        emails = []
        try:
            mail = imaplib.IMAP4_SSL(self.imap_server)
            mail.login(self.email, self.password)
            self.connected = True
            self.last_error = ""
            mail.select(folder, readonly=True)

            criteria = 'ALL'
            if since:
                criteria = f'(SINCE "{since.strftime("%d-%b-%Y")}")'

            _, data = mail.search(None, criteria)
            email_ids = data[0].split()

            for eid in reversed(email_ids[-limit:]):
                try:
                    _, msg_data = mail.fetch(eid, '(RFC822)')
                    msg = email_lib.message_from_bytes(msg_data[0][1])

                    body = ""
                    if msg.is_multipart():
                        for part in msg.walk():
                            ct = part.get_content_type()
                            if ct == "text/plain":
                                payload = part.get_payload(decode=True)
                                if payload:
                                    body = payload.decode('utf-8', errors='replace')
                                break
                    else:
                        payload = msg.get_payload(decode=True)
                        if payload:
                            body = payload.decode('utf-8', errors='replace')

                    from_addr = parseaddr(msg.get('From', ''))[1]
                    subject = msg.get('Subject', '') or ''
                    date_str = msg.get('Date', '')
                    try:
                        date_parsed = parsedate_to_datetime(date_str).isoformat()
                    except Exception:
                        date_parsed = datetime.now(timezone.utc).isoformat()

                    emails.append({
                        'id': eid.decode(),
                        'from_email': from_addr,
                        'subject': subject,
                        'body': body.strip(),
                        'received_at': date_parsed,
                        'message_id': msg.get('Message-ID', ''),
                    })
                except Exception as e:
                    logger.error(f"Error parsing email {eid}: {e}")
                    continue

            mail.logout()
        except imaplib.IMAP4.error as e:
            err_msg = str(e)
            if 'AUTHENTICATIONFAILED' in err_msg:
                self.last_error = "Authentication failed. Gmail requires an App Password (not your regular password). Go to Google Account > Security > 2-Step Verification > App Passwords."
            else:
                self.last_error = f"IMAP error: {err_msg}"
            self.connected = False
            logger.error(f"IMAP read error: {self.last_error}")
        except Exception as e:
            self.last_error = f"Connection error: {str(e)}"
            self.connected = False
            logger.error(f"IMAP read error: {e}")

        return emails

    def send_email(self, to, subject, body_html, attachments=None):
        try:
            msg = MIMEMultipart()
            msg['From'] = self.email
            msg['To'] = to
            msg['Subject'] = subject
            msg.attach(MIMEText(body_html, 'html'))

            if attachments:
                for filename, content in attachments:
                    att = MIMEApplication(content, _subtype='pdf')
                    att.add_header('Content-Disposition', 'attachment', filename=filename)
                    msg.attach(att)

            server = smtplib.SMTP(self.smtp_server, self.smtp_port)
            server.starttls()
            server.login(self.email, self.password)
            server.send_message(msg)
            server.quit()
            logger.info(f"Email sent to {to}: {subject}")
            return True
        except smtplib.SMTPAuthenticationError:
            self.last_error = "SMTP authentication failed. Gmail requires an App Password for SMTP access."
            logger.error(f"SMTP auth failed for {to}")
            return False
        except Exception as e:
            self.last_error = f"SMTP error: {str(e)}"
            logger.error(f"SMTP send error: {e}")
            return False

    def send_otp_email(self, to, otp, customer_id):
        subject = f"DPDP Shield - OTP Verification for {customer_id}"
        body = f"""
        <html><body style="font-family:Inter,sans-serif;background:#0B1220;color:#E5E7EB;padding:24px;">
        <div style="max-width:500px;margin:0 auto;background:#111827;border-radius:8px;padding:32px;border:1px solid #374151;">
            <h2 style="color:#3B82F6;margin-bottom:16px;">DPDP Shield - OTP Verification</h2>
            <p>Your One-Time Password for data request verification:</p>
            <div style="background:#1F2937;padding:16px;border-radius:8px;text-align:center;margin:24px 0;">
                <span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#10B981;font-family:monospace;">{otp}</span>
            </div>
            <p style="color:#9CA3AF;font-size:14px;">This OTP is valid for 5 minutes. Do not share this with anyone.</p>
            <p style="color:#9CA3AF;font-size:14px;">Customer ID: {customer_id}</p>
            <hr style="border-color:#374151;margin:24px 0;">
            <p style="color:#6B7280;font-size:12px;">DPDP Shield - Prevent | Detect | Respond</p>
        </div>
        </body></html>
        """
        return self.send_email(to, subject, body)

    def send_reply(self, to, subject, body_html):
        return self.send_email(to, f"Re: {subject}", body_html)
