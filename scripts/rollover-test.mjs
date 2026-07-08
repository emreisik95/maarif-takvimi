import { computeDateContext } from '../src/datetime.js';
import { getHicri, getHizirKasim } from '../src/hijri.js';
function show(label, ms){
  const c = computeDateContext(ms);
  console.log(label.padEnd(11), '| now', String(c.now.hour).padStart(2,'0')+':'+String(c.now.minute).padStart(2,'0'),
    '| rolled:', c.rolled, '| eff:', c.effectiveISO, c.weekdayName, '| DoY:', c.dayOfYear,
    '| hizir:', getHizirKasim(c.effective).tur, getHizirKasim(c.effective).gun,
    '| hicri:', getHicri(c.effective).gun, getHicri(c.effective).ayAdi, getHicri(c.effective).yil);
}
show('18:30 7Tem', Date.UTC(2026,6,7,15,30));
show('19:30 7Tem', Date.UTC(2026,6,7,16,30));
show('23:59 31Ara', Date.UTC(2026,11,31,20,59));
show('15 Oca', Date.UTC(2026,0,15,9,0));
show('05 May', Date.UTC(2026,4,5,9,0));
show('06 May', Date.UTC(2026,4,6,9,0));
show('07 Kas', Date.UTC(2026,10,7,9,0));
show('08 Kas', Date.UTC(2026,10,8,9,0));
