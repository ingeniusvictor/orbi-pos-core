import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

export const MAX_EVIDENCE_ATTACHMENT_BYTES = 20 * 1024 * 1024

const EXTENSION_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
}

export interface EvidenceAttachmentRecord {
  fileName: string
  url: string
  originalName: string
  contentType: string
  size: number
  sha256: string
  uploadedAt: string
  caseId: string | null
  entryId: string | null
}

function validateStoreId(storeId: string) {
  if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(storeId)) {
    throw new Error('Invalid store id')
  }
}

function validateEvidenceFileName(fileName: string) {
  if (!/^evidence-[a-z0-9-]{20,80}\.(?:jpg|jpeg|png|webp|pdf)$/.test(fileName)) {
    throw new Error('Invalid evidence attachment file name')
  }
}

function extension(fileName: string) {
  return path.extname(fileName).slice(1).toLowerCase()
}

function safeOriginalName(value: string) {
  const trimmed = value.trim()
  if (!trimmed) throw new Error('Original file name is required')
  const base = path.basename(trimmed).replace(/[\u0000-\u001f\u007f]/g, '_')
  if (!base || base === '.' || base === '..') throw new Error('Invalid original file name')
  return base.slice(0, 180)
}

function safeLinkId(value: string | undefined): string | null {
  if (!value?.trim()) return null
  const normalized = value.trim()
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/.test(normalized)) {
    throw new Error('Invalid evidence link id')
  }
  return normalized
}

function hasSignature(buffer: Buffer, contentType: string): boolean {
  if (contentType === 'image/jpeg') {
    return buffer.length >= 3
      && buffer[0] === 0xff
      && buffer[1] === 0xd8
      && buffer[2] === 0xff
  }

  if (contentType === 'image/png') {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
    return buffer.length >= signature.length
      && signature.every((byte, index) => buffer[index] === byte)
  }

  if (contentType === 'image/webp') {
    return buffer.length >= 12
      && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
      && buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  }

  if (contentType === 'application/pdf') {
    return buffer.length >= 5
      && buffer.subarray(0, 5).toString('ascii') === '%PDF-'
  }

  return false
}

export class EvidenceAttachmentStore {
  constructor(private readonly dataDir: string) {}

  private dir(storeId: string) {
    validateStoreId(storeId)
    return path.join(this.dataDir, 'stores', storeId, 'evidence', 'attachments')
  }

  private binaryPath(storeId: string, fileName: string) {
    validateEvidenceFileName(fileName)
    return path.join(this.dir(storeId), fileName)
  }

  private metadataPath(storeId: string, fileName: string) {
    return `${this.binaryPath(storeId, fileName)}.meta.json`
  }

  private contentType(fileName: string) {
    validateEvidenceFileName(fileName)
    return EXTENSION_TO_MIME[extension(fileName)]
  }

  async put(
    storeId: string,
    fileName: string,
    contentType: string,
    body: Buffer,
    originalName: string,
    caseId?: string,
    entryId?: string,
  ): Promise<EvidenceAttachmentRecord> {
    validateEvidenceFileName(fileName)

    const expected = this.contentType(fileName)
    if (!expected || expected !== contentType) {
      throw new Error('Evidence extension does not match content type')
    }
    if (!body.length) throw new Error('Evidence attachment is empty')
    if (body.length > MAX_EVIDENCE_ATTACHMENT_BYTES) {
      throw new Error('Evidence attachment exceeds 20 MB limit')
    }
    if (!hasSignature(body, contentType)) {
      throw new Error('Invalid evidence attachment signature')
    }

    const normalizedOriginalName = safeOriginalName(originalName)
    const normalizedCaseId = safeLinkId(caseId)
    const normalizedEntryId = safeLinkId(entryId)

    const dir = this.dir(storeId)
    await mkdir(dir, { recursive: true })

    const filePath = this.binaryPath(storeId, fileName)
    const tempFile = `${filePath}.tmp-${process.pid}-${Date.now()}`
    await writeFile(tempFile, body)
    await rename(tempFile, filePath)

    const info = await stat(filePath)
    const record: EvidenceAttachmentRecord = {
      fileName,
      url: `/api/stores/${storeId}/evidence/attachments/${fileName}`,
      originalName: normalizedOriginalName,
      contentType,
      size: info.size,
      sha256: createHash('sha256').update(body).digest('hex'),
      uploadedAt: new Date().toISOString(),
      caseId: normalizedCaseId,
      entryId: normalizedEntryId,
    }

    const metadataPath = this.metadataPath(storeId, fileName)
    const tempMetadata = `${metadataPath}.tmp-${process.pid}-${Date.now()}`
    await writeFile(tempMetadata, JSON.stringify(record, null, 2), 'utf8')
    await rename(tempMetadata, metadataPath)

    return record
  }

  async get(
    storeId: string,
    fileName: string,
  ): Promise<{ filePath: string; record: EvidenceAttachmentRecord } | null> {
    const filePath = this.binaryPath(storeId, fileName)
    const metadataPath = this.metadataPath(storeId, fileName)

    try {
      const [raw] = await Promise.all([
        readFile(metadataPath, 'utf8'),
        stat(filePath),
      ])
      const record = JSON.parse(raw) as EvidenceAttachmentRecord
      return { filePath, record }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw error
    }
  }

  async list(storeId: string): Promise<EvidenceAttachmentRecord[]> {
    const dir = this.dir(storeId)
    let names: string[]
    try {
      names = await readdir(dir)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw error
    }

    const metadataNames = names.filter((name) => name.endsWith('.meta.json'))
    const records: EvidenceAttachmentRecord[] = []

    for (const metadataName of metadataNames) {
      try {
        const raw = await readFile(path.join(dir, metadataName), 'utf8')
        const record = JSON.parse(raw) as EvidenceAttachmentRecord
        validateEvidenceFileName(record.fileName)
        await stat(this.binaryPath(storeId, record.fileName))
        records.push(record)
      } catch {
        // Ignore incomplete/corrupt metadata records in the pilot listing.
      }
    }

    return records.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
  }
}
