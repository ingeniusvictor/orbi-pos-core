import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { EvidenceAttachmentStore } from './evidence-attachment-store.js'

const dirs: string[] = []

async function makeStore() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'orbi-pos-evidence-files-'))
  dirs.push(dir)
  return new EvidenceAttachmentStore(dir)
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

const png = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0x00,0x00])
const pdf = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n')

describe('EvidenceAttachmentStore', () => {
  it('stores validated evidence with hash and safe metadata', async () => {
    const store = await makeStore()
    const record = await store.put(
      'el-chunchito',
      'evidence-12345678-1234-1234-1234-123456789abc.pdf',
      'application/pdf',
      pdf,
      'informe terreno.pdf',
      'CASE-001',
      'EVD-001',
    )

    expect(record.originalName).toBe('informe terreno.pdf')
    expect(record.sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(record.caseId).toBe('CASE-001')
    expect(record.entryId).toBe('EVD-001')
    expect((await store.list('el-chunchito'))).toHaveLength(1)
    expect((await store.get('el-chunchito', record.fileName))?.record.sha256)
      .toBe(record.sha256)
  })

  it('accepts validated image evidence', async () => {
    const store = await makeStore()
    const record = await store.put(
      'el-chunchito',
      'evidence-22345678-1234-1234-1234-123456789abc.png',
      'image/png',
      png,
      'captura.png',
    )

    expect(record.contentType).toBe('image/png')
  })

  it('rejects MIME/extension mismatches and fake signatures', async () => {
    const store = await makeStore()

    await expect(store.put(
      'el-chunchito',
      'evidence-32345678-1234-1234-1234-123456789abc.pdf',
      'image/png',
      png,
      'captura.png',
    )).rejects.toThrow('does not match')

    await expect(store.put(
      'el-chunchito',
      'evidence-42345678-1234-1234-1234-123456789abc.pdf',
      'application/pdf',
      Buffer.from('not a pdf'),
      'fake.pdf',
    )).rejects.toThrow('signature')
  })

  it('rejects unsafe opaque filenames and link ids', async () => {
    const store = await makeStore()

    await expect(store.put(
      'el-chunchito',
      '../evidence.pdf',
      'application/pdf',
      pdf,
      'safe.pdf',
    )).rejects.toThrow('Invalid evidence attachment file name')

    await expect(store.put(
      'el-chunchito',
      'evidence-52345678-1234-1234-1234-123456789abc.pdf',
      'application/pdf',
      pdf,
      'safe.pdf',
      '../CASE',
    )).rejects.toThrow('Invalid evidence link id')
  })
})
