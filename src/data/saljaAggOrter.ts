// Lokal SEO – orter att rangera på "sälja ägg [ort]"
// Län används för internlänkning och sammanhang i texten.

export type Ort = {
  slug: string;        // URL-slug (gemener, bindestreck)
  name: string;        // Visningsnamn
  lan: string;         // Län
  region: 'Götaland' | 'Svealand' | 'Norrland';
  invanare?: string;   // Ungefärligt antal invånare (för text)
  narliggande?: string[]; // slugs på närliggande orter (intern länkning)
};

export const ORTER: Ort[] = [
  // Storstad & tätorter – Götaland
  { slug: 'goteborg', name: 'Göteborg', lan: 'Västra Götalands län', region: 'Götaland', invanare: '600 000', narliggande: ['molndal', 'kungalv', 'partille', 'lerum', 'boras'] },
  { slug: 'malmo', name: 'Malmö', lan: 'Skåne län', region: 'Götaland', invanare: '360 000', narliggande: ['lund', 'helsingborg', 'trelleborg', 'staffanstorp'] },
  { slug: 'lund', name: 'Lund', lan: 'Skåne län', region: 'Götaland', invanare: '95 000', narliggande: ['malmo', 'eslov', 'lomma', 'staffanstorp'] },
  { slug: 'helsingborg', name: 'Helsingborg', lan: 'Skåne län', region: 'Götaland', invanare: '115 000', narliggande: ['angelholm', 'landskrona', 'malmo'] },
  { slug: 'angelholm', name: 'Ängelholm', lan: 'Skåne län', region: 'Götaland', invanare: '25 000', narliggande: ['helsingborg', 'bastad'] },
  { slug: 'bastad', name: 'Båstad', lan: 'Skåne län', region: 'Götaland', invanare: '5 500', narliggande: ['angelholm', 'laholm'] },
  { slug: 'kristianstad', name: 'Kristianstad', lan: 'Skåne län', region: 'Götaland', invanare: '40 000', narliggande: ['hassleholm', 'simrishamn', 'ystad'] },
  { slug: 'ystad', name: 'Ystad', lan: 'Skåne län', region: 'Götaland', invanare: '20 000', narliggande: ['simrishamn', 'kristianstad', 'trelleborg'] },
  { slug: 'simrishamn', name: 'Simrishamn', lan: 'Skåne län', region: 'Götaland', invanare: '7 000', narliggande: ['ystad', 'kristianstad'] },
  { slug: 'trelleborg', name: 'Trelleborg', lan: 'Skåne län', region: 'Götaland', invanare: '30 000', narliggande: ['malmo', 'ystad'] },
  { slug: 'eslov', name: 'Eslöv', lan: 'Skåne län', region: 'Götaland', invanare: '20 000', narliggande: ['lund', 'hassleholm'] },
  { slug: 'hassleholm', name: 'Hässleholm', lan: 'Skåne län', region: 'Götaland', invanare: '20 000', narliggande: ['kristianstad', 'eslov'] },
  { slug: 'landskrona', name: 'Landskrona', lan: 'Skåne län', region: 'Götaland', invanare: '30 000', narliggande: ['helsingborg', 'lomma'] },
  { slug: 'lomma', name: 'Lomma', lan: 'Skåne län', region: 'Götaland', invanare: '12 000', narliggande: ['lund', 'malmo'] },
  { slug: 'staffanstorp', name: 'Staffanstorp', lan: 'Skåne län', region: 'Götaland', invanare: '15 000', narliggande: ['lund', 'malmo'] },
  { slug: 'laholm', name: 'Laholm', lan: 'Hallands län', region: 'Götaland', invanare: '6 500', narliggande: ['halmstad', 'bastad'] },
  { slug: 'halmstad', name: 'Halmstad', lan: 'Hallands län', region: 'Götaland', invanare: '70 000', narliggande: ['laholm', 'falkenberg', 'varberg'] },
  { slug: 'falkenberg', name: 'Falkenberg', lan: 'Hallands län', region: 'Götaland', invanare: '25 000', narliggande: ['halmstad', 'varberg'] },
  { slug: 'varberg', name: 'Varberg', lan: 'Hallands län', region: 'Götaland', invanare: '35 000', narliggande: ['falkenberg', 'kungsbacka'] },
  { slug: 'kungsbacka', name: 'Kungsbacka', lan: 'Hallands län', region: 'Götaland', invanare: '25 000', narliggande: ['goteborg', 'varberg', 'molndal'] },
  { slug: 'molndal', name: 'Mölndal', lan: 'Västra Götalands län', region: 'Götaland', invanare: '70 000', narliggande: ['goteborg', 'kungsbacka', 'partille'] },
  { slug: 'partille', name: 'Partille', lan: 'Västra Götalands län', region: 'Götaland', invanare: '40 000', narliggande: ['goteborg', 'lerum'] },
  { slug: 'lerum', name: 'Lerum', lan: 'Västra Götalands län', region: 'Götaland', invanare: '20 000', narliggande: ['goteborg', 'partille', 'alingsas'] },
  { slug: 'alingsas', name: 'Alingsås', lan: 'Västra Götalands län', region: 'Götaland', invanare: '25 000', narliggande: ['lerum', 'boras', 'vargarda'] },
  { slug: 'kungalv', name: 'Kungälv', lan: 'Västra Götalands län', region: 'Götaland', invanare: '25 000', narliggande: ['goteborg', 'stenungsund'] },
  { slug: 'stenungsund', name: 'Stenungsund', lan: 'Västra Götalands län', region: 'Götaland', invanare: '11 000', narliggande: ['kungalv', 'uddevalla'] },
  { slug: 'uddevalla', name: 'Uddevalla', lan: 'Västra Götalands län', region: 'Götaland', invanare: '35 000', narliggande: ['stenungsund', 'trollhattan'] },
  { slug: 'trollhattan', name: 'Trollhättan', lan: 'Västra Götalands län', region: 'Götaland', invanare: '50 000', narliggande: ['vanersborg', 'uddevalla'] },
  { slug: 'vanersborg', name: 'Vänersborg', lan: 'Västra Götalands län', region: 'Götaland', invanare: '25 000', narliggande: ['trollhattan'] },
  { slug: 'boras', name: 'Borås', lan: 'Västra Götalands län', region: 'Götaland', invanare: '75 000', narliggande: ['alingsas', 'ulricehamn', 'goteborg'] },
  { slug: 'ulricehamn', name: 'Ulricehamn', lan: 'Västra Götalands län', region: 'Götaland', invanare: '10 000', narliggande: ['boras', 'jonkoping'] },
  { slug: 'vargarda', name: 'Vårgårda', lan: 'Västra Götalands län', region: 'Götaland', invanare: '6 000', narliggande: ['alingsas'] },
  { slug: 'skovde', name: 'Skövde', lan: 'Västra Götalands län', region: 'Götaland', invanare: '40 000', narliggande: ['mariestad', 'jonkoping'] },
  { slug: 'mariestad', name: 'Mariestad', lan: 'Västra Götalands län', region: 'Götaland', invanare: '16 000', narliggande: ['skovde', 'lidkoping'] },
  { slug: 'lidkoping', name: 'Lidköping', lan: 'Västra Götalands län', region: 'Götaland', invanare: '25 000', narliggande: ['mariestad', 'skovde'] },
  { slug: 'jonkoping', name: 'Jönköping', lan: 'Jönköpings län', region: 'Götaland', invanare: '100 000', narliggande: ['huskvarna', 'vetlanda', 'skovde', 'varnamo'] },
  { slug: 'huskvarna', name: 'Huskvarna', lan: 'Jönköpings län', region: 'Götaland', invanare: '25 000', narliggande: ['jonkoping'] },
  { slug: 'vetlanda', name: 'Vetlanda', lan: 'Jönköpings län', region: 'Götaland', invanare: '14 000', narliggande: ['jonkoping', 'eksjo'] },
  { slug: 'eksjo', name: 'Eksjö', lan: 'Jönköpings län', region: 'Götaland', invanare: '10 000', narliggande: ['vetlanda', 'nassjo'] },
  { slug: 'nassjo', name: 'Nässjö', lan: 'Jönköpings län', region: 'Götaland', invanare: '17 000', narliggande: ['eksjo', 'jonkoping'] },
  { slug: 'varnamo', name: 'Värnamo', lan: 'Jönköpings län', region: 'Götaland', invanare: '20 000', narliggande: ['jonkoping', 'vaxjo'] },
  { slug: 'vaxjo', name: 'Växjö', lan: 'Kronobergs län', region: 'Götaland', invanare: '70 000', narliggande: ['alvesta', 'varnamo', 'kalmar'] },
  { slug: 'alvesta', name: 'Alvesta', lan: 'Kronobergs län', region: 'Götaland', invanare: '8 000', narliggande: ['vaxjo'] },
  { slug: 'kalmar', name: 'Kalmar', lan: 'Kalmar län', region: 'Götaland', invanare: '40 000', narliggande: ['nybro', 'oskarshamn', 'vaxjo'] },
  { slug: 'nybro', name: 'Nybro', lan: 'Kalmar län', region: 'Götaland', invanare: '13 000', narliggande: ['kalmar'] },
  { slug: 'oskarshamn', name: 'Oskarshamn', lan: 'Kalmar län', region: 'Götaland', invanare: '17 000', narliggande: ['kalmar', 'vastervik'] },
  { slug: 'vastervik', name: 'Västervik', lan: 'Kalmar län', region: 'Götaland', invanare: '21 000', narliggande: ['oskarshamn', 'norrkoping'] },
  { slug: 'visby', name: 'Visby', lan: 'Gotlands län', region: 'Götaland', invanare: '24 000' },
  { slug: 'karlskrona', name: 'Karlskrona', lan: 'Blekinge län', region: 'Götaland', invanare: '36 000', narliggande: ['ronneby', 'karlshamn'] },
  { slug: 'ronneby', name: 'Ronneby', lan: 'Blekinge län', region: 'Götaland', invanare: '12 000', narliggande: ['karlskrona', 'karlshamn'] },
  { slug: 'karlshamn', name: 'Karlshamn', lan: 'Blekinge län', region: 'Götaland', invanare: '20 000', narliggande: ['ronneby', 'kristianstad'] },
  { slug: 'linkoping', name: 'Linköping', lan: 'Östergötlands län', region: 'Götaland', invanare: '120 000', narliggande: ['norrkoping', 'mjolby', 'motala'] },
  { slug: 'norrkoping', name: 'Norrköping', lan: 'Östergötlands län', region: 'Götaland', invanare: '100 000', narliggande: ['linkoping', 'finspang', 'soderkoping'] },
  { slug: 'motala', name: 'Motala', lan: 'Östergötlands län', region: 'Götaland', invanare: '30 000', narliggande: ['linkoping', 'mjolby', 'vadstena'] },
  { slug: 'mjolby', name: 'Mjölby', lan: 'Östergötlands län', region: 'Götaland', invanare: '13 000', narliggande: ['linkoping', 'motala'] },
  { slug: 'soderkoping', name: 'Söderköping', lan: 'Östergötlands län', region: 'Götaland', invanare: '7 500', narliggande: ['norrkoping'] },
  { slug: 'finspang', name: 'Finspång', lan: 'Östergötlands län', region: 'Götaland', invanare: '13 000', narliggande: ['norrkoping'] },
  { slug: 'vadstena', name: 'Vadstena', lan: 'Östergötlands län', region: 'Götaland', invanare: '6 000', narliggande: ['motala'] },

  // Svealand
  { slug: 'stockholm', name: 'Stockholm', lan: 'Stockholms län', region: 'Svealand', invanare: '980 000', narliggande: ['solna', 'taby', 'sodertalje', 'nacka', 'huddinge', 'jarfalla'] },
  { slug: 'solna', name: 'Solna', lan: 'Stockholms län', region: 'Svealand', invanare: '85 000', narliggande: ['stockholm', 'sundbyberg'] },
  { slug: 'sundbyberg', name: 'Sundbyberg', lan: 'Stockholms län', region: 'Svealand', invanare: '55 000', narliggande: ['stockholm', 'solna', 'jarfalla'] },
  { slug: 'jarfalla', name: 'Järfälla', lan: 'Stockholms län', region: 'Svealand', invanare: '85 000', narliggande: ['stockholm', 'sundbyberg'] },
  { slug: 'taby', name: 'Täby', lan: 'Stockholms län', region: 'Svealand', invanare: '75 000', narliggande: ['stockholm', 'vallentuna'] },
  { slug: 'vallentuna', name: 'Vallentuna', lan: 'Stockholms län', region: 'Svealand', invanare: '35 000', narliggande: ['taby', 'osteraker'] },
  { slug: 'osteraker', name: 'Österåker', lan: 'Stockholms län', region: 'Svealand', invanare: '47 000', narliggande: ['vallentuna', 'norrtalje'] },
  { slug: 'norrtalje', name: 'Norrtälje', lan: 'Stockholms län', region: 'Svealand', invanare: '17 000', narliggande: ['osteraker'] },
  { slug: 'nacka', name: 'Nacka', lan: 'Stockholms län', region: 'Svealand', invanare: '110 000', narliggande: ['stockholm', 'tyreso', 'varmdo'] },
  { slug: 'varmdo', name: 'Värmdö', lan: 'Stockholms län', region: 'Svealand', invanare: '46 000', narliggande: ['nacka'] },
  { slug: 'tyreso', name: 'Tyresö', lan: 'Stockholms län', region: 'Svealand', invanare: '49 000', narliggande: ['nacka', 'haninge'] },
  { slug: 'haninge', name: 'Haninge', lan: 'Stockholms län', region: 'Svealand', invanare: '95 000', narliggande: ['tyreso', 'nynashamn'] },
  { slug: 'nynashamn', name: 'Nynäshamn', lan: 'Stockholms län', region: 'Svealand', invanare: '14 000', narliggande: ['haninge'] },
  { slug: 'huddinge', name: 'Huddinge', lan: 'Stockholms län', region: 'Svealand', invanare: '115 000', narliggande: ['stockholm', 'botkyrka'] },
  { slug: 'botkyrka', name: 'Botkyrka', lan: 'Stockholms län', region: 'Svealand', invanare: '95 000', narliggande: ['huddinge', 'sodertalje'] },
  { slug: 'sodertalje', name: 'Södertälje', lan: 'Stockholms län', region: 'Svealand', invanare: '75 000', narliggande: ['botkyrka', 'nykvarn'] },
  { slug: 'nykvarn', name: 'Nykvarn', lan: 'Stockholms län', region: 'Svealand', invanare: '11 000', narliggande: ['sodertalje'] },
  { slug: 'uppsala', name: 'Uppsala', lan: 'Uppsala län', region: 'Svealand', invanare: '180 000', narliggande: ['enkoping', 'tierp', 'knivsta'] },
  { slug: 'enkoping', name: 'Enköping', lan: 'Uppsala län', region: 'Svealand', invanare: '25 000', narliggande: ['uppsala', 'vasteras'] },
  { slug: 'knivsta', name: 'Knivsta', lan: 'Uppsala län', region: 'Svealand', invanare: '12 000', narliggande: ['uppsala', 'taby'] },
  { slug: 'tierp', name: 'Tierp', lan: 'Uppsala län', region: 'Svealand', invanare: '5 500', narliggande: ['uppsala'] },
  { slug: 'vasteras', name: 'Västerås', lan: 'Västmanlands län', region: 'Svealand', invanare: '125 000', narliggande: ['enkoping', 'koping', 'eskilstuna'] },
  { slug: 'koping', name: 'Köping', lan: 'Västmanlands län', region: 'Svealand', invanare: '18 000', narliggande: ['vasteras'] },
  { slug: 'eskilstuna', name: 'Eskilstuna', lan: 'Södermanlands län', region: 'Svealand', invanare: '70 000', narliggande: ['vasteras', 'strangnas', 'katrineholm'] },
  { slug: 'strangnas', name: 'Strängnäs', lan: 'Södermanlands län', region: 'Svealand', invanare: '15 000', narliggande: ['eskilstuna', 'sodertalje'] },
  { slug: 'nykoping', name: 'Nyköping', lan: 'Södermanlands län', region: 'Svealand', invanare: '32 000', narliggande: ['katrineholm', 'norrkoping'] },
  { slug: 'katrineholm', name: 'Katrineholm', lan: 'Södermanlands län', region: 'Svealand', invanare: '24 000', narliggande: ['nykoping', 'eskilstuna'] },
  { slug: 'orebro', name: 'Örebro', lan: 'Örebro län', region: 'Svealand', invanare: '125 000', narliggande: ['kumla', 'lindesberg', 'karlskoga'] },
  { slug: 'kumla', name: 'Kumla', lan: 'Örebro län', region: 'Svealand', invanare: '14 000', narliggande: ['orebro'] },
  { slug: 'lindesberg', name: 'Lindesberg', lan: 'Örebro län', region: 'Svealand', invanare: '8 000', narliggande: ['orebro'] },
  { slug: 'karlskoga', name: 'Karlskoga', lan: 'Örebro län', region: 'Svealand', invanare: '28 000', narliggande: ['orebro', 'kristinehamn'] },
  { slug: 'karlstad', name: 'Karlstad', lan: 'Värmlands län', region: 'Svealand', invanare: '65 000', narliggande: ['kristinehamn', 'forshaga', 'arvika'] },
  { slug: 'kristinehamn', name: 'Kristinehamn', lan: 'Värmlands län', region: 'Svealand', invanare: '18 000', narliggande: ['karlstad', 'karlskoga'] },
  { slug: 'arvika', name: 'Arvika', lan: 'Värmlands län', region: 'Svealand', invanare: '14 000', narliggande: ['karlstad'] },
  { slug: 'forshaga', name: 'Forshaga', lan: 'Värmlands län', region: 'Svealand', invanare: '6 000', narliggande: ['karlstad'] },
  { slug: 'falun', name: 'Falun', lan: 'Dalarnas län', region: 'Svealand', invanare: '40 000', narliggande: ['borlange', 'leksand'] },
  { slug: 'borlange', name: 'Borlänge', lan: 'Dalarnas län', region: 'Svealand', invanare: '45 000', narliggande: ['falun'] },
  { slug: 'leksand', name: 'Leksand', lan: 'Dalarnas län', region: 'Svealand', invanare: '6 000', narliggande: ['falun', 'mora'] },
  { slug: 'mora', name: 'Mora', lan: 'Dalarnas län', region: 'Svealand', invanare: '11 000', narliggande: ['leksand'] },
  { slug: 'gavle', name: 'Gävle', lan: 'Gävleborgs län', region: 'Svealand', invanare: '80 000', narliggande: ['sandviken', 'soderhamn'] },
  { slug: 'sandviken', name: 'Sandviken', lan: 'Gävleborgs län', region: 'Svealand', invanare: '25 000', narliggande: ['gavle'] },
  { slug: 'soderhamn', name: 'Söderhamn', lan: 'Gävleborgs län', region: 'Svealand', invanare: '12 000', narliggande: ['gavle', 'hudiksvall'] },
  { slug: 'hudiksvall', name: 'Hudiksvall', lan: 'Gävleborgs län', region: 'Svealand', invanare: '15 000', narliggande: ['soderhamn'] },

  // Norrland
  { slug: 'sundsvall', name: 'Sundsvall', lan: 'Västernorrlands län', region: 'Norrland', invanare: '60 000', narliggande: ['harnosand', 'ornskoldsvik'] },
  { slug: 'harnosand', name: 'Härnösand', lan: 'Västernorrlands län', region: 'Norrland', invanare: '17 000', narliggande: ['sundsvall'] },
  { slug: 'ornskoldsvik', name: 'Örnsköldsvik', lan: 'Västernorrlands län', region: 'Norrland', invanare: '32 000', narliggande: ['sundsvall', 'umea'] },
  { slug: 'ostersund', name: 'Östersund', lan: 'Jämtlands län', region: 'Norrland', invanare: '50 000' },
  { slug: 'umea', name: 'Umeå', lan: 'Västerbottens län', region: 'Norrland', invanare: '90 000', narliggande: ['skelleftea', 'ornskoldsvik'] },
  { slug: 'skelleftea', name: 'Skellefteå', lan: 'Västerbottens län', region: 'Norrland', invanare: '36 000', narliggande: ['umea', 'pitea'] },
  { slug: 'pitea', name: 'Piteå', lan: 'Norrbottens län', region: 'Norrland', invanare: '24 000', narliggande: ['lulea', 'skelleftea'] },
  { slug: 'lulea', name: 'Luleå', lan: 'Norrbottens län', region: 'Norrland', invanare: '50 000', narliggande: ['pitea', 'boden'] },
  { slug: 'boden', name: 'Boden', lan: 'Norrbottens län', region: 'Norrland', invanare: '18 000', narliggande: ['lulea'] },
  { slug: 'kiruna', name: 'Kiruna', lan: 'Norrbottens län', region: 'Norrland', invanare: '17 000' },
];

export function getOrt(slug: string): Ort | undefined {
  return ORTER.find((o) => o.slug === slug);
}

export function ortBySlug(): Map<string, Ort> {
  return new Map(ORTER.map((o) => [o.slug, o]));
}
