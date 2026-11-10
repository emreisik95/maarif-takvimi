// Günün menüsü — saatli maarif yapraklarındaki gibi mevsimine uygun bir
// çorba, ana yemek, yanında ve tatlı. Tarihe göre sabit (aynı gün aynı menü).

const CORBA = {
  kis: ['Mercimek çorbası', 'Ezogelin çorbası', 'Tarhana çorbası', 'Yayla çorbası', 'Tavuk suyu çorba', 'Paça çorbası', 'İşkembe çorbası', 'Toyga çorbası', 'Un çorbası', 'Kelle paça'],
  bahar: ['Mercimek çorbası', 'Yayla çorbası', 'Tavuk suyu çorba', 'Ezogelin çorbası', 'Sebze çorbası', 'Şehriye çorbası', 'Toyga çorbası', 'Tarhana çorbası'],
  yaz: ['Domates çorbası', 'Cacık', 'Yayla çorbası', 'Sebze çorbası', 'Şehriye çorbası', 'Ayran aşı', 'Mercimek çorbası'],
  guz: ['Mercimek çorbası', 'Tarhana çorbası', 'Ezogelin çorbası', 'Yayla çorbası', 'Tavuk suyu çorba', 'Domates çorbası', 'Toyga çorbası', 'Mantar çorbası'],
};
const ANA = {
  kis: ['Kuru fasulye', 'Etli nohut', 'Lahana sarması', 'Kapuska', 'Pırasa', 'Karnıyarık', 'Hünkârbeğendi', 'Etli bezelye', 'Tas kebabı', 'Fırında tavuk', 'İzmir köfte', 'Ispanak yemeği', 'Etli kereviz', 'Hamsi tava', 'Mantı', 'Patates oturtma'],
  bahar: ['Zeytinyağlı enginar', 'Etli bezelye', 'Taze bakla', 'Ispanak yemeği', 'Kuzu tandır', 'Fırında tavuk', 'İzmir köfte', 'Etli kuru fasulye', 'Mantı', 'Kadınbudu köfte', 'Sebzeli güveç', 'Karnıyarık'],
  yaz: ['Zeytinyağlı taze fasulye', 'Biber dolması', 'Kabak dolması', 'Karnıyarık', 'İmam bayıldı', 'Türlü', 'Izgara köfte', 'Şiş kebap', 'Zeytinyağlı barbunya', 'Kabak mücver', 'Fırında tavuk', 'Patlıcan musakka', 'Çoban kavurma'],
  guz: ['Kuru fasulye', 'Etli nohut', 'Lahana sarması', 'Patlıcan musakka', 'Fırında tavuk', 'İzmir köfte', 'Karnıyarık', 'Etli taze fasulye', 'Mantı', 'Hünkârbeğendi', 'Tas kebabı', 'Mantar sote', 'Kadınbudu köfte', 'Etli bamya'],
};
const YANINDA = ['Pirinç pilavı', 'Bulgur pilavı', 'Şehriyeli pilav', 'Cacık', 'Çoban salata', 'Mevsim salata', 'Turşu', 'Ayran', 'Piyaz', 'Erişte'];
const TATLI = {
  kis: ['Ayva tatlısı', 'Kabak tatlısı', 'Sütlaç', 'Revani', 'Baklava', 'İrmik helvası', 'Tavuk göğsü', 'Kazandibi', 'Aşure', 'Tahin helvası'],
  bahar: ['Sütlaç', 'Revani', 'Şekerpare', 'Keşkül', 'Muhallebi', 'Tulumba', 'Kazandibi', 'Güllaç'],
  yaz: ['Karpuz', 'Kavun', 'Dondurma', 'Muhallebi', 'Sütlaç', 'Keşkül', 'Kemalpaşa', 'Vişne kompostosu'],
  guz: ['Ayva tatlısı', 'Kabak tatlısı', 'İncir tatlısı', 'Sütlaç', 'Revani', 'Aşure', 'İrmik helvası', 'Kazandibi', 'Şekerpare'],
};

function season(month) {
  if (month === 12 || month <= 2) return 'kis';
  if (month <= 5) return 'bahar';
  if (month <= 8) return 'yaz';
  return 'guz';
}

// Yılın günü + farklı adımlarla döner: ardışık günler farklı yemekler alır.
export function getMenu({ year, month, day }) {
  const doy = Math.round((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 1)) / 86400000);
  const s = season(month);
  const pick = (list, step, offset) => list[(doy * step + offset + year) % list.length];
  return {
    corba: pick(CORBA[s], 3, 1),
    ana: pick(ANA[s], 5, 2),
    yaninda: pick(YANINDA, 7, 3),
    tatli: pick(TATLI[s], 3, 5),
  };
}
