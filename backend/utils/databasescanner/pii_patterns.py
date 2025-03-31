import re

# 🔍 **1. Enhanced PII Regex Patterns**
extracted_patterns = {
    "Email Address": r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b",
    "Phone Number": r"\b(?:\+?(\d{1,3})[-.\s]?)?\(?(\d{2,4})\)?[-.\s]?(\d{3,4})[-.\s]?(\d{3,4})\b",
    "Credit Card Number": r"\b(?:\d[ -]*?){13,19}\b",
    "SSN": r"\b\d{3}-\d{2}-\d{4}\b",
    "Date of Birth": r"\b(?:0[1-9]|1[0-2])[/.-](?:0[1-9]|[12][0-9]|3[01])[/.-](?:19|20)\d{2}\b",
    "IP Address (IPv4)": r"\b(?:\d{1,3}\.){3}\d{1,3}\b",
    "IP Address (IPv6)": r"\b([a-fA-F0-9:]+:+)+[a-fA-F0-9]+\b",
    "Passport Number": r"\b[A-Z]{1,2}\d{6,9}\b",
    "Bank Account Number": r"\b\d{9,18}\b",
    "Aadhaar Number (India)": r"\b\d{4} \d{4} \d{4}\b",
    "PAN Card (India)": r"\b[A-Z]{5}\d{4}[A-Z]\b",
    "Driving License (India)": r"\b[A-Z]{2}\d{2} ?\d{11}\b",
    "National Insurance Number (UK)": r"\b[A-Z]{2}\d{6}[A-Z]\b",
    "NHS Number (UK)": r"\b\d{3} \d{3} \d{4}\b",
    "Vehicle Registration Number (India)": r"\b[A-Z]{2}[ -]?\d{2}[ -]?[A-Z]?[ -]?\d{4}\b",
    "MAC Address": r"\b([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})\b",
    "Bitcoin Address": r"\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b",
    "Routing Number (US)": r"\b\d{9}\b",
}

# 🚦 **2. PII Criticality Levels**
extracted_criticality = {
    "Email Address": "Medium",
    "Phone Number": "Medium",
    "Credit Card Number": "Critical",
    "SSN": "Critical",
    "Date of Birth": "High",
    "IP Address (IPv4)": "Low",
    "IP Address (IPv6)": "Low",
    "Passport Number": "High",
    "Bank Account Number": "High",
    "Aadhaar Number (India)": "Critical",
    "PAN Card (India)": "High",
    "Driving License (India)": "High",
    "National Insurance Number (UK)": "High",
    "NHS Number (UK)": "High",
    "Vehicle Registration Number (India)": "Medium",
    "MAC Address": "Low",
    "Bitcoin Address": "Medium",
    "Routing Number (US)": "High",
}

# 📜 **3. Compliance Standards Mapping**
extracted_compliance_standards = {
    "Email Address": ["GDPR", "CCPA"],
    "Phone Number": ["GDPR", "CCPA"],
    "Credit Card Number": ["PCI DSS"],
    "SSN": ["HIPAA", "GLBA"],
    "Date of Birth": ["GDPR", "CCPA"],
    "IP Address (IPv4)": ["GDPR"],
    "IP Address (IPv6)": ["GDPR"],
    "Passport Number": ["GDPR"],
    "Bank Account Number": ["GLBA", "GDPR"],
    "Aadhaar Number (India)": ["Aadhaar Act", "GDPR"],
    "PAN Card (India)": ["GDPR", "CCPA"],
    "Driving License (India)": ["GDPR", "CCPA"],
    "National Insurance Number (UK)": ["GDPR"],
    "NHS Number (UK)": ["GDPR", "HIPAA"],
    "Vehicle Registration Number (India)": ["GDPR"],
    "MAC Address": ["N/A"],
    "Bitcoin Address": ["N/A"],
    "Routing Number (US)": ["GLBA"],
}
