export function serviceOffer(agency: string) {
  const earlyPartner = agency === 'san-jose-evergreen';
  return {
    version: earlyPartner ? 'sje-free-through-2031-v1' : 'basic-2027-v1',
    freeThrough: earlyPartner ? '2031-12-31' : '2027-06-30',
    billingStarts: earlyPartner ? '2032-01-01' : '2027-07-01',
    headline: earlyPartner
      ? 'Free through December 31, 2031'
      : 'Free until July 1, 2027',
    billingLabel: earlyPartner ? 'January 1, 2032' : 'July 1, 2027',
    description: earlyPartner
      ? 'As an early partner, your district has extended free access through 2031.'
      : 'Try the service at no charge through June 30, 2027.',
    monthlyCents: 7500,
    annualCents: 90000,
    currency: 'USD',
  };
}
