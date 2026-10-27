import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

const STUDENT_APP_URL = (process.env.STUDENT_APP_URL || 'https://medicineqcm.vercel.app').replace(/\/$/, '')
const DOCTOR_APP_URL = (process.env.DOCTOR_APP_URL || 'https://docteur-sun.vercel.app').replace(/\/$/, '')
const DOCTOR_EMAIL = process.env.DOCTOR_EMAIL || 'razafimandimby222@gmail.com'
const FROM_NAME = 'MEDQCM L1'
const TIME_ZONE = 'Indian/Antananarivo'

function sendJson(res, status, payload) {
  res.status(status)
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function oneLine(value) {
  return String(value ?? '').replace(/[\r\n]+/g, ' ').trim()
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: TIME_ZONE,
  }).format(date)
}

function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIME_ZONE,
  }).format(date)
}

function layout({ title, preheader, content }) {
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f5f7f3;color:#15201b;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f7f3;">
    <tr>
      <td align="center" style="padding:28px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:#ffffff;border:1px solid #d7ded8;border-radius:18px;overflow:hidden;">
          <tr>
            <td style="padding:26px 28px 0;">
              <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#0b6b4f;font-weight:700;">MEDQCM L1</div>
              <h1 style="margin:14px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1.15;font-weight:400;color:#15201b;">${escapeHtml(title)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 30px;font-size:15px;line-height:1.65;color:#15201b;">${content}</td>
          </tr>
          <tr>
            <td style="padding:18px 28px;background:#eef2ed;font-size:12px;line-height:1.6;color:#657069;">
              MEDQCM L1 · Entraînement mensuel<br>
              Cet email a été envoyé automatiquement.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function button(url, label) {
  return `<a href="${escapeHtml(url)}" style="display:inline-block;background:#0b6b4f;color:#ffffff;text-decoration:none;padding:13px 22px;border-radius:999px;font-weight:700;font-size:14px;">${escapeHtml(label)}</a>`
}

function detailRow(label, value) {
  return `<tr>
    <td style="padding:7px 16px 7px 0;font-size:13px;color:#657069;vertical-align:top;white-space:nowrap;">${escapeHtml(label)}</td>
    <td style="padding:7px 0;font-size:14px;color:#15201b;vertical-align:top;">${value}</td>
  </tr>`
}

function getSupabaseCredentials() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anonKey) throw new Error('SUPABASE_NOT_CONFIGURED')
  return { url, anonKey }
}

async function authenticate(req) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) return null

  const { url, anonKey } = getSupabaseCredentials()
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const { data, error } = await client.auth.getUser(token)
  if (error || !data.user) return null

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('id, role, first_name, last_name, email, status, activated_at, expires_at')
    .eq('id', data.user.id)
    .single()

  if (profileError || !profile) return null

  return { client, user: data.user, profile }
}

function createTransport() {
  const user = process.env.SMTP_USER?.trim()
  const pass = process.env.SMTP_PASS?.replace(/\s+/g, '')
  if (!user || !pass) throw new Error('SMTP_NOT_CONFIGURED')

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE || 'true') !== 'false',
    auth: { user, pass },
  })
}

async function sendMail({ to, subject, html, text, replyTo }) {
  const user = process.env.SMTP_USER?.trim()
  const transport = createTransport()
  const info = await transport.sendMail({
    from: `"${FROM_NAME}" <${user}>`,
    to,
    subject,
    html,
    text,
    replyTo,
  })

  if (process.env.NOTIFY_DEBUG === 'true') {
    const preview = nodemailer.getTestMessageUrl(info)
    console.log('[notify] message', preview || info.messageId)
  }

  return info
}

async function notifyNewRequest({ client, user, profile }) {
  if (profile.role !== 'student') {
    return { status: 403, body: { error: 'Action réservée aux étudiants.' } }
  }

  const { data: request, error } = await client
    .from('access_requests')
    .select('id, user_id, type, receipt_path, receipt_name, created_at, status')
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!request) return { status: 200, body: { ok: true, skipped: 'no_pending_request' } }

  const createdAt = new Date(request.created_at).getTime()
  if (Number.isFinite(createdAt) && Date.now() - createdAt > 15 * 60 * 1000) {
    return { status: 200, body: { ok: true, skipped: 'request_too_old' } }
  }

  const { data: signed } = await client.storage
    .from('receipts')
    .createSignedUrl(request.receipt_path, 60 * 60 * 24 * 7)

  const studentName = oneLine(`${profile.first_name} ${profile.last_name}`)
  const isRenewal = request.type === 'renewal'
  const title = isRenewal ? 'Renouvellement de cycle' : 'Nouvelle demande d’inscription'
  const subject = isRenewal
    ? `🔔 Renouvellement QCM — ${studentName}`
    : `🔔 Nouvelle demande QCM — ${studentName}`
  const adminUrl = `${DOCTOR_APP_URL}/admin/demandes?request=${encodeURIComponent(request.id)}`
  const receiptUrl = signed?.signedUrl || adminUrl

  const content = `
    <p style="margin:0 0 18px;">${
      isRenewal
        ? 'Un étudiant demande le renouvellement de son accès au QCM.'
        : 'Un étudiant vient de déposer son dossier d’inscription.'
    }</p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:0 0 22px;border-top:1px solid #eef2ed;">
      ${detailRow('Étudiant', escapeHtml(studentName))}
      ${detailRow('Email', escapeHtml(profile.email))}
      ${detailRow('Dossier', isRenewal ? 'Renouvellement' : 'Première inscription')}
      ${detailRow('Déposé le', formatDateTime(request.created_at))}
    </table>
    <p style="margin:0 0 24px;">${button(adminUrl, 'Ouvrir le dossier')}</p>
    <p style="margin:0 0 8px;font-size:13px;color:#657069;">Justificatif de paiement</p>
    <p style="margin:0 0 20px;font-size:14px;"><a href="${escapeHtml(receiptUrl)}" style="color:#0b6b4f;font-weight:700;">Consulter le reçu</a></p>
    <p style="margin:0;font-size:13px;line-height:1.6;color:#657069;">Le lien du reçu expire dans 7 jours. Vous pouvez aussi ouvrir le dossier depuis votre espace docteur.</p>
  `

  const text = `${isRenewal ? 'Renouvellement' : 'Nouvelle demande'} QCM\n\nÉtudiant : ${studentName}\nEmail : ${profile.email}\nDéposé le : ${formatDateTime(request.created_at)}\n\nOuvrir le dossier : ${adminUrl}\nReçu : ${receiptUrl}`

  await sendMail({
    to: DOCTOR_EMAIL,
    subject,
    html: layout({ title, preheader: `${studentName} attend votre validation.`, content }),
    text,
    replyTo: profile.email,
  })

  return { status: 200, body: { ok: true } }
}

async function notifyAccessActivated({ client, profile, requestId, userId }) {
  if (profile.role !== 'professor') {
    return { status: 403, body: { error: 'Action réservée au docteur.' } }
  }

  let request = null
  if (requestId) {
    const { data, error } = await client
      .from('access_requests')
      .select('id, user_id, type, status, reviewed_at')
      .eq('id', requestId)
      .maybeSingle()
    if (error) throw error
    request = data
    if (!request || request.status !== 'approved') {
      return { status: 404, body: { error: 'Demande introuvable ou non approuvée.' } }
    }
  }

  const studentId = request?.user_id || userId
  if (!studentId) return { status: 400, body: { error: 'Étudiant introuvable.' } }

  const { data: student, error: studentError } = await client
    .from('profiles')
    .select('id, first_name, last_name, email, status, activated_at, expires_at')
    .eq('id', studentId)
    .single()
  if (studentError || !student) return { status: 404, body: { error: 'Étudiant introuvable.' } }

  const { data: assignment, error: assignmentError } = await client
    .from('subject_assignments')
    .select('id, subject_id, started_at, expires_at')
    .eq('user_id', studentId)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (assignmentError) throw assignmentError

  const startsAt = assignment?.started_at || student.activated_at
  const expiresAt = assignment?.expires_at || student.expires_at
  if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
    return { status: 200, body: { ok: true, skipped: 'access_expired' } }
  }

  let subject = null
  if (assignment?.subject_id) {
    const { data } = await client
      .from('subjects')
      .select('id, title, month_label')
      .eq('id', assignment.subject_id)
      .maybeSingle()
    subject = data
  }

  const studentName = oneLine(`${student.first_name} ${student.last_name}`)
  const subjectTitle = subject?.title || 'Sujet du mois'
  const period = `du ${formatDate(startsAt)} au ${formatDate(expiresAt)}`
  const loginUrl = `${STUDENT_APP_URL}/connexion`

  const content = `
    <p style="margin:0 0 16px;">Bonjour ${escapeHtml(student.first_name)},</p>
    <p style="margin:0 0 18px;">Votre dossier a été validé. Votre accès au QCM est ouvert <strong>${escapeHtml(period)}</strong>.</p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:0 0 22px;background:#e4f0ea;border-radius:14px;">
      <tr>
        <td style="padding:18px 20px;">
          <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#0b6b4f;font-weight:700;">Votre sujet</div>
          <div style="margin-top:6px;font-family:Georgia,'Times New Roman',serif;font-size:21px;line-height:1.3;color:#15201b;">${escapeHtml(subjectTitle)}</div>
          <div style="margin-top:6px;font-size:13px;color:#657069;">20 questions · correction après envoi</div>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 18px;">Connectez-vous avec votre adresse email et le mot de passe choisi lors de votre inscription.</p>
    <p style="margin:0 0 22px;">${button(loginUrl, 'Accéder à mon espace')}</p>
    <p style="margin:0;font-size:13px;line-height:1.6;color:#657069;">Votre identifiant : <strong style="color:#15201b;">${escapeHtml(student.email)}</strong></p>
  `

  const text = `Bonjour ${student.first_name},\n\nVotre dossier a été validé. Votre accès au QCM est ouvert ${period}.\n\nSujet : ${subjectTitle}\nIdentifiant : ${student.email}\n\nAccéder à votre espace : ${loginUrl}`

  await sendMail({
    to: student.email,
    subject: '✅ Votre accès QCM Médecine L1 est activé',
    html: layout({ title: 'Votre accès est ouvert.', preheader: `${studentName}, votre cycle QCM commence ${period}.`, content }),
    text,
  })

  return { status: 200, body: { ok: true } }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return sendJson(res, 405, { error: 'Méthode non autorisée.' })
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}
    const type = body.type
    if (type !== 'new_request' && type !== 'access_activated') {
      return sendJson(res, 400, { error: 'Type de notification inconnu.' })
    }

    const auth = await authenticate(req)
    if (!auth) return sendJson(res, 401, { error: 'Session invalide.' })

    const result =
      type === 'new_request'
        ? await notifyNewRequest(auth)
        : await notifyAccessActivated({
            client: auth.client,
            profile: auth.profile,
            requestId: typeof body.requestId === 'string' ? body.requestId : undefined,
            userId: typeof body.userId === 'string' ? body.userId : undefined,
          })

    return sendJson(res, result.status, result.body)
  } catch (error) {
    console.error('[notify]', error instanceof Error ? error.message : error)
    const code = error instanceof Error ? error.message : ''
    if (code === 'SMTP_NOT_CONFIGURED') {
      return sendJson(res, 500, { error: 'Configuration email incomplète.' })
    }
    if (code === 'SUPABASE_NOT_CONFIGURED') {
      return sendJson(res, 500, { error: 'Configuration Supabase incomplète.' })
    }
    return sendJson(res, 500, { error: 'Envoi de l’email impossible.' })
  }
}
