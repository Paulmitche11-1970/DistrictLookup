export const designs = [
  {
    id: 'classic',
    number: '01',
    name: 'Classic',
    path: '/martinez/classic',
    label: 'Search and map, side by side',
    description:
      'The original design. A dedicated address and contact panel keeps the map in view throughout the lookup.',
    bestFor:
      'A standalone district finder with equal emphasis on the answer and the map.',
    lesson:
      'Combines a district map with the immediate contact card seen in focused supervisor locators.',
  },
  {
    id: 'concierge',
    number: '02',
    name: 'Concierge',
    path: '/martinez/concierge',
    label: 'One address. A clear answer.',
    description:
      'A calm, welcoming search page. A rounded contact card sits beside the district map, with a compact council roster below.',
    bestFor:
      'Agencies that want a simple, approachable lookup on their existing website.',
    lesson:
      'Uses the direct address-to-person approach of compact agency lookups, with contact details kept on the page.',
  },
  {
    id: 'explorer',
    number: '03',
    name: 'Explorer',
    path: '/martinez/explorer',
    label: 'The city is the canvas',
    description:
      'An expansive map with a compact search bar and a floating representative card. Browse districts or go straight to an address.',
    bestFor:
      'Residents who want to understand district geography and explore their neighborhood.',
    lesson:
      'Keeps the spatial context of GIS locators while reducing the interface to lookup, district selection, and map controls.',
  },
  {
    id: 'directory',
    number: '04',
    name: 'Presentation',
    path: '/martinez/council',
    label: 'People first',
    description:
      'A council directory with prominent portraits and a built-in address search. Choose a person or let the address identify your representative.',
    bestFor:
      'A council or board landing page that also serves as the district finder.',
    lesson:
      'Connects the portrait rosters common on agency websites directly to the selected district and its map.',
  },
] as const;
export type DesignId = (typeof designs)[number]['id'];
