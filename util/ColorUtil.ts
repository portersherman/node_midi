export const rgbToHsv = (r, g, b) => {
    r /= 127.0;
    g /= 127.0;
    b /= 127.0;
    let v = Math.max(r, g, b), c = v - Math.min(r, g, b);
    let h = c && ((v == r) ? (g - b) / c : ((v == g) ? 2 + (b - r) / c : 4 + (r - g) / c));
    return {
        hue: Math.floor((60 * (h < 0 ? h + 6 : h) / 360.0) * 65535),
        sat: Math.floor(v && c / v * 254),
        bri: Math.floor(v * 254)
    };
}