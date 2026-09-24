import { mkdir, readdir, rename, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

export const MAX_IMAGE_BYTES = 12 * 1024 * 1024

const EXTENSION_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

export interface AssetRecord {
  fileName: string
  url: string
  contentType: string
  size: number
  modifiedAt: string
}

function validateStoreId(storeId: string) {
  if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(storeId)) {
    throw new Error('Invalid store id')
  }
}

function validateFileName(fileName: string) {
  if (!/^[a-z0-9][a-z0-9-]{7,79}\.(?:jpg|jpeg|png|webp)$/.test(fileName)) {
    throw new Error('Invalid asset file name')
  }
}

function extension(fileName: string) {
  return path.extname(fileName).slice(1).toLowerCase()
}

function hasImageSignature(buffer: Buffer, contentType: string): boolean {
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

  return false
}

export class AssetStore {
  constructor(private readonly dataDir: string) {}

  private assetsDir(storeId: string) {
    validateStoreId(storeId)
    return path.join(this.dataDir, 'stores', storeId, 'assets')
  }

  filePath(storeId: string, fileName: string) {
    validateFileName(fileName)
    return path.join(this.assetsDir(storeId), fileName)
  }

  contentType(fileName: string) {
    validateFileName(fileName)
    return EXTENSION_TO_MIME[extension(fileName)]
  }

  async put(storeId: string, fileName: string, contentType: string, body: Buffer): Promise<AssetRecord> {
    validateFileName(fileName)

    const expectedType = EXTENSION_TO_MIME[extension(fileName)]
    if (!expectedType || expectedType !== contentType) {
      throw new Error('Image extension does not match content type')
    }
    if (!body.length) throw new Error('Image is empty')
    if (body.length > MAX_IMAGE_BYTES) throw new Error('Image exceeds 12 MB limit')
    if (!hasImageSignature(body, contentType)) throw new Error('Invalid image signature')

    const dir = this.assetsDir(storeId)
    await mkdir(dir, { recursive: true })

    const file = this.filePath(storeId, fileName)
    const temp = `${file}.tmp-${process.pid}-${Date.now()}`
    await writeFile(temp, body)
    await rename(temp, file)

    const info = await stat(file)
    return {
      fileName,
      url: `/api/stores/${storeId}/assets/${fileName}`,
      contentType,
      size: info.size,
      modifiedAt: info.mtime.toISOString(),
    }
  }

  async get(storeId: string, fileName: string): Promise<{ filePath: string; contentType: string } | null> {
    const file = this.filePath(storeId, fileName)
    try {
      await stat(file)
      return { filePath: file, contentType: this.contentType(fileName) }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw error
    }
  }

  async list(storeId: string): Promise<AssetRecord[]> {
    const dir = this.assetsDir(storeId)
    let names: string[]
    try {
      names = await readdir(dir)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw error
    }

    const records = await Promise.all(
      names
        .filter((name) => {
          try {
            validateFileName(name)
            return true
          } catch {
            return false
          }
        })
        .map(async (fileName) => {
          const info = await stat(path.join(dir, fileName))
          return {
            fileName,
            url: `/api/stores/${storeId}/assets/${fileName}`,
            contentType: this.contentType(fileName),
            size: info.size,
            modifiedAt: info.mtime.toISOString(),
          }
        }),
    )

    return records.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))
  }
}
