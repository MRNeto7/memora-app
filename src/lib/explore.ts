// Explore layer: curated editorial data, shipped statically — zero API
// cost. First collection: Michelin-starred London.
//
// EDITORIAL SNAPSHOT — curated August 2026 from the 2025 guide. Stars
// change every year and restaurants close; refresh this list annually.
// Coordinates are street-level approximations (fine for map pins; the
// user's own memories always come from real place lookups). Plain facts
// only — no Michelin branding or assets.

export interface ExploreVenue {
  name: string
  stars: 1 | 2 | 3
  address: string
  lat: number
  lng: number
}

export const MICHELIN_LONDON: ExploreVenue[] = [
  // ★★★
  { name: 'Restaurant Gordon Ramsay', stars: 3, address: '68 Royal Hospital Rd, Chelsea SW3 4HP', lat: 51.4854, lng: -0.1620 },
  { name: 'Alain Ducasse at The Dorchester', stars: 3, address: '53 Park Ln, Mayfair W1K 1QA', lat: 51.5074, lng: -0.1523 },
  { name: 'Sketch — The Lecture Room & Library', stars: 3, address: '9 Conduit St, Mayfair W1S 2XG', lat: 51.5126, lng: -0.1417 },
  { name: 'Core by Clare Smyth', stars: 3, address: '92 Kensington Park Rd, Notting Hill W11 2PN', lat: 51.5150, lng: -0.2006 },
  { name: 'Hélène Darroze at The Connaught', stars: 3, address: 'Carlos Pl, Mayfair W1K 2AL', lat: 51.5101, lng: -0.1497 },
  { name: 'The Ledbury', stars: 3, address: '127 Ledbury Rd, Notting Hill W11 2AQ', lat: 51.5157, lng: -0.1997 },
  // ★★
  { name: 'Ikoyi', stars: 2, address: '180 Strand WC2R 1EA', lat: 51.5130, lng: -0.1150 },
  { name: 'Kitchen Table', stars: 2, address: '70 Charlotte St, Fitzrovia W1T 4QG', lat: 51.5195, lng: -0.1352 },
  { name: 'La Dame de Pic London', stars: 2, address: '10 Trinity Sq EC3N 4AJ', lat: 51.5104, lng: -0.0785 },
  { name: 'Claude Bosi at Bibendum', stars: 2, address: '81 Fulham Rd, Chelsea SW3 6RD', lat: 51.4924, lng: -0.1690 },
  { name: 'Gymkhana', stars: 2, address: '42 Albemarle St, Mayfair W1S 4JH', lat: 51.5090, lng: -0.1420 },
  { name: 'Da Terra', stars: 2, address: '8 Patriot Sq, Bethnal Green E2 9NF', lat: 51.5300, lng: -0.0555 },
  { name: 'Alex Dilling at Hotel Café Royal', stars: 2, address: '68 Regent St W1B 4DY', lat: 51.5101, lng: -0.1359 },
  { name: 'Brooklands by Claude Bosi', stars: 2, address: '1 Hamilton Pl, Mayfair W1J 7QY', lat: 51.5044, lng: -0.1500 },
  { name: 'Trivet', stars: 2, address: '36 Snowsfields, Bermondsey SE1 3SU', lat: 51.5040, lng: -0.0840 },
  { name: 'Sushi Kanesaka', stars: 2, address: '45 Park Ln, Mayfair W1K 1PN', lat: 51.5065, lng: -0.1512 },
  { name: 'Dinner by Heston Blumenthal', stars: 2, address: '66 Knightsbridge SW1X 7LA', lat: 51.5019, lng: -0.1597 },
  { name: 'A. Wong', stars: 2, address: '70 Wilton Rd, Pimlico SW1V 1DE', lat: 51.4930, lng: -0.1420 },
  // ★
  { name: 'Brat', stars: 1, address: '4 Redchurch St, Shoreditch E1 6JL', lat: 51.5239, lng: -0.0722 },
  { name: 'St. John', stars: 1, address: '26 St John St, Smithfield EC1M 4AY', lat: 51.5205, lng: -0.1017 },
  { name: 'The Clove Club', stars: 1, address: '380 Old St, Shoreditch EC1V 9LT', lat: 51.5266, lng: -0.0824 },
  { name: 'The River Café', stars: 1, address: 'Thames Wharf, Rainville Rd W6 9HA', lat: 51.4826, lng: -0.2230 },
  { name: 'Chez Bruce', stars: 1, address: '2 Bellevue Rd, Wandsworth SW17 7EG', lat: 51.4457, lng: -0.1687 },
  { name: 'La Trompette', stars: 1, address: '3-7 Devonshire Rd, Chiswick W4 2EU', lat: 51.4907, lng: -0.2545 },
  { name: 'Trinity', stars: 1, address: '4 The Polygon, Clapham SW4 0JG', lat: 51.4645, lng: -0.1387 },
  { name: 'Harwood Arms', stars: 1, address: 'Walham Grove, Fulham SW6 1QP', lat: 51.4805, lng: -0.1950 },
  { name: 'The Ritz Restaurant', stars: 1, address: '150 Piccadilly, St James’s W1J 9BR', lat: 51.5070, lng: -0.1415 },
  { name: 'Galvin La Chapelle', stars: 1, address: '35 Spital Sq, Spitalfields E1 6DY', lat: 51.5197, lng: -0.0785 },
  { name: 'Angler', stars: 1, address: '3 South Pl, Moorgate EC2M 2AF', lat: 51.5202, lng: -0.0870 },
  { name: 'Hide', stars: 1, address: '85 Piccadilly, Mayfair W1J 7NB', lat: 51.5062, lng: -0.1450 },
  { name: 'Sollip', stars: 1, address: '8 Melior St, Bermondsey SE1 3QP', lat: 51.5030, lng: -0.0846 },
  { name: 'Evelyn’s Table', stars: 1, address: '28 Rupert St, Soho W1D 6DJ', lat: 51.5113, lng: -0.1330 },
  { name: 'Pied à Terre', stars: 1, address: '34 Charlotte St, Fitzrovia W1T 2NH', lat: 51.5183, lng: -0.1355 },
  { name: 'KOL', stars: 1, address: '9 Seymour St, Marylebone W1H 7BA', lat: 51.5152, lng: -0.1580 },
  { name: 'Sabor', stars: 1, address: '35-37 Heddon St, Mayfair W1B 4BR', lat: 51.5115, lng: -0.1400 },
  { name: 'Amaya', stars: 1, address: 'Halkin Arcade, Motcomb St, Belgravia SW1X 8JT', lat: 51.4990, lng: -0.1560 },
  { name: 'Chishuru', stars: 1, address: '3 Great Titchfield St, Fitzrovia W1W 8AX', lat: 51.5177, lng: -0.1400 },
  { name: 'Akoko', stars: 1, address: '21 Berners St, Fitzrovia W1T 3LP', lat: 51.5177, lng: -0.1367 },
  { name: 'Dorian', stars: 1, address: '105-107 Talbot Rd, Notting Hill W11 2AT', lat: 51.5170, lng: -0.2010 },
  { name: 'Mountain', stars: 1, address: '16-18 Beak St, Soho W1F 9RD', lat: 51.5124, lng: -0.1381 },
  { name: 'Frog by Adam Handling', stars: 1, address: '34-35 Southampton St, Covent Garden WC2E 7HG', lat: 51.5108, lng: -0.1220 },
  { name: 'Luca', stars: 1, address: '88 St John St, Clerkenwell EC1M 4EH', lat: 51.5225, lng: -0.1020 },
  { name: 'Murano', stars: 1, address: '20 Queen St, Mayfair W1J 5PP', lat: 51.5077, lng: -0.1470 },
  { name: 'Jamavar', stars: 1, address: '8 Mount St, Mayfair W1K 3NF', lat: 51.5104, lng: -0.1508 },
  { name: 'Kai Mayfair', stars: 1, address: '65 S Audley St, Mayfair W1K 2QU', lat: 51.5093, lng: -0.1516 },
  { name: 'Cycene', stars: 1, address: '9 Chance St, Shoreditch E1 6JT', lat: 51.5240, lng: -0.0730 },
  { name: 'Humble Chicken', stars: 1, address: '54 Frith St, Soho W1D 4SL', lat: 51.5136, lng: -0.1318 },
  { name: 'Taku', stars: 1, address: '36 Albemarle St, Mayfair W1S 4JE', lat: 51.5088, lng: -0.1422 },
  { name: '64 Goodge Street', stars: 1, address: '64 Goodge St, Fitzrovia W1T 4NF', lat: 51.5203, lng: -0.1373 },
]
