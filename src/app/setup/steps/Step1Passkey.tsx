"use client";

import { useEffect, useState } from "react";

function RecoveryCodeView({
  code,
  saved,
  onToggle,
  onContinue,
}: {
  code: string;
  saved: boolean;
  onToggle: (v: boolean) => void;
  onContinue: () => void;
}): JSX.Element {
  return (
    <div className="w-full max-w-sm">
      <h1 className="mb-2 text-2xl font-bold">Save your recovery code</h1>
      <p className="mb-4 text-sm text-gray-500">
        Write this down. Store it somewhere safe. You will not see it again.
      </p>
      <div className="mb-6 rounded-xl bg-gray-100 p-4 text-center font-mono text-xl tracking-widest">
        {code}
      </div>
      <label className="mb-4 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={saved}
          onChange={(e) => onToggle(e.target.checked)}
        />
        I&apos;ve saved my recovery code
      </label>
      <button
        onClick={onContinue}
        disabled={!saved}
        className="w-full rounded-xl bg-black py-4 text-base font-semibold text-white disabled:opacity-40"
      >
        Next
      </button>
    </div>
  );
}

export default function Step1Passkey({
  onNext,
}: {
  onNext: () => void;
}): JSX.Element {
  const [code, setCode] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const c = sessionStorage.getItem("pendingRecoveryCode");
    if (c) setCode(c);
  }, []);

  function handleContinue(): void {
    sessionStorage.removeItem("pendingRecoveryCode");
    onNext();
  }

  if (code) {
    return (
      <RecoveryCodeView
        code={code}
        saved={saved}
        onToggle={setSaved}
        onContinue={handleContinue}
      />
    );
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="mb-2 text-2xl font-bold">Your passkey is enrolled</h1>
      <p className="mb-6 text-sm text-gray-500">
        You&apos;re all set. Let&apos;s connect your bank next.
      </p>
      <button
        onClick={onNext}
        className="w-full rounded-xl bg-black py-4 text-base font-semibold text-white disabled:opacity-40"
      >
        Continue
      </button>
    </div>
  );
}
