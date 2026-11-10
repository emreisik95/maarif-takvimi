#!/bin/sh
# Maarif Kindle eklentisi — ayarlar.
# Değiştirmek için bu dosyaya dokunma: aynı klasöre maarif.cfg koy ve içine
# yalnızca değiştirmek istediğin satırları yaz (ör. IMAGE_URL=...).

MAARIF_BASE="${MAARIF_BASE:-/mnt/us/extensions/maarif}"

IMAGE_URL="${IMAGE_URL:-https://maarif-takvimi.external.emre.zip/image-landscape/auto.png}"
# Sunucu 800x600 yatay görsel verir; panel 600x800 dikeydir.
IMAGE_ROTATION="${IMAGE_ROTATION:-90}"
SCREEN_SIZE="${SCREEN_SIZE:-600x800}"

# Yerel saatle yenileme anları. WHITE_HOUR saatinde (03:00-03:59) ekran
# beyaza çekilir (e-ink yanığına karşı); 04:00'te takvim geri gelir.
SCHEDULE="${SCHEDULE:-01:00 03:00 04:00 07:00 10:00 13:00 16:00 19:00 22:00}"
WHITE_HOUR="${WHITE_HOUR:-3}"

# Başarısız yenilemede kısa aralıkla tekrar dene, sonra bir sonraki ana bırak.
RETRY_DELAY="${RETRY_DELAY:-300}"
RETRY_MAX="${RETRY_MAX:-3}"
# Tek yenilemenin duvar saatiyle üst sınırı (uyku dahil); aşılırsa öldürülür.
REFRESH_TIMEOUT="${REFRESH_TIMEOUT:-420}"
# Yenileme sürerken cihaz uykuya geçerse bu kadar saniye sonra uyandır.
SUSPEND_RETRY="${SUSPEND_RETRY:-90}"
# Ana döngünün tek seferde en uzun bekleme süresi.
MAX_WAIT="${MAX_WAIT:-600}"

WIFI_TIMEOUT="${WIFI_TIMEOUT:-90}"
DOWNLOAD_ATTEMPTS="${DOWNLOAD_ATTEMPTS:-3}"
DOWNLOAD_RETRY_DELAY="${DOWNLOAD_RETRY_DELAY:-10}"
CURL_CONNECT_TIMEOUT="${CURL_CONNECT_TIMEOUT:-20}"
CURL_MAX_TIME="${CURL_MAX_TIME:-90}"
MIN_STANDARD_DEVIATION="${MIN_STANDARD_DEVIATION:-0.005}"

STATE_DIR="${MAARIF_STATE_DIR:-$MAARIF_BASE/state}"
RUN_DIR="${MAARIF_RUN_DIR:-/tmp/maarif}"
ENABLED_FILE="${MAARIF_ENABLED_FILE:-$MAARIF_BASE/enabled}"
TARGET_IMAGE="${MAARIF_TARGET_IMAGE:-/mnt/us/linkss/screensavers/bg_ss00.png}"
LAST_GOOD_IMAGE="${MAARIF_LAST_GOOD_IMAGE:-$STATE_DIR/last-good.png}"
WHITE_IMAGE="${MAARIF_WHITE_IMAGE:-$MAARIF_BASE/assets/white.png}"
FALLBACK_IMAGE="${MAARIF_FALLBACK_IMAGE:-$MAARIF_BASE/assets/fallback.png}"
CA_CERT="${MAARIF_CA_CERT:-$MAARIF_BASE/assets/isrg-root-x1.pem}"
LOG_FILE="${MAARIF_LOG_FILE:-/mnt/us/maarif.log}"
STATUS_FILE="${MAARIF_STATUS_FILE:-/mnt/us/maarif-status.txt}"
LOG_MAX_BYTES="${LOG_MAX_BYTES:-262144}"
UPSTART_JOB="${MAARIF_UPSTART_JOB:-/etc/upstart/maarif.conf}"

CURL_BIN="${CURL_BIN:-curl}"
CONVERT_BIN="${CONVERT_BIN:-/mnt/us/linkss/bin/convert}"
IDENTIFY_BIN="${IDENTIFY_BIN:-/mnt/us/linkss/bin/identify}"
LIPC_GET_BIN="${LIPC_GET_BIN:-lipc-get-prop}"
LIPC_SET_BIN="${LIPC_SET_BIN:-lipc-set-prop}"
LIPC_WAIT_BIN="${LIPC_WAIT_BIN:-lipc-wait-event}"
EIPS_BIN="${EIPS_BIN:-eips}"
SYNC_BIN="${SYNC_BIN:-sync}"
SLEEP_BIN="${SLEEP_BIN:-sleep}"
DATE_BIN="${DATE_BIN:-date}"
OD_BIN="${OD_BIN:-od}"
TR_BIN="${TR_BIN:-tr}"
AWK_BIN="${AWK_BIN:-awk}"
MNTROOT_BIN="${MNTROOT_BIN:-mntroot}"
START_BIN="${START_BIN:-start}"
STOP_BIN="${STOP_BIN:-stop}"

# Kullanıcı ayarları (varsa) en son okunur.
[ -f "$MAARIF_BASE/maarif.cfg" ] && . "$MAARIF_BASE/maarif.cfg"
