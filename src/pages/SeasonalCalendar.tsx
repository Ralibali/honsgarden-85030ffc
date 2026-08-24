import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Snowflake, Sprout, Sun, Leaf,
  Egg, Lightbulb, Droplets, Thermometer,
  Heart, Feather, Moon, Apple,
  ChevronLeft, ChevronRight, X,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';

type MonthData = {
  name: string;
  shortName: string;
  season: 'winter' | 'spring' | 'summer' | 'autumn';
  icon: React.ElementType;
  emoji: string;
  title: string;
  description: string;
  tips: string[];
  tasks: string[];
  eggExpectation: 'low' | 'medium' | 'high' | 'peak';
};

const months: MonthData[] = [
  {
    name: 'Januari', shortName: 'Jan', season: 'winter', icon: Snowflake, emoji: '❄️',
    title: 'Vintervilja',
    description: 'Kortaste dagarna. Hönsen behöver extra stöd för att klara kylan.',
    tips: [
      'Kontrollera att vattnet inte fryser – använd värmeplatta under vattenskålen',
      'Ge extra fett i fodret (solrosfrön, hampafrön) för att hålla värmen',
      'Undvik att värma hönshuset – det skapar fuktproblem',
      'Ventilation är viktigt även vintertid för att undvika frostskador på kammar',
    ],
    tasks: ['Kontrollera vatten 2x dagligen', 'Byt strö oftare', 'Tillsätt belysning 14-16h ljus'],
    eggExpectation: 'low',
  },
  {
    name: 'Februari', shortName: 'Feb', season: 'winter', icon: Lightbulb, emoji: '💡',
    title: 'Ljuset återvänder',
    description: 'Dagarna blir längre. Hönsen börjar långsamt öka produktionen.',
    tips: [
      'Ljustillskott kan hjälpa – sikta på 14 timmars ljus totalt',
      'Börja planera för vårens kycklingar om du vill ha ruvägg',
      'Rengör boplatser och fodertråg grundligt',
      'Kontrollera hönornas vikt – de bör vara i bra hull inför värpstart',
    ],
    tasks: ['Rengöring av hönshus', 'Kontrollera ljustimer', 'Beställ foder inför våren'],
    eggExpectation: 'low',
  },
  {
    name: 'Mars', shortName: 'Mar', season: 'spring', icon: Sprout, emoji: '🌱',
    title: 'Vårstart',
    description: 'Äggproduktionen ökar markant med det ökande dagsljuset.',
    tips: [
      'Förvänta en tydlig ökning av ägg – upp till dubbla mot vintern',
      'Se till att hönsen har tillgång till kalk (ostronskal) för starka skal',
      'Börja släppa ut hönsen mer – de behöver frisk luft och motion',
      'Passa på att göra en stor vårstädning av hönshuset',
    ],
    tasks: ['Vårstäda hönshuset', 'Fyll på kalk/grit', 'Avmaska vid behov'],
    eggExpectation: 'medium',
  },
  {
    name: 'April', shortName: 'Apr', season: 'spring', icon: Egg, emoji: '🥚',
    title: 'Full fart',
    description: 'Optimal äggproduktion. Hönsen är aktiva och värper bra.',
    tips: [
      'Perfekt tid att låta hönan ruva om du vill ha kycklingar',
      'Parasiter börjar bli aktiva – håll koll på kvalster',
      'Ge grönt gräs och maskrosblad som tillskott',
      'Kontrollera stängslet inför sommaren',
    ],
    tasks: ['Kontrollera för kvalster', 'Erbjud grönt dagligen', 'Reparera stängsel'],
    eggExpectation: 'high',
  },
  {
    name: 'Maj', shortName: 'Maj', season: 'spring', icon: Heart, emoji: '🐣',
    title: 'Kycklingtid',
    description: 'Bästa månaden för kläckning. Hönsen är på topp.',
    tips: [
      'Idealt att sätta ägg i kläckmaskin nu – 21 dagar till kycklingar',
      'Riklig tillgång på insekter och mask ger extra protein',
      'Håll dagligen koll på ruvande hönor',
      'Bästa tiden att köpa unghöns',
    ],
    tasks: ['Starta kläckning?', 'Extra vatten i värmen', 'Kontrollera reden'],
    eggExpectation: 'peak',
  },
  {
    name: 'Juni', shortName: 'Jun', season: 'summer', icon: Sun, emoji: '☀️',
    title: 'Sommartopp',
    description: 'Längsta dagarna. Maximal äggproduktion men se upp för värme.',
    tips: [
      'Se till att det finns skugga i rastgården',
      'Fräscht vatten är extra viktigt – byt minst 2 gånger om dagen',
      'Ge fryst frukt som godis vid värmebölja',
      'Samla ägg ofta – värmen gör att de förstörs snabbare',
    ],
    tasks: ['Skuggskydd i hagen', 'Extra vattenstation', 'Samla ägg 2x dagligen'],
    eggExpectation: 'peak',
  },
  {
    name: 'Juli', shortName: 'Jul', season: 'summer', icon: Droplets, emoji: '💧',
    title: 'Värmeomsorg',
    description: 'Risk för värmestress. Hönsen kan minska värpningen tillfälligt.',
    tips: [
      'Över 30°C kan vara farligt – ge frysta vattenflaskor i hönshuset',
      'Minska proteinrikt foder vid extrem värme',
      'Hönor som flåsar och håller vingarna ut från kroppen lider av värme',
      'Ge elektrolyter i vattnet vid värmebölja',
    ],
    tasks: ['Kontrollera för värmestress', 'Ge vattenmelon/gurka', 'Ventilera hönshuset'],
    eggExpectation: 'high',
  },
  {
    name: 'Augusti', shortName: 'Aug', season: 'summer', icon: Feather, emoji: '🪶',
    title: 'Ruggningen börjar',
    description: 'Många hönor börjar rugga. Äggproduktionen minskar.',
    tips: [
      'Ruggning är naturligt – hönorna tappar och byter fjädrar',
      'Ge extra protein (mealworms, solrosfrön) för fjädertillväxt',
      'Undvik att stressa hönorna under ruggningen',
      'Förbered hönshuset inför hösten',
    ],
    tasks: ['Extra protein i fodret', 'Undvik hantering', 'Höststäda hönshuset'],
    eggExpectation: 'medium',
  },
  {
    name: 'September', shortName: 'Sep', season: 'autumn', icon: Leaf, emoji: '🍂',
    title: 'Höstförberedelser',
    description: 'Dagarna kortas. Dags att förbereda för vintern.',
    tips: [
      'Isolera hönshuset om det behövs – men behåll ventilation',
      'Samla fallfrukt och ge till hönsen – äpplen och päron är populärt',
      'Avmaska hönsen inför vintern',
      'Kontrollera och reparera hönshuset inför stormar',
    ],
    tasks: ['Isolera hönshuset', 'Avmaskning', 'Reparera tak och väggar'],
    eggExpectation: 'medium',
  },
  {
    name: 'Oktober', shortName: 'Okt', season: 'autumn', icon: Apple, emoji: '🎃',
    title: 'Produktionsnedgång',
    description: 'Äggproduktionen sjunker tydligt. Ruggningen kan fortfarande pågå.',
    tips: [
      'Normal att äggproduktionen halveras jämfört med sommaren',
      'Börja med ljustillskott om du vill bibehålla viss produktion',
      'Pumpakött och frön är utmärkt höstgodis',
      'Se till att hönshuset är torrt och dragfritt',
    ],
    tasks: ['Installera ljustimer', 'Ge pumpagodis', 'Kontrollera tätning'],
    eggExpectation: 'low',
  },
  {
    name: 'November', shortName: 'Nov', season: 'autumn', icon: Moon, emoji: '🌙',
    title: 'Mörka månaden',
    description: 'Kort dagsljus och kallt. Hönsen behöver extra omsorg.',
    tips: [
      'Med belysning kan du få 2-4 ägg/vecka istället för nästan noll',
      'Ge varmvatten på morgonen – hönsen dricker mer då',
      'Kontrollera för frostskador på kammar och haklapp',
      'Byt till vinterfoder med högre energiinnehåll',
    ],
    tasks: ['Varmvatten på morgonen', 'Kontrollera kammar', 'Byt till vinterfoder'],
    eggExpectation: 'low',
  },
  {
    name: 'December', shortName: 'Dec', season: 'winter', icon: Thermometer, emoji: '🎄',
    title: 'Vinterro',
    description: 'Hönsen vilar. Minst ägg men viktigt att hålla dem friska.',
    tips: [
      'Ge majs på kvällen – det ger extra värme under natten',
      'Strö tjockt med halm eller kutterspån för isolering',
      'Julklapps-tips: rödkål och julgransgrenar uppskattas!',
      'Planera inför nästa säsong – vilka raser vill du ha?',
    ],
    tasks: ['Majs till kvällen', 'Tjockt strölager', 'Planera nästa år'],
    eggExpectation: 'low',
  },
];

const seasonColors: Record<string, { bg: string; text: string; border: string; accent: string }> = {
  winter: { bg: 'bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800', accent: 'bg-blue-100 dark:bg-blue-900/50' },
  spring: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800', accent: 'bg-emerald-100 dark:bg-emerald-900/50' },
  summer: { bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800', accent: 'bg-amber-100 dark:bg-amber-900/50' },
  autumn: { bg: 'bg-orange-50 dark:bg-orange-950/30', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-200 dark:border-orange-800', accent: 'bg-orange-100 dark:bg-orange-900/50' },
};

const eggLabels: Record<string, { label: string; color: string }> = {
  low: { label: 'Låg', color: 'bg-muted text-muted-foreground' },
  medium: { label: 'Medel', color: 'bg-primary/15 text-primary' },
  high: { label: 'Hög', color: 'bg-primary/25 text-primary font-semibold' },
  peak: { label: 'Topp', color: 'bg-primary/35 text-primary font-bold' },
};

export default function SeasonalCalendar() {
  const currentMonth = new Date().getMonth();
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const selectedData = selectedMonth !== null ? months[selectedMonth] : null;

  return (
    <motion.div
      className="max-w-3xl mx-auto space-y-6 pb-8"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <PageHeader title="Säsongskalender" emoji="🍂" subtitle="Tips och påminnelser för varje månad – anpassat för svenska hönsägare" />

      {/* Year overview grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
        {months.map((month, i) => {
          const sc = seasonColors[month.season];
          const isCurrent = i === currentMonth;
          const isSelected = i === selectedMonth;
          return (
            <motion.button
              key={month.name}
              onClick={() => setSelectedMonth(isSelected ? null : i)}
              className={`relative rounded-2xl p-3 text-left transition-all border-2 ${
                isSelected
                  ? `${sc.bg} ${sc.border} shadow-md ring-2 ring-primary/20`
                  : isCurrent
                  ? `${sc.bg} ${sc.border} shadow-sm`
                  : 'bg-card border-border/40 hover:border-border hover:shadow-sm'
              }`}
              whileTap={{ scale: 0.96 }}
            >
              {isCurrent && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary animate-pulse" />
              )}
              <span className="text-lg block mb-1">{month.emoji}</span>
              <p className={`text-xs font-semibold ${isSelected || isCurrent ? sc.text : 'text-foreground'}`}>
                {month.shortName}
              </p>
              <div className="mt-1.5">
                <div className={`inline-block px-1.5 py-0.5 rounded-md text-[9px] ${eggLabels[month.eggExpectation].color}`}>
                  🥚 {eggLabels[month.eggExpectation].label}
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Egg production curve */}
      <Card className="border-border/50 shadow-sm overflow-hidden">
        <CardContent className="p-4">
          <p className="text-xs font-medium text-muted-foreground mb-3">Äggproduktion genom året</p>
          <div className="flex items-end gap-1 h-20">
            {months.map((month, i) => {
              const heights = { low: 20, medium: 45, high: 70, peak: 100 };
              const h = heights[month.eggExpectation];
              const isCurrent = i === currentMonth;
              const isSelected = i === selectedMonth;
              return (
                <button
                  key={i}
                  onClick={() => setSelectedMonth(isSelected ? null : i)}
                  className="flex-1 flex flex-col items-center gap-1 group cursor-pointer"
                >
                  <motion.div
                    className={`w-full rounded-t-lg transition-colors ${
                      isSelected
                        ? 'bg-primary'
                        : isCurrent
                        ? 'bg-primary/70'
                        : 'bg-primary/20 group-hover:bg-primary/35'
                    }`}
                    initial={{ height: 0 }}
                    animate={{ height: `${h}%` }}
                    transition={{ duration: 0.6, delay: i * 0.04 }}
                  />
                  <span className={`text-[9px] ${isCurrent ? 'font-bold text-primary' : 'text-muted-foreground'}`}>
                    {month.shortName.slice(0, 1)}
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Selected month detail */}
      <AnimatePresence mode="wait">
        {selectedData && (
          <motion.div
            key={selectedMonth}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <Card className={`border-2 ${seasonColors[selectedData.season].border} shadow-md overflow-hidden`}>
              <CardContent className="p-5 space-y-5">
                {/* Month header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-2xl ${seasonColors[selectedData.season].accent} flex items-center justify-center`}>
                      <span className="text-2xl">{selectedData.emoji}</span>
                    </div>
                    <div>
                      <h2 className="text-lg font-serif text-foreground">{selectedData.name}</h2>
                      <p className={`text-xs font-medium ${seasonColors[selectedData.season].text}`}>{selectedData.title}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedMonth(selectedMonth! > 0 ? selectedMonth! - 1 : 11)}
                      className="p-1.5 rounded-lg hover:bg-muted/70 text-muted-foreground transition-colors"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setSelectedMonth(selectedMonth! < 11 ? selectedMonth! + 1 : 0)}
                      className="p-1.5 rounded-lg hover:bg-muted/70 text-muted-foreground transition-colors"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setSelectedMonth(null)}
                      className="p-1.5 rounded-lg hover:bg-muted/70 text-muted-foreground transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">{selectedData.description}</p>

                {/* Egg expectation */}
                <div className="flex items-center gap-2">
                  <Egg className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Förväntad äggproduktion:</span>
                  <Badge variant="secondary" className={eggLabels[selectedData.eggExpectation].color}>
                    {eggLabels[selectedData.eggExpectation].label}
                  </Badge>
                </div>

                {/* Tips */}
                <div>
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2.5">
                    <Lightbulb className="h-4 w-4 text-warning" />
                    Tips för {selectedData.name.toLowerCase()}
                  </h3>
                  <ul className="space-y-2">
                    {selectedData.tips.map((tip, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex gap-2">
                        <span className="text-primary/60 mt-0.5 shrink-0">•</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Tasks */}
                <div className={`rounded-xl p-3.5 ${seasonColors[selectedData.season].accent}`}>
                  <h3 className={`text-xs font-semibold ${seasonColors[selectedData.season].text} mb-2`}>
                    📋 Att göra denna månad
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedData.tasks.map((task, i) => (
                      <span
                        key={i}
                        className="text-xs bg-background/80 border border-border/40 rounded-lg px-2.5 py-1 text-foreground"
                      >
                        {task}
                      </span>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Current month highlight if nothing selected */}
      {selectedMonth === null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-4"
        >
          <p className="text-sm text-muted-foreground">
            Tryck på en månad för att se tips och uppgifter 👆
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}
