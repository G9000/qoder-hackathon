'use client';

import { useEffect, useRef, useState } from 'react';

export default function CopyLink() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setUrl(window.location.href);
  }, []);

  async function copy() {
    const value = url || window.location.href;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      inputRef.current?.select();
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
      <input
        ref={inputRef}
        readOnly
        value={url}
        aria-label="Report link"
        placeholder="Loading link…"
        className="min-w-0 flex-1 rounded-xl border border-ink/15 bg-white px-3 py-2 text-xs text-ink/70 outline-none focus:border-brand"
      />
      <button
        type="button"
        onClick={() => void copy()}
        className="rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white transition hover:opacity-90"
      >
        {copied ? 'Copied' : 'Copy link'}
      </button>
    </div>
  );
}
