/**
 * The two-letter codes (ISO 3166-1) the "Country/Region of origin" box offers. The API takes the
 * code (`country_code_of_origin`, e.g. "GB"); the names come from the browser's own region names,
 * so no list of names is kept here.
 */
const CODES = (
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ ' +
  'BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ ' +
  'CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ ' +
  'DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR ' +
  'GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY ' +
  'HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP ' +
  'KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY ' +
  'MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ ' +
  'NA NC NE NF NG NI NL NO NP NR NU NZ OM ' +
  'PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW ' +
  'SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ ' +
  'TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ ' +
  'VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW'
).split(' ')

// Built once, on first use: making the names and sorting about 250 of them is the slow part, and
// the dropdown is opened (and its card redrawn) many times, so it must not be redone each time.
let names: Intl.DisplayNames | null = null
let options: { value: string; label: string }[] | null = null

/** The country's name in English ("GB" → "United Kingdom"); the code itself when it has none. */
export function countryName(code: string): string {
  try {
    names ??= new Intl.DisplayNames(['en'], { type: 'region' })
    return names.of(code) ?? code
  } catch {
    return code
  }
}

/** Every country as a dropdown choice, by name, with an empty "Select" first (the same list each time). */
export function countryOptions(): { value: string; label: string }[] {
  if (options) return options
  const collator = new Intl.Collator('en')
  const countries = CODES.map((code) => ({ value: code, label: countryName(code) })).sort(
    (a, b) => collator.compare(a.label, b.label),
  )
  options = [{ value: '', label: 'Select' }, ...countries]
  return options
}
