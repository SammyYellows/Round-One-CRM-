// Champ's pictures (Sammy; the seven of 11/10/2026), one at a time, changing
// every 45 minutes. Worked out from the clock, so everyone sees the same one.
// Shared by the Champ page and the small Ask Champ on Enquiries.

export const PHOTOS = Array.from({ length: 7 }, (_, i) => `/champ/champ-${i + 1}.webp`);
const ROTATE_MS = 45 * 60e3;
export const photoNow = () => PHOTOS[Math.floor(Date.now() / ROTATE_MS) % PHOTOS.length];
