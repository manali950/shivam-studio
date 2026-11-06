/** URL validators for external media. Only YouTube and Google Drive hosts are accepted. */
 
export interface YouTubeInfo { id: string; embedUrl: string; thumbnail: string; watchUrl: string }
 
const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const YT_HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com', 'youtu.be'];
 
/** Supports watch?v=, youtu.be/, /embed/, /shorts/, /live/, /v/ and bare 11-char IDs. Playlists/channels are rejected. */
export function parseYouTube(input: string): YouTubeInfo | null {
  const raw = input.trim();
  if (!raw) return null;
  let id: string | null = null;
  if (YT_ID.test(raw)) id = raw;
  else {
    try {
      const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
      if (!YT_HOSTS.includes(u.hostname)) return null;
      if (u.hostname === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
      else if (u.pathname === '/watch') id = u.searchParams.get('v');
      else {
        const m = u.pathname.match(/^\/(embed|shorts|live|v)\/([^/?]+)/);
        id = m ? m[2] : null;
      }
    } catch { return null; }
  }
  if (!id || !YT_ID.test(id)) return null;
  return {
    id,
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
    thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    watchUrl: `https://www.youtube.com/watch?v=${id}`,
  };
}
 
export interface DriveInfo { kind: 'folder' | 'file'; id: string; url: string }
const DRIVE_ID = /^[A-Za-z0-9_-]{10,}$/;
 
/** Accepts drive.google.com folder/file share links. Access always depends on Google Drive sharing permissions. */
export function parseDrive(input: string): DriveInfo | null {
  try {
    const u = new URL(input.trim());
    if (u.protocol !== 'https:' || u.hostname !== 'drive.google.com') return null;
    const folder = u.pathname.match(/\/folders\/([^/?]+)/);
    if (folder && DRIVE_ID.test(folder[1])) return { kind: 'folder', id: folder[1], url: u.toString() };
    const file = u.pathname.match(/\/file\/d\/([^/?]+)/);
    if (file && DRIVE_ID.test(file[1])) return { kind: 'file', id: file[1], url: u.toString() };
    const open = u.searchParams.get('id');
    if (u.pathname === '/open' && open && DRIVE_ID.test(open)) return { kind: 'folder', id: open, url: u.toString() };
    return null;
  } catch { return null; }
}
 
export const isHttpUrl = (s: string) => { try { return /^https?:$/.test(new URL(s).protocol); } catch { return false; } };
 
export const DRIVE_NOTICE =
  'Access depends on Google Drive sharing permissions. Set the folder to "Anyone with the link — Viewer" (or share it with the client\'s Google account) — pasting a link here does not grant access by itself.';