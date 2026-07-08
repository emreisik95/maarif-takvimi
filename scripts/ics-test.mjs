// ICS mantığı testi — yerel HTTP ile crafted takvim sun, getCalendar('2026-07-07').
import http from 'node:http';

const ICS = `BEGIN:VCALENDAR
PRODID:-//test//TR
VERSION:2.0
CALSCALE:GREGORIAN
BEGIN:VEVENT
UID:daily-10@test
DTSTART;TZID=Europe/Istanbul:20260601T100000
DTEND;TZID=Europe/Istanbul:20260601T110000
RRULE:FREQ=DAILY
SUMMARY:Sabah Toplantisi
END:VEVENT
BEGIN:VEVENT
UID:daily-0030@test
DTSTART;TZID=Europe/Istanbul:20260601T003000
DTEND;TZID=Europe/Istanbul:20260601T013000
RRULE:FREQ=DAILY
EXDATE;TZID=Europe/Istanbul:20260707T003000
SUMMARY:Gece Yarisi (7sinde iptal)
END:VEVENT
BEGIN:VEVENT
UID:weekly-tue@test
DTSTART;TZID=Europe/Istanbul:20260602T140000
DTEND;TZID=Europe/Istanbul:20260602T150000
RRULE:FREQ=WEEKLY;BYDAY=TU
SUMMARY:Haftalik (tasindi)
END:VEVENT
BEGIN:VEVENT
UID:weekly-tue@test
RECURRENCE-ID;TZID=Europe/Istanbul:20260707T140000
DTSTART;TZID=Europe/Istanbul:20260707T160000
DTEND;TZID=Europe/Istanbul:20260707T170000
SUMMARY:Haftalik (16ya tasindi)
END:VEVENT
BEGIN:VEVENT
UID:multiperday@test
DTSTART;TZID=Europe/Istanbul:20260601T090000
DTEND;TZID=Europe/Istanbul:20260601T093000
RRULE:FREQ=DAILY;BYHOUR=9,15;BYMINUTE=0
EXDATE;TZID=Europe/Istanbul:20260707T090000
SUMMARY:Ikili (09 iptal 15 kalir)
END:VEVENT
BEGIN:VEVENT
UID:multiday@test
DTSTART;VALUE=DATE:20260705
DTEND;VALUE=DATE:20260709
SUMMARY:Tatil (5-8)
END:VEVENT
BEGIN:VEVENT
UID:ctrl@test
DTSTART;TZID=Europe/Istanbul:20260707T200000
DTEND;TZID=Europe/Istanbul:20260707T210000
SUMMARY:Kontrol\x01Karakter
END:VEVENT
END:VCALENDAR
`.replace(/\x01/g, '');

const server = http.createServer((_req, res) => { res.writeHead(200, { 'Content-Type': 'text/calendar' }); res.end(ICS); });
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
process.env.CALENDAR_ICS_URL = `http://127.0.0.1:${port}/cal.ics`;

const { getCalendar } = await import('../src/calendar.js');
const out = await getCalendar('2026-07-07');
console.log('TZ =', process.env.TZ, '\nSonuç:');
for (const e of out.events) console.log('  ', e.time, '|', e.title);
console.log('source:', out.source);
server.close();
