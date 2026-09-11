export async function api(path, options = {}) {
  let response;
  const origin = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
  try { response = await fetch(`${origin}/api${path}`, { credentials: 'include', ...options, headers: { 'Content-Type': 'application/json', ...options.headers }, body: options.body ? JSON.stringify(options.body) : undefined }); }
  catch { throw new Error('Unable to reach Nexora. Check your connection and try again.'); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(data.error || 'Something went wrong. Please try again.'); error.status = response.status; throw error; }
  return data;
}
export const money = n => `₹${Number(n).toLocaleString('en-IN')}`;
export const priceLabel = item => item.kind === 'Free' ? 'Free' : item.kind === 'Exchange' ? 'Open to exchange' : money(item.price);
export function timeAgo(time) { const minutes = Math.max(0, Math.floor((Date.now() - time) / 60000)); return minutes < 1 ? 'Just now' : minutes < 60 ? `${minutes}m ago` : minutes < 1440 ? `${Math.floor(minutes / 60)}h ago` : `${Math.floor(minutes / 1440)}d ago`; }
export const initials = name => (name || 'N').split(' ').map(x => x[0]).slice(0,2).join('').toUpperCase();
export const categories = ['Books', 'Electronics', 'Furniture', 'Clothing', 'Sports', 'Hostel essentials'];
export const communities = ['Campus life', 'Academics', 'Meetups', 'Want to buy'];
