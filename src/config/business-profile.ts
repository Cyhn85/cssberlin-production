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
    'Onlinehandel mit gebrauchter Bekleidung und Gebrauchsartikeln sowie Verkauf auf Flohmaerkten und mobilen Staenden',
  tradeRegistrationAuthority: 'Berlin Spandau',
  tradeStartDate: '2025-11-01',
} as const;

export const businessAddressLines = [
  businessProfile.streetAddress,
  `${businessProfile.postalCode} ${businessProfile.city}`,
  businessProfile.country,
] as const;

export const businessControlRules = {
  publishVatId: true,
  publishTaxNumber: false,
  handoffSourceOfTruth: 'OPERATIONS_AND_HANDOFF.md',
  internalBusinessRecord: 'docs/private/BUSINESS_CONFIDENTIAL.md',
} as const;
