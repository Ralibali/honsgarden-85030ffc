/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Img, Preview, Text } from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps { token: string }

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="sv" dir="ltr">
    <Head />
    <Preview>Din verifieringskod för Hönsgården</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src="https://sikbymtrbhrofysgkqsj.supabase.co/storage/v1/object/public/email-assets/logo-honsgarden.png" width="140" alt="Hönsgården" style={{ margin: '0 0 24px' }} />
        <Heading style={h1}>Din verifieringskod 🔐</Heading>
        <Text style={text}>Använd koden nedan för att bekräfta din identitet:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={signature}>Vänliga hälsningar,<br />Hönsgården · honsgarden.se</Text>
        <Text style={footer}>Koden upphör att gälla snart. Om du inte begärde detta kan du ignorera mejlet.</Text>
      </Container>
    </Body>
  </Html>
)
export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '30px 25px', maxWidth: '500px' }
const h1 = { fontFamily: 'Young Serif, Georgia, serif', fontSize: '22px', fontWeight: 'bold' as const, color: 'hsl(22, 18%, 12%)', margin: '0 0 20px' }
const text = { fontSize: '14px', color: 'hsl(22, 12%, 44%)', lineHeight: '1.6', margin: '0 0 16px' }
const codeStyle = { fontFamily: 'Courier, monospace', fontSize: '22px', fontWeight: 'bold' as const, color: 'hsl(22, 18%, 12%)', margin: '0 0 30px' }
const footer = { fontSize: '12px', color: '#999', margin: '30px 0 0' }
const signature = { fontSize: '14px', color: 'hsl(22, 12%, 44%)', lineHeight: '1.6', margin: '24px 0 0' }
