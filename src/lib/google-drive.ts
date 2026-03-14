import { getAccessTokenForUser } from "./google-calendar"

const DRIVE_API = "https://www.googleapis.com/drive/v3"

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  webViewLink: string
  iconLink: string
  modifiedTime: string
  starred: boolean
  parents?: string[]
  owners?: Array<{ displayName: string; emailAddress: string }>
  size?: string
  thumbnailLink?: string
}

export interface DriveListResult {
  files: DriveFile[]
  nextPageToken?: string
  error?: string
}

/**
 * List files in a folder or search Drive.
 */
export async function listDriveFiles(
  accessToken: string,
  options: {
    folderId?: string
    query?: string
    pageToken?: string
    pageSize?: number
    starred?: boolean
    orderBy?: string
  } = {}
): Promise<DriveListResult> {
  const { folderId, query, pageToken, pageSize = 50, starred, orderBy } = options

  const qParts: string[] = ["trashed = false"]
  if (folderId) qParts.push(`'${folderId}' in parents`)
  if (query) qParts.push(`name contains '${query.replace(/'/g, "\\'")}'`)
  if (starred) qParts.push("starred = true")

  const params = new URLSearchParams({
    q: qParts.join(" and "),
    fields: "nextPageToken,files(id,name,mimeType,webViewLink,iconLink,modifiedTime,starred,parents,owners,size,thumbnailLink)",
    pageSize: String(pageSize),
    orderBy: orderBy || "modifiedTime desc",
  })
  if (pageToken) params.set("pageToken", pageToken)

  const res = await fetch(`${DRIVE_API}/files?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    const errorText = await res.text()
    console.error("[Drive] List files failed:", res.status, errorText)
    let errorMessage = `Google Drive API error (${res.status})`
    try {
      const errorJson = JSON.parse(errorText)
      errorMessage = errorJson.error?.message || errorMessage
    } catch { /* use default */ }
    return { files: [], error: errorMessage }
  }

  const data = await res.json()
  return { files: data.files ?? [], nextPageToken: data.nextPageToken }
}

/**
 * Get file metadata by ID.
 */
export async function getDriveFile(
  accessToken: string,
  fileId: string
): Promise<DriveFile | null> {
  const params = new URLSearchParams({
    fields: "id,name,mimeType,webViewLink,iconLink,modifiedTime,starred,parents,owners,size,thumbnailLink",
  })

  const res = await fetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) return null
  return res.json()
}

/**
 * Read file content (Google Docs exported as plain text, Sheets as CSV).
 * Returns null for unsupported types (PDFs, images, etc).
 */
export async function readDriveFileContent(
  accessToken: string,
  fileId: string,
  mimeType: string
): Promise<string | null> {
  // Google Docs → export as plain text
  if (mimeType === "application/vnd.google-apps.document") {
    const res = await fetch(
      `${DRIVE_API}/files/${encodeURIComponent(fileId)}/export?mimeType=text/plain`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!res.ok) return null
    return res.text()
  }

  // Google Sheets → export as CSV
  if (mimeType === "application/vnd.google-apps.spreadsheet") {
    const res = await fetch(
      `${DRIVE_API}/files/${encodeURIComponent(fileId)}/export?mimeType=text/csv`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!res.ok) return null
    return res.text()
  }

  // Google Slides → export as plain text
  if (mimeType === "application/vnd.google-apps.presentation") {
    const res = await fetch(
      `${DRIVE_API}/files/${encodeURIComponent(fileId)}/export?mimeType=text/plain`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!res.ok) return null
    return res.text()
  }

  // Plain text files
  if (mimeType.startsWith("text/")) {
    const res = await fetch(
      `${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!res.ok) return null
    return res.text()
  }

  // Unsupported types (PDF, images, etc)
  return null
}

/**
 * Helper: get access token and list files for current user.
 */
export { getAccessTokenForUser }
