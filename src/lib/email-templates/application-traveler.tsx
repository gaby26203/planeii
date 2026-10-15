import * as React from 'react'
import { Body, Button, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  tripName?: string
  firstName?: string
  title?: string
  message?: string
  steps?: string[]
  tripUrl?: string
}

const Email = ({ tripName = 'el viaje', firstName, title, message, steps = [], tripUrl }: Props) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>{`Recibimos tu solicitud para ${tripName}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={eyebrow}>CHAMA VIAJA</Text>
        <Heading style={h1}>{title || `¡Gracias${firstName ? `, ${firstName}` : ''}!`}</Heading>
        <Text style={text}>Recibimos tu solicitud para <strong>{tripName}</strong>.</Text>
        {message ? <Text style={text}>{message}</Text> : null}
        {steps.length ? (
          <>
            <Text style={sub}>Próximos pasos</Text>
            {steps.map((s, i) => <Text key={i} style={step}>{i + 1}. {s}</Text>)}
          </>
        ) : null}
        {tripUrl ? <Button style={button} href={tripUrl}>Ver el viaje</Button> : null}
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Recibimos tu solicitud · ${d.tripName ?? 'tu viaje'}`,
  displayName: 'Confirmación a la viajera',
  previewData: {
    tripName: 'Relámpagos del Catatumbo', firstName: 'María', message: 'Te contactaremos pronto.',
    steps: ['Revisamos tu solicitud', 'Te escribimos por WhatsApp', 'Agendamos una llamada'], tripUrl: 'https://chamaviaja.com',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '"DM Sans", Arial, sans-serif', color: '#1a1a1a' }
const container = { padding: '28px 24px', maxWidth: '560px' }
const eyebrow = { fontSize: '11px', letterSpacing: '2px', color: '#b5543a', margin: '0 0 8px' }
const h1 = { fontFamily: '"Playfair Display", Georgia, serif', fontSize: '26px', margin: '0 0 16px', color: '#111111' }
const text = { fontSize: '15px', lineHeight: '1.6', margin: '0 0 12px' }
const sub = { fontSize: '12px', letterSpacing: '1.5px', color: '#6b6359', margin: '20px 0 6px', textTransform: 'uppercase' as const }
const step = { fontSize: '15px', margin: '4px 0' }
const button = { backgroundColor: '#b5543a', color: '#ffffff', padding: '12px 20px', borderRadius: '6px', fontSize: '14px', textDecoration: 'none', marginTop: '20px' }
