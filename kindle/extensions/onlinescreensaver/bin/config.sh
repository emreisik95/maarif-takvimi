#############################################################################
### ONLINE-SCREENSAVER CONFIGURATION SETTINGS
#############################################################################

# Interval in MINUTES in which to update the screensaver by default. This
# setting will only be used if no schedule (see below) fits. Note that if the
# update fails, the script is not updating again until INTERVAL minutes have
# passed again. So chose a good compromise between updating often (to make
# sure you always have the latest image) and rarely (to not waste battery).
DEFAULTINTERVAL=180

# Schedule for updating the screensaver. Use checkschedule.sh to check whether
# the format is correctly understood. 
#
# The format is a space separated list of settings for different times of day:
#       SCHEDULE="00:00-03:00=60 03:00-04:00=60 04:00-24:00=180"
# where each setting is of the format
#       STARTHOUR:STARTMINUTE-ENDHOUR:ENDMINUTE=INTERVAL
# where
#       STARTHOUR:STARTMINUTE is the time this setting starts taking effect
#       ENDHOUR:ENDMINUTE is the time this setting stops being active
#       INTERVAL is the interval in MINUTES in which to update the screensaver
#
# Time values must be in 24 hour format and not wrap over midnight.
# EXAMPLE: "00:00-06:00=480 06:00-18:00=15 18:00-24:00=30"
#          -> Between midnight and 6am, update every 4 hours
#          -> Between 6am and 6pm (18 o'clock), update every 15 minutes
#          -> Between 6pm and midnight, update every 30 minutes
#
# Use the checkschedule.sh script to verify that the setting is correct and
# which would be the active interval.
SCHEDULE="00:00-03:00=60 03:00-04:00=60 04:00-24:00=180"

# URL of screensaver image. This really must be in the EXACT resolution of
# your Kindle's screen (e.g. 600x800 or 758x1024) and really must be PNG.
#IMAGE_URI="http://enter.the.domain/here/and/the/path/to/the/image.png"
IMAGE_URI="https://maarif-takvimi.external.emre.zip/image-landscape/auto.png"
WHITE_IMAGE="/mnt/us/extensions/onlinescreensaver/bin/white.png"
LAST_GOOD_IMAGE="/mnt/us/extensions/onlinescreensaver/bin/last-good.png"

# folder that holds the screensavers
SCREENSAVERFOLDER=/mnt/us/linkss/screensavers/

# In which file to store the downloaded image. Make sure this is a valid
# screensaver file. E.g. check the current screensaver folder to see what
# the first filename is, then just use this. THIS FILE WILL BE OVERWRITTEN!
SCREENSAVERFILE=/mnt/us/linkss/screensavers/bg_ss00.png

# Exact e-ink panel geometry (WxH). update.sh force-resizes the downloaded image
# to this so it always fills the screen 1:1. This device is 600x800.
SCREEN_SIZE=600x800

# Clockwise ImageMagick rotation before fitting to the panel. Keep 0 for the
# portrait endpoint; use 90 or -90 with an 800x600 landscape endpoint depending
# on which side of the Kindle will face upward.
IMAGE_ROTATION=90

# Whether to create log output (1) or not (0).
LOGGING=1

# Where to log to - either /dev/stderr for console output, or an absolute
# file path (beware that this may grow large over time!)
#LOGFILE=/dev/stderr
LOGFILE=/mnt/us/onlinescreensaver.log

# whether to disable WiFi after the script has finished (if WiFi was off
# when the script started, it will always turn it off)
DISABLE_WIFI=0

# The image URL itself is the connectivity check. A sleeping Kindle can need
# some time to reassociate with Wi-Fi, so retry a bounded number of times.
DOWNLOAD_ATTEMPTS=3
DOWNLOAD_RETRY_DELAY=10
CURL_CONNECT_TIMEOUT=20
CURL_MAX_TIME=90



#############################################################################
# Advanced
#############################################################################

# the real-time clock to use (0, 1 or 2)
# Modified =1 for Kindle Touch
RTC=1

# the temporary file to download the screensaver image to
TMPFILE=/tmp/tmp.onlinescreensaver.png

# webhook address, used for example in Home Assistant to retrieve battery %
# i.e. WEBHOOKADR="<HomeAssistantURL>/api/webhook/kindle-battery-update-hook"
WEBHOOKADR=""
