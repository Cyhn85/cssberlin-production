export const businessProfile = {
  brandName: 'cssberlin.de',
  businessName: 'CSS Berlin',
  ownerName: 'Ceyhun Sabahattin Sorguc',
  streetAddress: 'Am Omnibushof 12',
  postalCode: '13593',
  city: 'Berlin',
  country: 'Deutschland',
  phoneDisplay: '+49 163 263 4020',
  phoneHref: 'tel:+491632634020',
  publicEmail: 'info@cssberlin.de',
  publicEmailHref: 'mailto:info@cssberlin.de',
  websiteUrl: 'https://cssberlin.de',
  websiteHost: 'www.cssberlin.de',
  vatId: 'DE459278750',
  tradeActivity:
    'Onlinehandel mit gebrauchter Bekleidung und Gebrauchsartikeln sowie Verkauf auf Flohmärkten und mobilen Ständen',
  tradeRegistrationAuthority: 'Berlin Spandau',
  tradeStartDate: '2025-11-01',
} as const;

export const businessAddressLines = [
  businessProfile.streetAddress,
  `${businessProfile.postalCode} ${businessProfile.city}`,
  businessProfile.country,
] as const;

/**
 * Price-disclosure wording required by the PAngV (Preisangabenverordnung).
 *
 * German law: wherever a price is shown to a consumer, the same screen has to
 * say whether VAT is included and that shipping comes on top. Missing it is a
 * standard Abmahnung (formal warning + costs), and the site showed no such
 * notice anywhere at all.
 *
 * Which sentence applies depends on the tax status, so it lives here next to
 * `vatId` rather than being typed into each page - one place to change if the
 * business ever moves onto the small-business scheme (§19 UStG).
 *
 * `isKleinunternehmer` is false because businessProfile.vatId is a real VAT ID
 * and businessControlRules.publishVatId is true: a §19 business does not show
 * VAT and would use the second sentence instead.
 */
export const priceDisclosure = {
  isKleinunternehmer: false,
  /** Short form, next to a price in a listing grid. */
  short: 'inkl. MwSt. zzgl. Versand',
  /** Long form for the product page, where the shipping link sits beside it. */
  long: 'Alle Preise inkl. gesetzlicher MwSt., zzgl.',
  /** Used instead of the above if the business ever switches to §19 UStG. */
  kleinunternehmerNotice:
    'Kein Ausweis der Umsatzsteuer gemäß § 19 UStG (Kleinunternehmerregelung).',
} as const;

/** The sentence to render next to a price in a compact spot (cards, lists). */
export const shortPriceNotice = priceDisclosure.isKleinunternehmer
  ? priceDisclosure.kleinunternehmerNotice
  : priceDisclosure.short;

export const businessControlRules = {
  publishVatId: true,
  publishTaxNumber: false,
  handoffSourceOfTruth: 'OPERATIONS_AND_HANDOFF.md',
  internalBusinessRecord: 'docs/private/BUSINESS_CONFIDENTIAL.md',
} as const;
