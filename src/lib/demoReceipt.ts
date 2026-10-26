import type { Receipt } from '@/types'

/**
 * Builds a clearly-labelled demo receipt so the full signup and renewal flow
 * can be tested without finding a real payment file.
 */
export function makeDemoReceipt(name = 'Recu-demonstration'): Receipt {
  const today = new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date())
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="620" viewBox="0 0 900 620">
  <rect width="900" height="620" fill="#f5f5f5"/>
  <rect x="32" y="32" width="836" height="556" fill="#ffffff" stroke="#cacacb"/>
  <text x="68" y="92" font-family="Arial, sans-serif" font-size="13" letter-spacing="4" fill="#707072">MEDQCM — REÇU DE PAIEMENT</text>
  <text x="68" y="158" font-family="Arial, sans-serif" font-size="42" font-weight="700" fill="#111111">Accès mensuel L1</text>
  <text x="68" y="190" font-family="Arial, sans-serif" font-size="15" fill="#707072">Document de démonstration — aucun paiement réel</text>
  <line x1="68" y1="230" x2="832" y2="230" stroke="#e5e5e5"/>
  <text x="68" y="270" font-family="Arial, sans-serif" font-size="12" fill="#707072">DATE</text>
  <text x="68" y="296" font-family="Arial, sans-serif" font-size="17" fill="#111111">${today}</text>
  <text x="440" y="270" font-family="Arial, sans-serif" font-size="12" fill="#707072">MONTANT</text>
  <text x="440" y="296" font-family="Arial, sans-serif" font-size="17" fill="#111111">30,00 €</text>
  <text x="68" y="360" font-family="Arial, sans-serif" font-size="12" fill="#707072">RÉFÉRENCE</text>
  <text x="68" y="386" font-family="Arial, sans-serif" font-size="17" fill="#111111">DEMO-${Date.now().toString().slice(-8)}</text>
  <rect x="650" y="340" width="182" height="62" fill="#fdecec" stroke="#d30005"/>
  <text x="741" y="378" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#d30005">DÉMONSTRATION</text>
  <line x1="68" y1="470" x2="832" y2="470" stroke="#e5e5e5"/>
  <text x="68" y="506" font-family="Arial, sans-serif" font-size="11" fill="#9e9ea0">Ce fichier est généré automatiquement par le prototype MEDQCM.</text>
  <text x="68" y="528" font-family="Arial, sans-serif" font-size="11" fill="#9e9ea0">Il permet de tester la vérification du docteur.</text>
</svg>`
  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  return {
    name: `${name}.svg`,
    mime: 'image/svg+xml',
    size: new Blob([svg]).size,
    dataUrl,
  }
}
