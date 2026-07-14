# Maarif KUAL Extension Design

## Amaç ve kapsam

Kindle Touch üzerindeki birbiriyle çakışan `maarif-dashboard` ve
`onlinescreensaver` kurulumları tek bir `maarif` KUAL extension'ıyla
değiştirilecek. Extension, linkss'in `/mnt/us/linkss/screensavers/bg_ss00.png`
dosyasını yönetir; KUAL, MRInstaller, linkss, KOReader ve kullanıcı kitaplarına
dokunmaz. Normal çalışma zamanlarında ekran üç saatte bir güncellenir.
03:00:00–03:59:59 aralığında ağ isteği yapılmadan tamamen beyaz görsel
gösterilir. 04:00'te beyaz pencere derhal kapanır: önce doğrulanmış son başarılı
görsel geri yüklenir, ardından ağdan güncel görsel alınmaya çalışılır.

USB bağlantısı Kindle'ın salt-okunur sistem bölümünü göstermediğinden ilk
kurulum iki aşamalıdır. Dosyalar USB üzerinden `extensions/maarif` altına
kopyalanır. Cihaz çıkarıldıktan sonra KUAL'daki “Kur ve başlat” eylemi
`/etc/upstart/maarif.conf` işini atomik olarak kurar ve servisi başlatır. İş,
`lab126_gui` başladıktan sonra çalışır; böylece reboot sonrasında KUAL'ı tekrar
açmak gerekmez. “Durdur” yalnızca servisi durdurur, “Otomatik başlatmayı kaldır”
upstart işini de siler. Kurulum ve kaldırma sırasında kök dosya sistemi her
durumda yeniden salt-okunur yapılır.

## Mimari ve veri akışı

`daemon.sh` tek süreçtir ve PID kilidiyle ikinci kopyayı engeller. Göreli
`sleep 10800` zinciri kullanılmaz. Bunun yerine her döngüde bir sonraki duvar
saati sınırı hesaplanır: 03:00, 04:00 ve 04:00'ten sonra üç saatlik sınırlar
(07:00, 10:00, 13:00, 16:00, 19:00, 22:00); gece de beyaz pencereye yetişmek
için 00:00 ve 03:00 sınırları korunur. Kindle uykuya geçerken `rtcWakeup`
kalan saniyeye ayarlanır; beklenmeyen erken uyanış döngüyü bozmaz, hedef saate
kadar yeniden beklenir. Saat geriye/ileriye alınırsa hedef her turda yeniden
hesaplanır.

`refresh.sh`, endpoint'ten geçici bir dosyaya indirir. İndirilen veri PNG
imzası, sıfırdan büyük boyut ve linkss `identify` sonucu ile doğrulanır;
ardından linkss `convert` ile 600×800, 8-bit grayscale ve doğru yönelimde yeni
bir geçici dosyaya dönüştürülür. Yalnızca bütün kontroller geçerse hedef görsel
ve `state/last-good.png` atomik `mv` ile değiştirilir. İndirme, TLS, dönüşüm
veya depolama hatasında mevcut hedefe dokunulmaz; hedef kayıpsa son iyi görsel
kurulur. Son iyi görsel de yoksa paketle gelen güvenli başlangıç görseli
kullanılır. Beyaz görsel asla son iyi görselin üzerine yazılmaz.

## Hata yönetimi ve doğrulama

Tüm shell dosyaları Kindle'ın BusyBox `/bin/sh` ortamına uygun olacak; Bash'e
özgü sözdizimi kullanılmayacak. Ağ denemeleri sınırlı süreli ve sınırlı sayıda
olacak. Wi-Fi kapalıysa geçici olarak açılacak, işlem sonunda başlangıçtaki
durumuna döndürülecek. USB mass-storage bağlıyken `/mnt/us` güvenli biçimde
kullanılamayabileceğinden daemon güncellemeyi atlayıp kısa aralıkla tekrar
deneyecek. Log boyutu sınırlandırılacak ve her kritik geçişin nedeni yazılacak.

Node testleri; menü/manifest bütünlüğünü, upstart kurulumunu, tek süreç
kilidini, tam saat hesabını, beyaz pencereyi, atomik son-iyi politikasını,
çevrimdışı fallback'i, PNG doğrulamasını ve eski extension adlarının
bulunmadığını kontrol edecek. Ayrı bir host test düzeneği sahte `date`, `curl`,
`lipc-*`, `eips` ve `convert` komutlarıyla gerçek shell scriptlerini çalıştırıp
03:xx beyaz, 04:xx fallback+download, başarılı indirme ve ağ hatası senaryolarını
kanıtlayacak. Dağıtımdan önce tüm testler, JSON/XML parse kontrolleri, `sh -n`,
dosya izinleri ve kaynak–Kindle checksum eşitliği doğrulanacak. Cihaz sistem
bölümüne kurulum ve gerçek reboot davranışı ancak KUAL eyleminden sonra cihaz
üzerinde gözlemlenebilir; extension bu doğrulamayı USB'ye yazılan `status.log`
ve “Durum yaz” eylemiyle görünür kılacak.
