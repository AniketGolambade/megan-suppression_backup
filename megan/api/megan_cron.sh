#!/usr/bin/bash
echo "$(date '+%Y-%m-%d %H:%M:%S') - Calling API" >> /home/megan/public_html/api/megan_cron_log.txt
curl -X GET http://megan.lopsolutions.com:9001/api/exportfile >> /home/megan/public_html/api/megan_cron_log.txt 2>&1