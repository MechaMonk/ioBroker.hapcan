
/**
* @param {number} hexValue
*/
function hex2string2(hexValue) {
    return hex2string(hexValue).padStart(2, '0');
}

/**
* @param {number} hexValue
*/
function hex2string(hexValue) {
    return hexValue.toString(16).toUpperCase();
}

/**
* @param {number} bcdValue
*/
function bcd2number(bcdValue) {
    const tensDigit = (bcdValue & 0xF0) >> 4;
    const unitDigit = bcdValue & 0x0F;
    return 10 * tensDigit + unitDigit;
}

/**
     * @param {Date} date
     */
function dateToLocalISO(date) {
    const offsetMs = date.getTimezoneOffset() * 60 * 1000;
    const msLocal = date.getTime() - offsetMs;
    const dateLocal = new Date(msLocal);
    const iso = dateLocal.toISOString();
    const isoLocal = iso.slice(0, 19);
    return isoLocal;
}

module.exports = {
    hex2string,
    hex2string2,
    bcd2number,
    dateToLocalISO
};
