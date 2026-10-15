import * as React from 'react'
import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  tripName?: string
  fullName?: string
  whatsapp?: string
  email?: string
  answers?: { label: string; value: string }[]
  source?: string
  panelUrl?: string
  whatsappUrl?: string
  duplicate?: boolean
}

const Email = ({ tripName = 'tu viaje', fullName = 'Una viajera', whatsapp, email, answers = [], source, panelUrl, whatsappUrl, duplicate }: Props) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>{`Nueva solicitud de ${fullName} para ${tripName}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={eyebrow}>NUEVA SOLICITUD</Text>
        <Heading style={h1}>{fullName} quiere sumarse a {tripName}</Heading>
        {duplicate ? <Text style={note}>Posible duplicado: esta persona ya había enviado una solicitud.</Text> : null}
        <Section style={card}>
          <Text style={row}><strong>WhatsApp:</strong> {whatsapp || '—'}</Text>
          <Text style={row}><strong>Correo:</strong> {email || '—'}</Text>
          {source ? <Text style={row}><strong>Llegó desde:</strong> {source}</Text> : null}
        </Section>
        {answers.length ? (
          <>
            <Hr style={hr} />
            {answers.map((a, i) => (
              <Section key={i}>
                <Text style={label}>{a.label}</Text>
                <Text style={value}>{a.value || '—'}</Text>
              </Section>
            ))}
          </>
        ) : null}
        <Hr style={hr} />
        {whatsappUrl ? <Button style={button} href={whatsappUrl}>Escribirle por WhatsApp</Button> : null}
        {panelUrl ? <Text style={{ marginTop: 16 }}><a href={panelUrl} style={link}>Ver solicitud en el panel</a></Text> : null}
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Nueva solicitud: ${d.fullName ?? 'viajera'} · ${d.tripName ?? 'viaje'}`,
  displayName: 'Aviso a organizadoras',
  previewData: {
    tripName: 'Relámpagos del Catatumbo', fullName: 'María Pérez', whatsapp: '+584141234567', email: 'maria@ejemplo.com',
    answers: [{ label: '¿Por qué querés hacer este viaje?', value: 'Quiero conocer el Catatumbo.' }],
    source: 'instagram', panelUrl: 'https://chamaviaja.com', whatsappUrl: 'https://wa.me/584141234567',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '"DM Sans", Arial, sans-serif', color: '#1a1a1a' }
const container = { padding: '28px 24px', maxWidth: '560px' }
const eyebrow = { fontSize: '11px', letterSpacing: '2px', color: '#b5543a', margin: '0 0 8px' }
const h1 = { fontFamily: '"Playfair Display", Georgia, serif', fontSize: '24px', margin: '0 0 16px', color: '#111111' }
const note = { fontSize: '13px', color: '#b5543a', margin: '0 0 12px' }
const card = { backgroundColor: '#f5efe6', borderRadius: '8px', padding: '12px 16px' }
const row = { fontSize: '14px', margin: '4px 0' }
const label = { fontSize: '12px', color: '#6b6359', margin: '12px 0 2px' }
const value = { fontSize: '14px', margin: '0', whiteSpace: 'pre-line' as const }
const hr = { borderColor: '#e6ddd0', margin: '20px 0' }
const button = { backgroundColor: '#b5543a', color: '#ffffff', padding: '12px 20px', borderRadius: '6px', fontSize: '14px', textDecoration: 'none' }
const link = { color: '#b5543a', fontSize: '14px' }
