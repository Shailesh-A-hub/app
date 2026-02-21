import csv
import os
import re
import threading
from pathlib import Path
from datetime import datetime, timezone
import random
import logging

logger = logging.getLogger(__name__)

CUSTOMER_HEADERS = ['customer_id','name','email','phone','status','created_at','updated_at']
MAIL_REPLIES_HEADERS = ['request_id','received_at','from_email','subject','body','customer_id','intent','otp_status','otp_sent_at','otp_verified_at','action_taken','action_status','replied_at','pdf_files','notes']
ADMIN_ACCESS_HEADERS = ['session_id','admin_email','login_time','logout_time','ip_address','device']
REPORTS_SENT_HEADERS = ['report_id','generated_at','generated_by','report_type','incident_id','request_id','customer_id','recipient','delivery_channel','delivery_status','pdf_filename','pdf_sha256','notes']

INDIAN_NAMES = [
    "Aarav Sharma", "Priya Patel", "Vivaan Gupta", "Ananya Singh", "Aditya Kumar",
    "Ishita Reddy", "Arjun Nair", "Diya Joshi", "Rohan Mehta", "Kavya Iyer",
    "Sai Prasad", "Neha Banerjee", "Vikram Choudhary", "Pooja Deshmukh", "Rahul Verma",
    "Shreya Bhat", "Karan Malhotra", "Riya Kapoor", "Amit Saxena", "Meera Pillai",
    "Deepak Tiwari", "Sunita Rao", "Manish Agarwal", "Lakshmi Menon", "Rajesh Pandey",
    "Anjali Mishra", "Suresh Kulkarni", "Nisha Chauhan", "Gaurav Sinha", "Divya Thakur",
    "Harish Bhatt", "Swati Dubey", "Nikhil Jain", "Pallavi Hegde", "Vishal Yadav"
]

INDIAN_PHONES = [
    "9876543210", "9123456789", "9988776655", "9871234567", "9765432100",
    "9654321098", "9543210987", "9432109876", "9321098765", "9210987654",
    "9109876543", "9012345678", "8976543210", "8865432109", "8754321098",
    "8643210987", "8532109876", "8421098765", "8310987654", "8209876543",
    "7998765432", "7887654321", "7776543210", "7665432109", "7554321098",
    "7443210987", "7332109876", "7221098765", "7110987654", "7009876543",
    "6998765432", "6887654321", "6776543210", "6665432109", "6554321098"
]


class CSVManager:
    def __init__(self, data_dir):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._init_csvs()

    def _init_csvs(self):
        schemas = {
            'customers.csv': CUSTOMER_HEADERS,
            'mail_replies.csv': MAIL_REPLIES_HEADERS,
            'admin_access.csv': ADMIN_ACCESS_HEADERS,
            'reports_sent.csv': REPORTS_SENT_HEADERS,
        }
        for filename, headers in schemas.items():
            filepath = self.data_dir / filename
            if not filepath.exists():
                with open(filepath, 'w', newline='', encoding='utf-8') as f:
                    writer = csv.writer(f)
                    writer.writerow(headers)

    def read_csv(self, filename):
        filepath = self.data_dir / filename
        if not filepath.exists():
            return []
        with self._lock:
            with open(filepath, 'r', newline='', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                return list(reader)

    def append_row(self, filename, row_dict):
        filepath = self.data_dir / filename
        with self._lock:
            with open(filepath, 'r', newline='', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                fieldnames = reader.fieldnames
            with open(filepath, 'a', newline='', encoding='utf-8') as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writerow(row_dict)

    def update_row(self, filename, key_field, key_value, updates):
        filepath = self.data_dir / filename
        with self._lock:
            rows = []
            fieldnames = None
            with open(filepath, 'r', newline='', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                fieldnames = reader.fieldnames
                rows = list(reader)
            updated = False
            for row in rows:
                if row.get(key_field) == key_value:
                    row.update(updates)
                    updated = True
            with open(filepath, 'w', newline='', encoding='utf-8') as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(rows)
            return updated

    def write_csv(self, filename, rows, headers=None):
        filepath = self.data_dir / filename
        with self._lock:
            if not headers and filepath.exists():
                with open(filepath, 'r', newline='', encoding='utf-8') as f:
                    reader = csv.DictReader(f)
                    headers = reader.fieldnames
            with open(filepath, 'w', newline='', encoding='utf-8') as f:
                writer = csv.DictWriter(f, fieldnames=headers)
                writer.writeheader()
                writer.writerows(rows)

    def get_next_id(self, filename, id_field, prefix):
        rows = self.read_csv(filename)
        if not rows:
            return f"{prefix}0001"
        ids = [r.get(id_field, '') for r in rows]
        nums = []
        for id_val in ids:
            match = re.search(r'\d+', id_val.replace(prefix, ''))
            if match:
                nums.append(int(match.group()))
        next_num = max(nums) + 1 if nums else 1
        return f"{prefix}{next_num:04d}"

    def get_next_report_id(self):
        rows = self.read_csv('reports_sent.csv')
        if not rows:
            return "REP-000001"
        nums = []
        for r in rows:
            match = re.search(r'\d+', r.get('report_id', '').replace('REP-', ''))
            if match:
                nums.append(int(match.group()))
        next_num = max(nums) + 1 if nums else 1
        return f"REP-{next_num:06d}"

    def seed_customers(self, count=30):
        existing = self.read_csv('customers.csv')
        if len(existing) >= count:
            return
        now = datetime.now(timezone.utc).isoformat()
        for i in range(len(existing), count):
            name = INDIAN_NAMES[i % len(INDIAN_NAMES)]
            email_name = name.lower().replace(' ', '.') + f"{i}@example.com"
            phone = INDIAN_PHONES[i % len(INDIAN_PHONES)]
            customer = {
                'customer_id': f"CUST-{i+1:04d}",
                'name': name,
                'email': email_name,
                'phone': phone,
                'status': 'ACTIVE',
                'created_at': now,
                'updated_at': now,
            }
            self.append_row('customers.csv', customer)

    def seed_sample_incident(self):
        existing = self.read_csv('reports_sent.csv')
        if existing:
            return

    def seed_sample_incident_with_pdfs(self, pdf_svc):
        """Seed sample incident WITH actual PDFs generated"""
        existing = self.read_csv('reports_sent.csv')
        if existing:
            return
        now = datetime.now(timezone.utc).isoformat()
        sample_incident = {
            'incident_id': 'INC-001',
            'discovery_time': now,
            'nature': 'Unauthorized access to personal data',
            'systems': 'Customer Database',
            'categories': 'Name, Email, Phone',
            'affected_count': 30,
            'description': 'Sample closed incident for demo purposes',
            'closure_time': now,
            'severity': 'HIGH',
            'vector': 'API',
        }
        # Generate actual DPB Notice PDF
        try:
            pdf_bytes1, sha1, fn1 = pdf_svc.generate_dpb_notice(sample_incident)
            self.append_row('reports_sent.csv', {
                'report_id': 'REP-000001', 'generated_at': now, 'generated_by': 'SYSTEM',
                'report_type': 'DPB_NOTICE', 'incident_id': 'INC-001',
                'request_id': '', 'customer_id': '', 'recipient': 'dpb@meity.gov.in',
                'delivery_channel': 'EMAIL', 'delivery_status': 'DELIVERED',
                'pdf_filename': fn1, 'pdf_sha256': sha1, 'notes': 'Sample closed incident DPB notice',
            })
        except Exception as e:
            logging.getLogger(__name__).error(f"Seed DPB PDF error: {e}")
        # Generate actual Audit Report PDF
        try:
            timeline = [{"time": now, "event": "Breach discovered"}, {"time": now, "event": "Incident closed"}]
            pdf_bytes2, sha2, fn2 = pdf_svc.generate_audit_report(sample_incident, timeline)
            self.append_row('reports_sent.csv', {
                'report_id': 'REP-000002', 'generated_at': now, 'generated_by': 'SYSTEM',
                'report_type': 'AUDIT_REPORT', 'incident_id': 'INC-001',
                'request_id': '', 'customer_id': '', 'recipient': 'SELF_DOWNLOAD',
                'delivery_channel': 'DOWNLOAD_ONLY', 'delivery_status': 'DOWNLOADED',
                'pdf_filename': fn2, 'pdf_sha256': sha2, 'notes': 'Sample closed incident audit report',
            })
        except Exception as e:
            logging.getLogger(__name__).error(f"Seed Audit PDF error: {e}")

    def find_customer(self, customer_id):
        rows = self.read_csv('customers.csv')
        for r in rows:
            if r['customer_id'] == customer_id:
                return r
        return None

    def find_customer_by_email(self, email):
        rows = self.read_csv('customers.csv')
        for r in rows:
            if r.get('email', '').lower() == email.lower():
                return r
        return None
