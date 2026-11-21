/** Private bucket for profile photos: "<your id>/<random>.webp", 2 MB, images only. */
export const AVATARS_BUCKET = "avatars";
/** Profile photos are cropped square and shrunk to this size before upload. */
export const AVATAR_SIDE = 512;
export const FIRST_NAME_MAX = 40;
export const LAST_NAME_MAX = 40;
/** profiles.city allows 80. */
export const CITY_MAX = 80;
/** The little line about you (profiles.bio allows 280; one short line reads best). */
export const LITTLE_LINE_MAX = 120;
