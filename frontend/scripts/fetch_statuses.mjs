import { readFileSync } from 'fs'
import axios from 'axios'

const envFile = readFileSync(new URL('../.env', import.meta.url), 'utf8')
const env = {}
for (const line of envFile.split('\n')) { const m = line.match(/^([^=]+)=(.*)$/); if (m) env[m[1].trim()] = m[2].trim() }

const BASE_URL = env.GAJAMADA_BASE_URL || 'https://gajamada-propam.polri.go.id'
const CONNECTION_ID = env.GAJAMADA_CONNECTION_ID || '245b8fd7c4a763019d5172fad5ec0086'
const DATABASE = env.GAJAMADA_DATABASE || 'divpropam'

// First login
const loginRes = await axios.post(`${BASE_URL}/api/v1/apps/auth/login`, {
  email: env.GAJAMADA_USERNAME || 'polda_jabar',
  password: env.GAJAMADA_PASSWORD || 'rahasia2026'
}, { headers: { 'Content-Type': 'application/json' } })
const cookies = loginRes.headers['set-cookie']?.join('; ') || ''

// Get statuses
const statusRes = await axios.post(`${BASE_URL}/api/v1/apps/data/management/get-all`, {
  page: 1, size: 200, order: 'ASC', search: '',
  connectionId: CONNECTION_ID, database: DATABASE,
  table: 'gold.report_filter',
  search_by: ['value'],
  filters: [
    { field: 'value', fieldType: 'string', operator: 'is not one of', table: 'gold.report_filter',
      value: { gte: 0, is: '', isOneOf: ['Tolak', 'Laporan Ditolak Polda', 'Laporan ditolak'], lte: 0 } },
    { field: 'type', fieldType: 'string', operator: 'is', table: 'gold.report_filter',
      value: { gte: 0, is: 'status_label', isOneOf: [], lte: 0 } }
  ]
}, { headers: { 'Content-Type': 'application/json', 'Cookie': cookies } })

const statuses = (statusRes.data?.data || []).map(r => r.value).filter(Boolean)
console.log(`Found ${statuses.length} status labels:`)
statuses.sort()
statuses.forEach((s, i) => console.log(`  ${i+1}. ${s}`))
