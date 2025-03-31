#!/bin/sh
echo "Running create_admin_startup.py..." >> /app/startup.log  # Log to file
python3 /app/create_admin_startup.py 2>&1 | tee -a /app/startup.log  # Capture logs

echo "Starting Steampipe service..." >> /app/startup.log

# Ensure Steampipe service starts and keeps running
while true; do
    steampipe service start
    sleep 5  # Give it some time
    steampipe service status | grep "running" && break
    echo "Retrying Steampipe service start..." >> /app/startup.log
    sleep 2  # Small delay before retrying
done

echo "Starting main app..." >> /app/startup.log
exec python3 /app/app.py



