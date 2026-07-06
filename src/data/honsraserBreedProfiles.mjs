// Kompanjonsfil till honsraserBreedProfiles.ts – innehåller endast fältet
// som prerender-skriptet behöver (slug, namn, description, faq) så att vi
// slipper köra tsx i bygget. Håll i synk manuellt om raser läggs till.

export const BREED_PRERENDER_PROFILES = [
  { slug: 'silkeshons', namn: 'Silkeshöns', description: 'Silkeshöns är lugna, keliga och lägger ~100 små krämvita ägg per år. Bäst i världen på att ruva – och ovanligt tåliga mot barn.', faq: [
    ['Hur många ägg lägger en silkeshöna per år?', 'Runt 80–120 små krämvita ägg per år. De tar ofta långa pauser för att ruva, så räkna med färre om du har flera ruvperioder.'],
    ['Klarar silkeshöns svensk vinter?', 'Ja, om hönshuset är torrt och dragfritt. Deras dun-lika fjädrar är inte vattentäta, så blöt slask är värre än torr kyla.'],
    ['Är silkeshöns bra för barn?', 'Bland de bästa. De är lugna, tåliga och låter sig lyftas utan att bli stressade. Många använder dem för att lära barn hönsskötsel.'],
    ['Varför ruvar silkeshöns så ofta?', 'De har starka moderinstinkter som avlats fram i århundraden. Många hobbyhönsägare skaffar en silkeshöna enbart för att ruva andra rasers ägg.'],
  ]},
  { slug: 'brahma', namn: 'Brahma', description: 'Brahma är den mjuka jätten bland höns: 4–5 kg, ~150 ägg per år och ett temperament så lugnt att man knappt tror det. Klarar vintern utmärkt.', faq: [
    ['Hur många ägg lägger en brahma per år?', 'Cirka 130–160 stora, ljust beige ägg per år. Räkna med lägre värpning under vintermörkret.'],
    ['Är brahma bra för nybörjare?', 'Ja, trots storleken. De är lugna, långsamma och lätta att hantera. Se bara till att sittpinnen inte är för hög – en brahma landar tungt.'],
    ['Klarar brahma svensk vinter?', 'Utmärkt. De är fjäderrika ända ner på tårna. Håll bara rastgården torr så fjäderbenen inte fryser fast i lera eller blöt snö.'],
    ['Hur mycket plats behöver en brahma?', 'Räkna med minst 1 kvm hönshus per 2 brahma och rejält med rastgård. De är stora djur och behöver plats att röra sig.'],
  ]},
  { slug: 'cochin', namn: 'Cochin', description: 'Cochin är en mjuk, fluffig ras med lugnt lynne. Värper ~140 ljust beige ägg per år, ruvar gärna och passar sällskap.', faq: [
    ['Hur många ägg lägger en cochin per år?', 'Cirka 120–160 medelstora ljust beige ägg per år. Värpningen sjunker rejält när de ruvar, vilket de gör ofta.'],
    ['Är cochin bra för barn?', 'Ja, de är lugna och tåliga och låter sig lyftas. Många familjer skaffar cochin för att just barnen ska kunna vara med i skötseln.'],
    ['Skiljer sig cochin från brahma?', 'De liknar varandra men brahma är lite större och rakare i formen. Cochin är rundare och mjukare i konturen.'],
    ['Hur ska man sköta fjäderbenen på cochin?', 'Håll rastgården torr. Blöt lera fastnar på fotfjädrarna och kan orsaka problem. Klipp försiktigt bort tovor vid behov.'],
  ]},
  { slug: 'orpington', namn: 'Orpington', description: 'Orpington är den fluffiga engelska allroundhönan. Värper ~180 beige ägg per år, är lugn, förlåtande och perfekt för nybörjare.', faq: [
    ['Hur många ägg lägger en orpington per år?', 'Cirka 160–200 stora beige ägg per år. Värpningen håller sig hyfsad även i 3–4-årsåldern, längre än hos hybrider.'],
    ['Vilken orpington-färg är vanligast i Sverige?', 'Guldgul (buff) är klart vanligast, följt av svart och blå. Vitt förekommer men är ovanligare.'],
    ['Är orpington bra för barn?', 'Ja, det är en av de mest nybörjar- och barnvänliga raserna. De är lugna, långsamma och lätta att hantera.'],
    ['Ruvar orpington ofta?', 'Ja, ganska ofta – flera gånger per säsong är vanligt. Vill du inte ha kycklingar behöver du bryta ruvningen aktivt.'],
  ]},
  { slug: 'wyandotte', namn: 'Wyandotte', description: 'Wyandotte är kompakt, vacker och lugn. Värper ~200 krämbeige ägg per år och har ros-kam som klarar svensk vinter fint.', faq: [
    ['Hur många ägg lägger en wyandotte per år?', 'Cirka 180–220 medelstora krämbeige ägg per år. Värpningen är relativt jämn och håller några år.'],
    ['Klarar wyandotte svensk vinter?', 'Ja, mycket bra. Ros-kammen ligger tätt mot huvudet och riskerar sällan frostbett.'],
    ['Vilken wyandotte-färg är vanligast?', 'Silverpärlemor och guldpärlemor är klassikerna, men blå, svart och columbia förekommer också ofta.'],
    ['Är wyandotte bra för nybörjare?', 'Ja. De är lugna, härdiga, värper bra och lever länge – en trygg rekommendation.'],
  ]},
  { slug: 'maran', namn: 'Maran', description: 'Maran är känd för sina djupt chokladbruna ägg. Värper ~180 om året och är en lugn, självständig hobbyhöna.', faq: [
    ['Varför är marans-ägg så mörka?', 'De har ett extra pigmentlager på skalet. Färgen är starkast första året och bleknar sedan gradvis.'],
    ['Hur många ägg lägger en marans per år?', 'Cirka 150–200 ägg per år. Räkna med något färre om du har svarta kopparhalsade linjer, de är avlade för färg snarare än volym.'],
    ['Klarar marans svensk vinter?', 'Ja, bra. De har en solid fjäderdräkt och en måttlig kam som sällan drabbas av frostbett.'],
    ['Kan marans-ägg vara stora?', 'Ja, en mogen marans-höna lägger ofta 65–75 grams ägg. Det är en tydlig plus jämfört med hybridvärpare i samma storleksklass.'],
  ]},
  { slug: 'araucana', namn: 'Araucana', description: 'Araucana är den chilenska rasen som lägger blå till turkosa ägg. Värper ~180 om året och är en pigg, alert flockhöna.', faq: [
    ['Varför är araucana-ägg blå?', 'Blåfärgen sitter i själva skalpigmentet. Öppna ett ägg och du ser att insidan också är blå – till skillnad från marans som bara har färg på ytan.'],
    ['Hur många ägg lägger en araucana per år?', 'Cirka 150–200 ägg per år. Volymen varierar med linje – utställningslinjer värper ofta färre än bruksavlade.'],
    ['Klarar araucana svensk vinter?', 'Ja. Rasen är van vid kalla nätter i Anderna och klarar frost bra om hönshuset är dragfritt.'],
    ['Är araucana lätt att hantera?', 'De är pigga och vill helst inte lyftas. Vill du ha en kelhöna är araucana inte förstahandsvalet – vill du ha en pigg producent av blå ägg är den perfekt.'],
  ]},
  { slug: 'australorp', namn: 'Australorp', description: 'Australorp är en produktiv och lugn ras. Värper ~250 ljusbruna ägg per år och kombinerar volym med snällt temperament.', faq: [
    ['Hur många ägg lägger en australorp per år?', 'I hobbymiljö 220–280 ljusbruna ägg per år. Rekordet för rasen är 364 ägg på 365 dagar, satt 1922–23.'],
    ['Är australorp bra för nybörjare?', 'Ja. De är lugna, snälla och ovanligt produktiva utan att vara känsliga hybrider.'],
    ['Klarar australorp svensk vinter?', 'Ja, mycket bra. Den täta svarta fjäderdräkten isolerar utmärkt.'],
    ['Ruvar australorp ofta?', 'Nej, mindre än den engelska orpingtonen. Vill du ha kycklingar behöver du oftast en ruvande ras vid sidan om.'],
  ]},
  { slug: 'sussex', namn: 'Sussex', description: 'Sussex är engelsk klassiker: pratsam, nyfiken, hänger efter dig i trädgården och lägger ~240 beige ägg per år.', faq: [
    ['Hur många ägg lägger en sussex per år?', 'Cirka 220–260 beige ägg per år. Produktionen håller sig jämn de första 2–3 åren.'],
    ['Vilken sussex-färg är vanligast?', 'Ljus sussex (columbia) är klart vanligast i Sverige, följt av speckled och röd.'],
    ['Är sussex bra i frigång?', 'Ja, de är duktiga födosökare och vaksamma. Håll dig i närheten första veckan så de lär sig var hönshuset är.'],
    ['Ruvar sussex ofta?', 'Nej, oftast inte. De värper hellre än ruvar. Vill du ha kycklingar behöver du en ruvande ras eller kläckningsmaskin.'],
  ]},
  { slug: 'vit-leghorn', namn: 'Vit leghorn', description: 'Vit leghorn är den klassiska italienska värphönan. Cirka 280 rent vita ägg per år. Livlig, flygvillig och effektiv.', faq: [
    ['Hur många ägg lägger en vit leghorn per år?', 'Cirka 250–300 vita ägg per år, vilket är i klass med moderna hybrider men med längre livslängd.'],
    ['Klarar vit leghorn svensk vinter?', 'Med bra hönshus ja, men den stora enkelkammen kan frostbitas. Vaselin på kammen kalla nätter hjälper.'],
    ['Är vit leghorn bra för nybörjare?', 'De är energiska och behöver rovdjurssäker rastgård. En van hönsägare älskar dem, en helt ny kan bli överraskad av tempot.'],
    ['Ruvar vit leghorn?', 'Nästan aldrig. De är avlade för värpning i över hundra år och har tappat de flesta ruvinstinkterna.'],
  ]},
  { slug: 'rhode-island-red', namn: 'Rhode Island Red', description: 'Rhode Island Red är en klassisk amerikansk värpras. Cirka 250 bruna ägg per år, härdig och långlivad.', faq: [
    ['Hur många ägg lägger en Rhode Island Red per år?', 'Cirka 220–280 medelstora bruna ägg per år. Produktionen håller sig hyfsat i 3–4 år.'],
    ['Klarar Rhode Island Red svensk vinter?', 'Ja, mycket bra. Fjäderdräkten är tät och kammen relativt liten.'],
    ['Är RIR-tuppar aggressiva?', 'Vissa linjer har tuppar som kan bli framfusiga mot människor. Välj en lugn tupp från en pålitlig uppfödare om du har barn.'],
    ['Vad är skillnaden mot New Hampshire?', 'New Hampshire är en avläggare av RIR och något ljusare i färgen, snabbare växande och något snällare i temperament.'],
  ]},
  { slug: 'plymouth-rock', namn: 'Plymouth Rock', description: 'Plymouth Rock är den amerikanska klassikern med den svartvita randningen. Trygg, snäll och lägger ~220 ljusbruna ägg per år.', faq: [
    ['Hur många ägg lägger en Plymouth Rock per år?', 'Cirka 200–240 ljust bruna ägg per år. Håller värpningen relativt jämn i 3–4 år.'],
    ['Vilken färg är vanligast i Sverige?', 'Barred Rock (svartvit-randig) är klart vanligast. Vit, buff och columbia förekommer men är ovanligare.'],
    ['Är Plymouth Rock bra för nybörjare?', 'Ja, en av de tryggaste rekommendationerna. Lugna, härdiga och förlåtande.'],
    ['Klarar Plymouth Rock svensk vinter?', 'Utmärkt. Tät fjäderdräkt och kompakt kroppsform gör dem tåliga även i norra Sverige.'],
  ]},
  { slug: 'bielefelder', namn: 'Bielefelder', description: 'Bielefelder är den moderna tyska allroundhönan. Autosexande som kyckling, ~230 stora ljusbruna ägg per år, mycket lugn.', faq: [
    ['Vad betyder autosexande?', 'Att man kan se på kycklingens dun redan vid kläckning om det är en tupp eller höna. Bielefelder är en av få raser där det fungerar tillförlitligt.'],
    ['Hur många ägg lägger en bielefelder per år?', 'Cirka 200–250 stora ljusbruna ägg per år. Äggen är ovanligt stora för en ren ras.'],
    ['Klarar bielefelder svensk vinter?', 'Ja, mycket bra. Tät fjäderdräkt och kompakt kroppsform.'],
    ['Var köper man bielefelder i Sverige?', 'Fortfarande ovanlig men växande. Kolla svenska bielefelder-gruppen på Facebook och hobbyuppfödares egna sidor.'],
  ]},
  { slug: 'vorwerk', namn: 'Vorwerk', description: 'Vorwerk är den vackra tyska bicolour-hönan: guldkropp, svart huvud och stjärt. Cirka 180 ljust beige ägg per år.', faq: [
    ['Hur många ägg lägger en vorwerk per år?', 'Cirka 160–200 ljust beige ägg per år.'],
    ['Är vorwerk lätt att hitta i Sverige?', 'Nej, rasen är ovanlig. Räkna med att importera kläckägg från Tyskland eller kontakta specialintresserade svenska uppfödare.'],
    ['Klarar vorwerk svensk vinter?', 'Ja, bra. Kammen är enkel men liten och sällan frostbiten.'],
    ['Finns vorwerk som dvärgras?', 'Ja, det finns en dvärgvariant (Zwerg-Vorwerk) men den är ännu ovanligare än standardstorleken.'],
  ]},
  { slug: 'welsumer', namn: 'Welsumer', description: 'Welsumer är den holländska rasen bakom "Cornflakes-tuppen" och lägger mörkt terrakotta-bruna, ofta prickiga ägg (~200 om året).', faq: [
    ['Hur många ägg lägger en welsumer per år?', 'Cirka 180–220 ägg per år i en mörk terrakotta-brun färg, ofta med mörka prickar.'],
    ['Vad är skillnaden mellan welsumer och marans?', 'Welsumer-äggen är prickiga och något ljusare, marans-ägg är enfärgat mycket mörka. Welsumer är också något mer produktiv.'],
    ['Klarar welsumer svensk vinter?', 'Ja, bra. Rasen är van vid nordeuropeiskt klimat.'],
    ['Är welsumer bra i frigång?', 'Ja, mycket. De är duktiga födosökare och alerta mot rovdjur utan att vara stressiga.'],
  ]},
  { slug: 'barnevelder', namn: 'Barnevelder', description: 'Barnevelder är den holländska "duplex"-rasen med dubbla fjäderringar och mörkt bruna ägg. Cirka 200 om året och ovanligt snäll.', faq: [
    ['Hur många ägg lägger en barnevelder per år?', 'Cirka 180–220 mörkt bruna ägg per år. Färgen är mörkast tidigt i värpsäsongen.'],
    ['Är barnevelder samma sak som marans?', 'Nej. Båda lägger mörka ägg men barnevelder är något ljusare bruna, mer prickfria, och rasen är mer social av sig.'],
    ['Klarar barnevelder svensk vinter?', 'Ja, bra. Tät fjäderdräkt och lugnt temperament gör dem energieffektiva.'],
    ['Är barnevelder bra för barn?', 'Ja. Rasen är lugn och lätt att hantera, och lockar också med spännande ägg att samla in.'],
  ]},
  { slug: 'faverolle', namn: 'Faverolle', description: 'Faverolle är den franska "5-tåiga" skäggiga rasen: extremt lugn, mycket vinterhärdig och lägger ~180 ljust beige ägg per år.', faq: [
    ['Hur många ägg lägger en faverolle per år?', 'Cirka 160–200 ljust beige eller rosa ägg per år. De värper ovanligt bra även vintertid.'],
    ['Varför har faverolle fem tår?', 'Det är ett gammalt renrasigt drag som ärvts genom historien. Ras-standarden kräver fem tår för att räknas som stambokförd faverolle.'],
    ['Klarar faverolle svensk vinter?', 'Ja, extremt bra. Fjäderrikedomen och skägget skyddar mot kyla.'],
    ['Hur passar faverolle i blandflock?', 'Bäst med andra lugna raser (orpington, cochin, brahma). Undvik att blanda med aggressiva värpraser som annars mobbar dem.'],
  ]},
  { slug: 'new-hampshire', namn: 'New Hampshire', description: 'New Hampshire är den snällare avläggaren av Rhode Island Red. Ljusare i färgen, snabbare växande och lägger ~220 ljusbruna ägg per år.', faq: [
    ['Hur många ägg lägger en new hampshire per år?', 'Cirka 200–240 ljust bruna ägg per år. Värpning börjar ofta redan vid 5–6 månader.'],
    ['Vad är skillnaden mot Rhode Island Red?', 'New Hampshire är ljusare i färgen, växer snabbare och är genomgående snällare i temperamentet.'],
    ['Är new hampshire bra för nybörjare?', 'Ja, en av de tryggare rekommendationerna. Lugna, produktiva och lätta att sköta.'],
    ['Klarar new hampshire svensk vinter?', 'Ja, mycket bra. Rasen har en solid fjäderdräkt och en kompakt kropp.'],
  ]},
  { slug: 'sebright', namn: 'Sebright', description: 'Sebright är en äkta engelsk dvärgras (~600 g) med guld- eller silverspetsade fjädrar. Prydnad framför produktion; ~80 små vita ägg/år.', faq: [
    ['Hur många ägg lägger en sebright per år?', 'Cirka 60–100 mycket små vita ägg. Rasen är inte en värpras.'],
    ['Är sebright bra i blandflock med stora höns?', 'Sällan. Storleksskillnaden gör dem sårbara. Håll sebright i egen flock eller med andra dvärgraser.'],
    ['Kan sebright flyga?', 'Ja, mycket bra. Överbyggd rastgård är i princip ett måste.'],
    ['Klarar sebright svensk vinter?', 'Med torrt, dragfritt hönshus ja, men de är mer känsliga än större raser. Håll ströet extra torrt.'],
  ]},
  { slug: 'hedemorahona', namn: 'Hedemorahöna', description: 'Hedemorahöna är den svenska lantrasen från Dalarna. Extremt vinterhärdig, lägger ~150 krämvita ägg/år och bevaras via genbank.', faq: [
    ['Hur många ägg lägger en hedemorahöna per år?', 'Cirka 130–170 krämvita ägg per år, med typisk paus under mörka vintermånaderna.'],
    ['Är hedemorahönan bra för norra Sverige?', 'Ja, den är förmodligen den mest vinterhärdiga svenska rasen. Fjäderdräkten är tät och kammen liten.'],
    ['Var köper man hedemorahöna?', 'Via Svenska Lanthönsklubbens uppfödarregister eller genom lokala lantras-nätverk.'],
    ['Kan hedemorahönan blandas med andra raser?', 'Ja, de är sociala i blandflock men står upp för sig själva. Undvik bara att blanda med aggressiva RIR-tuppar.'],
  ]},
  { slug: 'gotlandshona', namn: 'Gotlandshöna', description: 'Gotlandshöna är den lilla, pigga svenska lantrasen från Gotland. Duktig värpare för att vara lantras – ~180 vita ägg per år.', faq: [
    ['Hur många ägg lägger en gotlandshöna per år?', 'Cirka 160–200 vita till krämvita ägg per år – hög för en svensk lantras.'],
    ['Kan gotlandshönan flyga?', 'Ja, mycket bra. Rastgården behöver vara hög eller överbyggd om du inte vill hitta dem på tak eller grannens gräsmatta.'],
    ['Är gotlandshönan bra för nybörjare?', 'De är piggare än många hybrider men lätta att sköta. Räkna med att de vill ut och röra på sig.'],
    ['Var köper man stamboksförd gotlandshöna?', 'Via Svenska Lanthönsklubbens uppfödarregister eller lantras-nätverk. Räkna med 250–400 kr per unghöna.'],
  ]},
  { slug: 'olandsk-hona', namn: 'Öländsk höna', description: 'Öländsk dvärghöna är den svenska lantras-dvärgen från Öland. Kompakt (~800 g), pigg, lägger ~120 små vita ägg om året.', faq: [
    ['Hur många ägg lägger en öländsk höna per år?', 'Cirka 100–140 små vita ägg per år, typiskt 35–40 gram.'],
    ['Klarar öländsk dvärg svensk vinter?', 'Ja, förvånansvärt bra för sin storlek. Håll golvet extra torrt och skydda mot drag.'],
    ['Är öländsk höna bra för barn?', 'Ja. Den är liten, lätt att hantera och tåligt tempererad.'],
    ['Var köper man öländsk höna?', 'Via Svenska Lanthönsklubbens uppfödarregister eller lokala lantras-uppfödare.'],
  ]},
  { slug: 'bohuslan-dals-svarthona', namn: 'Bohuslän-Dals svarthöna', description: 'Bohuslän-Dals svarthöna är en ovanlig svensk lantras med svart fjäderdräkt, mörkt skinn och mörka ben. Lägger ~150 krämvita ägg/år.', faq: [
    ['Är Bohuslän-Dals svarthöna samma sak som ayam cemani?', 'Nej. De ser ut som varandra ytligt (svart fjäderdräkt, mörkt skinn) men Bohuslän-Dals svarthöna är svensk lantras med annat genetiskt ursprung.'],
    ['Hur många ägg lägger rasen per år?', 'Cirka 130–170 krämvita ägg per år. Ovanligt bra värpning för en så pass sällsynt ras.'],
    ['Var köper man Bohuslän-Dals svarthöna?', 'Via Svenska Lanthönsklubbens uppfödarregister. Rasen är ovanlig – räkna med väntetid.'],
    ['Klarar rasen svensk vinter?', 'Ja, mycket bra. Fjäderdräkten är tät och rasen är van vid svenskt västkustklimat.'],
  ]},
  { slug: 'kindahona', namn: 'Kindahöna', description: 'Kindahöna är den östgötska svenska lantrasen från Kinda härad. Pigg, självständig och lägger ~160 krämvita ägg per år.', faq: [
    ['Hur många ägg lägger en kindahöna per år?', 'Cirka 140–180 krämvita ägg per år, med typisk vinterpaus.'],
    ['Var köper man kindahöna?', 'Via Svenska Lanthönsklubbens uppfödarregister och lokala nätverk i Östergötland.'],
    ['Är kindahöna bra i frigång?', 'Ja, mycket. De är duktiga födosökare och trivs bäst med tillgång till trädgård.'],
    ['Klarar kindahönan svensk vinter?', 'Ja, mycket bra. Rasen är utvecklad för svenskt klimat.'],
  ]},
  { slug: 'frisisk-hona', namn: 'Frisisk höna', description: 'Frisisk höna är en gammal lantras från Friesland som också bevaras i Sverige. Pigg, flygvillig, ~200 vita ägg per år.', faq: [
    ['Hur många ägg lägger en frisisk höna per år?', 'Cirka 180–220 medelstora vita ägg per år, vilket är högt för en gammal lantras.'],
    ['Kan frisisk höna flyga?', 'Ja, mycket bra. Rastgården behöver vara hög eller överbyggd.'],
    ['Klarar frisisk höna svensk vinter?', 'Ja, bra. Kammen är enkel men rasen är van vid nordeuropeiskt klimat.'],
    ['Var köper man frisisk höna i Sverige?', 'Från specialintresserade uppfödare, ofta via Facebook-grupper för sällsynta europeiska lantraser.'],
  ]},
];
