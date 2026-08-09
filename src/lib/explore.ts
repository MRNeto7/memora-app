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

// Every Michelin three-star restaurant WORLDWIDE (2025-guide snapshot,
// curated Aug 2026). London's three-stars live in MICHELIN_LONDON above —
// deliberately excluded here to avoid duplicate pins. A handful of 2025
// promotions/demotions may have drifted; reconcile at the February refresh.
export const MICHELIN_THREE_STAR_WORLD: ExploreVenue[] = [
  // France
  { name: 'Guy Savoy', stars: 3, address: 'Monnaie de Paris, 11 Quai de Conti, Paris', lat: 48.8566, lng: 2.3387 },
  { name: 'Alléno Paris au Pavillon Ledoyen', stars: 3, address: '8 Av. Dutuit, Paris', lat: 48.8662, lng: 2.3125 },
  { name: 'Pierre Gagnaire', stars: 3, address: '6 Rue Balzac, Paris', lat: 48.8748, lng: 2.3005 },
  { name: 'Le Cinq', stars: 3, address: 'Four Seasons George V, Paris', lat: 48.8686, lng: 2.3008 },
  { name: 'Epicure', stars: 3, address: 'Le Bristol, 112 Rue du Faubourg Saint-Honoré, Paris', lat: 48.8718, lng: 2.3146 },
  { name: 'Arpège', stars: 3, address: '84 Rue de Varenne, Paris', lat: 48.8557, lng: 2.3178 },
  { name: 'L’Ambroisie', stars: 3, address: '9 Pl. des Vosges, Paris', lat: 48.8555, lng: 2.3655 },
  { name: 'Plénitude — Cheval Blanc Paris', stars: 3, address: '8 Quai du Louvre, Paris', lat: 48.8590, lng: 2.3420 },
  { name: 'Kei', stars: 3, address: '5 Rue Coq Héron, Paris', lat: 48.8646, lng: 2.3417 },
  { name: 'Le Gabriel — La Réserve', stars: 3, address: '42 Av. Gabriel, Paris', lat: 48.8666, lng: 2.3110 },
  { name: 'Le Pré Catelan', stars: 3, address: 'Bois de Boulogne, Paris', lat: 48.8659, lng: 2.2529 },
  { name: 'Table by Bruno Verjus', stars: 3, address: '3 Rue de Prague, Paris', lat: 48.8490, lng: 2.3760 },
  { name: 'Troisgros — Le Bois sans Feuilles', stars: 3, address: 'Ouches, near Roanne', lat: 46.0333, lng: 3.9500 },
  { name: 'Maison Pic', stars: 3, address: '285 Av. Victor Hugo, Valence', lat: 44.9270, lng: 4.8950 },
  { name: 'La Vague d’Or — Cheval Blanc St-Tropez', stars: 3, address: 'Saint-Tropez', lat: 43.2680, lng: 6.6330 },
  { name: 'Mirazur', stars: 3, address: '30 Av. Aristide Briand, Menton', lat: 43.7830, lng: 7.5210 },
  { name: 'La Villa Madie', stars: 3, address: 'Cassis', lat: 43.2110, lng: 5.5430 },
  { name: 'Le Petit Nice — Passedat', stars: 3, address: 'Marseille', lat: 43.2800, lng: 5.3520 },
  { name: 'L’Oustau de Baumanière', stars: 3, address: 'Les Baux-de-Provence', lat: 43.7440, lng: 4.7950 },
  { name: 'Auberge du Vieux Puits', stars: 3, address: 'Fontjoncouse', lat: 43.0350, lng: 2.7930 },
  { name: 'La Table du Castellet', stars: 3, address: 'Le Castellet', lat: 43.2520, lng: 5.7790 },
  { name: 'Le Clos des Sens', stars: 3, address: 'Annecy', lat: 45.9190, lng: 6.1420 },
  { name: 'Flocons de Sel', stars: 3, address: 'Megève', lat: 45.8570, lng: 6.6180 },
  { name: 'La Bouitte', stars: 3, address: 'Saint-Martin-de-Belleville', lat: 45.3810, lng: 6.5060 },
  { name: 'Le 1947 à Cheval Blanc', stars: 3, address: 'Courchevel', lat: 45.4150, lng: 6.6340 },
  { name: 'Christopher Coutanceau', stars: 3, address: 'La Rochelle', lat: 46.1560, lng: -1.1530 },
  { name: 'La Marine — Alexandre Couillon', stars: 3, address: 'Noirmoutier', lat: 47.0290, lng: -2.2880 },
  { name: 'Les Prés d’Eugénie — Michel Guérard', stars: 3, address: 'Eugénie-les-Bains', lat: 43.6550, lng: -0.3850 },
  { name: 'L’Assiette Champenoise', stars: 3, address: 'Tinqueux, Reims', lat: 49.2360, lng: 3.9990 },
  { name: 'Régis et Jacques Marcon', stars: 3, address: 'Saint-Bonnet-le-Froid', lat: 45.1440, lng: 4.4310 },
  { name: 'Maison Lameloise', stars: 3, address: 'Chagny', lat: 46.9090, lng: 4.7520 },
  { name: 'Le Coquillage — Hugo Roellinger', stars: 3, address: 'Saint-Méloir-des-Ondes, Cancale', lat: 48.6540, lng: -1.9270 },
  // Japan
  { name: 'Quintessence', stars: 3, address: 'Shinagawa, Tokyo', lat: 35.6480, lng: 139.7270 },
  { name: 'Joël Robuchon', stars: 3, address: 'Yebisu Garden Place, Tokyo', lat: 35.6440, lng: 139.7130 },
  { name: 'Kanda', stars: 3, address: 'Moto-Azabu, Tokyo', lat: 35.6550, lng: 139.7270 },
  { name: 'Kagurazaka Ishikawa', stars: 3, address: 'Kagurazaka, Tokyo', lat: 35.7020, lng: 139.7400 },
  { name: 'Kohaku', stars: 3, address: 'Kagurazaka, Tokyo', lat: 35.7010, lng: 139.7390 },
  { name: 'Nihonryori RyuGin', stars: 3, address: 'Hibiya, Tokyo', lat: 35.6740, lng: 139.7630 },
  { name: 'Makimura', stars: 3, address: 'Shinagawa, Tokyo', lat: 35.6090, lng: 139.7300 },
  { name: 'L’Osier', stars: 3, address: 'Ginza, Tokyo', lat: 35.6720, lng: 139.7640 },
  { name: 'Sazenka', stars: 3, address: 'Minami-Azabu, Tokyo', lat: 35.6500, lng: 139.7260 },
  { name: 'Kikunoi Honten', stars: 3, address: 'Higashiyama, Kyoto', lat: 34.9990, lng: 135.7810 },
  { name: 'Hyotei', stars: 3, address: 'Nanzenji, Kyoto', lat: 35.0110, lng: 135.7860 },
  { name: 'Kyoto Kitcho Arashiyama', stars: 3, address: 'Arashiyama, Kyoto', lat: 35.0130, lng: 135.6740 },
  { name: 'Nakamura', stars: 3, address: 'Nakagyo, Kyoto', lat: 35.0110, lng: 135.7670 },
  { name: 'Hajime', stars: 3, address: 'Nishi, Osaka', lat: 34.6810, lng: 135.4930 },
  { name: 'Taian', stars: 3, address: 'Chuo, Osaka', lat: 34.6780, lng: 135.5010 },
  { name: 'Kashiwaya', stars: 3, address: 'Senriyama, Osaka', lat: 34.7300, lng: 135.4980 },
  // United States
  { name: 'Eleven Madison Park', stars: 3, address: '11 Madison Ave, New York', lat: 40.7416, lng: -73.9870 },
  { name: 'Le Bernardin', stars: 3, address: '155 W 51st St, New York', lat: 40.7614, lng: -73.9819 },
  { name: 'Per Se', stars: 3, address: '10 Columbus Cir, New York', lat: 40.7683, lng: -73.9830 },
  { name: 'Masa', stars: 3, address: '10 Columbus Cir, New York', lat: 40.7686, lng: -73.9832 },
  { name: 'Chef’s Table at Brooklyn Fare', stars: 3, address: 'Hudson Yards, New York', lat: 40.7550, lng: -73.9960 },
  { name: 'The French Laundry', stars: 3, address: 'Yountville, California', lat: 38.4044, lng: -122.3650 },
  { name: 'SingleThread', stars: 3, address: 'Healdsburg, California', lat: 38.6100, lng: -122.8690 },
  { name: 'Benu', stars: 3, address: 'San Francisco', lat: 37.7850, lng: -122.3990 },
  { name: 'Quince', stars: 3, address: 'San Francisco', lat: 37.7970, lng: -122.4030 },
  { name: 'Atelier Crenn', stars: 3, address: 'San Francisco', lat: 37.7980, lng: -122.4360 },
  { name: 'Addison', stars: 3, address: 'San Diego, California', lat: 32.9440, lng: -117.1900 },
  { name: 'Alinea', stars: 3, address: '1723 N Halsted St, Chicago', lat: 41.9130, lng: -87.6480 },
  { name: 'Smyth', stars: 3, address: '177 N Ada St, Chicago', lat: 41.8860, lng: -87.6520 },
  { name: 'The Inn at Little Washington', stars: 3, address: 'Washington, Virginia', lat: 38.7130, lng: -78.1590 },
  // Spain
  { name: 'El Celler de Can Roca', stars: 3, address: 'Girona', lat: 41.9930, lng: 2.8080 },
  { name: 'Disfrutar', stars: 3, address: 'Barcelona', lat: 41.3880, lng: 2.1530 },
  { name: 'Lasarte', stars: 3, address: 'Barcelona', lat: 41.3920, lng: 2.1610 },
  { name: 'ABaC', stars: 3, address: 'Barcelona', lat: 41.4100, lng: 2.1350 },
  { name: 'Cocina Hermanos Torres', stars: 3, address: 'Barcelona', lat: 41.3840, lng: 2.1400 },
  { name: 'DiverXO', stars: 3, address: 'Madrid', lat: 40.4580, lng: -3.6870 },
  { name: 'Arzak', stars: 3, address: 'San Sebastián', lat: 43.3200, lng: -1.9560 },
  { name: 'Akelarre', stars: 3, address: 'San Sebastián', lat: 43.3220, lng: -2.0110 },
  { name: 'Martín Berasategui', stars: 3, address: 'Lasarte-Oria', lat: 43.2680, lng: -2.0230 },
  { name: 'Azurmendi', stars: 3, address: 'Larrabetzu, Bilbao', lat: 43.2680, lng: -2.8130 },
  { name: 'Quique Dacosta', stars: 3, address: 'Dénia', lat: 38.8450, lng: 0.1210 },
  { name: 'El Cenador de Amós', stars: 3, address: 'Villaverde de Pontones, Cantabria', lat: 43.4230, lng: -3.7180 },
  { name: 'Aponiente', stars: 3, address: 'El Puerto de Santa María, Cádiz', lat: 36.5990, lng: -6.2280 },
  { name: 'Atrio', stars: 3, address: 'Cáceres', lat: 39.4750, lng: -6.3710 },
  { name: 'Noor', stars: 3, address: 'Córdoba', lat: 37.8890, lng: -4.7620 },
  // Germany
  { name: 'Waldhotel Sonnora', stars: 3, address: 'Dreis, Mosel', lat: 49.9550, lng: 6.8320 },
  { name: 'Victor’s Fine Dining by Christian Bau', stars: 3, address: 'Perl-Nennig', lat: 49.5390, lng: 6.3820 },
  { name: 'Aqua', stars: 3, address: 'Wolfsburg', lat: 52.4320, lng: 10.7860 },
  { name: 'The Table Kevin Fehling', stars: 3, address: 'Hamburg', lat: 53.5430, lng: 10.0020 },
  { name: 'Rutz', stars: 3, address: 'Berlin', lat: 52.5280, lng: 13.3870 },
  { name: 'Schwarzwaldstube', stars: 3, address: 'Baiersbronn', lat: 48.5310, lng: 8.3690 },
  { name: 'Restaurant Bareiss', stars: 3, address: 'Baiersbronn', lat: 48.5150, lng: 8.3810 },
  { name: 'JAN', stars: 3, address: 'Munich', lat: 48.1560, lng: 11.5560 },
  { name: 'ES:SENZ', stars: 3, address: 'Grassau, Chiemgau', lat: 47.7810, lng: 12.4520 },
  // Italy
  { name: 'Osteria Francescana', stars: 3, address: 'Modena', lat: 44.6440, lng: 10.9250 },
  { name: 'Le Calandre', stars: 3, address: 'Rubano, Padua', lat: 45.4090, lng: 11.8100 },
  { name: 'Dal Pescatore', stars: 3, address: 'Canneto sull’Oglio, Mantua', lat: 45.1450, lng: 10.3820 },
  { name: 'Da Vittorio', stars: 3, address: 'Brusaporto, Bergamo', lat: 45.6660, lng: 9.7620 },
  { name: 'Enoteca Pinchiorri', stars: 3, address: 'Florence', lat: 43.7690, lng: 11.2620 },
  { name: 'La Pergola', stars: 3, address: 'Rome', lat: 41.9180, lng: 12.4470 },
  { name: 'Piazza Duomo', stars: 3, address: 'Alba', lat: 44.7000, lng: 8.0350 },
  { name: 'Reale', stars: 3, address: 'Castel di Sangro', lat: 41.7840, lng: 14.1070 },
  { name: 'Uliassi', stars: 3, address: 'Senigallia', lat: 43.7190, lng: 13.2170 },
  { name: 'Atelier Moessmer Norbert Niederkofler', stars: 3, address: 'Brunico, South Tyrol', lat: 46.7960, lng: 11.9370 },
  { name: 'Villa Crespi', stars: 3, address: 'Orta San Giulio', lat: 45.7980, lng: 8.4210 },
  // UK beyond London
  { name: 'The Fat Duck', stars: 3, address: 'High St, Bray', lat: 51.5080, lng: -0.7010 },
  { name: 'The Waterside Inn', stars: 3, address: 'Ferry Rd, Bray', lat: 51.5070, lng: -0.7020 },
  { name: 'L’Enclume', stars: 3, address: 'Cartmel, Cumbria', lat: 54.2010, lng: -2.9540 },
  { name: 'Moor Hall', stars: 3, address: 'Aughton, Lancashire', lat: 53.5390, lng: -2.9200 },
  // Switzerland
  { name: 'Schloss Schauenstein', stars: 3, address: 'Fürstenau', lat: 46.7230, lng: 9.4450 },
  { name: 'Restaurant de l’Hôtel de Ville', stars: 3, address: 'Crissier', lat: 46.5450, lng: 6.5740 },
  { name: 'Cheval Blanc by Peter Knogl', stars: 3, address: 'Basel', lat: 47.5600, lng: 7.5880 },
  { name: 'Memories', stars: 3, address: 'Bad Ragaz', lat: 47.0050, lng: 9.5030 },
  // Belgium & Netherlands
  { name: 'Hof van Cleve', stars: 3, address: 'Kruisem', lat: 50.9500, lng: 3.5280 },
  { name: 'Boury', stars: 3, address: 'Roeselare', lat: 50.9440, lng: 3.1310 },
  { name: 'Zilte', stars: 3, address: 'Antwerp', lat: 51.2280, lng: 4.4050 },
  { name: 'De Librije', stars: 3, address: 'Zwolle', lat: 52.5130, lng: 6.0910 },
  // Nordics
  { name: 'Geranium', stars: 3, address: 'Copenhagen', lat: 55.7050, lng: 12.5720 },
  { name: 'noma', stars: 3, address: 'Copenhagen', lat: 55.6830, lng: 12.6110 },
  { name: 'Jordnær', stars: 3, address: 'Gentofte, Copenhagen', lat: 55.7510, lng: 12.5470 },
  { name: 'Maaemo', stars: 3, address: 'Oslo', lat: 59.9070, lng: 10.7660 },
  { name: 'Frantzén', stars: 3, address: 'Stockholm', lat: 59.3360, lng: 18.0540 },
  // Austria
  { name: 'Amador', stars: 3, address: 'Vienna', lat: 48.2540, lng: 16.3600 },
  { name: 'Steirereck', stars: 3, address: 'Stadtpark, Vienna', lat: 48.2050, lng: 16.3800 },
  // Slovenia
  { name: 'Hiša Franko', stars: 3, address: 'Kobarid', lat: 46.2470, lng: 13.5790 },
  // Hong Kong & Macau
  { name: '8½ Otto e Mezzo Bombana', stars: 3, address: 'Central, Hong Kong', lat: 22.2800, lng: 114.1580 },
  { name: 'T’ang Court', stars: 3, address: 'Tsim Sha Tsui, Hong Kong', lat: 22.2950, lng: 114.1690 },
  { name: 'Caprice', stars: 3, address: 'Central, Hong Kong', lat: 22.2870, lng: 114.1580 },
  { name: 'Forum Restaurant', stars: 3, address: 'Causeway Bay, Hong Kong', lat: 22.2790, lng: 114.1830 },
  { name: 'Robuchon au Dôme', stars: 3, address: 'Grand Lisboa, Macau', lat: 22.1890, lng: 113.5420 },
  { name: 'The Eight', stars: 3, address: 'Grand Lisboa, Macau', lat: 22.1890, lng: 113.5430 },
  { name: 'Jade Dragon', stars: 3, address: 'City of Dreams, Macau', lat: 22.1450, lng: 113.5630 },
  // Mainland China & Taiwan
  { name: 'Ultraviolet by Paul Pairet', stars: 3, address: 'Shanghai', lat: 31.2300, lng: 121.4900 },
  { name: 'Xin Rong Ji (Xinyuan South Rd)', stars: 3, address: 'Beijing', lat: 39.9170, lng: 116.4100 },
  { name: 'King’s Joy', stars: 3, address: 'Beijing', lat: 39.9450, lng: 116.4110 },
  { name: 'Le Palais', stars: 3, address: 'Taipei', lat: 25.0500, lng: 121.5170 },
  // Singapore
  { name: 'Odette', stars: 3, address: 'National Gallery, Singapore', lat: 1.2900, lng: 103.8520 },
  { name: 'Les Amis', stars: 3, address: 'Orchard, Singapore', lat: 1.3050, lng: 103.8360 },
  { name: 'Zén', stars: 3, address: 'Bukit Pasoh Rd, Singapore', lat: 1.2800, lng: 103.8410 },
  // South Korea
  { name: 'Mosu', stars: 3, address: 'Hannam, Seoul', lat: 37.5340, lng: 127.0020 },
  { name: 'Mingles', stars: 3, address: 'Gangnam, Seoul', lat: 37.5240, lng: 127.0530 },
  // Thailand & Middle East
  { name: 'Sorn', stars: 3, address: 'Sukhumvit, Bangkok', lat: 13.7220, lng: 100.5780 },
  { name: 'Trèsind Studio', stars: 3, address: 'Palm Jumeirah, Dubai', lat: 25.0990, lng: 55.1180 },
]

/** Everything the Explore layer shows — London depth + the global 3★ tier. */
export const EXPLORE_VENUES: ExploreVenue[] = [...MICHELIN_LONDON, ...MICHELIN_THREE_STAR_WORLD]
