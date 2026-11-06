import { Link } from 'react-router-dom';
import { Camera } from 'lucide-react';
 
export default function NotFound() {
  return (
    <div className="grid min-h-[70vh] place-items-center bg-paper px-6 py-20 text-center">
      <div><div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-ink text-[#b08d57]"><Camera className="h-6 w-6" /></div>
        <p className="eyebrow">Error 404</p><h1 className="mt-2 font-serif text-4xl font-semibold">This frame is out of focus</h1>
        <p className="mt-2 text-ink-muted">The page you're looking for doesn't exist or has moved.</p>
        <Link to=".." relative="path" className="mt-6 inline-flex h-10 items-center rounded-lg bg-ink px-5 text-sm font-medium text-white">Go back</Link></div>
    </div>
  );
}