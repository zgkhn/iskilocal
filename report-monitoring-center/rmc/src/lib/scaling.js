/**
 * Merkezi ölçekleme ve formatlama kütüphanesi.
 * Tüm raporlar, grafikler ve export'lar bu fonksiyonları kullanır.
 */

/**
 * Sadece matematiksel ölçekleme (çarpma, bölme, offset) uygular.
 * Grafik verileri için sayısal değer döner.
 */
export function applyScaleMath(value, scale) {
    if (!scale) return value;
    let v = parseFloat(value);
    if (isNaN(v)) return value;

    if (scale.multiply_factor && scale.multiply_factor !== 1) v *= scale.multiply_factor;
    if (scale.divide_factor && scale.divide_factor !== 1 && scale.divide_factor !== 0) v /= scale.divide_factor;
    if (scale.offset_value) v += scale.offset_value;

    return v;
}

/**
 * Sayısal değeri formatlayarak string döner.
 * Binlik ayracı, ondalık ayracı, hassasiyet ve karakter kısıtlaması uygular.
 */
export function formatNumber(value, scale) {
    const v = typeof value === 'number' ? value : parseFloat(value);
    if (isNaN(v)) return String(value);

    let prec = parseInt(scale?.decimal_precision);
    if (isNaN(prec)) prec = 2;
    prec = Math.max(0, Math.min(20, prec));

    const dSep = scale?.decimal_separator ?? ',';
    const tSep = scale?.thousand_separator ?? '.';
    const maxLen = scale?.max_digits;

    let parts = v.toFixed(prec).split('.');
    let intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, tSep || '');
    let res = parts[1] && dSep ? intPart + dSep + parts[1] : intPart + (parts[1] || '');

    if (maxLen && res.length > maxLen) {
        res = res.substring(0, maxLen);
    }

    return res;
}

/**
 * Tam ölçekleme + formatlama. Birim dahil.
 * Tablolarda ve UI'da gösterimde kullanılır.
 */
export function formatScaledValue(rawValue, scale) {
    const scaled = applyScaleMath(rawValue, scale);
    const formatted = formatNumber(scaled, scale);
    const unit = scale?.unit || '';
    return unit ? `${formatted} ${unit}` : formatted;
}
