import { describe, it, expect } from 'vitest';
import { assessHealthUrgency, HEALTH_ESCALATION_NOTICE, HEALTH_GENERAL_NOTICE } from '../agdaHealthGuard';

describe('agdaHealthGuard – urgent detection', () => {
  it.each([
    'Min höna håller på att dö',
    'En höna dog i natt',
    'Hon blöder från kloaken',
    'Det var blod i avföringen',
    'Hon gapar och andas tungt',
    'Hon kan inte gå längre',
    'Hon äter inte och dricker inte',
    'Jag tror hon brutit benet',
    'Hon krystar hela morgonen',
    'Två höns har dött den här veckan',
    'Hela flocken är slö och dålig',
  ])('flags urgent: %s', (message) => {
    expect(assessHealthUrgency(message).urgency).toBe('urgent');
  });
});

describe('agdaHealthGuard – health (non-urgent) detection', () => {
  it.each([
    'Tror min höna är sjuk, vad gör jag?',
    'Kan jag ge mina höns maskmedel?',
    'Hon har kvalster på benen',
    'Vilka symptom ger koccidios?',
    'Behöver jag kontakta veterinär?',
    'Hönan tappar fjädrar på halsen',
  ])('flags health: %s', (message) => {
    expect(assessHealthUrgency(message).urgency).toBe('health');
  });
});

describe('agdaHealthGuard – no false alarms', () => {
  it.each([
    '',
    'Hur mycket foder behöver tre höns?',
    'Varför värper flocken mindre i november?',
    'Vilken ras passar bäst för nybörjare?',
    'Kan jag sälja ägg till min granne?',
    'Blodbudet var fullbokat', // 'blod' med word boundary ska INTE träffa 'blodbud'
    'Hon är jätteduktig på att värpa',
  ])('flags none: %s', (message) => {
    expect(assessHealthUrgency(message).urgency).toBe('none');
  });
});

describe('agdaHealthGuard – notices', () => {
  it('escalation notice always names the veterinarian and never diagnoses', () => {
    expect(HEALTH_ESCALATION_NOTICE).toContain('veterinär');
    expect(HEALTH_ESCALATION_NOTICE).not.toMatch(/diagnos(erar)? du/i);
  });

  it('general notice always names the veterinarian', () => {
    expect(HEALTH_GENERAL_NOTICE).toContain('veterinär');
  });

  it('returns matched patterns for telemetry', () => {
    const result = assessHealthUrgency('Hon blöder och kan inte stå');
    expect(result.urgency).toBe('urgent');
    expect(result.matched.length).toBeGreaterThan(0);
  });
});
