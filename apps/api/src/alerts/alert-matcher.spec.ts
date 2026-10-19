import { alertDedupeKey, alertMatchesPharmacy } from './alert-matcher.service';

const prishtina = { city: 'Prishtinë', latitude: 42.6629, longitude: 21.1655 };
const prizren = { city: 'Prizren', latitude: 42.2139, longitude: 20.7397 };
const none = { preferredCity: null, latitude: null, longitude: null, radiusKm: null };

describe('alertMatchesPharmacy', () => {
  it('matches everywhere when the alert has no location preference', () => {
    expect(alertMatchesPharmacy(none, prishtina)).toBe(true);
    expect(alertMatchesPharmacy(none, prizren)).toBe(true);
  });

  it('matches the preferred city case- and accent-insensitively', () => {
    const alert = { ...none, preferredCity: 'prishtine' };
    expect(alertMatchesPharmacy(alert, prishtina)).toBe(true);
    expect(alertMatchesPharmacy(alert, prizren)).toBe(false);
  });

  it('matches by radius around a point', () => {
    const alert = { ...none, latitude: 42.65, longitude: 21.16, radiusKm: 5 };
    expect(alertMatchesPharmacy(alert, prishtina)).toBe(true);
    expect(alertMatchesPharmacy(alert, prizren)).toBe(false);
  });
});

describe('alertDedupeKey', () => {
  it('is stable per alert + availability event', () => {
    expect(alertDedupeKey('a1', 'h1')).toBe(alertDedupeKey('a1', 'h1'));
    expect(alertDedupeKey('a1', 'h1')).not.toBe(alertDedupeKey('a1', 'h2'));
    expect(alertDedupeKey('a1', 'h1')).not.toBe(alertDedupeKey('a2', 'h1'));
  });
});
