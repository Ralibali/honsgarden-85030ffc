/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Img, Link, Preview, Text } from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps { siteName: string; siteUrl: string; recipient: string; confirmationUrl: string }

export const SignupEmail = ({ siteName, siteUrl, recipient, confirmationUrl }: SignupEmailProps) => (
  <Html lang="sv" dir="ltr">
    <Head />
    <Preview>Bekräfta din e-post för Hönsgården</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src="https://sikbymtrbhrofysgkqsj.supabase.co/storage/v1/object/public/email-assets/logo-honsgarden.png" width="140" alt="Hönsgården" style={{ margin: '0 0 24px' }} />
        <Heading style={h1}>Bekräfta din e-post 🐔</Heading>
        <Text style={text}>Tack för att du registrerade dig på <Link href={siteUrl} style={link}><strong>Hönsgården</strong></Link>!</Text>
        <Text style={text}>Bekräfta din e-postadress (<Link href={`mailto:${recipient}`} style={link}>{recipient}</Link>) genom att klicka på knappen nedan:</Text>
        <Button style={button} href={confirmationUrl}>Bekräfta e-post</Button>
        <Text style={signature}>Vänliga hälsningar,<br />Hönsgården · honsgarden.se</Text>
        <Text style={footer}>Om du inte skapade ett konto kan du ignorera detta mejl.</Text>
      </Container>
    </Body>
  </Html>
)
export default SignupEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '30px 25px', maxWidth: '500px' }
const h1 = { fontFamily: 'Young Serif, Georgia, serif', fontSize: '22px', fontWeight: 'bold' as const, color: 'hsl(22, 18%, 12%)', margin: '0 0 20px' }
const text = { fontSize: '14px', color: 'hsl(22, 12%, 44%)', lineHeight: '1.6', margin: '0 0 16px' }
const link = { color: 'inherit', textDecoration: 'underline' }
const button = { backgroundColor: 'hsl(142, 32%, 34%)', color: 'hsl(35, 32%, 97%)', fontSize: '14px', borderRadius: '14px', padding: '12px 24px', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#999', margin: '30px 0 0' }
const signature = { fontSize: '14px', color: 'hsl(22, 12%, 44%)', lineHeight: '1.6', margin: '24px 0 0' }
