// web/app/import/page.tsx
'use client';

import React, { useState } from 'react';

interface Suggestion {
  merchant: string;
  displayName: string;
  averageAmount: number;
  cadence: 'monthly' | 'weekly' | 'unknown';
  lastChargeDate: string;
  sampleTransactions: {
    date: string;
    merchantRaw: string;
    merchant: string;
    amount: number;
    description?: string;
  }[];
}

export default function ImportPage() {
  const [csvText, setCsvText] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [statusMsg, setStatusMsg] = useState('');

  async function handleAnalyze() {
    setLoading(true);
    setStatusMsg('');
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: csvText }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatusMsg(data.error || 'Error analyzing CSV');
        setSuggestions([]);
        setSelected({});
        return;
      }

      setSuggestions(data.suggestions || []);
      // reset selected
      const sel: Record<string, boolean> = {};
      (data.suggestions || []).forEach((s: Suggestion) => {
        sel[s.merchant] = true; // pre-check everything
      });
      setSelected(sel);
    } catch (err: any) {
      console.error(err);
      setStatusMsg('Network or server error.');
    } finally {
      setLoading(false);
    }
  }

  function toggleOne(merchant: string) {
    setSelected((prev) => ({
      ...prev,
      [merchant]: !prev[merchant],
    }));
  }

    function addDays(isoDate: string, days: number): string {
        const d = new Date(isoDate + "T00:00:00Z");
        d.setUTCDate(d.getUTCDate() + days);

        const yyyy = d.getUTCFullYear();
        const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
        const dd = String(d.getUTCDate()).padStart(2, "0");

        return `${yyyy}-${mm}-${dd}`;
    }

    async function handleAddSelected() {
        setLoading(true);
        setStatusMsg('');

        try {
            for (const sug of suggestions) {
            if (!selected[sug.merchant]) continue;

            // Infer next bill ~30 days from last charge
            const estimatedNextBill = addDays(sug.lastChargeDate, 30);

            const newSub = {
                merchant: sug.displayName || sug.merchant,
                amount: sug.averageAmount,
                period: sug.cadence === 'monthly' ? 'monthly' : 'monthly', // future: map 'weekly' differently if you extend Period
                nextBillDate: estimatedNextBill,
                notes: `Imported via CSV on /import. cadence=${sug.cadence}`,
            };

            const res = await fetch('/api/subscriptions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newSub),
            });

            if (!res.ok) {
                const errJson = await res.json().catch(() => ({}));
                console.error('Failed to create sub', newSub, errJson);
            }
            }

            setStatusMsg('Selected subscriptions added ✅');
        } catch (err: any) {
            console.error(err);
            setStatusMsg('Error adding subscriptions.');
        } finally {
            setLoading(false);
        }
    }

  return (
    <main style={{ maxWidth: '900px', margin: '2rem auto', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1rem' }}>
        Import Transactions
      </h1>

      <section
        style={{
          border: '1px solid #444',
          borderRadius: '0.5rem',
          padding: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <label
          htmlFor="csv"
          style={{ display: 'block', fontWeight: 500, marginBottom: '0.5rem' }}
        >
          Paste CSV export (include header row):
        </label>
        <textarea
          id="csv"
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          placeholder={`Date,Description,Amount
            2025-09-14,SPOTIFY *12345,-9.99
            2025-10-14,SPOTIFY *12345,-9.99
            2025-10-03,NETFLIX.COM,-15.49
            `}
          style={{
            width: '100%',
            minHeight: '150px',
            fontFamily: 'monospace',
            fontSize: '0.9rem',
            padding: '0.5rem',
            borderRadius: '0.25rem',
            border: '1px solid #666',
            backgroundColor: '#111',
            color: '#eee',
                }}
                />

        <button
          onClick={handleAnalyze}
          disabled={loading}
          style={{
            marginTop: '1rem',
            backgroundColor: '#2563eb',
            color: 'white',
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            border: 'none',
            fontWeight: 600,
            cursor: 'pointer',
            opacity: loading ? 0.6 : 1,
        }}
        >
          {loading ? 'Analyzing…' : 'Analyze CSV'}
        </button>
      </section>

      {statusMsg && (
        <p style={{ marginBottom: '1rem', color: '#10b981', fontWeight: 500 }}>
          {statusMsg}
        </p>
      )}

      {suggestions.length > 0 && (
        <section
          style={{
            border: '1px solid #444',
            borderRadius: '0.5rem',
            padding: '1rem',
            marginBottom: '2rem',
            backgroundColor: '#1a1a1a',
            color: '#eee',
          }}
        >
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>
            Detected Recurring Charges
          </h2>

          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.9rem',
              }}
            >
              <thead>
                <tr style={{ backgroundColor: '#2a2a2a' }}>
                  <th style={thStyle}></th>
                  <th style={thStyle}>Merchant</th>
                  <th style={thStyle}>Avg $</th>
                  <th style={thStyle}>Cadence</th>
                  <th style={thStyle}>Last Charge</th>
                  <th style={thStyle}>Samples</th>
                </tr>
              </thead>
              <tbody>
                {suggestions.map((sug) => (
                  <tr key={sug.merchant} style={{ borderTop: '1px solid #444' }}>
                    <td style={tdStyleCentered}>
                      <input
                        type="checkbox"
                        checked={!!selected[sug.merchant]}
                        onChange={() => toggleOne(sug.merchant)}
                      />
                    </td>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 600 }}>{sug.displayName}</div>
                      <div style={{ fontSize: '0.75rem', color: '#999' }}>
                        ({sug.merchant})
                      </div>
                    </td>
                    <td style={tdStyle}>${sug.averageAmount.toFixed(2)}</td>
                    <td style={tdStyle}>{sug.cadence}</td>
                    <td style={tdStyle}>{sug.lastChargeDate}</td>
                    <td style={tdStyle}>
                      {sug.sampleTransactions.slice(0, 3).map((t, idx) => (
                        <div key={idx} style={{ marginBottom: '0.25rem' }}>
                          <div>{t.date}</div>
                          <div style={{ fontSize: '0.75rem', color: '#999' }}>
                            ${t.amount.toFixed(2)} – {t.merchantRaw}
                          </div>
                        </div>
                      ))}
                      {sug.sampleTransactions.length > 3 && (
                        <div style={{ fontSize: '0.75rem', color: '#666' }}>
                          +{sug.sampleTransactions.length - 3} more…
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={handleAddSelected}
            disabled={loading}
            style={{
              marginTop: '1rem',
              backgroundColor: '#10b981',
              color: '#000',
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              border: 'none',
              fontWeight: 600,
              cursor: 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Saving…' : 'Add Selected Subscriptions'}
          </button>
        </section>
      )}
    </main>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '0.5rem',
  borderBottom: '1px solid #444',
  whiteSpace: 'nowrap',
  fontWeight: 600,
};

const tdStyle: React.CSSProperties = {
  verticalAlign: 'top',
  padding: '0.5rem',
};

const tdStyleCentered: React.CSSProperties = {
  ...tdStyle,
  textAlign: 'center',
};
