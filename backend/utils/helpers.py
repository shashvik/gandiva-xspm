import datetime

def serialize_datetime(obj):
    """Helper function to serialize datetime objects"""
    if isinstance(obj, (datetime.datetime, datetime.date)):
        return obj.isoformat()
    return obj 