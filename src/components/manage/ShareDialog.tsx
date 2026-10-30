"use client";

import { useRef, useState } from "react";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import { Dialog } from "@/components/ui/Dialog";
import { btn, btnSm, input } from "@/components/ui/styles";

// Share link and QR for one form (SPEC §7: "Share link / QR"). The QR encodes the form's unique code.
export function ShareDialog({
  open,
  onClose,
  code,
  title,
  description,
  status,
}: {
  open: boolean;
  onClose: () => void;
  code: string;
  title: string;
  description: string;
  status: "draft" | "open" | "closed";
}) {
  // Only read in the browser: the dialog renders nothing on the server while closed.
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const svgHost = useRef<HTMLDivElement>(null);
  const canvasHost = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const url = `${origin}/f/${code}`;

  const download = (href: string, filename: string) => {
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    a.click();
  };

  const downloadPng = () => {
    const canvas = canvasHost.current?.querySelector("canvas");
    if (canvas) download(canvas.toDataURL("image/png"), `${code}.png`);
  };

  const downloadSvg = () => {
    const svg = svgHost.current?.querySelector("svg");
    if (!svg) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" });
    download(URL.createObjectURL(blob), `${code}.svg`);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <Dialog open={open} onClose={onClose} title={title} description={description}>
      {status !== "open" && (
        <p className="mb-4 rounded-md bg-warn-soft p-3 text-sm text-warn">
          This form is {status === "draft" ? "a draft" : "closed"}. Set it to Open before sharing, or people will see “not accepting responses”.
        </p>
      )}
      <div className="grid gap-5 sm:grid-cols-[200px_1fr]">
        <div ref={canvasHost} className="rounded-lg bg-white p-3" aria-label="QR code">
          <QRCodeCanvas value={url || code} size={176} level="M" />
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Form link
            <input className={`${input} font-mono text-sm`} readOnly value={url || `/f/${code}`} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnSm} onClick={copy}>
              {copied ? "Copied" : "Copy link"}
            </button>
            <button type="button" className={btnSm} onClick={downloadPng}>
              Download PNG
            </button>
            <button type="button" className={btnSm} onClick={downloadSvg}>
              Download SVG
            </button>
          </div>
          <p className="text-sm text-muted">
            Print the QR on slides or the venue door for check-in. The link opens once the public form route is live (milestone 3).
          </p>
        </div>
      </div>
      {/* Hidden SVG source for the SVG download. */}
      <div ref={svgHost} className="hidden">
        <QRCodeSVG value={url || code} size={512} level="M" />
      </div>
      <div className="mt-4 flex justify-end">
        <button type="button" className={btn} onClick={onClose}>
          Done
        </button>
      </div>
    </Dialog>
  );
}
